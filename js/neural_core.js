/* js/neural_core.js
 * CPU MLP, Adam, masked action selection, n-step foresight selection, replay, Double DQN,
 * and 49-Matchup Compact Matrix Pool (7v7 Rider-vs-Rider).
 * Build: v5-state256-action17
 */
(function (g) {
  "use strict";

  const BUILD = "v5-state256-action17";
  const K = g.KF;

  // Default compact architecture for 1v1 matchup matrices: 256 -> 64 -> 32 -> 17
  const COMPACT_MATCHUP_SIZES = Object.freeze([256, 64, 32, 17]);
  const GDRIVE_FOLDER_ID = "15P5HeKqLxMYw3ykirJj2HMT726SZnkId";

  function validateSizes(sizes) {
    if (
      !Array.isArray(sizes) ||
      sizes.length < 2 ||
      sizes.length > 6 ||
      sizes.some(n => !Number.isInteger(n) || n < 1 || n > 2048)
    ) {
      throw new Error("Invalid neural layer sizes.");
    }

    let parameters = 0;

    for (let i = 1; i < sizes.length; i++) {
      parameters += sizes[i - 1] * sizes[i] + sizes[i];
    }

    if (parameters > 2000000) {
      throw new Error("Network exceeds the supported parameter limit.");
    }
  }

  function checkOutput(q, mask) {
    if (!q || !q.length || (mask && mask.length !== q.length)) {
      throw new Error("Neural output/mask size mismatch.");
    }

    for (const value of q) {
      if (!Number.isFinite(value)) {
        throw new Error("Non-finite neural output.");
      }
    }
  }

  function argmax(q, mask) {
    checkOutput(q, mask);
    let best = -1;

    for (let i = 0; i < q.length; i++) {
      if (mask && !mask[i]) continue;
      if (best < 0 || q[i] > q[best]) best = i;
    }

    if (best < 0) throw new Error("No legal neural action.");
    return best;
  }

  function randomAction(mask, rng = Math.random) {
    if (!mask) throw new Error("An action mask is required.");

    const legal = [];

    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) legal.push(i);
    }

    if (!legal.length) throw new Error("Empty action mask.");
    return legal[Math.floor(rng() * legal.length)];
  }

  function sampleAction(q, mask, temperature = 0.15, rng = Math.random) {
    const best = argmax(q, mask);
    if (!(temperature > 0.001)) return best;

    const probabilities = new Float64Array(q.length);
    let total = 0;

    for (let i = 0; i < q.length; i++) {
      if (mask && !mask[i]) continue;
      probabilities[i] = Math.exp((q[i] - q[best]) / temperature);
      total += probabilities[i];
    }

    let cursor = rng() * total;

    for (let i = 0; i < probabilities.length; i++) {
      if (!probabilities[i]) continue;
      cursor -= probabilities[i];
      if (cursor <= 0) return i;
    }

    return best;
  }

  /**
   * Selects an action by combining network Q-values with n-move foresight EV planning.
   * - Live Search is STRICTLY OFF when mode === "train"
   * - Live Search is STRICTLY ON when mode === "eval" or "game"
   */
  function selectWithForesight(env, slot, net, mask, options = {}) {
    const mode =
      options.mode ||
      env?.mode ||
      env?.state?.mode ||
      (typeof g.SoulEnv?.getExecutionMode === "function"
        ? g.SoulEnv.getExecutionMode()
        : "game");

    const useLiveSearch =
      typeof g.SoulEnv?.shouldUseLiveSearch === "function"
        ? g.SoulEnv.shouldUseLiveSearch(mode, env)
        : mode !== "train";

    // Skip expensive plan memory rollout during training observations
    const obs = g.SoulEnv.observe(env, slot, !useLiveSearch);
    const inputVec = g.SoulEnv.vector(obs);
    const q = net.predict(inputVec);
    checkOutput(q, mask);

    const adjustedQ = Float32Array.from(q);

    if (useLiveSearch && typeof g.SoulEnv?.foresee === "function") {
      const plan = g.SoulEnv.foresee(env, slot, net, {
        ...options,
        mode
      });
      const plannedIdx = plan?.sequence?.[0] ?? -1;

      if (
        plannedIdx >= 0 &&
        plannedIdx < adjustedQ.length &&
        (!mask || mask[plannedIdx])
      ) {
        const foresightWeight = Number.isFinite(options.foresightWeight)
          ? options.foresightWeight
          : 0.35;
        const bonus = K.clamp(Number(plan.targetEv || 0), -2, 2) * foresightWeight;
        adjustedQ[plannedIdx] += bonus;
      }
    }

    if (options.temperature && options.temperature > 0.001) {
      return sampleAction(adjustedQ, mask, options.temperature, options.rng);
    }

    return argmax(adjustedQ, mask);
  }

  function validateJSON(json) {
    validateSizes(json?.sizes);

    if (
      !Array.isArray(json.layers) ||
      json.layers.length !== json.sizes.length - 1
    ) {
      throw new Error("Invalid neural checkpoint layer count.");
    }

    json.layers.forEach((layer, index) => {
      const lengths = {
        w: json.sizes[index] * json.sizes[index + 1],
        b: json.sizes[index + 1]
      };

      for (const field of ["w", "b"]) {
        if (
          !Array.isArray(layer?.[field]) ||
          layer[field].length !== lengths[field] ||
          layer[field].some(value =>
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            !Number.isFinite(Math.fround(value))
          )
        ) {
          throw new Error(
            `Invalid neural parameters: layer ${index}, field ${field}.`
          );
        }
      }
    });

    return true;
  }

  class Network {
    constructor(...sizes) {
      if (sizes.length === 1 && Array.isArray(sizes[0])) {
        sizes = sizes[0];
      }

      validateSizes(sizes);

      this.sizes = [...sizes];
      this.layers = [];
      this.adamStep = 0;

      const rng = K.rng(1);

      for (let i = 0; i < sizes.length - 1; i++) {
        const n = sizes[i];
        const m = sizes[i + 1];
        const bound = Math.sqrt(6 / n);

        const w = Float32Array.from(
          { length: n * m },
          () => (rng() * 2 - 1) * bound
        );

        this.layers.push({
          n, m, w,
          b: new Float32Array(m),
          mw: new Float32Array(w.length),
          vw: new Float32Array(w.length),
          mb: new Float32Array(m),
          vb: new Float32Array(m)
        });
      }
    }

    forward(input) {
      if (
        !input ||
        input.length !== this.sizes[0] ||
        Array.from(input).some(value => !Number.isFinite(value))
      ) {
        throw new Error("Invalid neural input.");
      }

      const tape = [input];

      for (let index = 0; index < this.layers.length; index++) {
        const layer = this.layers[index];
        const previous = tape[index];
        const next = new Float32Array(layer.m);
        const hidden = index < this.layers.length - 1;

        for (let j = 0; j < layer.m; j++) {
          let value = layer.b[j];
          const offset = j * layer.n;

          for (let i = 0; i < layer.n; i++) {
            value += layer.w[offset + i] * previous[i];
          }

          next[j] = hidden ? Math.max(0, value) : value;

          if (!Number.isFinite(next[j])) {
            throw new Error("Neural forward pass diverged.");
          }
        }

        tape.push(next);
      }

      return tape;
    }

    predict(input) {
      const tape = this.forward(input);
      return tape[tape.length - 1];
    }

    toJSON() {
      return {
        sizes: [...this.sizes],
        layers: this.layers.map(layer => ({
          w: Array.from(layer.w),
          b: Array.from(layer.b)
        }))
      };
    }

    static fromJSON(json) {
      validateJSON(json);
      const net = new Network(json.sizes);

      json.layers.forEach((source, index) => {
        net.layers[index].w.set(source.w);
        net.layers[index].b.set(source.b);
      });

      return net;
    }

    clone() {
      return Network.fromJSON(this.toJSON());
    }

    train(rows, learningRate = 0.0001, imitation = 0) {
      if (!rows.length) return 0;

      const outputSize = this.sizes[this.sizes.length - 1];

      const gradients = this.layers.map(layer => ({
        w: new Float64Array(layer.w.length),
        b: new Float64Array(layer.b.length)
      }));

      let loss = 0;

      for (const row of rows) {
        if (
          !Number.isInteger(row.a) ||
          row.a < 0 ||
          row.a >= outputSize ||
          !Number.isFinite(row.y) ||
          (row.m && (!row.m[row.a] || row.m.length !== outputSize))
        ) {
          throw new Error("Invalid training row.");
        }

        const weight = row.weightScale ?? 1;

        if (!Number.isFinite(weight) || weight < 0) {
          throw new Error("Invalid training weight.");
        }

        const tape = this.forward(row.s);
        const q = tape[tape.length - 1];
        let delta = new Float64Array(outputSize);

        const error = q[row.a] - row.y;
        const absolute = Math.abs(error);

        loss += weight * (
          absolute <= 1 ? 0.5 * error * error : absolute - 0.5
        );

        delta[row.a] = weight * K.clamp(error, -1, 1);

        if (row.demo && imitation > 0) {
          const best = argmax(q, row.m);
          const probabilities = new Float64Array(outputSize);
          let total = 0;

          for (let a = 0; a < outputSize; a++) {
            if (row.m && !row.m[a]) continue;
            probabilities[a] = Math.exp(q[a] - q[best]);
            total += probabilities[a];
          }

          for (let a = 0; a < outputSize; a++) {
            if (row.m && !row.m[a]) continue;

            const probability = probabilities[a] / total;

            delta[a] += imitation * (
              probability - Number(a === row.a)
            );
          }

          loss += imitation * (
            Math.log(total) + q[best] - q[row.a]
          );
        }

        for (let l = this.layers.length - 1; l >= 0; l--) {
          const layer = this.layers[l];
          const previous = tape[l];
          const grad = gradients[l];
          const back = l > 0 ? new Float64Array(layer.n) : null;

          for (let j = 0; j < layer.m; j++) {
            const d = delta[j];
            const offset = j * layer.n;
            grad.b[j] += d;

            for (let i = 0; i < layer.n; i++) {
              grad.w[offset + i] += d * previous[i];

              if (back) {
                back[i] += layer.w[offset + i] * d;
              }
            }
          }

          if (back) {
            for (let i = 0; i < back.length; i++) {
              if (previous[i] <= 0) back[i] = 0;
            }

            delta = back;
          }
        }
      }

      let normSquared = 0;

      for (const gradient of gradients) {
        for (const field of ["w", "b"]) {
          for (const value of gradient[field]) {
            normSquared += (value / rows.length) ** 2;
          }
        }
      }

      if (!Number.isFinite(normSquared)) {
        throw new Error("Non-finite neural gradient.");
      }

      const scale =
        Math.min(1, 5 / (Math.sqrt(normSquared) || 1)) / rows.length;

      this.adamStep++;

      const correction1 = 1 - Math.pow(0.9, this.adamStep);
      const correction2 = 1 - Math.pow(0.999, this.adamStep);

      this.layers.forEach((layer, index) => {
        for (const field of ["w", "b"]) {
          const parameters = layer[field];
          const first = layer["m" + field];
          const second = layer["v" + field];
          const gradient = gradients[index][field];

          for (let i = 0; i < parameters.length; i++) {
            const d = gradient[i] * scale;

            first[i] = 0.9 * first[i] + 0.1 * d;
            second[i] = 0.999 * second[i] + 0.001 * d * d;

            parameters[i] -= learningRate *
              (first[i] / correction1) /
              (Math.sqrt(second[i] / correction2) + 1e-8);

            if (!Number.isFinite(parameters[i])) {
              throw new Error("Neural parameter diverged.");
            }
          }
        }
      });

      return loss / rows.length;
    }
  }

  class Replay {
    constructor(capacity = 50000) {
      this.capacity = capacity;
      this.items = [];
      this.cursor = 0;
    }

    add(item) {
      if (this.items.length < this.capacity) {
        this.items.push(item);
      } else {
        this.items[this.cursor] = item;
      }

      this.cursor = (this.cursor + 1) % this.capacity;
    }

    sample(count, rng = Math.random) {
      if (!this.items.length) throw new Error("Replay is empty.");

      return Array.from(
        { length: count },
        () => this.items[Math.floor(rng() * this.items.length)]
      );
    }
  }

  class Learner {
    constructor(net, seed = 1, previousSteps = 0, options = {}) {
      this.net = net;
      this.target = net.clone();
      this.rng = K.rng(seed);
      this.replay = new Replay(options.capacity || 50000);
      this.steps = previousSteps;
      this.updates = 0;
      this.loss = 0;

      this.matchupKey = options.matchupKey || null;
      this.mode = options.mode || "train";

      this.gamma = g.SoulEnv.GAMMA;
      this.batchSize = options.batchSize || 32;
      this.warmup = options.warmup || 256;
      this.interval = options.interval || 32;

      // Multi-step foresight lookahead buffer (default n = 3 turns)
      this.nStep = Math.max(
        1,
        Math.min(6, Number(options.nStep ?? g.SoulEnv?.getForesightConfig?.()?.horizon ?? 3))
      );
      this.nStepQueue = [];

      this.updateStats = {
        win: 0, damage: 0, loss: 0, neutral: 0
      };
    }

    setMode(mode = "train") {
      this.mode = mode === "train" || mode === "eval" || mode === "game"
        ? mode
        : "game";
      return this.mode;
    }

    selectAction(env, slot, mask, options = {}) {
      const activeMode = options.mode || this.mode || "game";
      return selectWithForesight(env, slot, this.net, mask, {
        ...options,
        mode: activeMode
      });
    }

    softUpdateTarget(tau = 0.005) {
      for (let l = 0; l < this.net.layers.length; l++) {
        for (const field of ["w", "b"]) {
          const online = this.net.layers[l][field];
          const target = this.target.layers[l][field];

          for (let i = 0; i < online.length; i++) {
            target[i] = tau * online[i] + (1 - tau) * target[i];
          }
        }
      }
    }

    _commitNStepFromHead() {
      if (!this.nStepQueue.length) return;

      const head = this.nStepQueue.shift();
      let nStepReward = head.r;
      let cumulativeDiscount = head.discount;
      let finalS1 = head.s1;
      let finalM1 = head.m1;

      for (let i = 0; i < this.nStepQueue.length; i++) {
        if (cumulativeDiscount === 0) break;
        const stepItem = this.nStepQueue[i];
        nStepReward += cumulativeDiscount * stepItem.r;
        cumulativeDiscount *= stepItem.discount;
        finalS1 = stepItem.s1;
        finalM1 = stepItem.m1;
        if (stepItem.done) break;
      }

      // Boost replay priority weight when a multi-step sequence achieves high foreseen EV
      let weightScale = head.weightScale ?? 1;
      if (nStepReward - head.r > 0.35) {
        weightScale = Math.min(2.5, weightScale * 1.25);
      }

      this.replay.add({
        ...head,
        nStepR: nStepReward,
        nStepDiscount: cumulativeDiscount,
        nStepS1: finalS1,
        nStepM1: finalM1,
        weightScale
      });
    }

    accept(transition, imitation = 0.03) {
      const discount = transition.done
        ? 0
        : transition.discount ?? this.gamma;

      if (
        !Number.isFinite(transition.r) ||
        !Number.isFinite(discount) ||
        discount < 0 ||
        discount > 1 ||
        !transition.m?.[transition.a]
      ) {
        throw new Error("Invalid replay transition.");
      }

      /*
       * Combat replay must identify the action that actually executed.
       * Generic Network.train() remains usable for ordinary test rows;
       * this guard protects the combat replay ingestion path.
       */
      const actionKey =
        g.SoulEnv.ACTION_MAP[transition.a];

      const selectedCharge = transition.selectedCharge;

      const validCharge = actionKey === "DO_NOTHING"
        ? selectedCharge === 0
        : (
            Number.isFinite(selectedCharge) &&
            selectedCharge >= 1 &&
            selectedCharge <= 100
          );

      if (
        !actionKey ||
        !validCharge ||
        transition.actionKey !== actionKey ||
        transition.selectedActionKey !== actionKey ||
        transition.resolvedActionKey !== actionKey ||
        transition.charge !== selectedCharge ||
        transition.resolvedCharge !== selectedCharge ||
        transition.coreAdjustedAction === true
      ) {
        throw new Error(
          "Replay action/charge mismatch. " +
          "Non-idle replay moves must execute at 1–100% charge."
        );
      }

      this.steps++;

      const enriched = {
        ...transition,
        discount,
        weightScale: transition.weightScale ?? 1
      };

      this.nStepQueue.push(enriched);

      if (transition.done) {
        while (this.nStepQueue.length > 0) {
          this._commitNStepFromHead();
        }
      } else if (this.nStepQueue.length >= this.nStep) {
        this._commitNStepFromHead();
      }

      if (
        this.steps % this.interval !== 0 ||
        this.replay.items.length < this.warmup
      ) {
        return;
      }

      const rows = this.replay.sample(this.batchSize, this.rng).map(t => {
        // 1-step Double DQN target
        let target1 = t.r;
        if (t.discount > 0 && t.m1 && t.m1.some(Boolean)) {
          const nextAction1 = argmax(this.net.predict(t.s1), t.m1);
          target1 += t.discount * this.target.predict(t.s1)[nextAction1];
        }

        // n-step Double DQN foresight target
        let targetN = t.nStepR ?? t.r;
        const discN = t.nStepDiscount ?? t.discount;
        const s1N = t.nStepS1 ?? t.s1;
        const m1N = t.nStepM1 ?? t.m1;

        if (discN > 0 && s1N && m1N && m1N.some(Boolean)) {
          const nextActionN = argmax(this.net.predict(s1N), m1N);
          targetN += discN * this.target.predict(s1N)[nextActionN];
        }

        // Blend 1-step stability (40%) with n-step foresight destination EV (60%)
        const blendedTarget = 0.40 * target1 + 0.60 * targetN;
        const target = K.clamp(blendedTarget, -5, 5);

        const category = t.rewardCategory || "Neu";
        const key = category === "Win"
          ? "win"
          : category === "Dmg"
            ? "damage"
            : category === "Loss"
              ? "loss"
              : "neutral";

        this.updateStats[key]++;

        return {
          s: t.s,
          a: t.a,
          m: t.m,
          demo: t.demo,
          y: target,
          weightScale: t.weightScale
        };
      });

      this.loss = this.net.train(rows, 0.0001, imitation);
      this.updates++;
      this.softUpdateTarget();
    }

    toJSON() {
      return {
        build: BUILD,
        schema: g.SoulEnv?.SCHEMA,
        matchupKey: this.matchupKey,
        steps: this.steps,
        updates: this.updates,
        loss: this.loss,
        updateStats: { ...this.updateStats },
        net: this.net.toJSON()
      };
    }

    static fromJSON(payload, seed = 1, options = {}) {
      const netJson = payload?.net || payload;
      const net = Network.fromJSON(netJson);
      const steps = Number(payload?.steps) || 0;
      const learner = new Learner(net, seed, steps, {
        ...options,
        matchupKey: payload?.matchupKey || options.matchupKey || null
      });
      learner.updates = Number(payload?.updates) || 0;
      learner.loss = Number(payload?.loss) || 0;
      if (payload?.updateStats && typeof payload.updateStats === "object") {
        learner.updateStats = {
          win: Number(payload.updateStats.win) || 0,
          damage: Number(payload.updateStats.damage) || 0,
          loss: Number(payload.updateStats.loss) || 0,
          neutral: Number(payload.updateStats.neutral) || 0
        };
      }
      return learner;
    }
  }

  /**
   * 49-Matchup Compact Matrix Pool (7 Riders vs 7 Riders)
   * Stores and syncs individual 1v1 matrices (`matrix_rA_vs_rB.json`)
   * with Google Drive Folder 15P5HeKqLxMYw3ykirJj2HMT726SZnkId.
   */
  class MatchupMatrixPool {
    constructor(options = {}) {
      this.sizes = Array.isArray(options.sizes)
        ? [...options.sizes]
        : [...COMPACT_MATCHUP_SIZES];
      validateSizes(this.sizes);

      this.numRiders = Number(options.numRiders) || 7;
      this.capacityPerMatchup = Number(options.capacityPerMatchup) || 8192;
      this.folderId = options.folderId || GDRIVE_FOLDER_ID;
      this.learners = new Map();
    }

    static normalizeRiderIndex(rider) {
      if (typeof rider === "number" && Number.isInteger(rider)) {
        return Math.max(0, Math.min(6, rider));
      }
      const str = String(rider || "").trim().toLowerCase();
      const match = str.match(/(\d+)/);
      if (match) {
        return Math.max(0, Math.min(6, Number(match[1])));
      }
      return 0;
    }

    static getKey(riderA, riderB) {
      const a = MatchupMatrixPool.normalizeRiderIndex(riderA);
      const b = MatchupMatrixPool.normalizeRiderIndex(riderB);
      return `r${a}_vs_r${b}`;
    }

    static getFileName(riderA, riderB) {
      return `matrix_${MatchupMatrixPool.getKey(riderA, riderB)}.json`;
    }

    getOrCreateSync(riderA, riderB, mode = "train", seed = 1) {
      const key = MatchupMatrixPool.getKey(riderA, riderB);
      let learner = this.learners.get(key);

      if (!learner) {
        const net = new Network(this.sizes);
        learner = new Learner(net, seed, 0, {
          matchupKey: key,
          mode,
          capacity: this.capacityPerMatchup
        });
        this.learners.set(key, learner);
      }

      learner.setMode(mode);
      return learner;
    }

    async getMatchupLearner(riderA, riderB, mode = "game", seed = 1) {
      const key = MatchupMatrixPool.getKey(riderA, riderB);
      if (this.learners.has(key)) {
        const existing = this.learners.get(key);
        existing.setMode(mode);
        return existing;
      }

      const storage = g.MatrixStorage || g.matrixStorage || null;
      if (storage && typeof storage.loadMatchupMatrix === "function") {
        try {
          const a = MatchupMatrixPool.normalizeRiderIndex(riderA);
          const b = MatchupMatrixPool.normalizeRiderIndex(riderB);
          const loaded = await storage.loadMatchupMatrix(a, b);
          if (loaded) {
            const learner = Learner.fromJSON(loaded, seed, {
              matchupKey: key,
              mode,
              capacity: this.capacityPerMatchup
            });
            this.learners.set(key, learner);
            return learner;
          }
        } catch (_) {
          // Fallback to fresh compact matrix if remote/local file not yet created
        }
      }

      return this.getOrCreateSync(riderA, riderB, mode, seed);
    }

    async saveMatchup(riderA, riderB) {
      const a = MatchupMatrixPool.normalizeRiderIndex(riderA);
      const b = MatchupMatrixPool.normalizeRiderIndex(riderB);
      const key = MatchupMatrixPool.getKey(a, b);
      const learner = this.learners.get(key);
      if (!learner) return null;

      const payload = learner.toJSON();
      const storage = g.MatrixStorage || g.matrixStorage || null;
      if (storage && typeof storage.saveMatchupMatrix === "function") {
        return await storage.saveMatchupMatrix(a, b, payload);
      }
      return payload;
    }

    async saveAllActiveToGoogleDrive() {
      const results = [];
      for (let rA = 0; rA < this.numRiders; rA++) {
        for (let rB = 0; rB < this.numRiders; rB++) {
          const key = MatchupMatrixPool.getKey(rA, rB);
          if (this.learners.has(key)) {
            const res = await this.saveMatchup(rA, rB);
            results.push({ key, saved: Boolean(res) });
          }
        }
      }
      return results;
    }
  }

  function getStanceGroups(actionIndex, outputSize = 17) {
    const stance = actionIndex < 16 ? Math.floor(actionIndex / 4) : -1;
    const sameStance = [];
    const otherStances = [];

    for (let i = 0; i < outputSize; i++) {
      if (i === actionIndex) continue;

      const candidateStance = i < 16 ? Math.floor(i / 4) : -1;

      if (candidateStance === stance) sameStance.push(i);
      else otherStances.push(i);
    }

    return { sameStance, otherStances };
  }

  g.SoulNN = {
    BUILD,
    COMPACT_MATCHUP_SIZES,
    GDRIVE_FOLDER_ID,
    Network,
    Learner,
    Replay,
    MatchupMatrixPool,
    validateJSON,
    argmax,
    randomAction,
    sampleAction,
    selectWithForesight,
    getStanceGroups
  };
})(globalThis);
