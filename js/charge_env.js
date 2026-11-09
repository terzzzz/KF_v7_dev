/* js/charge_env.js
 * Combat observations, orthogonal CHI, tactical flags, n-step EV foresight plan memory,
 * action mapping, and optional charge controls.
 * Build: v5-state256-action17
 *
 * Input layout (256 floats total):
 *   0..63    Two recent completed turns (t-2, t-1), two fighters, 16 move categories (64).
 *   64..80   Self Orthogonal CHI one-hot (0..16 = 17 values).
 *   81..97   Enemy Orthogonal CHI one-hot (0..16 = 17 values).
 *   98..101  Self 4 CHI tactical flags: [chiTooLow(<5), chiHighBoost(>14), canDebuff, canBuff].
 *   102..105 Enemy 4 CHI tactical flags: [chiTooLow(<5), chiHighBoost(>14), canDebuff, canBuff].
 *   106..107 Low-weight Relative Advantage Deltas: [0.20 * lpDiff, 0.20 * chiDiff].
 *   108..127 Persistent n-Move Foresight Plan Memory (20 values):
 *              108..124 Planned next action orthogonal one-hot (17 values, 0..16)
 *              125      Planned action currently legal & affordable flag (0 or 1)
 *              126      Remaining plan horizon ratio (stepsLeft / horizon)
 *              127      Foreseen destination EV (scaled to [-0.35, +0.35])
 *   128..131 Opponent W/A/S/D rolling frequencies (last 6 turns).
 *   132..135 Self/enemy LP and CHI ratios.
 *   136..253 Two fighter feature blocks, 59 values each.
 *   254..255 Round progress and remaining-round fraction.
 */
(function (g) {
  "use strict";

  const BUILD = "v5-state256-action17";
  const SCHEMA = "kf-state256-action17-v2-charge1-reset1";

  const C = g.CombatCore;
  const K = g.KF;

  const GAMMA = 0.95;
  const STEP = C.CHARGE_STEP_MS;

  const CHI_MAX_ORTHOGONAL = 16;
  const CHI_BINS = 17; // 0..16 inclusive
  const LOW_CHI_THRESHOLD = 5;   // startChi < 5 penalty in combat_core
  const HIGH_CHI_THRESHOLD = 14; // startChi > 14 bonus in combat_core
  const ADVANTAGE_DELTA_WEIGHT = 0.20; // Low weighting for relative advantage deltas

  const SLOTS = ["p1", "p2"];
  const DIRS = ["W", "A", "S", "D"];
  const BUTTONS = ["I", "J", "K", "L"];

  const ACTION_MAP = Object.freeze([
    "W+J", "W+K", "W+I", "W+L",
    "A+J", "A+K", "A+I", "A+L",
    "S+J", "S+K", "S+I", "S+L",
    "D+J", "D+K", "D+I", "D+L",
    "DO_NOTHING"
  ]);

  const STATUS_IDS = Object.freeze([
    "typhoon_speed",
    "charge_speed",
    "focus",
    "v3_focus",
    "red_shutter",
    "power_focus",
    "double_typhoon_speed",
    "red_lamp_boost",
    "accuracy_focus",
    "arm_calibration",
    "rope_bind",
    "mercury_atk",
    "mercury_def",
    "airborne_evasion",
    "inca_blessing",
    "gigi_focus",
    "bleeding",
    "lprecover",
    "lpRecovery",
    "airborne_boost"
  ]);

  const DEBUFF_STATUS_SET = new Set([
    "rope_bind",
    "bleeding"
  ]);

  const BUFF_STATUS_SET = new Set(
    STATUS_IDS.filter(id => !DEBUFF_STATUS_SET.has(id))
  );

  const IDLE_INDEX = 16;

  // Adjustable n-step foresight configuration
  const foresightConfig = {
    enabled: true,
    horizon: 3,           // Default n = 3 moves lookahead
    beamWidth: 4,         // Top K candidate branches expanded per ply
    commitmentBonus: 0.28,// Hysteresis bonus for following last turn's high-EV plan
    minEvThreshold: 0.05  // Minimum EV required to commit a multi-turn plan
  };

  // WeakMap keeps multi-turn plan state bound to combat state objects
  const planMemoryMap = new WeakMap();

  const idle = () => ({
    key: "DO_NOTHING",
    charge: 0
  });

  function number(value, fallback = 0) {
    return Number.isFinite(Number(value))
      ? Number(value)
      : fallback;
  }

  function limit() {
    return C.decisionLimitMs();
  }

  function setForesightConfig(options = {}) {
    if (!options || typeof options !== "object") {
      return { ...foresightConfig };
    }
    if (typeof options.enabled === "boolean") {
      foresightConfig.enabled = options.enabled;
    }
    if (Number.isFinite(Number(options.horizon))) {
      foresightConfig.horizon = Math.max(
        1,
        Math.min(6, Math.round(Number(options.horizon)))
      );
    }
    if (Number.isFinite(Number(options.beamWidth))) {
      foresightConfig.beamWidth = Math.max(
        2,
        Math.min(8, Math.round(Number(options.beamWidth)))
      );
    }
    if (Number.isFinite(Number(options.commitmentBonus))) {
      foresightConfig.commitmentBonus = K.clamp(
        Number(options.commitmentBonus),
        0,
        1
      );
    }
    if (Number.isFinite(Number(options.minEvThreshold))) {
      foresightConfig.minEvThreshold = Number(options.minEvThreshold);
    }
    return { ...foresightConfig };
  }

  function getForesightConfig() {
    return { ...foresightConfig };
  }

  function makeSpec() {
    return {
      schema: SCHEMA,
      input: 256,
      hidden: [128, 64],
      output: ACTION_MAP.length,
      actions: [...ACTION_MAP],
      statusIds: [...STATUS_IDS]
    };
  }

  function assertSpec(spec) {
    if (
      spec?.schema !== SCHEMA ||
      spec.input !== 256 ||
      spec.output !== ACTION_MAP.length ||
      JSON.stringify(spec.actions) !== JSON.stringify(ACTION_MAP) ||
      JSON.stringify(spec.statusIds) !== JSON.stringify(STATUS_IDS)
    ) {
      throw new Error(
        "Incompatible observation/action/rules schema. " +
        "This build requires a 256-input, 17-action checkpoint " +
        "trained with positive move charges and direction-reset charging."
      );
    }

    return spec;
  }

  function getActionIndexByKey(key) {
    return ACTION_MAP.indexOf(key);
  }

  /* ------------------------------------------------------------------
   * Orthogonal CHI & Tactical Buff/Debuff Affordance Helpers
   * ------------------------------------------------------------------ */

  function orthogonalChiVector(chiValue) {
    const clamped = Math.round(
      K.clamp(number(chiValue, 0), 0, CHI_MAX_ORTHOGONAL)
    );
    const vec = new Array(CHI_BINS).fill(0);
    vec[clamped] = 1;
    return vec;
  }

  function activeStatusIdSet(player) {
    const active = new Set();
    for (const buff of player?.activeBuffs || []) {
      if (number(buff?.roundsLeft, 0) > 0 && buff?.id) {
        active.add(buff.id);
      }
    }
    return active;
  }

  function moveChiCost(move) {
    if (!move || typeof move !== "object") return 0;
    const explicit = number(
      move.chiCost ?? move.cost ?? move.chiRequired ?? move.reqChi,
      NaN
    );
    if (Number.isFinite(explicit)) return Math.max(0, explicit);

    const delta = number(move.chiDelta ?? move.chi, 0);
    return delta < 0 ? Math.abs(delta) : 0;
  }

  function classifyMoveTacticalRole(key, move) {
    if (!move || typeof move !== "object" || key === "DO_NOTHING") {
      return { isBuff: false, isDebuff: false, statusId: null };
    }

    const statusId =
      move.statusId ||
      move.buffId ||
      move.debuffId ||
      move.buff?.id ||
      move.debuff?.id ||
      move.effects?.statusId ||
      null;

    const effects = move.effects || move.buff?.effects || {};
    const target = String(move.target || move.buff?.target || "").toLowerCase();
    const kind = String(move.type || move.category || move.kind || "").toLowerCase();

    const hasDebuffEffect =
      Boolean(move.isDebuff || move.debuff) ||
      kind.includes("debuff") ||
      kind.includes("bind") ||
      kind.includes("bleed") ||
      (statusId && DEBUFF_STATUS_SET.has(statusId)) ||
      number(move.lpBleed ?? effects.lpBleed, 0) > 0 ||
      number(move.faintDamage ?? move.faint ?? effects.faint, 0) >= 25 ||
      (target === "enemy" && (
        number(effects.attack, 1) < 1 ||
        number(effects.armor, 1) < 1 ||
        number(effects.speed, 1) < 1 ||
        number(effects.evasion, 0) < 0
      ));

    const hasBuffEffect =
      Boolean(
        move.isBuff ||
        move.buff ||
        move.enableSpecials ||
        effects.enableSpecials
      ) ||
      kind.includes("buff") ||
      kind.includes("stance") ||
      kind.includes("focus") ||
      move.direction === "W" ||
      (statusId && BUFF_STATUS_SET.has(statusId)) ||
      number(move.lpRegen ?? effects.lpRegen, 0) > 0 ||
      (target !== "enemy" && (
        number(effects.attack, 1) > 1 ||
        number(effects.dAttack, 1) > 1 ||
        number(effects.sAttack, 1) > 1 ||
        number(effects.armor, 1) > 1 ||
        number(effects.speed, 1) > 1 ||
        number(effects.accuracy, 0) > 0 ||
        number(effects.evasion, 0) > 0
      ));

    return {
      isBuff: hasBuffEffect && !hasDebuffEffect,
      isDebuff: hasDebuffEffect,
      statusId
    };
  }

  function isMoveAffordableAndLegal(state, slot, key, move) {
    const player = state?.[slot];
    if (!player || !move) return false;

    const cost = moveChiCost(move);
    if (number(player.chi, 0) < cost) return false;

    if (state?.moves?.[slot]?.[key] && typeof C?.isLegal === "function") {
      const maxChg = typeof C.maxCharge === "function"
        ? C.maxCharge(player, move.direction)
        : 100;
      if (maxChg < 1) return false;
      return Boolean(C.isLegal(state, slot, { key, charge: maxChg }));
    }

    return true;
  }

  function computeFighterChiFlags(state, slot) {
    const enemySlot = typeof C?.other === "function"
      ? C.other(slot)
      : (slot === "p1" ? "p2" : "p1");

    const player = state?.[slot] || {};
    const enemy = state?.[enemySlot] || {};
    const chi = number(player.chi, 0);

    const chiTooLow = Number(chi < LOW_CHI_THRESHOLD);
    const chiHighBoost = Number(chi > HIGH_CHI_THRESHOLD);

    const selfStatuses = activeStatusIdSet(player);
    const enemyStatuses = activeStatusIdSet(enemy);
    const slotMoves = state?.moves?.[slot] || null;

    let canDebuff = 0;
    let canBuff = 0;

    if (slotMoves && typeof slotMoves === "object") {
      for (const key of ACTION_MAP) {
        if (key === "DO_NOTHING") continue;
        const move = slotMoves[key];
        if (!move) continue;

        const role = classifyMoveTacticalRole(key, move);
        if (!role.isBuff && !role.isDebuff) continue;

        if (!isMoveAffordableAndLegal(state, slot, key, move)) {
          continue;
        }

        if (role.isDebuff) {
          const alreadyOnEnemy =
            role.statusId && enemyStatuses.has(role.statusId);
          if (!alreadyOnEnemy) {
            canDebuff = 1;
          }
        }

        if (role.isBuff) {
          const alreadyOnSelf =
            role.statusId && selfStatuses.has(role.statusId);
          if (!alreadyOnSelf) {
            canBuff = 1;
          }
        }

        if (canDebuff && canBuff) break;
      }
    } else {
      // Fallback when synthetic observation has no attached move table
      canDebuff = Number(chi >= LOW_CHI_THRESHOLD && enemyStatuses.size === 0);
      canBuff = Number(chi >= LOW_CHI_THRESHOLD && selfStatuses.size === 0);
    }

    return [chiTooLow, chiHighBoost, canDebuff, canBuff];
  }

  /* ------------------------------------------------------------------
   * Persistent n-Move EV Foresight Planner & Plan Memory
   * ------------------------------------------------------------------ */

  function getStatePlanStore(state) {
    if (!state || typeof state !== "object") {
      return { p1: null, p2: null };
    }
    let store = planMemoryMap.get(state);
    if (!store) {
      store = { p1: null, p2: null };
      planMemoryMap.set(state, store);
    }
    if (number(state.round, 1) <= 1 && (!state.history || state.history.length === 0)) {
      store.p1 = null;
      store.p2 = null;
    }
    return store;
  }

  function clearPlanMemory(state, slot = null) {
    const store = getStatePlanStore(state);
    if (slot) {
      store[slot] = null;
    } else {
      store.p1 = null;
      store.p2 = null;
    }
  }

  function estimateMoveImmediateEv(simSelf, simEnemy, key, move) {
    if (key === "DO_NOTHING" || !move) {
      // Idle/Charge gains small value only if CHI-starved
      return simSelf.chi < LOW_CHI_THRESHOLD ? 0.12 : -0.15;
    }

    const cost = moveChiCost(move);
    if (simSelf.chi < cost) return -1.0;

    const selfMods = C.modifiers(simSelf, simSelf.chi);
    const enemyMods = C.modifiers(simEnemy, simEnemy.chi);
    const role = classifyMoveTacticalRole(key, move);

    const maxLp = Math.max(1, number(simEnemy.maxLp, 2500));
    const baseDmg = number(
      move.damage ?? move.power ?? move.baseDamage,
      move.direction === "S" ? 360 : move.direction === "D" ? 240 : move.direction === "A" ? 150 : 60
    );

    const dirMult = move.direction === "S"
      ? selfMods.sAttack
      : move.direction === "D"
        ? selfMods.dAttack
        : 1;

    const effectiveDmg =
      (baseDmg * selfMods.attack * dirMult) /
      Math.max(0.35, enemyMods.armor);

    const hitProb = K.clamp(
      0.82 + (selfMods.accuracy / 100) - enemyMods.evasion * 0.5,
      0.20,
      0.98
    );

    let ev = (effectiveDmg * hitProb) / maxLp;

    // Lethal finisher bonus
    if (effectiveDmg * hitProb >= simEnemy.lp) {
      ev += 1.25;
    }

    // Tactical Buff evaluation
    if (role.isBuff) {
      const alreadyBuffed = (simSelf.activeBuffs || []).some(
        b => b.roundsLeft > 0 && (!role.statusId || b.id === role.statusId)
      );
      if (alreadyBuffed) {
        ev -= 0.45; // Avoid redundant buff spam
      } else {
        const hpFactor = K.clamp(simSelf.lp / Math.max(1, simSelf.maxLp), 0.2, 1.0);
        ev += 0.42 * hpFactor;
      }
    }

    // Tactical Debuff evaluation
    if (role.isDebuff) {
      const alreadyDebuffed = (simEnemy.activeBuffs || []).some(
        b => b.roundsLeft > 0 && (!role.statusId || b.id === role.statusId)
      );
      if (alreadyDebuffed) {
        ev -= 0.40;
      } else {
        ev += 0.38;
      }
    }

    // Guard / Counter stance value when enemy has high CHI
    if (move.direction === "A" && simEnemy.chi > HIGH_CHI_THRESHOLD) {
      ev += 0.22;
    }

    // Penalize dropping self into < 5 Low CHI penalty zone unless lethal or buffing
    const nextChi = K.clamp(
      simSelf.chi - cost + number(move.chiGain ?? (cost === 0 ? 2 : 0), 0),
      0,
      CHI_MAX_ORTHOGONAL
    );
    if (simSelf.chi >= LOW_CHI_THRESHOLD && nextChi < LOW_CHI_THRESHOLD && ev < 0.85) {
      ev -= 0.20;
    }
    // Reward reaching > 14 High CHI surge zone
    if (simSelf.chi <= HIGH_CHI_THRESHOLD && nextChi > HIGH_CHI_THRESHOLD) {
      ev += 0.18;
    }

    return ev;
  }

  function projectSimulatedPair(simSelf, simEnemy, key, move) {
    const cost = moveChiCost(move);
    const chiGain = key === "DO_NOTHING"
      ? 2
      : number(move?.chiGain, cost === 0 ? 2 : 0);

    const nextSelfChi = K.clamp(
      simSelf.chi - cost + chiGain,
      0,
      CHI_MAX_ORTHOGONAL
    );

    const role = classifyMoveTacticalRole(key, move);
    const nextSelfBuffs = (simSelf.activeBuffs || [])
      .map(b => ({ ...b, roundsLeft: Math.max(0, number(b.roundsLeft, 0) - 1) }))
      .filter(b => b.roundsLeft > 0);

    const nextEnemyBuffs = (simEnemy.activeBuffs || [])
      .map(b => ({ ...b, roundsLeft: Math.max(0, number(b.roundsLeft, 0) - 1) }))
      .filter(b => b.roundsLeft > 0);

    if (role.isBuff) {
      nextSelfBuffs.push({
        id: role.statusId || "power_focus",
        roundsLeft: number(move?.duration ?? move?.rounds, 3),
        enableSpecials: Boolean(move?.enableSpecials || move?.direction === "W"),
        effects: move?.effects || { attack: 1.25, speed: 1.15 }
      });
    }

    if (role.isDebuff) {
      nextEnemyBuffs.push({
        id: role.statusId || "bleeding",
        roundsLeft: number(move?.duration ?? move?.rounds, 3),
        effects: move?.effects || { armor: 0.80, lpBleed: 80 }
      });
    }

    const stepEv = estimateMoveImmediateEv(simSelf, simEnemy, key, move);
    const estDmg = Math.max(0, stepEv * Math.max(1, number(simEnemy.maxLp, 2500)) * 0.55);

    return {
      stepEv,
      nextSelf: {
        ...simSelf,
        chi: nextSelfChi,
        lp: Math.max(0, simSelf.lp - 95),
        activeBuffs: nextSelfBuffs
      },
      nextEnemy: {
        ...simEnemy,
        chi: K.clamp(simEnemy.chi + 1, 0, CHI_MAX_ORTHOGONAL),
        lp: Math.max(0, simEnemy.lp - estDmg),
        activeBuffs: nextEnemyBuffs
      }
    };
  }

  function buildForesightPlan(state, slot, net = null, options = {}) {
    const cfg = { ...foresightConfig, ...options };
    const horizon = Math.max(1, Math.min(6, number(cfg.horizon, 3)));
    const beamWidth = Math.max(2, Math.min(8, number(cfg.beamWidth, 4)));

    const enemySlot = C.other(slot);
    const self = state?.[slot];
    const enemy = state?.[enemySlot];
    const slotMoves = state?.moves?.[slot] || {};

    if (!self || !enemy || state.winner || self.isFainted) {
      return null;
    }

    const store = getStatePlanStore(state);
    const existingPlan = store[slot];
    const currentRound = number(state.round, 1);

    // Check if an existing plan from an earlier turn is still active & valid
    let committedFirstIdx = -1;
    if (
      existingPlan &&
      Array.isArray(existingPlan.sequence) &&
      existingPlan.sequence.length > 0
    ) {
      const candIdx = existingPlan.sequence[0];
      const candKey = ACTION_MAP[candIdx];
      const candMove = slotMoves[candKey];
      if (
        candIdx >= 0 &&
        candIdx < IDLE_INDEX &&
        isMoveAffordableAndLegal(state, slot, candKey, candMove)
      ) {
        committedFirstIdx = candIdx;
      }
    }

    // Gather legal root actions
    const rootCandidates = [];
    for (let idx = 0; idx < IDLE_INDEX; idx++) {
      const key = ACTION_MAP[idx];
      const move = slotMoves[key];
      if (!move || !isMoveAffordableAndLegal(state, slot, key, move)) {
        continue;
      }

      const sim = projectSimulatedPair(self, enemy, key, move);
      let score = sim.stepEv;

      if (idx === committedFirstIdx) {
        score += cfg.commitmentBonus;
      }

      rootCandidates.push({
        sequence: [idx],
        totalEv: score,
        simSelf: sim.nextSelf,
        simEnemy: sim.nextEnemy
      });
    }

    if (rootCandidates.length === 0) {
      return {
        createdAtRound: currentRound,
        lastAdvancedRound: currentRound,
        horizon,
        sequence: [IDLE_INDEX],
        targetEv: 0
      };
    }

    // Optional neural Q-prior at root if net is supplied
    if (net && typeof net.predict === "function") {
      try {
        const tempObs = observe({ state, history: state.history || [] }, slot, true);
        const qValues = net.predict(vector(tempObs));
        for (const branch of rootCandidates) {
          const a0 = branch.sequence[0];
          if (Number.isFinite(qValues[a0])) {
            branch.totalEv += 0.35 * K.clamp(qValues[a0], -3, 3);
          }
        }
      } catch (_) {
        // Fallback cleanly to tactical rollout EV
      }
    }

    rootCandidates.sort((a, b) => b.totalEv - a.totalEv);
    let beam = rootCandidates.slice(0, beamWidth);

    // Roll forward for remaining plies 1 .. horizon - 1
    for (let depth = 1; depth < horizon; depth++) {
      const discount = Math.pow(GAMMA, depth);
      const expanded = [];

      for (const branch of beam) {
        if (branch.simEnemy.lp <= 0) {
          expanded.push(branch);
          continue;
        }

        for (let idx = 0; idx < IDLE_INDEX; idx++) {
          const key = ACTION_MAP[idx];
          const move = slotMoves[key];
          if (!move) continue;

          const cost = moveChiCost(move);
          if (branch.simSelf.chi < cost) continue;

          const sim = projectSimulatedPair(
            branch.simSelf,
            branch.simEnemy,
            key,
            move
          );

          expanded.push({
            sequence: [...branch.sequence, idx],
            totalEv: branch.totalEv + discount * sim.stepEv,
            simSelf: sim.nextSelf,
            simEnemy: sim.nextEnemy
          });
        }
      }

      if (!expanded.length) break;
      expanded.sort((a, b) => b.totalEv - a.totalEv);
      beam = expanded.slice(0, beamWidth);
    }

    const best = beam[0];
    const plan = {
      createdAtRound: currentRound,
      lastAdvancedRound: currentRound,
      horizon,
      sequence: best.sequence,
      targetEv: best.totalEv
    };

    store[slot] = plan;
    return plan;
  }

  function syncAndReadPlanMemory(state, slot) {
    if (!foresightConfig.enabled || !state || !state[slot]) {
      return {
        plannedActionIndex: -1,
        plannedActionOrthogonal: new Array(ACTION_MAP.length).fill(0),
        isLegal: 0,
        remainingHorizonRatio: 0,
        foreseenEvScaled: 0
      };
    }

    const store = getStatePlanStore(state);
    const currentRound = number(state.round, 1);
    let plan = store[slot];

    // Advance stored plan when combat advances to a new round
    if (plan && currentRound > plan.lastAdvancedRound) {
      const roundsElapsed = currentRound - plan.lastAdvancedRound;
      const history = state.history || [];
      const lastTurn = history[history.length - 1];
      const lastExecutedKey = actionKey(lastTurn, slot);
      const lastExecutedIdx = getActionIndexByKey(lastExecutedKey);

      if (
        roundsElapsed === 1 &&
        plan.sequence.length > 1 &&
        lastExecutedIdx === plan.sequence[0]
      ) {
        plan.sequence = plan.sequence.slice(1);
        plan.lastAdvancedRound = currentRound;
      } else {
        plan = null;
        store[slot] = null;
      }
    }

    // Check if current planned step is still legal; otherwise rebuild plan
    const slotMoves = state?.moves?.[slot] || {};
    if (plan && plan.sequence.length > 0) {
      const nextIdx = plan.sequence[0];
      const nextKey = ACTION_MAP[nextIdx];
      const nextMove = slotMoves[nextKey];
      const stillValid =
        !state[slot].isFainted &&
        nextIdx >= 0 &&
        nextIdx < ACTION_MAP.length &&
        (nextIdx === IDLE_INDEX || isMoveAffordableAndLegal(state, slot, nextKey, nextMove));

      if (!stillValid) {
        plan = null;
        store[slot] = null;
      }
    }

    if (!plan || !plan.sequence.length) {
      plan = buildForesightPlan(state, slot);
    }

    const plannedOrthogonal = new Array(ACTION_MAP.length).fill(0);
    if (!plan || !plan.sequence.length) {
      return {
        plannedActionIndex: -1,
        plannedActionOrthogonal: plannedOrthogonal,
        isLegal: 0,
        remainingHorizonRatio: 0,
        foreseenEvScaled: 0
      };
    }

    const plannedIdx = plan.sequence[0];
    if (plannedIdx >= 0 && plannedIdx < ACTION_MAP.length) {
      plannedOrthogonal[plannedIdx] = 1;
    }

    const plannedKey = ACTION_MAP[plannedIdx];
    const isLegal = Number(
      plannedIdx === IDLE_INDEX ||
      isMoveAffordableAndLegal(state, slot, plannedKey, slotMoves[plannedKey])
    );

    const maxH = Math.max(1, number(plan.horizon, foresightConfig.horizon));
    const remainingRatio = K.clamp(plan.sequence.length / maxH, 0, 1);
    const foreseenEvScaled = K.clamp(number(plan.targetEv, 0) / 4, -1, 1) * 0.35;

    return {
      plannedActionIndex: plannedIdx,
      plannedActionOrthogonal: plannedOrthogonal,
      isLegal,
      remainingHorizonRatio: remainingRatio,
      foreseenEvScaled
    };
  }

  function foresee(env, slot, net = null, options = {}) {
    const state = env?.state || env;
    return buildForesightPlan(state, slot, net, options);
  }

  /* ------------------------------------------------------------------
   * Environment Lifecycle & Step Execution
   * ------------------------------------------------------------------ */

  function create(state, previousActions = {}) {
    const env = {
      state,
      previousActions,
      history: state.history || [],
      cells: {},
      t: 0,
      done: false
    };

    for (const slot of SLOTS) {
      const forced = Boolean(state.winner || state[slot].isFainted);

      env.cells[slot] = {
        direction: null,
        startedAt: null,
        start: null,
        charge: 0,
        locked: forced,
        action: forced ? idle() : null
      };
    }

    env.done = SLOTS.every(slot => env.cells[slot].locked);
    return env;
  }

  function refresh(env) {
    for (const slot of SLOTS) {
      const cell = env.cells[slot];

      if (
        cell.locked ||
        cell.startedAt === null ||
        !cell.direction
      ) {
        continue;
      }

      cell.charge = C.chargePercent(
        env.state[slot],
        cell.direction,
        env.t - cell.startedAt
      );
    }
  }

  function lock(env, slot, action) {
    const cell = env.cells[slot];

    if (
      !cell ||
      cell.locked ||
      !C.isLegal(env.state, slot, action)
    ) {
      return false;
    }

    const normalized = C.normalizeAction(
      env.state,
      slot,
      action
    );

    if (normalized.key !== "DO_NOTHING") {
      const move = env.state.moves[slot][normalized.key];

      if (
        cell.direction !== move.direction ||
        cell.startedAt === null ||
        normalized.charge > cell.charge
      ) {
        return false;
      }
    }

    cell.action = normalized;
    cell.charge = normalized.charge;
    cell.locked = true;

    if (normalized.key === "DO_NOTHING") {
      cell.direction = null;
      cell.startedAt = null;
      cell.start = null;
    }

    // Synchronize executed action with persistent foresight plan memory
    const store = getStatePlanStore(env.state);
    const plan = store[slot];
    const lockedIdx = getActionIndexByKey(normalized.key);
    if (plan && Array.isArray(plan.sequence) && plan.sequence.length > 0) {
      if (plan.sequence[0] !== lockedIdx) {
        // AI deviated from the prior plan; align head so next turn re-evaluates cleanly
        plan.sequence[0] = lockedIdx;
      }
    }

    return true;
  }

  function apply(env, slot, input) {
    const cell = env.cells[slot];

    if (!cell) return false;

    // Missing input is WAIT, never action index zero.
    if (
      input === undefined ||
      input === null ||
      input === "WAIT"
    ) {
      return true;
    }

    if (cell.locked || env.t >= limit()) {
      return false;
    }

    if (typeof input === "object") {
      if (typeof input.key !== "string") {
        return false;
      }

      return lock(env, slot, {
        key: input.key,
        charge: input.charge ?? (
          input.key === "DO_NOTHING"
            ? 0
            : cell.charge
        )
      });
    }

    if (typeof input === "number") {
      if (
        !Number.isInteger(input) ||
        input < 0 ||
        input >= ACTION_MAP.length
      ) {
        return false;
      }

      return lock(env, slot, {
        key: ACTION_MAP[input],
        charge: input === IDLE_INDEX
          ? 0
          : cell.charge
      });
    }

    if (input === "IDLE" || input === "DO_NOTHING") {
      return lock(env, slot, idle());
    }

    if (ACTION_MAP.includes(input)) {
      return lock(env, slot, {
        key: input,
        charge: cell.charge
      });
    }

    if (DIRS.includes(input)) {
      /*
       * A DIFFERENT direction loses all accumulated charge.
       * Repeating the SAME direction keeps its clock.
       */
      if (cell.direction !== input) {
        cell.direction = input;
        cell.startedAt = env.t;
        cell.start = env.t;
        cell.charge = 1;
      }

      refresh(env);
      return true;
    }

    if (BUTTONS.includes(input) && cell.direction) {
      return lock(env, slot, {
        key: cell.direction + "+" + input,
        charge: cell.charge
      });
    }

    return false;
  }

  function step(env, inputs = {}) {
    if (env.done) return [];

    refresh(env);

    const rejected = [];

    for (const slot of SLOTS) {
      const sequence = Array.isArray(inputs[slot])
        ? inputs[slot]
        : [inputs[slot] ?? "WAIT"];

      for (const input of sequence) {
        if (!apply(env, slot, input)) {
          rejected.push({ slot, input });
        }
      }
    }

    env.t = Math.min(limit(), env.t + STEP);
    refresh(env);

    if (env.t >= limit()) {
      for (const slot of SLOTS) {
        if (!env.cells[slot].locked) {
          lock(env, slot, idle());
        }
      }
    }

    env.done = SLOTS.every(slot => env.cells[slot].locked);

    return rejected;
  }

  function actionKey(turn, slot) {
    const action = turn?.actions?.[slot] ?? turn?.[slot];

    return typeof action === "string"
      ? action
      : action?.key || null;
  }

  function observe(env, slot, skipPlanRefresh = false) {
    const enemySlot = C.other(slot);

    const self = env.state[slot];
    const enemy = env.state[enemySlot];

    const fullHistory = env.history || env.state.history || [];
    const recent4 = fullHistory.slice(-4);
    const padded = Array(4 - recent4.length).fill(null).concat(recent4);

    const historyFrames = padded.map(turn => ({
      selfActionIndex: getActionIndexByKey(actionKey(turn, slot)),
      enemyActionIndex: getActionIndexByKey(actionKey(turn, enemySlot))
    }));

    const rollingWindow = fullHistory.slice(-6);
    const rollingStances = [0, 0, 0, 0];

    for (const turn of rollingWindow) {
      const key = actionKey(turn, enemySlot) || "";
      const index = DIRS.indexOf(key.split("+")[0]);

      if (index >= 0 && key.includes("+")) {
        rollingStances[index]++;
      }
    }

    const denominator = Math.max(1, rollingWindow.length);

    for (let i = 0; i < rollingStances.length; i++) {
      rollingStances[i] /= denominator;
    }

    const selfChiOrthogonal = orthogonalChiVector(self.chi);
    const enemyChiOrthogonal = orthogonalChiVector(enemy.chi);

    const selfChiFlags = computeFighterChiFlags(env.state, slot);
    const enemyChiFlags = computeFighterChiFlags(env.state, enemySlot);

    const selfLpRatio = self.lp / Math.max(1, self.maxLp);
    const enemyLpRatio = enemy.lp / Math.max(1, enemy.maxLp);
    const selfChiRatio = self.chi / Math.max(1, self.maxChi || 16);
    const enemyChiRatio = enemy.chi / Math.max(1, enemy.maxChi || 16);

    const advantageDeltas = [
      K.clamp(
        (selfLpRatio - enemyLpRatio) * ADVANTAGE_DELTA_WEIGHT,
        -ADVANTAGE_DELTA_WEIGHT,
        ADVANTAGE_DELTA_WEIGHT
      ),
      K.clamp(
        (selfChiRatio - enemyChiRatio) * ADVANTAGE_DELTA_WEIGHT,
        -ADVANTAGE_DELTA_WEIGHT,
        ADVANTAGE_DELTA_WEIGHT
      )
    ];

    const planMemory = skipPlanRefresh
      ? {
          plannedActionIndex: -1,
          plannedActionOrthogonal: new Array(ACTION_MAP.length).fill(0),
          isLegal: 0,
          remainingHorizonRatio: 0,
          foreseenEvScaled: 0
        }
      : syncAndReadPlanMemory(env.state, slot);

    return {
      self,
      enemy,
      round: env.state.round,
      selfLp: self.lp,
      selfMaxLp: self.maxLp,
      enemyLp: enemy.lp,
      enemyMaxLp: enemy.maxLp,
      selfChi: self.chi,
      enemyChi: enemy.chi,
      selfMaxChi: self.maxChi,
      enemyMaxChi: enemy.maxChi,
      historyFrames,
      rollingStances,
      selfChiOrthogonal,
      enemyChiOrthogonal,
      selfChiFlags,
      enemyChiFlags,
      advantageDeltas,
      planMemory
    };
  }

  function periodicAmount(buff, field) {
    return Math.max(
      0,
      number(buff[field] ?? buff.effects?.[field], 0)
    );
  }

  function fighterFeatures(player, round) {
    const mods = C.modifiers(player);
    const buffs = (player.activeBuffs || []).filter(
      buff => buff.roundsLeft > 0
    );

    const maxLp = Math.max(1, number(player.maxLp, 2500));

    let regen = 0;
    let bleed = 0;
    let fragile = 0;

    for (const buff of buffs) {
      regen += periodicAmount(buff, "lpRegen");
      bleed += periodicAmount(buff, "lpBleed");

      if (
        buff.cancelOnLpDamage ??
        buff.effects?.cancelOnLpDamage ??
        false
      ) {
        fragile++;
      }
    }

    const values = [
      maxLp / 3000,
      number(player.maxChi, 16) / 16,
      number(player.faintMeter) /
        Math.max(1, number(g.COMBAT_RULES?.FAINT_THRESHOLD, 100)),
      Number(Boolean(player.isFainted)),
      number(player.airborneTicks) / 10,
      Number(
        player.airborneTicks > 0 &&
        player.airborneAppliedRound === round
      ),
      number(player.airborneChargePercent, 100) / 100,
      number(player.activeChargePercent) / 100,
      number(player.idleStreak) / 10,
      mods.attack,
      mods.dAttack,
      mods.sAttack,
      mods.armor,
      mods.speed,
      mods.accuracy / 100,
      mods.evasion,
      regen / maxLp,
      bleed / maxLp,
      fragile / 10
    ];

    for (const id of STATUS_IDS) {
      const buff = buffs.find(item => item.id === id);

      if (!buff) {
        values.push(0, 0);
        continue;
      }

      const periodic =
        periodicAmount(buff, "lpRegen") > 0 ||
        periodicAmount(buff, "lpBleed") > 0;

      const firstApplied =
        buff.periodicAppliedRound ??
        buff.appliedRound ??
        round - 1;

      values.push(
        number(buff.roundsLeft) / 10,
        Number(periodic && firstApplied < round)
      );
    }

    if (values.length !== 59) {
      throw new Error("Internal fighter feature layout mismatch.");
    }

    return values;
  }

  function vector(observation, spec = makeSpec()) {
    assertSpec(spec);

    const values = [];

    // 0..63: Last 2 completed turns (frames 2 and 3 of the 4-frame history buffer)
    const frames = observation.historyFrames || [];
    const recentTwoFrames = frames.slice(-2);
    while (recentTwoFrames.length < 2) {
      recentTwoFrames.unshift({ selfActionIndex: -1, enemyActionIndex: -1 });
    }

    for (let frame = 0; frame < 2; frame++) {
      const history = recentTwoFrames[frame] || {
        selfActionIndex: -1,
        enemyActionIndex: -1
      };

      for (const index of [
        history.selfActionIndex,
        history.enemyActionIndex
      ]) {
        for (let action = 0; action < 16; action++) {
          values.push(Number(action === index));
        }
      }
    }

    // 64..80: Self Orthogonal CHI (17 values: 0..16)
    const selfChiOrtho =
      Array.isArray(observation.selfChiOrthogonal) &&
      observation.selfChiOrthogonal.length === CHI_BINS
        ? observation.selfChiOrthogonal
        : orthogonalChiVector(observation.selfChi ?? observation.self?.chi);
    values.push(...selfChiOrtho);

    // 81..97: Enemy Orthogonal CHI (17 values: 0..16)
    const enemyChiOrtho =
      Array.isArray(observation.enemyChiOrthogonal) &&
      observation.enemyChiOrthogonal.length === CHI_BINS
        ? observation.enemyChiOrthogonal
        : orthogonalChiVector(observation.enemyChi ?? observation.enemy?.chi);
    values.push(...enemyChiOrtho);

    // 98..105: 4 Self CHI tactical flags + 4 Enemy CHI tactical flags (8 values)
    const selfFlags =
      Array.isArray(observation.selfChiFlags) &&
      observation.selfChiFlags.length === 4
        ? observation.selfChiFlags
        : computeFighterChiFlags(
            { p1: observation.self, p2: observation.enemy },
            "p1"
          );

    const enemyFlags =
      Array.isArray(observation.enemyChiFlags) &&
      observation.enemyChiFlags.length === 4
        ? observation.enemyChiFlags
        : computeFighterChiFlags(
            { p1: observation.self, p2: observation.enemy },
            "p2"
          );

    values.push(...selfFlags, ...enemyFlags);

    // 106..107: Low-weight Relative Advantage Deltas (2 values)
    const selfLpRatio =
      observation.selfLp / Math.max(1, observation.selfMaxLp);
    const enemyLpRatio =
      observation.enemyLp / Math.max(1, observation.enemyMaxLp);
    const selfChiRatio =
      observation.selfChi / Math.max(1, observation.selfMaxChi || 16);
    const enemyChiRatio =
      observation.enemyChi / Math.max(1, observation.enemyMaxChi || 16);

    const deltas =
      Array.isArray(observation.advantageDeltas) &&
      observation.advantageDeltas.length === 2
        ? observation.advantageDeltas
        : [
            K.clamp(
              (selfLpRatio - enemyLpRatio) * ADVANTAGE_DELTA_WEIGHT,
              -ADVANTAGE_DELTA_WEIGHT,
              ADVANTAGE_DELTA_WEIGHT
            ),
            K.clamp(
              (selfChiRatio - enemyChiRatio) * ADVANTAGE_DELTA_WEIGHT,
              -ADVANTAGE_DELTA_WEIGHT,
              ADVANTAGE_DELTA_WEIGHT
            )
          ];
    values.push(...deltas);

    // 108..127: Persistent Multi-Turn Foresight Plan Memory (20 values)
    const planMem = observation.planMemory;
    const plannedOrtho =
      Array.isArray(planMem?.plannedActionOrthogonal) &&
      planMem.plannedActionOrthogonal.length === ACTION_MAP.length
        ? planMem.plannedActionOrthogonal
        : new Array(ACTION_MAP.length).fill(0);

    values.push(
      ...plannedOrtho,
      number(planMem?.isLegal, 0),
      number(planMem?.remainingHorizonRatio, 0),
      number(planMem?.foreseenEvScaled, 0)
    );

    // 128..131: Opponent rolling stances (4 values)
    values.push(...observation.rollingStances);

    // 132..135: Self/Enemy LP and CHI continuous ratios (4 values)
    values.push(
      selfLpRatio,
      enemyLpRatio,
      selfChiRatio,
      enemyChiRatio
    );

    // 136..253: Two fighter feature blocks, 59 values each (118 values)
    values.push(
      ...fighterFeatures(observation.self, observation.round),
      ...fighterFeatures(observation.enemy, observation.round)
    );

    // 254..255: Round progress and remaining-round fraction (2 values)
    const maxRounds = Math.max(
      1,
      number(g.COMBAT_RULES?.MAX_ROUNDS, 100)
    );

    values.push(
      observation.round / maxRounds,
      Math.max(0, maxRounds - observation.round) / maxRounds
    );

    if (
      values.length !== spec.input ||
      values.some(value => !Number.isFinite(value))
    ) {
      throw new Error("Invalid neural observation.");
    }

    return Float32Array.from(values);
  }

  /*
   * Terminal combat states may legitimately have no legal actions.
   * This matters for replay next-state masks because terminal transitions
   * have discount zero and must never be bootstrapped anyway.
   */
  function mask(env, slot, allowEmpty = false) {
    const result = new Uint8Array(ACTION_MAP.length);

    for (let index = 0; index < ACTION_MAP.length; index++) {
      const key = ACTION_MAP[index];
      const move = env.state.moves?.[slot]?.[key];

      if (!move) continue;

      const charge = index === IDLE_INDEX
        ? 0
        : C.maxCharge(
            env.state[slot],
            move.direction
          );

      result[index] = Number(
        C.isLegal(env.state, slot, { key, charge })
      );
    }

    if (!result.some(Boolean) && !allowEmpty) {
      throw new Error(
        "Combat state has no legal action, including idle."
      );
    }

    return result;
  }

  function actionFromIndex(env, slot, index, charge) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= ACTION_MAP.length
    ) {
      throw new Error("Invalid action index.");
    }

    const key = ACTION_MAP[index];
    const move = env.state.moves?.[slot]?.[key];

    if (!move) {
      throw new Error("Action is absent from this fighter's moves.");
    }

    const reachable = index === IDLE_INDEX
      ? 0
      : C.maxCharge(
          env.state[slot],
          move.direction
        );

    const action = {
      key,
      charge: charge === undefined ? reachable : charge
    };

    if (
      !C.isLegal(env.state, slot, action) ||
      (
        index !== IDLE_INDEX &&
        action.charge > reachable
      )
    ) {
      throw new Error(
        "Invalid or unreachable planned action. " +
        "Non-idle moves require 1–100% charge."
      );
    }

    return C.normalizeAction(env.state, slot, action);
  }

  function actions(env) {
    return {
      p1: { ...(env.cells.p1.action || idle()) },
      p2: { ...(env.cells.p2.action || idle()) }
    };
  }

  function planned(action) {
    const requested = { ...(action || idle()) };

    return (env, slot) => {
      const cell = env.cells[slot];

      if (!cell) {
        throw new Error("Invalid planned-controller slot.");
      }

      if (env.done || cell.locked || env.t >= limit()) {
        return "WAIT";
      }

      // Check before normalization: no silent zero-charge fallback.
      if (!C.isLegal(env.state, slot, requested)) {
        throw new Error(
          "Planned controller received an illegal action."
        );
      }

      const plan = C.normalizeAction(
        env.state,
        slot,
        requested
      );

      if (env.t < C.cpuReadyAtMs()) {
        return "WAIT";
      }

      if (plan.key === "DO_NOTHING") {
        return { ...plan };
      }

      const direction =
        env.state.moves[slot][plan.key].direction;

      if (
        plan.charge >
        C.maxCharge(env.state[slot], direction)
      ) {
        throw new Error(
          "Planned controller received an unreachable charge."
        );
      }

      if (cell.direction !== direction) {
        /*
         * Selecting a direction creates 1% immediately.
         * A 1% plan may therefore confirm on that same input tick.
         */
        return plan.charge === 1
          ? [direction, { ...plan }]
          : direction;
      }

      if (cell.charge < plan.charge) {
        return "WAIT";
      }

      /*
       * Preserve the selected threshold when the 50 ms clock steps
       * slightly past it. Never grant more than accumulated charge.
       */
      return { ...plan };
    };
  }

  function scripted(rng = Math.random) {
    return (observation, legalMask) => {
      const legal = [];

      for (let i = 0; i < legalMask.length; i++) {
        if (legalMask[i] && i !== IDLE_INDEX) {
          legal.push(i);
        }
      }

      if (!legal.length) {
        return IDLE_INDEX;
      }

      return legal[Math.floor(rng() * legal.length)];
    };
  }

  class Frames {
    constructor(spec) {
      this.spec = assertSpec(spec);
    }

    push(value) {
      if (value.length !== this.spec.input) {
        throw new Error("Frame size mismatch.");
      }

      return value;
    }
  }

  g.SoulEnv = {
    BUILD,
    SCHEMA,
    GAMMA,
    ACTION_MAP,
    STATUS_IDS,
    IDLE_INDEX,
    makeSpec,
    assertSpec,
    getActionIndexByKey,
    setForesightConfig,
    getForesightConfig,
    foresee,
    clearPlanMemory,
    create,
    step,
    observe,
    vector,
    mask,
    actionFromIndex,
    actions,
    isDecision: env => !env.done,
    Frames,
    planned,
    scripted
  };
})(globalThis);
