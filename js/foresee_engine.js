/* js/foresee_engine.js
 * Kamen Fight
 * Neural-Guided Expectimax & Monte Carlo Horizon Search
 *
 * Tiers:
 *   1. easy      -> Tree-hopper (Novice)
 *   2. balanced  -> Cricket     (All-Balanced Tree)
 *   3. defensive -> Beetle      (Two-Regime Defensive/Guard Tree)
 *   4. master    -> Bullet Ant  (LP-Lead Tactical Tree + Diversified Top-4)
 *   5. rider     -> Rider       (EV_Tree + EV_Matrix + EV_Live 8s Counter Engine)
 */
(function (g) {
  "use strict";

  const K = g.KF;
  const C = g.CombatCore;
  const B = g.RiderBrains;

  const DIRS = ["W", "A", "S", "D"];

  // Base tactical anchors (each receives a +1% to +12% randomizer per move/turn):
  //   24 -> 25..36% (Fast Utility/Guard)
  //   34 -> 35..46% (Standard Utility/Guard)
  //   60 -> 61..72% (Fast Priority Attack with reliable hit rate)
  //   68 -> 69..80% (Neutral D Poke)
  //   78 -> 79..90% (Neutral S Poke)
  //   88 -> 89..100% (Safe Heavy Punish)
  const DEFAULT_LEVEL_SETTINGS = {
    easy: {
      horizon: 1,
      rollouts: 0,
      finalists: 4,
      risk: 0.10,
      nearBest: 12,
      charges: [24, 34, 60, 68, 78, 88]
    },
    balanced: {
      horizon: 2,
      rollouts: 16,
      finalists: 6,
      risk: 0.20,
      nearBest: 8,
      charges: [24, 34, 60, 68, 78, 88]
    },
    defensive: {
      horizon: 2,
      rollouts: 28,
      finalists: 8,
      risk: 0.30,
      nearBest: 0,
      charges: [24, 34, 60, 68, 78, 88]
    },
    master: {
      horizon: 3,
      rollouts: 48,
      finalists: 8,
      risk: 0.25,
      nearBest: 0,
      charges: [24, 34, 60, 68, 78, 88]
    },
    rider: {
      horizon: 3,
      rollouts: 80,
      finalists: 10,
      risk: 0.25,
      nearBest: 0,
      charges: [24, 34, 60, 68, 78, 88]
    }
  };

  function nowMs() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }

  function randPlus1To12(rng = Math.random) {
    const r = typeof rng === "function" ? rng() : Math.random();
    return 1 + Math.floor(K.clamp(r, 0, 0.999999) * 12);
  }

  function jitterChargeAnchor(baseCharge, minAllowed, maxAllowed, isOffensive, rng) {
    if (!Number.isFinite(maxAllowed) || maxAllowed < 1) {
      return 0;
    }
    const safeMin = Math.max(1, Math.min(maxAllowed, Math.round(minAllowed || 1)));
    const tacticalFloor = isOffensive
      ? Math.min(maxAllowed, Math.max(safeMin, 58))
      : Math.min(maxAllowed, Math.max(safeMin, 20));

    let base = Math.round(Number(baseCharge) || 60);
    if (base <= 5) {
      base = isOffensive ? 60 : 24;
    } else if (isOffensive && base < 58) {
      base = 60;
    }
    // Pull 95-100 anchors back to 88 so +1..12% spans 89..100% instead of clamping at 100%
    if (base >= 95) {
      base = 88;
    }

    const clampedBase = K.clamp(base, tacticalFloor, maxAllowed);
    const jittered = clampedBase + randPlus1To12(rng);
    return K.clamp(jittered, safeMin, maxAllowed);
  }

  function normalizeDifficulty(value) {
    const raw = String(value || "balanced").trim().toLowerCase();
    if (
      raw === "easy" ||
      raw === "novice" ||
      raw === "tree-hopper" ||
      raw === "tree_hopper" ||
      raw === "treehopper"
    ) {
      return "easy";
    }
    if (
      raw === "balanced" ||
      raw === "balance" ||
      raw === "cricket"
    ) {
      return "balanced";
    }
    if (
      raw === "defensive" ||
      raw === "defense" ||
      raw === "beetle"
    ) {
      return "defensive";
    }
    if (
      raw === "master" ||
      raw === "bullet-ant" ||
      raw === "bullet_ant" ||
      raw === "bulletant" ||
      raw === "soul"
    ) {
      return "master";
    }
    if (raw === "rider" || raw === "mcts") {
      return "rider";
    }
    if (K && typeof K.difficulty === "function") {
      const mapped = K.difficulty(raw);
      if (mapped === "soul") return "master";
      if (DEFAULT_LEVEL_SETTINGS[mapped]) return mapped;
    }
    return "balanced";
  }

  function getLevelSettings(difficulty) {
    const norm = normalizeDifficulty(difficulty);
    const base = DEFAULT_LEVEL_SETTINGS[norm] || DEFAULT_LEVEL_SETTINGS.balanced;
    const fromKF =
      (K && K.levels && (K.levels[norm] || (norm === "defensive" && K.levels.balanced))) ||
      {};
    return {
      ...base,
      ...fromKF,
      charges: Array.isArray(fromKF.charges) && fromKF.charges.length > 0
        ? [...fromKF.charges]
        : [...base.charges]
    };
  }

  function brainDifficultyKey(difficulty) {
    const norm = normalizeDifficulty(difficulty);
    if (norm === "defensive") {
      return K && K.levels && K.levels.defensive ? "defensive" : "balanced";
    }
    if (norm === "rider") {
      return K && K.levels && K.levels.rider ? "rider" : "master";
    }
    return norm;
  }

  function appendForecastHistory(
    history,
    before,
    action1,
    action2
  ) {
    const p1 = {
      ...C.normalizeAction(before, "p1", action1)
    };

    const p2 = {
      ...C.normalizeAction(before, "p2", action2)
    };

    return [
      ...(Array.isArray(history) ? history : []),
      {
        p1,
        p2,
        actions: { p1, p2 },
        fainted: {
          p1: Boolean(before.p1.isFainted),
          p2: Boolean(before.p2.isFainted)
        }
      }
    ].slice(-24);
  }

  function getMoveDirection(state, slot, key) {
    if (!key || key === "DO_NOTHING") {
      return "IDLE";
    }
    const move = state?.moves?.[slot]?.[key];
    if (move?.direction) {
      return move.direction;
    }
    if (typeof key === "string" && key.includes("+")) {
      return key.split("+")[0];
    }
    return "IDLE";
  }

  function isSMove(state, slot, key) {
    if (!key || typeof key !== "string") {
      return false;
    }
    const move = state?.moves?.[slot]?.[key];
    return move?.direction === "S" || key.startsWith("S+");
  }

  function isDMove(state, slot, key) {
    if (!key || typeof key !== "string") {
      return false;
    }
    const move = state?.moves?.[slot]?.[key];
    return move?.direction === "D" || key.startsWith("D+");
  }

  function isWMove(state, slot, key) {
    if (!key || typeof key !== "string") {
      return false;
    }
    const move = state?.moves?.[slot]?.[key];
    return move?.direction === "W" || key.startsWith("W+");
  }

  function isAGuardMove(state, slot, key) {
    if (!key || typeof key !== "string") {
      return false;
    }
    const move = state?.moves?.[slot]?.[key];
    return move?.direction === "A" || key.startsWith("A+");
  }

  function isOffensiveMove(state, slot, key) {
    if (!key || key === "DO_NOTHING") {
      return false;
    }
    const move = state?.moves?.[slot]?.[key];
    if (!move) {
      return isDMove(state, slot, key) || isSMove(state, slot, key);
    }
    return Boolean(move.offensive) || move.direction === "D" || move.direction === "S";
  }

  function isOmniGuardMove(state, slot, key) {
    if (!key || typeof key !== "string") {
      return false;
    }
    if (key === "A+I") {
      return true;
    }
    const move = state?.moves?.[slot]?.[key];
    return Boolean(
      move &&
      (move.guardKind === "all" || move.omniGuard === true)
    );
  }

  function hasGuardTrait(state, slot, key) {
    if (!key || typeof key !== "string") {
      return false;
    }
    if (key === "A+I") {
      return true;
    }
    const move = state?.moves?.[slot]?.[key];
    return Boolean(
      move &&
      (move.direction === "A" || move.guardKind || move.omniGuard)
    );
  }

  function minSChiCost(state, slot) {
    const moves = state?.moves?.[slot];
    if (!moves) {
      return 4;
    }

    let minCost = Infinity;
    for (const [key, move] of Object.entries(moves)) {
      if (!move) continue;
      if (move.direction === "S" || key.startsWith("S+")) {
        const cost = Number(move.chiCost);
        if (Number.isFinite(cost) && cost > 0 && cost < minCost) {
          minCost = cost;
        }
      }
    }

    return Number.isFinite(minCost) ? minCost : 4;
  }

  function canUseMoveKey(state, slot, key, dirConstraints = null) {
    if (!state || !state[slot] || state[slot].isFainted) {
      return false;
    }
    const move = state.moves?.[slot]?.[key];
    if (!move) {
      return false;
    }
    const dc = dirConstraints && move.direction ? dirConstraints[move.direction] : null;
    if (dc && dc.allowed === false) {
      return false;
    }
    const availMs = dc && Number.isFinite(dc.availableMs) ? dc.availableMs : undefined;
    const maxChg = C.maxCharge(state[slot], move.direction, availMs);
    if (!Number.isFinite(maxChg) || maxChg < 1) {
      return false;
    }
    return C.isLegal(state, slot, { key, charge: maxChg });
  }

  function canUseSMove(state, slot, dirConstraints = null) {
    if (!state || !state[slot] || state[slot].isFainted) {
      return false;
    }
    const moves = state.moves?.[slot];
    if (!moves) {
      return false;
    }
    for (const key of Object.keys(moves)) {
      if (isSMove(state, slot, key) && canUseMoveKey(state, slot, key, dirConstraints)) {
        return true;
      }
    }
    return false;
  }

  function countConsecutiveSD(history, slot) {
    if (!Array.isArray(history) || history.length === 0) {
      return 0;
    }
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      if (!turn || (turn.fainted && turn.fainted[slot])) {
        break;
      }
      const act = turn[slot] || turn.actions?.[slot];
      const key = String(act?.key || "");
      if (key.startsWith("S+") || key.startsWith("D+")) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /*
   * Builds per-direction time and charge constraints for either the AI (`isSelf = true`)
   * or the opponent (`isSelf = false`) during the 8-second real-time input window.
   */
  function buildDirectionConstraints(state, targetSlot, live, isSelf) {
    if (!live || typeof live !== "object" || live.isInitial) {
      return null;
    }

    const remainingMs = Math.max(0, Number(live.remainingMs) || 0);
    const constraints = {
      allowDoNothing: true
    };

    if (isSelf) {
      const selfDir = String(live.selfDirection || "").toUpperCase();
      const selfElapsedMs = Math.max(0, Number(live.selfElapsedMs) || 0);
      const selfCharge = K.clamp(Math.floor(Number(live.selfCharge) || 0), 0, 100);
      const switchPenaltyMs = Math.max(0, Number(live.switchPenaltyMs) || 0);

      for (const dir of DIRS) {
        if (selfDir && dir === selfDir) {
          constraints[dir] = {
            allowed: true,
            availableMs: selfElapsedMs + remainingMs,
            minCharge: Math.max(1, selfCharge),
            maxCharge: 100
          };
        } else {
          const switchAvailMs = Math.max(0, remainingMs - switchPenaltyMs);
          constraints[dir] = {
            allowed: switchAvailMs >= C.CHARGE_STEP_MS,
            availableMs: switchAvailMs,
            minCharge: 1,
            maxCharge: 100
          };
        }
      }
      return constraints;
    }

    const oppDir = String(live.oppDirection || "").toUpperCase();
    const oppElapsedMs = Math.max(0, Number(live.oppElapsedMs) || 0);
    const oppCharge = K.clamp(Math.floor(Number(live.oppCharge) || 0), 0, 100);
    const oppLocked = Boolean(live.oppLocked);

    if (oppLocked) {
      if (!DIRS.includes(oppDir) || oppCharge < 1) {
        for (const dir of DIRS) {
          constraints[dir] = {
            allowed: false,
            availableMs: 0,
            minCharge: 0,
            maxCharge: 0
          };
        }
        constraints.allowDoNothing = true;
        return constraints;
      }

      constraints.allowDoNothing = false;
      for (const dir of DIRS) {
        if (dir === oppDir) {
          constraints[dir] = {
            allowed: true,
            availableMs: oppElapsedMs,
            minCharge: oppCharge,
            maxCharge: oppCharge
          };
        } else {
          constraints[dir] = {
            allowed: false,
            availableMs: 0,
            minCharge: 0,
            maxCharge: 0
          };
        }
      }
      return constraints;
    }

    for (const dir of DIRS) {
      if (oppDir && dir === oppDir) {
        constraints[dir] = {
          allowed: true,
          availableMs: oppElapsedMs + remainingMs,
          minCharge: Math.max(1, oppCharge),
          maxCharge: 100
        };
      } else {
        constraints[dir] = {
          allowed: remainingMs >= C.CHARGE_STEP_MS,
          availableMs: remainingMs,
          minCharge: 1,
          maxCharge: 100
        };
      }
    }

    return constraints;
  }

  /*
   * Generates legal candidate actions with a +1% to +12% randomizer applied per move,
   * ensuring no difficulty is stuck at constant % values while preserving hit-chance floors.
   */
  function buildRandomizedActions(
    state,
    slot,
    extraCharges,
    dirConstraints,
    rng
  ) {
    const probeCharges = [
      1, 20, 28, 36, 45, 55, 62, 70, 78, 86, 94, 100,
      ...(Array.isArray(extraCharges) ? extraCharges : [])
    ];

    const probed = C.actions(
      state,
      slot,
      [...new Set(probeCharges)],
      dirConstraints
    );

    if (!probed || probed.length === 0) {
      return [{ key: "DO_NOTHING", charge: 0 }];
    }

    const byKey = new Map();
    for (const act of probed) {
      if (!byKey.has(act.key)) {
        byKey.set(act.key, []);
      }
      byKey.get(act.key).push(act.charge ?? 0);
    }

    const result = [];

    for (const [key, legalCharges] of byKey.entries()) {
      if (key === "DO_NOTHING") {
        result.push({ key: "DO_NOTHING", charge: 0 });
        continue;
      }

      const move = state.moves?.[slot]?.[key];
      const dc = dirConstraints && move?.direction ? dirConstraints[move.direction] : null;
      const availMs = dc && Number.isFinite(dc.availableMs) ? dc.availableMs : undefined;
      const coreMax = move
        ? C.maxCharge(state[slot], move.direction, availMs)
        : Math.max(...legalCharges);

      const minAllowed = Math.max(
        1,
        dc && Number.isFinite(dc.minCharge) ? dc.minCharge : 1,
        Math.min(...legalCharges)
      );
      const maxAllowed = Math.max(
        minAllowed,
        Math.min(
          coreMax,
          dc && Number.isFinite(dc.maxCharge) ? dc.maxCharge : 100
        )
      );

      // If opponent is locked at an exact charge in live mode, preserve exact lock
      if (minAllowed === maxAllowed) {
        const lockedAct = { key, charge: minAllowed };
        if (C.isLegal(state, slot, lockedAct)) {
          result.push(lockedAct);
        }
        continue;
      }

      const offensive = isOffensiveMove(state, slot, key);
      const baseAnchors = offensive
        ? [60, 68, 78, 88]
        : [24, 34, 48];

      const chosenCharges = new Set();

      for (const anchor of baseAnchors) {
        const jittered = jitterChargeAnchor(
          anchor,
          minAllowed,
          maxAllowed,
          offensive,
          rng
        );
        if (jittered >= 1) {
          chosenCharges.add(jittered);
        }
      }

      if (Array.isArray(extraCharges)) {
        for (const extra of extraCharges) {
          if (!Number.isFinite(extra) || extra < 1) continue;
          const jittered = jitterChargeAnchor(
            extra,
            minAllowed,
            maxAllowed,
            offensive,
            rng
          );
          if (jittered >= 1) {
            chosenCharges.add(jittered);
          }
        }
      }

      let addedForMove = 0;
      for (const chg of chosenCharges) {
        const candidate = { key, charge: chg };
        if (C.isLegal(state, slot, candidate)) {
          result.push(candidate);
          addedForMove++;
        }
      }

      if (addedForMove === 0) {
        const fallbackCharge = K.clamp(
          maxAllowed,
          1,
          100
        );
        const fallback = { key, charge: fallbackCharge };
        if (C.isLegal(state, slot, fallback)) {
          result.push(fallback);
        }
      }
    }

    return result.length > 0 ? result : probed;
  }

  /*
   * Evaluates the 4 Tactical Charge Rules:
   *   1. Fast Priority with Hit-Chance Balance (60%–76% for D/S, never 35%–55%).
   *   2. Faint > 75% AND Opponent Chi Check (high risk only when oppChi >= oppMinS).
   *   3. Contested Neutral Poke (D: 69%–82%, S: 79%–92%).
   *   4. Safe Heavy Punish (89%–100% when opponent is fainted or starved of Chi).
   */
  function evaluateTacticalChargeBonus(state, slot, action) {
    if (!state || !action || action.key === "DO_NOTHING") {
      return 0;
    }

    const enemySlot = C.other(slot);
    const own = state[slot];
    const enemy = state[enemySlot];
    const move = state.moves?.[slot]?.[action.key];

    if (!own || !enemy || !move) {
      return 0;
    }

    const charge = Number(action.charge || 0);
    const dir = move.direction;
    const offensive = isOffensiveMove(state, slot, action.key);

    const faintThreshold = Math.max(
      1,
      Number(g.COMBAT_RULES?.FAINT_THRESHOLD || 100)
    );
    const myFaintRatio = Number(own.faintMeter || 0) / faintThreshold;
    const oppFaintRatio = Number(enemy.faintMeter || 0) / faintThreshold;

    const oppChi = Number(enemy.chi || 0);
    const oppMinS = minSChiCost(state, enemySlot);
    const oppMaxLp = Math.max(1, Number(enemy.maxLp || 1600));
    const oppLpRatio = Number(enemy.lp || 0) / oppMaxLp;

    // Rule 2: Faint > 75% combined with Opponent Chi threat check
    const highFaintRisk =
      !own.isFainted &&
      !enemy.isFainted &&
      myFaintRatio > 0.75 &&
      oppChi >= oppMinS;

    const moderateFaintRisk =
      !own.isFainted &&
      !enemy.isFainted &&
      myFaintRatio > 0.75 &&
      oppChi >= 2 &&
      oppChi < oppMinS;

    // Rule 4 condition: Opponent is fainted, Chi-starved, or faint-doomed with low Chi
    const lowOpponentThreat =
      Boolean(enemy.isFainted) ||
      oppChi <= 1 ||
      (oppFaintRatio > 0.75 && oppChi < 2);

    // Non-offensive W / A utility & guards (no offensive hit-rate penalty)
    if (!offensive) {
      if (charge < 20) {
        return -18; // Prevent 1% charge cheese
      }
      if (highFaintRisk) {
        return charge >= 24 && charge <= 38
          ? 8
          : charge > 55
            ? -10
            : 2;
      }
      return charge >= 25 && charge <= 48
        ? 6
        : charge > 65
          ? -6
          : 2;
    }

    // Offensive moves (D / S / offensive W or A): protect hit chance by penalizing < 58%
    if (charge < 58) {
      return -22;
    }

    // Rule 4 — Safe Heavy Punish (opponent is fainted or has very low Chi)
    if (lowOpponentThreat && !highFaintRisk) {
      if (charge >= 88) {
        return 12;
      }
      if (charge >= 78) {
        return 5;
      }
      return -6;
    }

    // Rule 1 & Rule 2 — High Faint Risk (faint > 75% & oppChi >= minS) OR Lethal Kill-Confirm
    // Stay in 60%–76% so hit chance stays reliable while still winning priority
    if (highFaintRisk || oppLpRatio <= 0.22) {
      if (charge >= 60 && charge <= 76) {
        return 14;
      }
      if (charge > 76 && charge <= 82) {
        return 2;
      }
      if (charge > 82) {
        return highFaintRisk ? -15 : -8;
      }
    }

    // Moderate Faint Risk (faint > 75%, but opponent only has 2-3 Chi and cannot use S moves)
    if (moderateFaintRisk) {
      if (charge >= 64 && charge <= 84) {
        return 9;
      }
      if (charge > 88) {
        return -7;
      }
      return 2;
    }

    // Rule 3 — Contested Neutral Poke (D: 68%–82%, S: 78%–92%)
    if (dir === "D") {
      if (charge >= 68 && charge <= 82) {
        return 8;
      }
      if (charge >= 60 && charge < 68) {
        return 4;
      }
      return 1;
    }

    if (dir === "S") {
      if (charge >= 78 && charge <= 92) {
        return 8;
      }
      if (charge >= 64 && charge < 78) {
        return 4;
      }
      return 2;
    }

    return charge >= 65 && charge <= 88 ? 5 : 0;
  }

  /*
   * Evaluates active buff / status unit differential for Rider EV_Tree (w_Buff = 18.0).
   */
  function evaluateActiveBuffUnits(player) {
    if (!player || player.lp <= 0) {
      return 0;
    }
    const maxLp = Math.max(1, Number(player.maxLp || 1600));
    let units = 0;

    for (const buff of player.activeBuffs || []) {
      const rounds = Math.max(0, Math.min(4, Number(buff.roundsLeft || 0)));
      if (rounds <= 0) continue;
      const eff = buff.effects || {};
      const durScale = 0.55 + 0.25 * rounds;

      if (Number(eff.evasion) > 0) {
        units += Number(eff.evasion) * 1.25 * durScale;
      }
      const lpRegen = Number(buff.lpRegen ?? eff.lpRegen ?? 0);
      if (lpRegen > 0) {
        units += ((lpRegen * rounds) / maxLp) * 1.40;
      }
      const lpBleed = Number(buff.lpBleed ?? eff.lpBleed ?? 0);
      if (lpBleed > 0) {
        units -= ((lpBleed * rounds) / maxLp) * 1.40;
      }
      if (Number(eff.attack) > 1) {
        units += (Number(eff.attack) - 1) * 0.85 * durScale;
      }
      if (Number(eff.dAttack) > 1) {
        units += (Number(eff.dAttack) - 1) * 0.70 * durScale;
      }
      if (Number(eff.sAttack) > 1) {
        units += (Number(eff.sAttack) - 1) * 0.70 * durScale;
      }
      if (eff.armor !== undefined && Number(eff.armor) < 1) {
        units += (1 - Number(eff.armor)) * 0.90 * durScale;
      }
      if (eff.speed !== undefined && Number(eff.speed) !== 1) {
        units += (Number(eff.speed) - 1) * 0.60 * durScale;
      }
    }

    if (Number(player.airborneTicks) > 0) {
      units += 0.20 * Math.min(2, Number(player.airborneTicks));
    }

    return K.clamp(units, -2.5, 2.5);
  }

  /*
   * Evaluates "Doomed Status" (Resource Lock, Asymmetric S-Threat, and
   * Faint-Lock Vulnerability) that exists even when LP has not changed yet.
   */
  function evaluateDoomedStatus(state, slot) {
    if (!state || state.winner) {
      return 0;
    }

    const enemySlot = C.other(slot);
    const own = state[slot];
    const enemy = state[enemySlot];

    if (!own || !enemy) {
      return 0;
    }

    const ownChi = Number(own.chi || 0);
    const enemyChi = Number(enemy.chi || 0);
    const chiDiff = ownChi - enemyChi;

    const ownMinS = minSChiCost(state, slot);
    const enemyMinS = minSChiCost(state, enemySlot);

    const ownHasS = !own.isFainted && canUseSMove(state, slot);
    const enemyHasS = !enemy.isFainted && canUseSMove(state, enemySlot);

    let score = 0;

    // 1. Asymmetric S-Move Capability
    if (ownHasS && !enemyHasS) {
      score += 22;
      if (enemyChi <= 2 && ownChi >= ownMinS + 2) {
        score += 18;
      }
    } else if (!ownHasS && enemyHasS) {
      score -= 22;
      if (ownChi <= 2 && enemyChi >= enemyMinS + 2) {
        score -= 18;
      }
    }

    // 2. Non-linear Chi Dominance / Resource Starvation
    if (Math.abs(chiDiff) >= 3) {
      const sign = chiDiff > 0 ? 1 : -1;
      const excess = Math.min(12, Math.abs(chiDiff) - 2);
      score += sign * (excess * 3.5 + excess * excess * 0.35);
    }

    if (ownChi <= 1 && enemyChi >= 7) {
      score -= 28;
    } else if (enemyChi <= 1 && ownChi >= 7) {
      score += 28;
    }

    // 3. Faint-Doomed Setup (> 75% faint + Opponent Chi threat check)
    const faintThreshold = Math.max(
      1,
      Number(g.COMBAT_RULES?.FAINT_THRESHOLD || 100)
    );
    const ownFaintRatio = Number(own.faintMeter || 0) / faintThreshold;
    const enemyFaintRatio = Number(enemy.faintMeter || 0) / faintThreshold;

    if (!own.isFainted && ownFaintRatio > 0.75 && enemyChi >= enemyMinS) {
      const chiThreatScale = enemyChi >= enemyMinS + 2 ? 1.25 : 1.0;
      score -= 36 * chiThreatScale * ((ownFaintRatio - 0.60) / 0.40);
    }
    if (!enemy.isFainted && enemyFaintRatio > 0.75 && ownChi >= ownMinS) {
      const chiThreatScale = ownChi >= ownMinS + 2 ? 1.25 : 1.0;
      score += 36 * chiThreatScale * ((enemyFaintRatio - 0.60) / 0.40);
    }

    return score;
  }

  /*
   * Evaluates transition-level tactics between `before` and `after`.
   * Includes Beetle's 2.2x CHI weighting when myCHI < oppCHI and Rider's +24 Guard bonus.
   */
  function evaluateTransitionTactics(
    before,
    after,
    slot,
    ownAction,
    opponentAction,
    difficulty = "balanced"
  ) {
    if (!before || !after || after.winner) {
      return 0;
    }

    const enemySlot = C.other(slot);
    const beforeOwn = before[slot];
    const afterOwn = after[slot];
    const beforeEnemy = before[enemySlot];
    const afterEnemy = after[enemySlot];

    if (!beforeOwn || !afterOwn || !beforeEnemy || !afterEnemy) {
      return 0;
    }

    const ownLpDelta = afterOwn.lp - beforeOwn.lp;
    const enemyLpDelta = afterEnemy.lp - beforeEnemy.lp;
    const ownChiDelta = afterOwn.chi - beforeOwn.chi;
    const enemyChiDelta = afterEnemy.chi - beforeEnemy.chi;
    const netChiDelta = ownChiDelta - enemyChiDelta;

    const ownKey = String(ownAction?.key || "");
    const enemyKey = String(opponentAction?.key || "");

    const ownIsAI = ownKey === "A+I";
    const enemyIsAI = enemyKey === "A+I";
    const ownIsAGuard = isAGuardMove(before, slot, ownKey);
    const enemyIsAGuard = isAGuardMove(before, enemySlot, enemyKey);
    const ownIsS = isSMove(before, slot, ownKey);
    const enemyIsS = isSMove(before, enemySlot, enemyKey);
    const enemyMove = before.moves?.[enemySlot]?.[enemyKey];

    let tacticalDelta = 0;

    // Case 1: We used A+I (or A-guard) against opponent's S move and won Chi without losing LP
    if (
      (ownIsAI || ownIsAGuard) &&
      enemyIsS &&
      ownLpDelta >= 0 &&
      netChiDelta > 0
    ) {
      tacticalDelta += (ownIsAI ? 44 : 28) + 12 * netChiDelta;

      const enemyMinS = minSChiCost(before, enemySlot);
      if (beforeEnemy.chi >= enemyMinS && afterEnemy.chi < enemyMinS) {
        tacticalDelta += 26;
      }
    } else if (
      (ownIsAI || ownIsAGuard) &&
      enemyMove?.offensive &&
      ownLpDelta >= -15
    ) {
      // Clean Guard / Omni Guard mitigation bonus (+24 pts base)
      tacticalDelta += 24;
    }

    // Case 2: We used an S move into opponent's A+I (or A-guard), dealt 0 LP damage, and lost Chi
    if (
      ownIsS &&
      (enemyIsAI || enemyIsAGuard) &&
      enemyLpDelta >= 0 &&
      netChiDelta < 0
    ) {
      tacticalDelta -= (enemyIsAI ? 50 : 32) + 14 * Math.abs(netChiDelta);

      const ownMinS = minSChiCost(before, slot);
      if (beforeOwn.chi >= ownMinS && afterOwn.chi < ownMinS) {
        tacticalDelta -= 30;
      }
    }

    // Case 3: General Zero-LP turn with a clear Chi winner
    if (ownLpDelta === 0 && enemyLpDelta === 0 && Math.abs(netChiDelta) >= 1) {
      tacticalDelta += 6.5 * netChiDelta;
    }

    // Case 4: Beetle (defensive) Regime 1 (myCHI < oppCHI) 2.2x CHI differential boost
    if (difficulty === "defensive" && Number(beforeOwn.chi || 0) < Number(beforeEnemy.chi || 0)) {
      tacticalDelta += 5.5 * netChiDelta;
      if (ownChiDelta > 0 && ownLpDelta >= -10) {
        tacticalDelta += 4.0 * ownChiDelta;
      }
    }

    return tacticalDelta;
  }

  let evaluatorWarningShown = false;

  /*
   * Position evaluation with Rider's explicit EV point scale:
   * - w_LP = 1.40 per % Max LP
   * - w_CHI = 0.55 to 0.85 per % Max CHI
   * - w_Buff = 18.0 per active buff/status unit
   * - Terminal = +/- 120.0 (plus decisive KO dominance)
   */
  function evaluatePosition(
    state,
    slot,
    history,
    evaluator,
    isRider = false
  ) {
    let baseScore;

    if (typeof evaluator === "function") {
      try {
        const value = evaluator(state, slot, history);

        if (Number.isFinite(value)) {
          baseScore = value;
        } else {
          throw new Error(
            "Evaluator returned a non-finite score."
          );
        }
      } catch (error) {
        if (!evaluatorWarningShown) {
          evaluatorWarningShown = true;

          console.warn(
            "[ForeseeEngine] Evaluator failed; using heuristic fallback.",
            error
          );
        }
      }
    }

    if (baseScore === undefined) {
      baseScore = B.evaluate(state, slot);
    }

    let riderCalibration = 0;
    if (isRider && state) {
      const enemySlot = C.other(slot);
      const own = state[slot];
      const enemy = state[enemySlot];
      if (state.winner) {
        if (state.winner === slot) {
          riderCalibration += 120;
        } else if (state.winner !== "draw") {
          riderCalibration -= 120;
        }
      } else if (own && enemy) {
        const ownMaxLp = Math.max(1, Number(own.maxLp || 1600));
        const enemyMaxLp = Math.max(1, Number(enemy.maxLp || 1600));
        const lpPctDiff = (own.lp / ownMaxLp - enemy.lp / enemyMaxLp) * 100;

        const ownMaxChi = Math.max(1, Number(own.maxChi || 16));
        const enemyMaxChi = Math.max(1, Number(enemy.maxChi || 16));
        const ownMinS = minSChiCost(state, slot);
        const enemyMinS = minSChiCost(state, enemySlot);
        const nearCriticalChi =
          own.chi <= Math.max(3, ownMinS) ||
          enemy.chi <= Math.max(3, enemyMinS) ||
          own.chi / ownMaxChi < 0.30 ||
          enemy.chi / enemyMaxChi < 0.30;
        const wChi = nearCriticalChi ? 0.85 : 0.55;
        const chiPctDiff = (own.chi / ownMaxChi - enemy.chi / enemyMaxChi) * 100;

        const buffDiff =
          evaluateActiveBuffUnits(own) - evaluateActiveBuffUnits(enemy);

        const explicitEv =
          1.40 * lpPctDiff +
          wChi * chiPctDiff +
          18.0 * buffDiff;

        // Blend explicit EV point calibration with RiderBrains positional evaluation
        baseScore = 0.50 * baseScore + 0.50 * explicitEv;
      }
    }

    return baseScore + riderCalibration + evaluateDoomedStatus(state, slot);
  }

  function actionId(action) {
    return `${action.key}@${action.charge ?? 0}`;
  }

  function stableSort(a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    const x = actionId(a.action);
    const y = actionId(b.action);

    return x < y ? -1 : x > y ? 1 : 0;
  }

  /*
   * RIDER finalist selector: preserves top 8 highest-scoring (move, charge) finalists
   * intact first, then uses extra slots to test Matrix-advised and diverse moves.
   */
  function selectDiverseFinalists(sortedRows, limit, advisedKeys = null) {
    if (sortedRows.length <= limit) {
      return sortedRows.map(row => ({ ...row }));
    }

    const baseCount = Math.min(8, limit);
    const chosen = sortedRows.slice(0, baseCount).map(row => ({ ...row }));
    const chosenIds = new Set(chosen.map(row => actionId(row.action)));
    const seenKeys = new Set(chosen.map(row => row.action.key));

    if (Array.isArray(advisedKeys)) {
      for (const advisedKey of advisedKeys) {
        if (chosen.length >= limit) break;
        if (seenKeys.has(advisedKey)) continue;

        const match = sortedRows.find(
          row => row.action.key === advisedKey && !chosenIds.has(actionId(row.action))
        );
        if (match) {
          chosen.push({ ...match });
          chosenIds.add(actionId(match.action));
          seenKeys.add(advisedKey);
        }
      }
    }

    for (let i = baseCount; i < sortedRows.length && chosen.length < limit; i++) {
      const row = sortedRows[i];
      const id = actionId(row.action);
      if (!seenKeys.has(row.action.key) && !chosenIds.has(id)) {
        chosen.push({ ...row });
        chosenIds.add(id);
        seenKeys.add(row.action.key);
      }
    }

    for (let i = baseCount; i < sortedRows.length && chosen.length < limit; i++) {
      const row = sortedRows[i];
      const id = actionId(row.action);
      if (!chosenIds.has(id)) {
        chosen.push({ ...row });
        chosenIds.add(id);
      }
    }

    return chosen;
  }

  /*
   * BEETLE (defensive) finalist selector:
   * Guarantees DO_NOTHING (IDLE) and all legal A-guard moves (especially Omni Guard / A+I)
   * are present in the finalist pool before Monte Carlo rollouts run.
   */
  function selectBeetleFinalists(sortedRows, limit, state, slot) {
    if (sortedRows.length <= limit) {
      return sortedRows.map(row => ({ ...row }));
    }

    const chosen = [];
    const chosenIds = new Set();
    const seenKeys = new Set();

    function addRow(row) {
      if (!row || chosen.length >= limit) return;
      const id = actionId(row.action);
      if (chosenIds.has(id)) return;
      chosen.push({ ...row });
      chosenIds.add(id);
      seenKeys.add(row.action.key);
    }

    // Always seed top 3 raw rows first
    for (let i = 0; i < Math.min(3, sortedRows.length); i++) {
      addRow(sortedRows[i]);
    }

    // Force best variant of each legal A move (Omni Guard / Guard) into finalists
    for (const row of sortedRows) {
      if (chosen.length >= limit - 1) break;
      if (isAGuardMove(state, slot, row.action.key) && !seenKeys.has(row.action.key)) {
        addRow(row);
      }
    }

    // Force DO_NOTHING (IDLE) into finalists
    const idleRow = sortedRows.find(r => r.action.key === "DO_NOTHING");
    if (idleRow) {
      addRow(idleRow);
    }

    // Fill remaining finalist slots by score order
    for (const row of sortedRows) {
      if (chosen.length >= limit) break;
      addRow(row);
    }

    return chosen;
  }

  /*
   * BULLET ANT (master) Top-4 Directional Diversity Cap:
   * Prevents 4 charge variations of S or D from monopolizing all 4 selection slots,
   * capping any single offensive direction (S or D) to at most 2 slots in the Top 4
   * when competitive W, A, or IDLE options exist.
   */
  function diversifyMasterTop4(sortedFinalists, allSortedRows, state, slot) {
    if (!sortedFinalists || sortedFinalists.length <= 1) {
      return sortedFinalists;
    }

    // Merge finalists + remaining root rows in score order
    const seenIds = new Set(sortedFinalists.map(r => actionId(r.action)));
    const pool = [
      ...sortedFinalists,
      ...allSortedRows.filter(r => !seenIds.has(actionId(r.action)))
    ];

    const bestScore = pool[0]?.score ?? 0;
    const top4 = [];
    const usedIds = new Set();
    const usedKeys = new Set();
    const dirCounts = { W: 0, A: 0, S: 0, D: 0, IDLE: 0 };

    // Pass 1: Pick up to 4 unique move keys respecting max 2 per S/D direction
    // as long as the candidate is within a competitive window (38 pts of best)
    for (const row of pool) {
      if (top4.length >= 4) break;
      const key = row.action.key;
      const id = actionId(row.action);
      if (usedKeys.has(key)) continue;

      const dir = getMoveDirection(state, slot, key);
      const isOffensiveDir = dir === "S" || dir === "D";
      const maxForDir = isOffensiveDir ? 2 : 2;

      if ((dirCounts[dir] || 0) >= maxForDir) {
        continue;
      }

      if (top4.length > 0 && bestScore - row.score > 38) {
        continue;
      }

      top4.push(row);
      usedIds.add(id);
      usedKeys.add(key);
      dirCounts[dir] = (dirCounts[dir] || 0) + 1;
    }

    // Pass 2: If fewer than 4 unique move keys fit Pass 1, fill up to 4 with unique move keys
    for (const row of pool) {
      if (top4.length >= 4) break;
      const key = row.action.key;
      const id = actionId(row.action);
      if (usedKeys.has(key) || usedIds.has(id)) continue;

      top4.push(row);
      usedIds.add(id);
      usedKeys.add(key);
    }

    // Pass 3: Fill any still-open Top-4 slots + append remaining rows in score order
    for (const row of pool) {
      const id = actionId(row.action);
      if (!usedIds.has(id)) {
        top4.push(row);
        usedIds.add(id);
      }
    }

    return top4;
  }

  /*
   * RIDER Live 8-Second Counter-Adaptation EV (EV_Live):
   * Uses opponent direction & charge telemetry + anti-reset hysteresis.
   */
  function computeRiderLiveEV(state, slot, action, liveContext) {
    if (!liveContext || typeof liveContext !== "object" || liveContext.isInitial) {
      return 0;
    }

    const enemySlot = C.other(slot);
    const ownMove = state?.moves?.[slot]?.[action.key];
    const ownDir = getMoveDirection(state, slot, action.key);

    const liveSelfDir = String(liveContext.selfDirection || "").toUpperCase();
    const liveSelfCharge = K.clamp(Number(liveContext.selfCharge) || 0, 0, 100);
    const liveOppDir = String(liveContext.oppDirection || "").toUpperCase();
    const liveOppCharge = K.clamp(Number(liveContext.oppCharge) || 0, 0, 100);
    const liveOppElapsedMs = Math.max(0, Number(liveContext.oppElapsedMs) || 0);
    const liveRemainingMs = Number.isFinite(liveContext.remainingMs)
      ? Math.max(0, Number(liveContext.remainingMs))
      : 7700;
    const liveOppSwitchCount = Math.max(0, Number(liveContext.oppSwitchCount) || 0);

    const feintDampener =
      liveOppSwitchCount >= 2 && liveOppElapsedMs < 600
        ? 0.55
        : 1.0;

    let evLive = 0;

    // Case A: Opponent is charging an Attack (S or D) with >= 20% charge
    if ((liveOppDir === "S" || liveOppDir === "D") && liveOppCharge >= 20) {
      const chargeScale = K.clamp(liveOppCharge / 100, 0.20, 1.0) * feintDampener;

      if (ownDir === "A") {
        const omniMult = isOmniGuardMove(state, slot, action.key) ? 1.35 : 1.0;
        evLive += 28 * chargeScale * omniMult;
      } else if (ownMove?.offensive) {
        // Check if our action can beat the opponent's probable attack in priority
        const oppSampleKey = liveOppDir + "+K";
        const oppSampleAction = {
          key: state?.moves?.[enemySlot]?.[oppSampleKey] ? oppSampleKey : liveOppDir + "+J",
          charge: Math.min(100, Math.max(liveOppCharge, 62))
        };
        const priorityCmp =
          C.comparePriority(
            state,
            slot === "p1" ? action : oppSampleAction,
            slot === "p1" ? oppSampleAction : action
          ) * (slot === "p1" ? 1 : -1);

        if (priorityCmp > 0) {
          evLive += 22 * chargeScale;
        } else {
          evLive -= 16 * chargeScale;
        }
      } else if (action.key === "DO_NOTHING" || ownDir === "W") {
        evLive -= 24 * chargeScale;
      }
    }
    // Case B: Opponent is holding Guard / Counter (A)
    else if (liveOppDir === "A" && liveOppCharge >= 10) {
      const guardScale = K.clamp(liveOppCharge / 100, 0.25, 1.0) * feintDampener;
      if (ownDir === "S") {
        evLive -= 35 * guardScale;
      } else if (ownDir === "W" || action.key === "DO_NOTHING") {
        evLive += 20 * guardScale;
      } else if (ownDir === "D" && Number(ownMove?.chiCost || 0) <= 1) {
        evLive += 14 * guardScale;
      }
    }
    // Case C: Opponent is holding Buff (W) or IDLE (no direction)
    else if (liveOppDir === "W" || (!liveOppDir && liveRemainingMs < 5000)) {
      if (ownMove?.offensive && (ownDir === "D" || ownDir === "S")) {
        evLive += 20;
      } else if (ownDir === "W") {
        evLive += 14;
      }
    }

    // Anti-Reset Hysteresis: switching away from a held direction resets charge to 1%
    if (liveSelfDir && liveSelfCharge >= 5) {
      if (ownDir === liveSelfDir) {
        evLive += 3.0 * (liveSelfCharge / 100);
      } else {
        const deltaSwitch = 12 + 0.25 * liveSelfCharge;
        evLive -= deltaSwitch;

        if (action.key !== "DO_NOTHING" && ownMove) {
          const neededMs = C.timeToChargeMs(
            state[slot],
            ownMove.direction,
            action.charge,
            0
          );
          if (neededMs > liveRemainingMs - 150) {
            evLive -= 18;
          }
        }
      }
    }

    return evLive;
  }

  function sample(entries, rng) {
    let remaining = rng();

    for (const entry of entries) {
      remaining -= entry.probability;

      if (remaining <= 0) {
        return entry.action;
      }
    }

    return entries[entries.length - 1].action;
  }

  function sampleRankedAction(rows, rng) {
    if (!rows || rows.length === 0) {
      return null;
    }

    const roll = rng();
    let targetIndex = 0;

    if (roll < 0.50) {
      targetIndex = 0;
    } else if (roll < 0.80) {
      targetIndex = 1;
    } else if (roll < 0.95) {
      targetIndex = 2;
    } else {
      targetIndex = 3;
    }

    const safeIndex = Math.min(
      targetIndex,
      rows.length - 1
    );

    const bestRow = rows[0];
    const candidateRow = rows[safeIndex];

    if (
      bestRow &&
      candidateRow &&
      Number.isFinite(bestRow.score) &&
      Number.isFinite(candidateRow.score) &&
      bestRow.score - candidateRow.score > 18
    ) {
      return bestRow;
    }

    return candidateRow;
  }

  /*
   * Model move usage, attack-button habits (J/K/I/L), direction habits (A/D/S/W),
   * A+I usage, and A+I vs S trap habits from recent history.
   */
  function observations(history, slot) {
    const counts = {};
    const charges = [];
    const buttonCounts = { J: 0, K: 0, I: 0, L: 0 };
    const dirCounts = { A: 0, D: 0, S: 0, W: 0 };
    const otherSlot = C.other(slot);

    let guardWeight = 0;
    let aIWeight = 0;
    let aIVsSWeight = 0;
    let aIConsecutive = 0;
    let streakBroken = false;
    let recentTurns = 0;
    let recentAICount = 0;
    let recentSCount = 0;

    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];

      if (turn.fainted && turn.fainted[slot]) {
        continue;
      }

      const action = turn[slot] || turn.actions?.[slot];
      if (!action) {
        continue;
      }

      const key = String(action.key || "");
      if (!streakBroken) {
        if (key === "A+I") {
          aIConsecutive++;
        } else if (key !== "DO_NOTHING") {
          streakBroken = true;
        }
      }

      if (recentTurns < 5) {
        recentTurns++;
        if (key === "A+I") {
          recentAICount++;
        } else if (key.startsWith("S+")) {
          recentSCount++;
        }
      }
    }

    for (let i = 0; i < history.length; i++) {
      const turn = history[i];

      if (turn.fainted && turn.fainted[slot]) {
        continue;
      }

      const action = turn[slot] || turn.actions?.[slot];
      if (!action) {
        continue;
      }

      const weight = Math.pow(
        0.90,
        history.length - 1 - i
      );

      const key = String(action.key || "");
      const otherAction = turn[otherSlot] || turn.actions?.[otherSlot];
      const otherKey = String(otherAction?.key || "");

      counts[key] = (counts[key] || 0) + weight;

      if (key === "A+I") {
        aIWeight += weight;
        if (otherKey.startsWith("S+")) {
          aIVsSWeight += weight * 1.5;
        }
      }

      if (key.includes("+")) {
        const [dir, btn] = key.split("+");
        if (Object.prototype.hasOwnProperty.call(dirCounts, dir)) {
          dirCounts[dir] += weight;
        }
        if (dir === "A") {
          guardWeight += weight;
        } else if (
          (dir === "D" || dir === "S" || dir === "W") &&
          Object.prototype.hasOwnProperty.call(buttonCounts, btn)
        ) {
          buttonCounts[btn] += weight;
        }
      }

      if (
        key !== "DO_NOTHING" &&
        Number.isFinite(action.charge) &&
        action.charge >= 1 &&
        action.charge <= 100
      ) {
        charges.push({
          charge: action.charge,
          weight
        });
      }
    }

    const recentAIMoveRate = recentTurns > 0 ? recentAICount / recentTurns : 0;
    const recentSMoveRate = recentTurns > 0 ? recentSCount / recentTurns : 0;

    return {
      counts,
      charges,
      buttonCounts,
      dirCounts,
      guardWeight,
      aIWeight,
      aIVsSWeight,
      aIConsecutive,
      recentAIMoveRate,
      recentSMoveRate
    };
  }

  /*
   * Build an action probability distribution from:
   * - RiderBrains tactical priors
   * - Observed move, button, direction, and A+I vs S tendencies
   * - Current legal actions with +1..12% randomized tactical charges
   */
  function policy(
    state,
    slot,
    history,
    difficulty,
    rolloutSelf = false,
    counterRead = false,
    dirConstraints = null,
    liveContext = null
  ) {
    const normDiff = normalizeDifficulty(difficulty);
    const brainDiff = brainDifficultyKey(normDiff);
    const otherSlot = C.other(slot);
    const observed = observations(history || [], slot);
    const otherObserved = observations(history || [], otherSlot);

    const isSmartTier =
      counterRead ||
      normDiff === "defensive" ||
      normDiff === "master" ||
      normDiff === "rider";

    const ownCanUseS = canUseSMove(state, slot, dirConstraints);
    const otherCanUseS = canUseSMove(state, otherSlot);
    const otherCanUseAI = canUseMoveKey(state, otherSlot, "A+I");

    const extraCharges = [];

    for (const item of observed.charges.slice(-3)) {
      extraCharges.push(item.charge);
      extraCharges.push(
        Math.max(1, item.charge - 1)
      );
    }

    if (
      !rolloutSelf &&
      liveContext &&
      Number.isFinite(liveContext.oppCharge) &&
      liveContext.oppCharge >= 1
    ) {
      extraCharges.push(Math.floor(liveContext.oppCharge));
    }

    const policyRng = K.rng(
      K.hash(
        state?.round || 1,
        (history && history.length) || 0,
        slot,
        rolloutSelf ? "self_policy" : "opp_policy"
      )
    );

    const available = buildRandomizedActions(
      state,
      slot,
      extraCharges,
      dirConstraints,
      policyRng
    );

    const groups = {};

    for (const action of available) {
      (groups[action.key] ||= []).push(action);
    }

    const tree = B.intent(
      state,
      slot,
      brainDiff
    ) || {};

    const preferredMoves = Array.isArray(tree.preferred)
      ? tree.preferred
      : [];

    const otherTree = isSmartTier
      ? B.intent(state, otherSlot, "master") || {}
      : null;
    const otherPreferred = Array.isArray(otherTree?.preferred)
      ? otherTree.preferred
      : [];

    const otherPrefersS = otherPreferred.some(prefKey =>
      isSMove(state, otherSlot, prefKey) && canUseMoveKey(state, otherSlot, prefKey)
    );

    const liveOppDir =
      !rolloutSelf && liveContext && !liveContext.isInitial
        ? String(liveContext.oppDirection || "").toUpperCase()
        : "";
    const liveOppCharge =
      !rolloutSelf && liveContext
        ? K.clamp(Number(liveContext.oppCharge) || 0, 0, 100)
        : 0;
    const liveOppElapsedMs =
      !rolloutSelf && liveContext
        ? Math.max(0, Number(liveContext.oppElapsedMs) || 0)
        : 0;
    const liveRemainingMs =
      !rolloutSelf && liveContext && Number.isFinite(liveContext.remainingMs)
        ? Math.max(0, Number(liveContext.remainingMs))
        : 7700;
    const liveOppSwitchCount =
      !rolloutSelf && liveContext
        ? Math.max(0, Number(liveContext.oppSwitchCount) || 0)
        : 0;

    const faintThreshold = Math.max(
      1,
      Number(g.COMBAT_RULES?.FAINT_THRESHOLD || 100)
    );
    const slotFaintRatio = Number(state[slot]?.faintMeter || 0) / faintThreshold;
    const otherChi = Number(state[otherSlot]?.chi || 0);
    const otherMinS = minSChiCost(state, otherSlot);
    const slotUnderHighFaintRisk = slotFaintRatio > 0.75 && otherChi >= otherMinS;

    const entries = [];

    for (const [key, group] of Object.entries(groups)) {
      const move = state.moves?.[slot]?.[key];
      let keyWeight =
        3 * B.prior(
          state,
          slot,
          group[0],
          brainDiff
        ) +
        (observed.counts[key] || 0);

      if (
        rolloutSelf &&
        preferredMoves.includes(key)
      ) {
        keyWeight *= 3;
      }

      // Beetle (defensive) rollout self-policy favors A-guards and IDLE when behind in CHI
      if (
        rolloutSelf &&
        normDiff === "defensive" &&
        Number(state[slot]?.chi || 0) < Number(state[otherSlot]?.chi || 0)
      ) {
        if (isAGuardMove(state, slot, key)) {
          keyWeight *= isOmniGuardMove(state, slot, key) ? 2.8 : 2.1;
        } else if (key === "DO_NOTHING" || isWMove(state, slot, key)) {
          keyWeight *= 1.65;
        } else if (isSMove(state, slot, key) || isDMove(state, slot, key)) {
          keyWeight *= 0.65;
        }
      }

      if (!rolloutSelf && liveOppDir && move) {
        const timeFraction = K.clamp(1 - liveRemainingMs / 7700, 0, 1);
        const chargeProgress = K.clamp(liveOppCharge / 100, 0, 1);
        const feintDampener =
          liveOppSwitchCount >= 2 && liveOppElapsedMs < 600
            ? 0.55
            : 1.0;

        if (move.direction === liveOppDir) {
          const commitmentBoost =
            1.0 +
            feintDampener * (
              1.6 +
              2.6 * chargeProgress +
              1.6 * timeFraction
            );
          keyWeight *= commitmentBoost;
        } else if (key === "DO_NOTHING") {
          keyWeight *= 0.25;
        } else if (move.direction) {
          const switchMaxCharge = C.maxCharge(
            state[slot],
            move.direction,
            liveRemainingMs
          );
          const switchFeasibility = K.clamp(switchMaxCharge / 100, 0.10, 1.0);
          keyWeight *=
            switchFeasibility *
            Math.max(0.20, 1 - 0.65 * timeFraction);
        }
      }

      if (isSmartTier && move) {
        const isKeyAI = key === "A+I";
        const isKeyS = isSMove(state, slot, key);

        if (isKeyAI) {
          if (otherCanUseS) {
            const sThreatLevel =
              1.0 +
              (otherPrefersS ? 0.65 : 0.25) +
              0.45 * (otherObserved.dirCounts.S || 0) +
              1.20 * (otherObserved.recentSMoveRate || 0);

            keyWeight = Math.max(keyWeight, 2.8) * (1.45 * sThreatLevel);
          }

          if (!rolloutSelf && (observed.aIWeight > 0 || observed.aIConsecutive > 0)) {
            const habitMultiplier =
              1.0 +
              1.8 * observed.aIWeight +
              1.6 * observed.aIVsSWeight +
              1.5 * observed.aIConsecutive;

            const habitFloor = ownCanUseS
              ? 3.5 * (observed.aIWeight + observed.aIConsecutive)
              : 1.5 * observed.aIWeight;

            keyWeight = Math.max(keyWeight * habitMultiplier, keyWeight + habitFloor);
          }
        } else if (isKeyS) {
          if (!rolloutSelf && observed.dirCounts.S > 0.5) {
            keyWeight *= 1.0 + 0.35 * Math.min(4, observed.dirCounts.S);
          }

          if (
            otherCanUseAI &&
            (otherObserved.aIWeight > 0.25 || otherObserved.aIConsecutive >= 1)
          ) {
            const trapDampener =
              1.0 +
              1.35 * otherObserved.aIWeight +
              1.25 * otherObserved.aIVsSWeight +
              1.10 * otherObserved.aIConsecutive;

            keyWeight /= trapDampener;
          }
        } else if (
          move.offensive &&
          (move.direction === "D" || move.direction === "W") &&
          ownCanUseS &&
          otherCanUseAI &&
          (otherObserved.aIWeight > 0.30 || otherObserved.aIConsecutive >= 1)
        ) {
          keyWeight *= 1.25 + 0.35 * Math.min(3, otherObserved.aIWeight + otherObserved.aIConsecutive);
        }

        if (counterRead) {
          if (move.guardKind === "matching" && move.guardButton) {
            const btn = move.guardButton;
            const ourButtonHabit = otherObserved?.buttonCounts?.[btn] || 0;
            const ourTelegraphedPreferred = otherPreferred.some(prefKey => {
              const pm = state.moves?.[otherSlot]?.[prefKey];
              return pm?.offensive && pm.button === btn && pm.chiCost <= state[otherSlot].chi;
            });

            let parryLikelihood = 1.0 + 0.25 * Math.max(0, ourButtonHabit - 0.8) + 0.75 * observed.guardWeight;
            if (ourTelegraphedPreferred && state[otherSlot].chi >= 5 && observed.guardWeight > 0.25) {
              parryLikelihood += 0.35;
            }
            keyWeight *= parryLikelihood;
          } else if (move.offensive && move.button) {
            const btnHabit = observed.buttonCounts[move.button] || 0;
            if (btnHabit > 1.0) {
              keyWeight *= 1 + 0.20 * (btnHabit - 1.0);
            }
          }
        }
      }

      const local = group.map(action => {
        const actCharge = action.charge ?? 0;
        const offensive = isOffensiveMove(state, slot, action.key);

        let weight = 1.0;
        if (offensive) {
          if (slotUnderHighFaintRisk) {
            // Under >75% faint + opponent Chi threat: prefer 60-76% fast priority band
            weight = actCharge >= 60 && actCharge <= 76 ? 1.55 : actCharge > 82 ? 0.45 : 0.85;
          } else {
            weight = actCharge >= 68 && actCharge <= 92 ? 1.30 : actCharge >= 60 ? 1.0 : 0.40;
          }
        } else {
          weight = actCharge >= 24 && actCharge <= 48 ? 1.35 : 0.70;
        }

        for (const item of observed.charges) {
          weight +=
            item.weight *
            Math.exp(
              -Math.abs(actCharge - item.charge) / 12
            );
        }

        if (state[otherSlot].isFainted || otherChi <= 1) {
          weight *= actCharge >= 88
            ? 3.5
            : 0.35;
        }

        return { action, weight };
      });

      const localTotal = local.reduce(
        (sum, entry) => sum + entry.weight,
        0
      );

      for (const entry of local) {
        entries.push({
          action: entry.action,
          weight:
            keyWeight *
            (
              localTotal > 0
                ? entry.weight / localTotal
                : 1.0
            )
        });
      }
    }

    const total = entries.reduce(
      (sum, entry) => sum + entry.weight,
      0
    );

    return entries.map(entry => ({
      action: entry.action,
      probability: total > 0
        ? entry.weight / total
        : 1 / entries.length
    }));
  }

  function orderedActions(
    slot,
    ownAction,
    opponentAction
  ) {
    return slot === "p1"
      ? [ownAction, opponentAction]
      : [opponentAction, ownAction];
  }

  function pairValue(
    state,
    slot,
    ownAction,
    opponentAction,
    evaluator = null,
    history = [],
    difficulty = "balanced",
    isRider = false
  ) {
    const [a1, a2] = orderedActions(
      slot,
      ownAction,
      opponentAction
    );

    const nextHistory = appendForecastHistory(
      history,
      state,
      a1,
      a2
    );

    return C.distribution(state, a1, a2).reduce(
      (sum, result) =>
        sum +
        result.probability *
        (
          evaluatePosition(
            result.state,
            slot,
            nextHistory,
            evaluator,
            isRider
          ) +
          evaluateTransitionTactics(
            state,
            result.state,
            slot,
            ownAction,
            opponentAction,
            difficulty
          )
        ),
      0
    );
  }

  function search(context) {
    const startTimeMs = nowMs();

    const {
      state,
      slot,
      history = [],
      seed = 1,
      evaluator = null,
      candidates = null,
      isTraining = false
    } = context;

    const liveContext =
      context.liveContext ||
      state?.liveContext ||
      null;

    const usingNeural = typeof evaluator === "function";
    const isRider = Boolean(context.isRider) || usingNeural;

    const difficulty = isRider
      ? "rider"
      : normalizeDifficulty(context.difficulty);
    const brainDiff = brainDifficultyKey(difficulty);

    const isBeetle = difficulty === "defensive";
    const isBulletAnt = difficulty === "master" && !isRider;

    const isSmartDifficulty =
      isRider ||
      isBeetle ||
      difficulty === "master" ||
      difficulty === "rider";

    const requestedBudgetMs = Number(
      context.timeBudgetMs ?? context.timeLimitMs ?? context.maxTimeMs ?? 0
    );
    const activeTimeBudgetMs =
      !isTraining && isRider && Number.isFinite(requestedBudgetMs) && requestedBudgetMs > 0
        ? requestedBudgetMs
        : 0;
    const deadlineMs = activeTimeBudgetMs > 0
      ? startTimeMs + activeTimeBudgetMs
      : 0;

    const evalFn = (
      s,
      sl,
      branchHistory = history
    ) => evaluatePosition(
      s,
      sl,
      branchHistory,
      evaluator,
      isRider
    );

    const settings = getLevelSettings(difficulty);

    let minRollouts = settings.rollouts;
    let maxRollouts = settings.rollouts;

    if (isTraining) {
      settings.horizon = Math.min(
        settings.horizon,
        2
      );

      settings.rollouts = Math.min(
        settings.rollouts,
        4
      );

      settings.finalists = Math.min(
        settings.finalists,
        2
      );

      minRollouts = settings.rollouts;
      maxRollouts = settings.rollouts;
    } else if (isRider) {
      settings.risk = 0.25; // 0.75 * Mean + 0.25 * WorstCase
      settings.finalists = Math.max(settings.finalists, 10);
      const isLiveReplan = Boolean(liveContext && !liveContext.isInitial);
      minRollouts = isLiveReplan
        ? Math.max(32, Math.floor(settings.rollouts * 0.5))
        : Math.max(settings.rollouts, 80);
      maxRollouts = activeTimeBudgetMs > 0
        ? Math.max(minRollouts, 128)
        : Math.max(settings.rollouts, 96);
      settings.rollouts = maxRollouts;
    }

    const opponentSlot = C.other(slot);
    const extraCharges = [];

    for (const turn of history) {
      const observed = turn[opponentSlot] || turn.actions?.[opponentSlot];

      if (
        observed &&
        observed.key !== "DO_NOTHING" &&
        !turn.fainted?.[opponentSlot] &&
        Number.isFinite(observed.charge) &&
        observed.charge >= 1 &&
        observed.charge <= 100
      ) {
        extraCharges.push(
          Math.max(1, observed.charge - 1)
        );
      }
    }

    if (
      liveContext &&
      !liveContext.isInitial &&
      Number.isFinite(liveContext.selfCharge) &&
      liveContext.selfCharge >= 1
    ) {
      extraCharges.push(Math.floor(liveContext.selfCharge));
    }

    const selfConstraints = buildDirectionConstraints(
      state,
      slot,
      liveContext,
      true
    );

    const oppConstraints = buildDirectionConstraints(
      state,
      opponentSlot,
      liveContext,
      false
    );

    const chargeJitterRng = K.rng(
      K.hash(
        seed,
        "charge_jitter_v2",
        state?.round || 1,
        history.length,
        slot,
        difficulty
      )
    );

    const allOwnActions = buildRandomizedActions(
      state,
      slot,
      extraCharges,
      selfConstraints,
      chargeJitterRng
    );

    let ownActions = allOwnActions;

    const enemyObserved = observations(history, opponentSlot);
    const enemyCanUseS = canUseSMove(state, opponentSlot, oppConstraints);
    const ownCanUseS = canUseSMove(state, slot, selfConstraints);

    if (
      Array.isArray(candidates) &&
      candidates.length > 0
    ) {
      const filtered = allOwnActions.filter(action =>
        candidates.includes(action.key) ||
        candidates.includes(action) ||
        candidates.some(candidate =>
          typeof candidate === "object" &&
          candidate.key === action.key
        )
      );

      if (filtered.length > 0) {
        ownActions = filtered;

        if (isSmartDifficulty) {
          const existingIds = new Set(ownActions.map(actionId));

          if (enemyCanUseS || isBeetle) {
            for (const act of allOwnActions) {
              if (
                (act.key === "A+I" || (isBeetle && (isAGuardMove(state, slot, act.key) || act.key === "DO_NOTHING"))) &&
                !existingIds.has(actionId(act))
              ) {
                ownActions.push(act);
                existingIds.add(actionId(act));
              }
            }
          }

          if (enemyObserved.aIWeight > 0.30 || enemyObserved.aIConsecutive >= 1) {
            for (const act of allOwnActions) {
              const mv = state.moves?.[slot]?.[act.key];
              if (
                mv?.offensive &&
                (mv.direction === "D" || mv.direction === "W") &&
                !existingIds.has(actionId(act))
              ) {
                ownActions.push(act);
                existingIds.add(actionId(act));
              }
            }
          }
        }
      }
    }

    const opponentPolicy = policy(
      state,
      opponentSlot,
      history,
      "master",
      false,
      isSmartDifficulty,
      oppConstraints,
      liveContext
    );

    let enemySProb = 0;
    let enemyAIProb = 0;

    for (const entry of opponentPolicy) {
      const k = entry.action.key;
      if (k === "A+I") {
        enemyAIProb += entry.probability;
      } else if (isSMove(state, opponentSlot, k)) {
        enemySProb += entry.probability;
      }
    }

    // Query Rider Matrix EV (30 * P_Matrix + 45 * V_Matrix) or fallback actionBonuses
    const rootMatrixMetrics =
      usingNeural && typeof evaluator.matrixMetrics === "function"
        ? evaluator.matrixMetrics(state, slot, history)
        : null;

    const rootNeuralBonuses =
      usingNeural && typeof evaluator.actionBonuses === "function"
        ? evaluator.actionBonuses(state, slot, history)
        : null;

    const rawAdvisedKeys =
      usingNeural && typeof evaluator.advisedMoves === "function"
        ? evaluator.advisedMoves(state, slot, history)
        : [];

    const advisedKeys = Array.isArray(rawAdvisedKeys)
      ? [...rawAdvisedKeys]
      : [];

    if (isSmartDifficulty && enemyCanUseS && !advisedKeys.includes("A+I")) {
      advisedKeys.unshift("A+I");
    }

    const liveSelfDir =
      liveContext && !liveContext.isInitial
        ? String(liveContext.selfDirection || "").toUpperCase()
        : "";
    const liveSelfCharge =
      liveContext && !liveContext.isInitial
        ? K.clamp(Number(liveContext.selfCharge) || 0, 0, 100)
        : 0;
    const liveRemainingMs =
      liveContext && !liveContext.isInitial && Number.isFinite(liveContext.remainingMs)
        ? Math.max(0, Number(liveContext.remainingMs))
        : 7700;

    const myChi = Number(state[slot]?.chi || 0);
    const oppChi = Number(state[opponentSlot]?.chi || 0);
    const myMaxChi = Math.max(1, Number(state[slot]?.maxChi || 16));
    const myLp = Number(state[slot]?.lp || 0);
    const oppLp = Number(state[opponentSlot]?.lp || 0);
    const oppMinS = minSChiCost(state, opponentSlot);
    const consecutiveSD = countConsecutiveSD(history, slot);

    const rows = [];

    /*
     * Step 1: one-turn expectimax evaluation.
     */
    for (const action of ownActions) {
      let expected = 0;
      let worst = Infinity;

      for (const opponent of opponentPolicy) {
        const value = pairValue(
          state,
          slot,
          action,
          opponent.action,
          evalFn,
          history,
          difficulty,
          isRider
        );

        expected += opponent.probability * value;
        worst = Math.min(worst, value);
      }

      const evMatrix =
        rootMatrixMetrics && Number.isFinite(rootMatrixMetrics[action.key]?.evMatrix)
          ? rootMatrixMetrics[action.key].evMatrix
          : rootNeuralBonuses && Number.isFinite(rootNeuralBonuses[action.key])
            ? rootNeuralBonuses[action.key]
            : 0;

      let baseMoveBonus = B.bonus(
        state,
        slot,
        action,
        brainDiff
      );

      // Apply the 4 Tactical Charge Rules (Hit-chance balance + Faint > 75% & oppChi check)
      let tacticalRootBonus = evaluateTacticalChargeBonus(
        state,
        slot,
        action
      );
      const ownMove = state.moves?.[slot]?.[action.key];

      if (isSmartDifficulty) {
        if (action.key === "A+I" && enemyCanUseS) {
          tacticalRootBonus +=
            36 * enemySProb +
            8 * Math.min(2.5, enemyObserved.dirCounts.S) +
            (oppChi >= oppMinS + 2 ? 10 : 0);
        } else if (isSMove(state, slot, action.key)) {
          if (
            enemyAIProb >= 0.16 ||
            enemyObserved.aIWeight >= 0.35 ||
            enemyObserved.aIConsecutive >= 1
          ) {
            const trapRisk = Math.min(
              1,
              enemyAIProb * 1.6 +
              0.30 * enemyObserved.aIWeight +
              0.35 * enemyObserved.aIConsecutive
            );

            if (baseMoveBonus > 0) {
              baseMoveBonus *= Math.max(0, 1 - trapRisk);
            }

            tacticalRootBonus -=
              32 * enemyAIProb +
              12 * enemyObserved.aIConsecutive +
              10 * Math.min(3, enemyObserved.aIVsSWeight);
          }
        } else if (
          ownMove?.offensive &&
          (ownMove.direction === "D" || ownMove.direction === "W") &&
          ownCanUseS &&
          (enemyAIProb >= 0.20 || enemyObserved.aIConsecutive >= 1)
        ) {
          tacticalRootBonus +=
            16 * enemyAIProb +
            8 * Math.min(2, enemyObserved.aIConsecutive);
        }
      }

      /*
       * BEETLE (defensive) Two-Regime Evaluation:
       * - Regime 1 (myChi < oppChi): Guard/OmniGuard priority bonus (1.35x for Guard trait),
       *   50% A-skill CHI cost discount, IDLE/W recovery boost, 0.65x S/D attack restraint.
       * - Regime 2 (myChi >= oppChi): Normal balanced-offensive evaluation.
       */
      if (isBeetle && myChi < oppChi) {
        const chiDeficit = Math.min(6, oppChi - myChi);
        if (isAGuardMove(state, slot, action.key)) {
          const rawGuardBonus =
            28 +
            8 * chiDeficit +
            (oppChi >= oppMinS ? 25 : 0);
          const traitMultiplier = hasGuardTrait(state, slot, action.key) ? 1.35 : 1.0;
          const chiDiscountCompensation = 4.5 * Math.max(0, Number(ownMove?.chiCost || 0));
          tacticalRootBonus += rawGuardBonus * traitMultiplier + chiDiscountCompensation;
        } else if (action.key === "DO_NOTHING") {
          tacticalRootBonus += enemySProb < 0.25 ? 24 : 18;
        } else if (isWMove(state, slot, action.key)) {
          tacticalRootBonus += 20;
        } else if (
          (isSMove(state, slot, action.key) || isDMove(state, slot, action.key)) &&
          !state[opponentSlot]?.isFainted &&
          oppLp > 220
        ) {
          if (baseMoveBonus > 0) {
            baseMoveBonus *= 0.65;
          }
          tacticalRootBonus -= 14;
        }
      }

      /*
       * BULLET ANT (master) State-Aware Tactical Shift (myLp > oppLp) & Anti-Spam:
       * Promotes W buffs, A guards, and low-CHI IDLE into the Top 4 when holding an LP lead.
       */
      if (isBulletAnt) {
        if (myLp > oppLp) {
          if (isWMove(state, slot, action.key)) {
            const buffId = ownMove?.buff?.id || action.key;
            const alreadyActive = (state[slot]?.activeBuffs || []).some(
              b => b.id === buffId && Number(b.roundsLeft) > 1
            );
            if (!alreadyActive) {
              tacticalRootBonus += 22;
            }
          } else if (isAGuardMove(state, slot, action.key)) {
            tacticalRootBonus += (action.key === "A+I" && enemyCanUseS) ? 30 : 18;
          } else if (action.key === "DO_NOTHING" && myChi < 0.60 * myMaxChi) {
            tacticalRootBonus += 20 + 2.5 * Math.max(0, 0.60 * myMaxChi - myChi);
          }
        }

        if (
          (isSMove(state, slot, action.key) || isDMove(state, slot, action.key)) &&
          !state[opponentSlot]?.isFainted &&
          (consecutiveSD >= 2 || myChi <= 3)
        ) {
          tacticalRootBonus -= 16 + 6 * Math.max(0, consecutiveSD - 1);
        }
      }

      /*
       * Real-time 8s window evaluation:
       * - Rider uses the full EV_Live counter-adaptation & hysteresis model.
       * - Other smart tiers preserve charge and avoid unreachable switches.
       */
      let evLive = 0;
      if (isRider) {
        evLive = computeRiderLiveEV(state, slot, action, liveContext);
      } else if (isSmartDifficulty && liveSelfDir && ownMove) {
        if (ownMove.direction === liveSelfDir) {
          tacticalRootBonus += 2.5 * (liveSelfCharge / 100);
        } else if (action.key !== "DO_NOTHING") {
          const neededMs = C.timeToChargeMs(
            state[slot],
            ownMove.direction,
            action.charge,
            0
          );
          if (neededMs > liveRemainingMs - 150) {
            tacticalRootBonus -= 6;
          }
        }
      }

      const evTree =
        (1 - settings.risk) * expected +
        settings.risk * worst +
        baseMoveBonus +
        tacticalRootBonus;

      rows.push({
        action,
        expected,
        worst,
        evTree,
        evMatrix,
        evLive,
        score: evTree + evMatrix + evLive
      });
    }

    rows.sort(stableSort);

    let finalists = rows;
    let completedHorizon = 1;
    let completedRollouts = 0;

    /*
     * Step 2: multi-turn Monte Carlo continuation.
     */
    if (
      settings.horizon > 1 &&
      rows.length > 1 &&
      !state.winner
    ) {
      if (isRider) {
        finalists = selectDiverseFinalists(rows, settings.finalists, advisedKeys);
      } else if (isBeetle) {
        finalists = selectBeetleFinalists(rows, settings.finalists, state, slot);
      } else {
        finalists = rows.slice(0, settings.finalists).map(row => ({ ...row }));
        if (
          isSmartDifficulty &&
          enemyCanUseS &&
          !finalists.some(r => r.action.key === "A+I")
        ) {
          const bestAIRow = rows.find(r => r.action.key === "A+I");
          if (bestAIRow && finalists.length > 0) {
            finalists[finalists.length - 1] = { ...bestAIRow };
          }
        }
      }

      const continuationSums = new Float64Array(finalists.length);

      for (
        let sampleIndex = 0;
        sampleIndex < maxRollouts;
        sampleIndex++
      ) {
        if (
          deadlineMs > 0 &&
          sampleIndex >= minRollouts &&
          nowMs() >= deadlineMs
        ) {
          break;
        }

        for (let fIdx = 0; fIdx < finalists.length; fIdx++) {
          const row = finalists[fIdx];

          const rng = K.rng(
            K.hash(
              seed,
              "forecast",
              sampleIndex
            )
          );

          const opponentAction = sample(
            opponentPolicy,
            rng
          );

          let [a1, a2] = orderedActions(
            slot,
            row.action,
            opponentAction
          );

          const firstResult = C.resolve(
            state,
            a1,
            a2,
            rng,
            false
          );

          let future = firstResult.state;

          let futureHistory = appendForecastHistory(
            history,
            state,
            firstResult.actions.p1,
            firstResult.actions.p2
          );

          const firstValue = evalFn(
            future,
            slot,
            futureHistory
          );

          let rolloutTacticalDelta = 0;

          for (
            let depth = 1;
            depth < settings.horizon && !future.winner;
            depth++
          ) {
            const ownPolicy = policy(
              future,
              slot,
              futureHistory,
              difficulty,
              true,
              isSmartDifficulty
            );

            const enemyPolicy = policy(
              future,
              opponentSlot,
              futureHistory,
              "master",
              false,
              isSmartDifficulty
            );

            const ownNext = sample(
              ownPolicy,
              rng
            );

            const enemyNext = sample(
              enemyPolicy,
              rng
            );

            [a1, a2] = orderedActions(
              slot,
              ownNext,
              enemyNext
            );

            const beforeFuture = future;

            const nextResult = C.resolve(
              beforeFuture,
              a1,
              a2,
              rng,
              false
            );

            futureHistory = appendForecastHistory(
              futureHistory,
              beforeFuture,
              nextResult.actions.p1,
              nextResult.actions.p2
            );

            future = nextResult.state;

            rolloutTacticalDelta +=
              Math.pow(0.85, depth) *
              evaluateTransitionTactics(
                beforeFuture,
                future,
                slot,
                ownNext,
                enemyNext,
                difficulty
              );
          }

          continuationSums[fIdx] +=
            evalFn(
              future,
              slot,
              futureHistory
            ) -
            firstValue +
            rolloutTacticalDelta;
        }

        completedRollouts = sampleIndex + 1;
      }

      if (completedRollouts > 0) {
        for (let fIdx = 0; fIdx < finalists.length; fIdx++) {
          const rolloutDelta = continuationSums[fIdx] / completedRollouts;
          finalists[fIdx].evTree = (finalists[fIdx].evTree || 0) + rolloutDelta;
          finalists[fIdx].score += rolloutDelta;
        }
      }

      finalists.sort(stableSort);
      completedHorizon = settings.horizon;
    }

    // Preserve all evaluated rows after finalists so Cricket (5th best / W / A) and Bullet Ant have full pool access
    const finalistIds = new Set(finalists.map(r => actionId(r.action)));
    let orderedFinalists = [
      ...finalists,
      ...rows.filter(r => !finalistIds.has(actionId(r.action)))
    ];

    // Bullet Ant (master): Apply Top-4 Directional Slot Cap
    if (isBulletAnt) {
      orderedFinalists = diversifyMasterTop4(
        finalists,
        rows,
        state,
        slot
      );
    }

    // Tree-hopper (easy): Direct ForeseeEngine callers also get the 40% random / 10% IDLE / 30% D / 20% S distribution at rows[0]
    if (difficulty === "easy") {
      const rng = K.rng(
        K.hash(seed, "tree_hopper_foresee", history.length + 1, slot)
      );
      const roll = rng();
      const legalD = ownActions.filter(a => isDMove(state, slot, a.key));
      const legalS = ownActions.filter(a => isSMove(state, slot, a.key));
      let chosenAction = null;
      let strategyTag = "Tree-hopper 40% random legal";

      if (roll < 0.10) {
        chosenAction = { key: "DO_NOTHING", charge: 0 };
        strategyTag = "Tree-hopper 10% explicit IDLE";
      } else if (roll < 0.40 && legalD.length > 0) {
        chosenAction = legalD[Math.floor(rng() * legalD.length)];
        strategyTag = "Tree-hopper 30% legal D";
      } else if (roll < 0.60 && legalS.length > 0) {
        chosenAction = legalS[Math.floor(rng() * legalS.length)];
        strategyTag = "Tree-hopper 20% legal S";
      } else {
        chosenAction = ownActions[Math.floor(rng() * ownActions.length)];
      }

      if (chosenAction && C.isLegal(state, slot, chosenAction)) {
        const chosenRow = {
          action: { ...chosenAction },
          score: orderedFinalists[0]?.score ?? 0
        };
        orderedFinalists = [
          chosenRow,
          ...orderedFinalists.filter(r => actionId(r.action) !== actionId(chosenAction))
        ];
        return {
          rows: orderedFinalists,
          debug: {
            difficulty,
            strategy: strategyTag,
            rootActions: ownActions.length,
            completedHorizon: 1
          }
        };
      }
    }

    if (
      Array.isArray(candidates) &&
      candidates.length > 0
    ) {
      const selectionRng = K.rng(
        K.hash(
          seed,
          "rider_ranked_selection",
          history.length
        )
      );

      const chosenRow = sampleRankedAction(
        orderedFinalists,
        selectionRng
      );

      if (chosenRow && orderedFinalists.length > 0) {
        orderedFinalists = [
          chosenRow,
          ...orderedFinalists.filter(
            row => row !== chosenRow
          )
        ];
      }
    }

    const elapsedMs = Number((nowMs() - startTimeMs).toFixed(2));

    return {
      rows: orderedFinalists,
      debug: {
        difficulty,
        strategy: isBeetle
          ? myChi < oppChi
            ? "Beetle: Defensive CHI-Recovery Regime (myCHI < oppCHI)"
            : "Beetle: Balanced-Offensive Regime (myCHI >= oppCHI)"
          : isBulletAnt
            ? myLp > oppLp
              ? "Bullet Ant: LP-Lead Tactical Shift + Diversified Top-4"
              : "Bullet Ant: Diversified Top-4 Master Search"
            : isRider
              ? "Rider: EV_Tree + EV_Matrix + EV_Live Counter Search"
              : (B.intent(state, slot, brainDiff) || {}).name || "Cricket: All-Balanced Search",
        rootActions: ownActions.length,
        opponentActions: opponentPolicy.length,
        completedHorizon,
        rolloutsPerFinalist: completedRollouts || settings.rollouts,
        timeBudgetMs: activeTimeBudgetMs,
        elapsedMs,
        usingNeuralEvaluator:
          typeof evaluator === "function",
        isTraining,
        liveSelfDir: liveSelfDir || null,
        liveOppDir: (liveContext && liveContext.oppDirection) || null,
        selectedRank:
          candidates && orderedFinalists.length > 0
            ? finalists.indexOf(orderedFinalists[0]) + 1
            : 1,
        finalists: orderedFinalists
          .slice(0, 6)
          .map(row => ({
            key: row.action.key,
            charge: row.action.charge,
            score: Number(row.score.toFixed(2)),
            evTree: Number((row.evTree ?? row.score).toFixed(2)),
            evMatrix: Number((row.evMatrix ?? 0).toFixed(2)),
            evLive: Number((row.evLive ?? 0).toFixed(2))
          }))
      }
    };
  }

  g.ForeseeEngine = {
    search,
    policy,
    sample,
    sampleRankedAction,
    pairValue,
    computeRiderLiveEV
  };
})(globalThis);
