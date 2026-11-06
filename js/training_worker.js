/* js/training_worker.js
 * Build: v5-state256-action17
 * Matrix: v7-7riders-10backup
 * Patch: charge1-reset1
 */
"use strict";

const BUILD = "v5-state256-action17";
const VERSION = "kf-soul-ddqn-v5-state256-action17";
const PATCH = "charge1-reset1";
const CACHE_TAG = BUILD + "-" + PATCH + "-v7";

const EXPECTED_SCHEMA =
  "kf-state256-action17-v2-charge1-reset1";

const MIXED_CPU_SEQUENCE = [
  "easy",
  "balanced",
  "defensive",
  "master"
];
const MIXED_ROUND_SPAN = 30;
const MAX_WINS_PER_DIFF_OPP = 4;

// Turbo scheduling constants: keep worker on-CPU ~99.5% of the time
const YIELD_INTERVAL_MS = 250;
const PROGRESS_INTERVAL_MS = 1000;
const CHECKPOINT_GAME_INTERVAL = 250;
const CHECKPOINT_MIN_INTERVAL_MS = 5000;

importScripts(...[
  "common.js",
  "combat_core.js",
  "rider_brains.js",
  "foresee_engine.js",
  "charge_env.js",
  "neural_core.js",
  "soul_sim.js",
  "soul_agent.js",
  "ai.js"
].map(file => file + "?v=" + CACHE_TAG));

let busy = false;
let cancelled = false;

const channel = new MessageChannel();
let resume = null;

channel.port1.onmessage = () => {
  const callback = resume;
  resume = null;

  if (callback) callback();
};

function pause() {
  return new Promise(resolve => {
    resume = resolve;
    channel.port2.postMessage(null);
  });
}

function send(type, payload = {}) {
  self.postMessage({
    type,
    build: BUILD,
    patch: PATCH,
    schema: EXPECTED_SCHEMA,
    ...payload
  });
}

function assertRuntime() {
  if (
    SoulEnv.SCHEMA !== EXPECTED_SCHEMA ||
    typeof CombatCore.chargePercent !== "function" ||
    typeof CombatCore.cpuReadyAtMs !== "function" ||
    typeof CombatCore.lastInputMs !== "function"
  ) {
    throw new Error(
      "Training worker loaded incompatible charging rules. " +
      "Apply the charge1-reset1 core/environment patches."
    );
  }

  if (
    KF_AI.VERSION !== BUILD ||
    SoulSim.BUILD !== BUILD ||
    SoulNN.BUILD !== BUILD ||
    SoulAgent.VERSION !== BUILD
  ) {
    throw new Error("Training worker module build mismatch.");
  }

  SoulEnv.assertSpec(SoulEnv.makeSpec());
}

function validateJob(job) {
  assertRuntime();

  if (
    job?.build !== BUILD ||
    job.patch !== PATCH ||
    job.schema !== EXPECTED_SCHEMA ||
    !["train", "evaluate"].includes(job.kind)
  ) {
    throw new Error(
      "Invalid job or mismatched training UI/worker patch."
    );
  }

  if (
    !job.data ||
    !Array.isArray(job.data.riders) ||
    !job.data.moves
  ) {
    throw new Error("Training job is missing combat data.");
  }

  SoulAgent.syncRosterCodes(job.data.riders);

  if (
    !Number.isInteger(job.matches) ||
    job.matches < 2 ||
    job.matches > 100000
  ) {
    throw new Error("Match count must be from 2 to 100000.");
  }

  if (
    job.kind === "evaluate" &&
    job.matches % 2 !== 0
  ) {
    throw new Error(
      "Evaluation count must be even for slot pairing."
    );
  }

  if (
    !Number.isSafeInteger(job.seed) ||
    job.seed < 0 ||
    job.seed > 4294967295
  ) {
    throw new Error("Invalid job seed.");
  }

  if (!["standard", "terminal_only"].includes(job.rewardMode)) {
    throw new Error("Invalid reward mode.");
  }

  if (!job.learner || !job.opponent) {
    throw new Error("Select a learner and opponent (or ALL OPPONENTS).");
  }

  const aliases = {
    novice: "easy",
    "tree-hopper": "easy",
    tree_hopper: "easy",
    treehopper: "easy",
    balance: "balanced",
    cricket: "balanced",
    defense: "defensive",
    beetle: "defensive",
    "bullet-ant": "master",
    bullet_ant: "master",
    bulletant: "master",
    soul: "master",
    mcts: "rider"
  };

  job.mode = aliases[String(job.mode || "").toLowerCase()] || job.mode;
  job.teacher = aliases[String(job.teacher || "master").toLowerCase()] || job.teacher;

  if (![
    "mixed",
    "easy",
    "balanced",
    "defensive",
    "master",
    "rider"
  ].includes(job.mode)) {
    throw new Error("Invalid opponent controller.");
  }

  if (Number.isFinite(job.guidePct)) {
    if (job.guidePct < 0 || job.guidePct > 100) {
      throw new Error("Guidance % must be from 0 to 100.");
    }
  } else if (
    !Number.isFinite(job.guideHoldPct) ||
    !Number.isFinite(job.guideZeroPct) ||
    job.guideHoldPct < 0 ||
    job.guideZeroPct > 100 ||
    job.guideHoldPct > job.guideZeroPct
  ) {
    throw new Error("Invalid guidance schedule.");
  }

  if (
    !Number.isInteger(job.initialEpsilon) ||
    job.initialEpsilon < 1 ||
    job.initialEpsilon > 100
  ) {
    throw new Error(
      "Initial Epsilon must be an integer from 1 to 100."
    );
  }

  if (typeof job.winOnly !== "boolean") {
    throw new Error("winOnly must be a boolean.");
  }

  if (typeof job.warmStart !== "boolean") {
    throw new Error("warmStart must be a boolean.");
  }

  if (!["network", "rider"].includes(job.learnerPolicy)) {
    throw new Error("Invalid learner policy.");
  }

  if (!["easy", "balanced", "defensive", "master"].includes(job.teacher)) {
    throw new Error("Invalid teacher difficulty.");
  }
}

function validateTransition(transition) {
  const index = transition?.a;

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= SoulEnv.ACTION_MAP.length
  ) {
    throw new Error("Episode returned an invalid action index.");
  }

  const key = SoulEnv.ACTION_MAP[index];
  const charge = transition.selectedCharge;

  const validCharge = key === "DO_NOTHING"
    ? charge === 0
    : Number.isFinite(charge) && charge >= 1 && charge <= 100;

  if (
    !validCharge ||
    !transition.m?.[index] ||
    !Number.isFinite(transition.r) ||
    transition.actionKey !== key ||
    transition.selectedActionKey !== key ||
    transition.resolvedActionKey !== key ||
    transition.charge !== charge ||
    transition.resolvedCharge !== charge ||
    transition.coreAdjustedAction === true
  ) {
    throw new Error(
      "Episode action/charge mismatch. " +
      "Refusing to record a mislabeled transition."
    );
  }
}

function blendParameter(oldAvg, oldGames, newVal) {
  if (!Number.isFinite(newVal)) return oldAvg || 0;
  if (oldGames <= 0 || !Number.isFinite(oldAvg)) return newVal;
  const alpha = Math.max(0.02, 1 / (oldGames + 1));
  return oldAvg * (1 - alpha) + newVal * alpha;
}

function updateMatchParameters(params, prevTotalGames, metrics, wasdCounts, jkilCounts) {
  const updated = SoulAgent.createDefaultMatchParameters(params);
  if (!metrics) return updated;

  updated.avgRounds = blendParameter(updated.avgRounds, prevTotalGames, metrics.rounds);
  updated.avgFinalLpRatio = blendParameter(updated.avgFinalLpRatio, prevTotalGames, metrics.finalLpRatio);
  updated.avgEnemyFinalLpRatio = blendParameter(updated.avgEnemyFinalLpRatio, prevTotalGames, metrics.enemyFinalLpRatio);
  updated.avgDamageDealtRatio = blendParameter(updated.avgDamageDealtRatio, prevTotalGames, metrics.damageDealtRatio);
  updated.avgDamageTakenRatio = blendParameter(updated.avgDamageTakenRatio, prevTotalGames, metrics.damageTakenRatio);
  updated.avgChiEarned = blendParameter(updated.avgChiEarned, prevTotalGames, metrics.chiEarnedPerRound);
  updated.avgChiSpent = blendParameter(updated.avgChiSpent, prevTotalGames, metrics.chiSpentPerRound);
  updated.avgNetChiAdvantage = blendParameter(updated.avgNetChiAdvantage, prevTotalGames, metrics.netChiAdvantage);
  updated.avgExecutionCharge = blendParameter(updated.avgExecutionCharge, prevTotalGames, metrics.avgExecutionCharge);
  updated.priorityWinRate = blendParameter(updated.priorityWinRate, prevTotalGames, metrics.priorityWinRate);
  updated.sMoveUsageRate = blendParameter(updated.sMoveUsageRate, prevTotalGames, metrics.sMoveUsageRate);
  updated.aGuardSuccessRate = blendParameter(updated.aGuardSuccessRate, prevTotalGames, metrics.aGuardSuccessRate);
  updated.wBuffCastRate = blendParameter(updated.wBuffCastRate, prevTotalGames, metrics.wBuffCastRate);
  updated.evasionTriggerRate = blendParameter(updated.evasionTriggerRate, prevTotalGames, metrics.evasionTriggerRate);
  updated.faintInflictedRate = blendParameter(updated.faintInflictedRate, prevTotalGames, metrics.faintInflicted);
  updated.faintSufferedRate = blendParameter(updated.faintSufferedRate, prevTotalGames, metrics.faintSuffered);

  const stanceTotal = Math.max(
    1,
    Object.values(wasdCounts).reduce((a, b) => a + b, 0)
  );
  for (const k of ["W", "A", "S", "D", "IDLE"]) {
    updated.stanceDistribution[k] = Number(((wasdCounts[k] || 0) / stanceTotal).toFixed(4));
  }

  const buttonTotal = Math.max(
    1,
    Object.values(jkilCounts).reduce((a, b) => a + b, 0)
  );
  for (const k of ["J", "K", "I", "L", "NONE"]) {
    updated.buttonDistribution[k] = Number(((jkilCounts[k] || 0) / buttonTotal).toFixed(4));
  }

  return updated;
}

async function run(job) {
  validateJob(job);

  const training = job.kind === "train";
  const data = job.data;
  const spec = SoulEnv.makeSpec();
  const seed = job.seed >>> 0;

  const learnerRider = data.riders.find(
    rider => rider.id === job.learner
  );

  if (!learnerRider) {
    throw new Error("Selected learner rider is absent from the dataset.");
  }

  const isMultiOpponent = job.opponent === "*";
  const targetOpponentRiders = isMultiOpponent
    ? data.riders.filter(r => {
        if (training) return true;
        const key = SoulAgent.getCanonicalKey(job.learner, r.id);
        return Boolean(job.checkpointsByMatchup?.[key]);
      })
    : [data.riders.find(r => r.id === job.opponent)].filter(Boolean);

  if (targetOpponentRiders.length === 0) {
    throw new Error(
      training
        ? "No opponent riders found in dataset."
        : "No checkpoints exist to evaluate for this learner."
    );
  }

  const riderDistillation =
    training && job.learnerPolicy === "rider";
  const riderImitationCoefficient = 0.02;
  const initialEpsilonBase = job.initialEpsilon / 100;
  const winOnly = job.winOnly;

  // Build isolated per-matchup context so weights/replays NEVER pollute across opponents
  const contexts = new Map();

  for (const oppRider of targetOpponentRiders) {
    const key = SoulAgent.getCanonicalKey(job.learner, oppRider.id);
    const old = isMultiOpponent
      ? (job.checkpointsByMatchup?.[key] || null)
      : (job.checkpoint || job.checkpointsByMatchup?.[key] || null);

    if (old) {
      const validation = SoulAgent.validateCheckpoint(
        old,
        job.learner,
        oppRider.id
      );

      if (!validation.valid) {
        throw new Error(`Checkpoint ${key} rejected: ${validation.error}`);
      }
    }

    if (!training && !old) {
      throw new Error(`No checkpoint exists to evaluate for ${key}.`);
    }

    const net = old
      ? SoulNN.Network.fromJSON(old.net)
      : new SoulNN.Network(
          spec.input,
          ...spec.hidden,
          spec.output
        );

    const revKey = SoulAgent.getCanonicalKey(oppRider.id, job.learner);
    const revCheckpoint = isMultiOpponent
      ? (job.opponentCheckpointsByMatchup?.[revKey] || null)
      : (job.opponentCheckpoint || job.opponentCheckpointsByMatchup?.[revKey] || null);

    let opponentNet = null;
    if (revCheckpoint) {
      const revValidation = SoulAgent.validateCheckpoint(
        revCheckpoint,
        oppRider.id,
        job.learner
      );
      if (!revValidation.valid) {
        throw new Error(`Reverse checkpoint ${revKey} rejected: ${revValidation.error}`);
      }
      opponentNet = SoulNN.Network.fromJSON(revCheckpoint.net);
    }

    const baseGames = old?.games || 0;
    const baseSteps = old?.steps || 0;

    const learner = training
      ? new SoulNN.Learner(
          net,
          KF.hash(seed, "replay", key),
          baseSteps,
          job.warmStart
            ? { interval: 2, warmup: 32 }
            : { interval: 4, warmup: 128 }
        )
      : null;

    const weightsID = old ? SoulAgent.fingerprint(old) : null;
    const loadedWeightsID = !training
      ? String(KF.hash(JSON.stringify(net.toJSON())))
      : weightsID;

    if (!training && String(weightsID) !== loadedWeightsID) {
      throw new Error(
        `Loaded evaluation weights differ from checkpoint for ${key}.`
      );
    }

    contexts.set(oppRider.id, {
      key,
      opponentRider: oppRider,
      old,
      net,
      opponentNet,
      learner,
      baseGames,
      baseSteps,
      weightsID,
      loadedWeightsID,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      rounds: 0,
      transitions: 0,
      qSum: 0,
      qCount: 0,
      recent: [],
      wasdCounts: { W: 0, A: 0, S: 0, D: 0, IDLE: 0 },
      jkilCounts: { J: 0, K: 0, I: 0, L: 0, NONE: 0 },
      matchParameters: SoulAgent.createDefaultMatchParameters(old?.matchParameters)
    });
  }

  const started = performance.now();
  let lastProgress = started;
  let lastYield = started;
  let lastCheckpointSent = started;

  let games = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let rounds = 0;
  let transitions = 0;
  let qSum = 0;
  let qCount = 0;

  let guideProbability = 0;
  let imitation = 0;
  let epsilon = 0;

  const breakdown = {};
  const firstWinningGames = [];
  const winCountsByDiffOpp = {};

  const wasdCounts = {
    W: 0,
    A: 0,
    S: 0,
    D: 0,
    IDLE: 0
  };

  const jkilCounts = {
    J: 0,
    K: 0,
    I: 0,
    L: 0,
    NONE: 0
  };

  const moveMatrix = Object.fromEntries(
    Object.keys(wasdCounts).map(stance => [
      stance,
      { J: 0, K: 0, I: 0, L: 0, NONE: 0 }
    ])
  );

  function buildCheckpointForContext(ctx) {
    return {
      version: VERSION,
      trainerBuild: BUILD,
      trainerPatch: PATCH,
      spec,
      net: ctx.net.toJSON(),

      canonicalKey: ctx.key,
      learnerId: job.learner,
      opponentId: ctx.opponentRider.id,

      games: ctx.baseGames + ctx.games,
      steps: ctx.learner ? ctx.learner.steps : ctx.baseSteps,

      savedAt: new Date().toISOString(),
      seed,
      rewardMode: job.rewardMode,

      evaluation: null,
      evaluated: false,

      matchParameters: ctx.matchParameters,

      trainingTask: {
        opponentController: job.mode,
        warmStart: job.warmStart,
        initialEpsilon: job.initialEpsilon,
        winOnly,
        learnerPolicy: job.learnerPolicy,
        riderDistillation,
        riderImitationCoefficient: riderDistillation
          ? riderImitationCoefficient
          : 0
      }
    };
  }

  const singleCtx = !isMultiOpponent
    ? contexts.get(targetOpponentRiders[0].id)
    : null;

  const modeDisplayNames = {
    easy: "Tree-hopper (easy)",
    balanced: "Cricket (balanced)",
    defensive: "Beetle (defensive)",
    master: "Bullet Ant (master)",
    rider: "Rider"
  };

  const effectiveOpponent = job.mode === "rider"
    ? isMultiOpponent
      ? "Rider with per-matchup reverse active checkpoints (Bullet Ant fallback)"
      : singleCtx?.opponentNet
        ? "Rider with reverse-matchup active checkpoint"
        : "Bullet Ant fallback; reverse-matchup checkpoint unavailable"
    : job.mode === "mixed"
      ? "MIXED cycle (30 Tree-hopper -> 30 Cricket -> 30 Beetle -> 30 Bullet Ant)"
      : modeDisplayNames[job.mode] || job.mode;

  function buildMatchupEvaluationReports(seconds) {
    if (training) return null;

    const perOpponentRequested = Math.floor(job.matches / targetOpponentRiders.length);
    const reports = [];

    for (const oppRider of targetOpponentRiders) {
      const ctx = contexts.get(oppRider.id);
      if (!ctx || ctx.games < 2 || ctx.games % 2 !== 0) continue;

      reports.push({
        build: BUILD,
        patch: PATCH,
        schema: EXPECTED_SCHEMA,
        kind: "evaluate",
        target: job.target || "candidate",
        learner: job.learner,
        opponent: oppRider.id,
        learnerPolicy: job.learnerPolicy,
        games: ctx.games,
        requested: isMultiOpponent ? ctx.games : job.matches,
        perOpponentRequested,
        wins: ctx.wins,
        losses: ctx.losses,
        draws: ctx.draws,
        winRate: ctx.games ? (100 * ctx.wins) / ctx.games : 0,
        averageRounds: ctx.games ? ctx.rounds / ctx.games : 0,
        seconds,
        weightsID: ctx.weightsID,
        loadedWeightsID: ctx.loadedWeightsID,
        cancelled
      });
    }

    return reports;
  }

  function report(activeCtx = singleCtx) {
    const seconds = Math.max(
      0.001,
      (performance.now() - started) / 1000
    );

    const ctx = activeCtx || contexts.values().next().value;

    let totalReplaySize = 0;
    let totalUpdates = 0;
    let latestLoss = 0;
    const aggUpdateStats = { win: 0, damage: 0, loss: 0, neutral: 0 };

    for (const c of contexts.values()) {
      if (c.learner) {
        totalReplaySize += c.learner.replay.items.length || 0;
        totalUpdates += c.learner.updates || 0;
        if (c.learner.loss) latestLoss = c.learner.loss;
        if (c.learner.updateStats) {
          aggUpdateStats.win += c.learner.updateStats.win || 0;
          aggUpdateStats.damage += c.learner.updateStats.damage || 0;
          aggUpdateStats.loss += c.learner.updateStats.loss || 0;
          aggUpdateStats.neutral += c.learner.updateStats.neutral || 0;
        }
      }
    }

    return {
      build: BUILD,
      patch: PATCH,
      schema: EXPECTED_SCHEMA,
      kind: job.kind,
      target: job.target || "candidate",

      games,
      requested: job.matches,
      wins,
      losses,
      draws,

      winRate: games ? (100 * wins) / games : 0,
      averageRounds: games ? rounds / games : 0,
      seconds,

      matchesPerMinute: (60 * games) / seconds,
      decisionsPerSecond: transitions / seconds,
      transitions,

      loss: ctx?.learner?.loss || latestLoss || 0,
      replaySize: totalReplaySize,
      updates: totalUpdates,
      updateStats: training ? aggUpdateStats : null,

      avgQ: qCount ? qSum / qCount : 0,
      totalTrainingGames: (ctx?.baseGames || 0) + (training ? games : 0),

      weightsID: singleCtx ? singleCtx.weightsID : "MULTI-MATCHUP-MATRIX",
      loadedWeightsID: singleCtx ? singleCtx.loadedWeightsID : "MULTI-MATCHUP-MATRIX",

      teacher: training ? job.teacher : null,
      guidePct: Number.isFinite(job.guidePct)
        ? job.guidePct
        : null,
      guideProbability,
      imitationCoefficient: imitation,
      epsilon,
      initialEpsilon: job.initialEpsilon,

      winOnly,
      rewardMode: job.rewardMode,
      seed,

      learner: job.learner,
      opponent: isMultiOpponent
        ? `ALL (${targetOpponentRiders.length} Riders Auto-Cycle)`
        : job.opponent,
      activeOpponentId: ctx?.opponentRider?.id || job.opponent,
      learnerPolicy: job.learnerPolicy,

      riderDistillation,
      riderImitationCoefficient: riderDistillation
        ? riderImitationCoefficient
        : 0,

      mode: job.mode,
      effectiveOpponent,
      warmStart: job.warmStart,
      hiddenSizes: ctx.net.sizes.slice(1, -1),
      cancelled,

      matchParameters: ctx?.matchParameters || null,
      matchupReports: buildMatchupEvaluationReports(seconds),

      breakdown,
      firstWinningGames,

      wasdRatio: {
        counts: { ...wasdCounts }
      },

      moveBreakdown: {
        jkilCounts: { ...jkilCounts },
        moveMatrix
      }
    };
  }

  const fullMixedCycleLength =
    MIXED_ROUND_SPAN * MIXED_CPU_SEQUENCE.length;

  for (let i = 0; i < job.matches && !cancelled; i++) {
    const pairIndex = Math.floor(i / 2);
    const oppRider =
      targetOpponentRiders[pairIndex % targetOpponentRiders.length];
    const ctx = contexts.get(oppRider.id);

    const mixedCycleIndex =
      training && job.mode === "mixed"
        ? Math.floor(i / fullMixedCycleLength)
        : 0;

    const learnerSlot =
      (i + mixedCycleIndex) % 2 === 0 ? "p1" : "p2";

    const matchOpponentMode = job.mode === "mixed"
      ? MIXED_CPU_SEQUENCE[
          Math.floor(i / MIXED_ROUND_SPAN) %
          MIXED_CPU_SEQUENCE.length
        ]
      : job.mode;

    const bucketKey = `${ctx.key}|${matchOpponentMode}`;
    const needDemoMoves =
      (winCountsByDiffOpp[bucketKey] || 0) < MAX_WINS_PER_DIFF_OPP;

    const ctxPair = Math.floor(ctx.games / 2);
    const matchSeed = KF.hash(
      seed,
      ctx.key,
      training ? "training" : "evaluation",
      training ? ctx.baseGames + ctxPair : ctxPair
    );

    const progress = (100 * i) / job.matches;

    guideProbability = 0;
    epsilon = 0;
    imitation = 0;

    let matchGuideProbability = 0;

    if (training) {
      if (job.warmStart) {
        guideProbability = 1;
        matchGuideProbability = 1;
        imitation = 1;

        epsilon = Math.max(
          0.02,
          initialEpsilonBase * (1 - (progress / 100) * 0.8)
        );
      } else {
        if (Number.isFinite(job.guidePct)) {
          guideProbability = job.guidePct / 100;
        } else if (progress < job.guideHoldPct) {
          guideProbability = 1;
        } else if (
          progress < job.guideZeroPct &&
          job.guideZeroPct > job.guideHoldPct
        ) {
          guideProbability =
            1 -
            (progress - job.guideHoldPct) /
            (job.guideZeroPct - job.guideHoldPct);
        }

        const rollingWinRate = ctx.recent.length
          ? ctx.recent.reduce((sum, value) => sum + value, 0) /
            ctx.recent.length
          : 0.2;

        const targetFloor = Math.max(
          0.01,
          initialEpsilonBase * 0.1
        );

        const adaptiveRatio = Math.max(
          0.2,
          1 + (0.5 - rollingWinRate) / 0.3
        );

        epsilon = Math.max(
          targetFloor,
          Math.min(
            initialEpsilonBase,
            initialEpsilonBase *
            (1 - (progress / 100) * 0.7) *
            adaptiveRatio
          )
        );

        // Deterministic per-match roll so low guideProbability skips heavy teacher lookahead
        // on unguided matches instead of running teacher evaluation on 100% of matches
        const guideRoll = (KF.hash(matchSeed, "guide_gate", i) >>> 0) / 4294967296;
        const guidedMatch = guideProbability >= 1 || (guideProbability > 0 && guideRoll < guideProbability);

        matchGuideProbability = guidedMatch ? 1 : 0;

        const masterImitation = guidedMatch
          ? Math.max(0.01, 0.05 * guideProbability)
          : 0;

        imitation = Math.max(
          masterImitation,
          riderDistillation ? riderImitationCoefficient : 0
        );
      }
    }

    const matchTransitions = [];
    const matchRoundMoves = needDemoMoves ? [] : null;

    const generator = SoulSim.episode({
      data,
      spec,
      net: ctx.net,

      learnerSlot,
      learnerId: job.learner,
      opponent: ctx.opponentRider,

      opponentMode: matchOpponentMode,
      opponentNet: ctx.opponentNet,

      seed: matchSeed,
      epsilon,
      guideProbability: matchGuideProbability,
      teacher: job.teacher,
      rewardMode: job.rewardMode,

      learnerMode: job.learnerPolicy,
      distillRider: riderDistillation,
      isEvaluation: !training
    });

    let result = null;

    for (const event of generator) {
      if (cancelled) break;

      if (event.type === "transition") {
        validateTransition(event.transition);
        transitions++;
        ctx.transitions++;

        if (training) {
          if (winOnly) {
            matchTransitions.push({
              transition: event.transition,
              imitation
            });
          } else {
            ctx.learner.accept(event.transition, imitation);
          }
        }

        const key = event.transition.resolvedActionKey;
        const learnerCharge = event.transition.resolvedCharge;
        const parts = key.split("+");

        const stance = ["W", "A", "S", "D"].includes(parts[0])
          ? parts[0]
          : "IDLE";

        const button = ["J", "K", "I", "L"].includes(parts[1])
          ? parts[1]
          : "NONE";

        wasdCounts[stance]++;
        jkilCounts[button]++;
        moveMatrix[stance][button]++;

        ctx.wasdCounts[stance]++;
        ctx.jkilCounts[button]++;

        if (needDemoMoves) {
          matchRoundMoves.push({
            round: matchRoundMoves.length + 1,
            learnerMove: key,
            learnerCharge,
            learnerLp: event.transition.learnerLp,
            learnerChi: event.transition.learnerChi,
            learnerFaint: event.transition.learnerFaint,
            oppMove: event.transition.opponentActionKey,
            oppCharge: event.transition.opponentCharge,
            oppLp: event.transition.oppLp,
            oppChi: event.transition.oppChi,
            oppFaint: event.transition.oppFaint
          });
        }
      } else if (event.type === "round") {
        if (
          Number.isFinite(event.qSumDelta) &&
          event.qCountDelta > 0
        ) {
          qSum += event.qSumDelta;
          qCount += event.qCountDelta;
          ctx.qSum += event.qSumDelta;
          ctx.qCount += event.qCountDelta;
        }
      } else if (event.type === "end") {
        result = event.result;
      }
    }

    if (!result || cancelled) break;

    const prevTotalCtxGames = ctx.baseGames + ctx.games;
    games++;
    rounds += result.rounds;
    ctx.games++;
    ctx.rounds += result.rounds;

    ctx.matchParameters = updateMatchParameters(
      ctx.matchParameters,
      prevTotalCtxGames,
      result.matchMetrics,
      ctx.wasdCounts,
      ctx.jkilCounts
    );

    let outcome;

    if (result.state.winner === learnerSlot) {
      wins++;
      ctx.wins++;
      outcome = "wins";

      const currentBucketWins = winCountsByDiffOpp[bucketKey] || 0;

      if (currentBucketWins < MAX_WINS_PER_DIFF_OPP && matchRoundMoves) {
        winCountsByDiffOpp[bucketKey] = currentBucketWins + 1;

        firstWinningGames.push({
          gameNumber: games,
          matchupKey: ctx.key,
          opponentId: oppRider.id,
          opponentName: oppRider.name || oppRider.id,
          difficulty: matchOpponentMode,
          difficultyLabel:
            modeDisplayNames[matchOpponentMode] || matchOpponentMode,
          learnerSlot,
          bucketWinIndex: currentBucketWins + 1,
          bucketMaxWins: MAX_WINS_PER_DIFF_OPP,
          totalRounds: result.rounds,
          moves: matchRoundMoves
        });
      }

      if (training && winOnly) {
        for (const item of matchTransitions) {
          ctx.learner.accept(item.transition, item.imitation);
        }
      }
    } else if (result.state.winner === "draw") {
      draws++;
      ctx.draws++;
      outcome = "draws";
    } else if (result.state.winner) {
      losses++;
      ctx.losses++;
      outcome = "losses";
    } else {
      throw new Error(
        "Episode ended without a winner or draw."
      );
    }

    ctx.recent.push(outcome === "wins" ? 1 : 0);
    if (ctx.recent.length > 30) ctx.recent.shift();

    const matchOpponentLabel = job.mode === "mixed"
      ? `mixed:${
          matchOpponentMode === "easy"
            ? "tree-hopper"
            : matchOpponentMode === "balanced"
              ? "cricket"
              : matchOpponentMode === "defensive"
                ? "beetle"
                : matchOpponentMode === "master"
                  ? "bullet-ant"
                  : matchOpponentMode
        }`
      : matchOpponentMode;

    const label =
      `${ctx.key} (${oppRider.id}) / ${matchOpponentLabel} / ${learnerSlot}`;

    if (!breakdown[label]) {
      breakdown[label] = {
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0
      };
    }
    const row = breakdown[label];

    row.games++;
    row[outcome]++;

    const now = performance.now();

    if (
      training &&
      ctx.games % CHECKPOINT_GAME_INTERVAL === 0 &&
      now - lastCheckpointSent >= CHECKPOINT_MIN_INTERVAL_MS
    ) {
      send("checkpoint", {
        checkpoint: buildCheckpointForContext(ctx)
      });
      lastCheckpointSent = performance.now();
    }

    if (now - lastProgress >= PROGRESS_INTERVAL_MS) {
      send("progress", { report: report(ctx) });
      lastProgress = performance.now();
    }

    if (now - lastYield >= YIELD_INTERVAL_MS) {
      await pause();
      lastYield = performance.now();
    }
  }

  if (training) {
    for (const ctx of contexts.values()) {
      if (ctx.games > 0) {
        send("checkpoint", {
          checkpoint: buildCheckpointForContext(ctx)
        });
      }
    }
  }

  send("done", { report: report() });
}

self.onmessage = async event => {
  if (event.data?.type === "stop") {
    cancelled = true;
    return;
  }

  if (event.data?.type !== "start" || busy) {
    return;
  }

  busy = true;
  cancelled = false;

  try {
    await run(event.data.job);
  } catch (error) {
    send("error", {
      error: error?.stack || error?.message || String(error)
    });
  } finally {
    busy = false;
  }
};
