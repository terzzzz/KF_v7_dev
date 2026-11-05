/* js/common.js
 * Shared constants, utilities, PRNG and data loader.
 *
 * Compatibility: shared-core-1
 * Patch: release-routing-1
 *
 * Combat rules and standard-search settings are preserved with 5-tier support.
 */
(function (g) {
  "use strict";

  const KF = g.KF = {};

  KF.VERSION = "shared-core-1";
  KF.PATCH = "release-routing-1";

  KF.clamp = (value, min = 0, max = 1) =>
    Math.min(max, Math.max(min, value));

  KF.wait = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  KF.difficulty = function (value) {
    const key = String(value || "balanced").trim().toLowerCase();

    return {
      novice: "easy",
      easy: "easy",
      "tree-hopper": "easy",
      tree_hopper: "easy",
      treehopper: "easy",

      normal: "balanced",
      balanced: "balanced",
      balance: "balanced",
      cricket: "balanced",

      defensive: "defensive",
      defense: "defensive",
      beetle: "defensive",

      master: "master",
      "bullet-ant": "master",
      bullet_ant: "master",
      bulletant: "master",
      soul: "master",

      rider: "rider",
      mcts: "rider"
    }[key] || "balanced";
  };

  KF.hash = function () {
    const text = Array.from(arguments).join("|");
    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  };

  KF.rng = function (seed) {
    let state = Number(seed) >>> 0;

    return function () {
      state = (state + 0x6D2B79F5) >>> 0;

      let value = state;

      value = Math.imul(
        value ^ (value >>> 15),
        value | 1
      );

      value ^= value + Math.imul(
        value ^ (value >>> 7),
        value | 61
      );

      return (
        (value ^ (value >>> 14)) >>> 0
      ) / 4294967296;
    };
  };

  /*
   * Search settings for the 5 AI tiers (+ legacy soul alias).
   */
  KF.levels = Object.freeze({
    easy: {
      charges: [60, 100],
      horizon: 1,
      finalists: 0,
      rollouts: 0,
      risk: 0,
      nearBest: 160
    },

    balanced: {
      charges: [60, 90, 100],
      horizon: 1,
      finalists: 0,
      rollouts: 0,
      risk: 0,
      nearBest: 16
    },

    defensive: {
      charges: [1, 35, 60, 90, 100],
      horizon: 2,
      finalists: 8,
      rollouts: 32,
      risk: 0.25,
      nearBest: 0
    },

    master: {
      charges: [1, 35, 60, 90, 100],
      horizon: 3,
      finalists: 8,
      rollouts: 48,
      risk: 0.15,
      nearBest: 4
    },

    soul: {
      charges: [1, 35, 60, 90, 100],
      horizon: 3,
      finalists: 8,
      rollouts: 64,
      risk: 0.15,
      nearBest: 1
    },

    rider: {
      charges: [1, 35, 60, 90, 100],
      horizon: 3,
      finalists: 10,
      rollouts: 80,
      risk: 0.25,
      nearBest: 0
    }
  });

  g.COMBAT_RULES = Object.freeze({
    STARTING_CHI: 8,
    MAX_CHI: 16,
    PASSIVE_CHI: 1,

    FAINT_THRESHOLD: 100,
    HIT_BUILDUP: 25,
    SCRATCH_BUILDUP: 10,
    ROUND_RECOVERY: 13,

    FAINT_PENALTY_CHI_GUARD: 15,
    FAINT_PENALTY_STANDARD_GUARD: 12,
    FAINT_PENALTY_IDLE_GUARD: 5,

    MAX_ROUNDS: 50
  });

  g.GAME_CONFIG = Object.freeze({
    ROUND_TIME_LIMIT: 8,
    CPU_REACTION_MS: 250,
    VIDEO_TIMEOUT_MS: 8000,

    MASTER_CPU_HP_MULTIPLIER: 1,
    MASTER_CPU_DMG_MULTIPLIER: 1,

    SOUL_CPU_HP_MULTIPLIER: 1,
    SOUL_CPU_DMG_MULTIPLIER: 1
  });

  g.CHARGE_TIMES = Object.freeze({
    W: 3500,
    A: 2200,
    S: 4200,
    D: 3000
  });

  g.getChargeTimeMs = function (direction) {
    return g.CHARGE_TIMES[
      String(direction).toUpperCase()
    ] || 3000;
  };

  g.calculateChargeProgress = function (
    direction,
    elapsedMs
  ) {
    const key = String(direction || "").toUpperCase();

    if (
      !Object.prototype.hasOwnProperty.call(
        g.CHARGE_TIMES,
        key
      )
    ) {
      return 0;
    }

    const elapsed = Number(elapsedMs);

    if (!Number.isFinite(elapsed)) {
      throw new TypeError(
        "Charge elapsed time must be a finite number."
      );
    }

    return KF.clamp(
      Math.floor(
        100 * Math.max(0, elapsed) /
        g.getChargeTimeMs(key)
      ),
      1,
      100
    );
  };

  let dataPromise = null;

  KF.loadData = function () {
    if (!dataPromise) {
      dataPromise = (async function () {
        const responses = await Promise.all([
          fetch("data/riders.json"),
          fetch("data/moves.json")
        ]);

        if (responses.some(response => !response.ok)) {
          throw new Error(
            "Could not load rider/move data."
          );
        }

        const [allRiders, rawMoves] = await Promise.all(
          responses.map(response => response.json())
        );

        const riders = allRiders.filter(
          rider => rider.active === true
        );

        const moves =
          g.CombatCore.compileMoves(rawMoves);

        if (!riders.length) {
          throw new Error("No active riders found.");
        }

        for (const rider of riders) {
          if (!moves[rider.id]) {
            throw new Error(
              `Missing moves for ${rider.id}.`
            );
          }
        }

        return { riders, moves };
      })().catch(error => {
        dataPromise = null;
        throw error;
      });
    }

    return dataPromise;
  };
})(globalThis);
