/* js/ai.js
 * Search dispatcher.
 * 5 Playstyle Levels:
 *   1. easy      -> Tree-hopper (Novice)
 *   2. balanced  -> Cricket     (Balance)
 *   3. defensive -> Beetle      (Defensive)
 *   4. master    -> Bullet Ant  (Master)
 *   5. rider     -> Rider       (Neural Matrix + Live 8s EV Search)
 * Build: v5-state256-action17
 */
(function (g) {
  "use strict";

  const VERSION = "v5-state256-action17";
  const C = g.CombatCore;
  const K = g.KF;

  const LEVEL_LABELS = {
    easy: "Tree-hopper",
    balanced: "Cricket",
    defensive: "Beetle",
    master: "Bullet Ant",
    rider: "Rider"
  };

  // Per-slot tracker for Cricket's -10% charge adjustment after a failed S/D move
  const cricketTrackers = {
    p1: {
      lastRoundChecked: 0,
      lastActionWasSD: false,
      enemyLpBefore: null,
      pendingSDPenalty: false,
      appliedOnRound: -1
    },
    p2: {
      lastRoundChecked: 0,
      lastActionWasSD: false,
      enemyLpBefore: null,
      pendingSDPenalty: false,
      appliedOnRound: -1
    }
  };

  function stamp(action, debug) {
    return {
      action: Object.assign({}, action),
      debug: Object.assign({}, debug, {
        engineVersion: VERSION
      })
    };
  }

  function difficultyName(value) {
    const name = String(value || "balanced").trim().toLowerCase();

    if (
      name === "novice" ||
      name === "easy" ||
      name === "tree-hopper" ||
      name === "tree_hopper" ||
      name === "treehopper"
    ) {
      return "easy";
    }

    if (
      name === "balanced" ||
      name === "balance" ||
      name === "cricket"
    ) {
      return "balanced";
    }

    if (
      name === "defensive" ||
      name === "defense" ||
      name === "beetle"
    ) {
      return "defensive";
    }

    if (
      name === "master" ||
      name === "bullet-ant" ||
      name === "bullet_ant" ||
      name === "bulletant" ||
      name === "soul"
    ) {
      return "master";
    }

    if (name === "mcts" || name === "rider") {
      return "rider";
    }

    if (K && typeof K.difficulty === "function") {
      const mapped = K.difficulty(value);
      if (mapped === "soul") return "master";
      if (LEVEL_LABELS[mapped]) return mapped;
    }

    return "balanced";
  }

  function isSDKey(state, slot, key) {
    if (!key || typeof key !== "string" || key === "DO_NOTHING") {
      return false;
    }
    const move = state?.moves?.[slot]?.[key];
    const dir = move?.direction || (key.includes("+") ? key.split("+")[0] : "");
    return dir === "S" || dir === "D";
  }

  function getMoveDirection(state, slot, key) {
    if (!key || key === "DO_NOTHING") return "IDLE";
    const move = state?.moves?.[slot]?.[key];
    if (move?.direction) return move.direction;
    return key.includes("+") ? key.split("+")[0] : "IDLE";
  }

  function availableMsForDirection(live, direction) {
    if (!live || typeof live !== "object" || live.isInitial) {
      return undefined;
    }

    const remainingMs = Number(live.remainingMs);
    if (!Number.isFinite(remainingMs)) {
      return undefined;
    }

    const selfDir = String(live.selfDirection || "").toUpperCase();
    const dir = String(direction || "").toUpperCase();

    if (selfDir && dir === selfDir) {
      const selfElapsedMs = Math.max(0, Number(live.selfElapsedMs) || 0);
      return selfElapsedMs + Math.max(0, remainingMs);
    }

    const switchPenaltyMs = Math.max(0, Number(live.switchPenaltyMs) || 0);
    return Math.max(0, remainingMs - switchPenaltyMs);
  }

  function clampReachableAction(state, slot, action, live) {
    if (!action || typeof action.key !== "string") {
      return null;
    }

    if (action.key === "DO_NOTHING") {
      return { key: "DO_NOTHING", charge: 0 };
    }

    const move = state?.moves?.[slot]?.[action.key];
    if (!move) return null;

    const availableMs = availableMsForDirection(live, move.direction);
    const reachable = C.maxCharge(state[slot], move.direction, availableMs);
    if (reachable < 1) return null;

    const selfDir = String(live?.selfDirection || "").toUpperCase();
    const minCharge =
      !live?.isInitial &&
      selfDir &&
      move.direction === selfDir &&
      Number.isFinite(live?.selfCharge) &&
      live.selfCharge >= 1
        ? K.clamp(Math.floor(live.selfCharge), 1, reachable)
        : 1;

    return {
      key: action.key,
      charge: K.clamp(
        Math.floor(Number(action.charge) || 1),
        minCharge,
        reachable
      )
    };
  }

  function updateCricketSDTracker(state, slot, history) {
    const tracker = cricketTrackers[slot];
    if (!tracker) return false;

    const enemySlot = C.other(slot);
    const currentRound = Number(state.round || 1);

    if (currentRound <= 1) {
      tracker.lastRoundChecked = 1;
      tracker.lastActionWasSD = false;
      tracker.enemyLpBefore = Number(state[enemySlot]?.lp || 1600);
      tracker.pendingSDPenalty = false;
      tracker.appliedOnRound = -1;
      return false;
    }

    const lastTurn =
      Array.isArray(history) && history.length > 0
        ? history[history.length - 1]
        : null;

    if (lastTurn && currentRound > tracker.lastRoundChecked) {
      const lastAct = lastTurn[slot] || lastTurn.actions?.[slot];
      const oppLastAct = lastTurn[enemySlot] || lastTurn.actions?.[enemySlot];
      const lastKey = String(lastAct?.key || "");
      const oppLastKey = String(oppLastAct?.key || "");

      if (isSDKey(state, slot, lastKey)) {
        const recordedEnemyLpBefore = Number(
          lastTurn.lpBefore?.[enemySlot] ?? tracker.enemyLpBefore
        );
        const currentEnemyLp = Number(state[enemySlot]?.lp || 0);

        const failedByLp =
          Number.isFinite(recordedEnemyLpBefore) &&
          currentEnemyLp >= recordedEnemyLpBefore;
        const failedByGuard = oppLastKey.startsWith("A+");

        if (failedByLp || failedByGuard) {
          tracker.pendingSDPenalty = true;
        }
      }
      tracker.lastRoundChecked = currentRound;
    }

    return Boolean(
      tracker.pendingSDPenalty ||
      tracker.appliedOnRound === currentRound
    );
  }

  function buildUniqueKeyRows(rows) {
    const unique = [];
    const seenKeys = new Set();
    for (const row of rows) {
      if (!seenKeys.has(row.action.key)) {
        unique.push(row);
        seenKeys.add(row.action.key);
      }
    }
    return unique;
  }

  function choose(context) {
    const safeContext = context || {};
    const state = safeContext.state;
    const slot = safeContext.slot;

    if (
      !state ||
      !["p1", "p2"].includes(slot) ||
      !state[slot] ||
      !state[C.other(slot)] ||
      !state.moves ||
      !state.moves[slot]
    ) {
      throw new Error("Invalid AI context.");
    }

    let difficulty = difficultyName(safeContext.difficulty || safeContext.mode);
    if (safeContext.useMCTS === true) {
      difficulty = "rider";
    }

    const label = LEVEL_LABELS[difficulty] || "Cricket";

    if (state.winner || state[slot].isFainted) {
      return stamp(
        { key: "DO_NOTHING", charge: 0 },
        {
          difficulty: difficulty,
          playstyle: label,
          strategy: "Completed match / forced faint recovery"
        }
      );
    }

    if (!g.ForeseeEngine || typeof g.ForeseeEngine.search !== "function") {
      throw new Error("ForeseeEngine.search is missing.");
    }

    const liveContext = safeContext.liveContext || state.liveContext || null;
    const history = safeContext.history || [];
    const enemySlot = C.other(slot);

    let net = safeContext.neuralNetwork || null;
    let spec = safeContext.neuralSpec || null;
    let loadedMatrixFile = null;

    if (difficulty === "rider" && !net) {
      // 1. Check policyWeights passed in by `ai_worker.js` (even when `disableAgent === true`)
      let checkpoint = safeContext.policyWeights || null;

      // 2. If not provided by worker and agent isn't disabled, check SoulAgent / SoulNN
      if (!checkpoint && !safeContext.disableAgent) {
        if (g.SoulAgent && typeof g.SoulAgent.getSection === "function") {
          checkpoint =
            g.SoulAgent.getSection(state[slot].id, state[enemySlot].id, "active") ||
            g.SoulAgent.getSection(state[slot].id, state[enemySlot].id, "candidate") ||
            null;
        }
      }

      if (checkpoint) {
        if (
          g.SoulAgent &&
          typeof g.SoulAgent.validateCheckpoint === "function" &&
          checkpoint.version
        ) {
          const validation = g.SoulAgent.validateCheckpoint(
            checkpoint,
            state[slot].id,
            state[enemySlot].id
          );

          if (!validation.valid) {
            throw new Error("Invalid RIDER checkpoint: " + validation.error);
          }
        }

        net = g.SoulNN.Network.fromJSON(checkpoint.net || checkpoint);
        spec = checkpoint.spec || spec;
        loadedMatrixFile =
          checkpoint.matrixFile ||
          (g.SoulAgent && typeof g.SoulAgent.getMatrixFileName === "function"
            ? `data/${g.SoulAgent.getMatrixFileName(state[slot].id, state[enemySlot].id)}`
            : "SoulAgent.active");
      } else if (!safeContext.disableAgent && g.SoulNN && typeof g.SoulNN.getMatchupMatrix === "function") {
        // 3. Direct synchronous fallback from `data/matrix_r{A}_vs_r{B}.json`
        const entry = g.SoulNN.getMatchupMatrix(state[slot], state[enemySlot]);
        if (entry && entry.net) {
          net = entry.net;
          spec = entry.spec || spec;
          loadedMatrixFile = entry.fileName;
        }
      }
    }

    const rider = difficulty === "rider";
    const isTeacher = Boolean(safeContext.isTeacher);
    const isTraining = Boolean(safeContext.isTraining);

    if (rider && net) {
      spec = spec || g.SoulEnv.makeSpec();
      g.SoulEnv.assertSpec(spec);
    }

    const evaluator =
      rider && net && g.SoulSim && typeof g.SoulSim.makeNeuralEvaluator === "function"
        ? g.SoulSim.makeNeuralEvaluator(
            net,
            spec,
            slot,
            history
          )
        : null;

    const searchDifficulty = rider ? "rider" : difficulty;

    let customBudget = safeContext.timeBudgetMs;
    if (customBudget === undefined || customBudget === null) {
      customBudget = safeContext.timeLimitMs;
    }
    if (customBudget === undefined || customBudget === null) {
      customBudget = safeContext.maxTimeMs;
    }

    const defaultRiderBudgetMs =
      liveContext && !liveContext.isInitial ? 65 : 100;

    const timeBudgetMs =
      rider && !isTraining
        ? Number.isFinite(customBudget) && customBudget > 0
          ? customBudget
          : defaultRiderBudgetMs
        : Number.isFinite(customBudget) && customBudget > 0
          ? customBudget
          : 0;

    const copiedState = C.copyState(state);
    if (liveContext) {
      copiedState.liveContext = Object.assign({}, liveContext);
    }

    const searchContext = Object.assign({}, safeContext, {
      state: copiedState,
      slot: slot,
      history: history,
      difficulty: searchDifficulty,
      evaluator: evaluator,
      isRider: rider,
      isTeacher: isTeacher,
      isTraining: isTraining,
      liveContext: liveContext ? Object.assign({}, liveContext) : null,
      timeBudgetMs: timeBudgetMs,
      timeLimitMs: timeBudgetMs,
      maxTimeMs: timeBudgetMs
    });

    delete searchContext.neuralNetwork;
    delete searchContext.neuralSpec;
    delete searchContext.policyWeights;
    delete searchContext.useMCTS;

    const result = g.ForeseeEngine.search(searchContext);

    const rawRows = result && Array.isArray(result.rows) ? result.rows : [];
    const rows = rawRows
      .map(function (row) {
        if (!row || !Number.isFinite(row.score)) return null;
        const clampedAction = clampReachableAction(
          state,
          slot,
          row.action,
          liveContext
        );
        if (!clampedAction || !C.isLegal(state, slot, clampedAction)) {
          return null;
        }
        return Object.assign({}, row, { action: clampedAction });
      })
      .filter(Boolean);

    if (!rows.length) {
      throw new Error("ForeseeEngine returned no legal, finite candidate.");
    }

    const seedVal =
      safeContext.seed !== undefined && safeContext.seed !== null
        ? safeContext.seed
        : 1;
    const roundNum = Number(state.round || history.length + 1);
    const rng = K.rng(K.hash(seedVal, "ai_tier_select", difficulty, roundNum, slot));

    let selected = rows[0];
    let selectionReason = "1st best move";

    /*
     * LEVEL 1: Tree-hopper (easy / novice)
     */
    if (difficulty === "easy") {
      const uniqueRows = buildUniqueKeyRows(rows);
      const dRows = uniqueRows.filter(r => getMoveDirection(state, slot, r.action.key) === "D");
      const sRows = uniqueRows.filter(r => getMoveDirection(state, slot, r.action.key) === "S");
      const idleRow = uniqueRows.find(r => r.action.key === "DO_NOTHING");

      const roll = rng();
      if (roll < 0.10 && idleRow) {
        selected = idleRow;
        selectionReason = "Tree-hopper: 10% IDLE";
      } else if (roll < 0.40 && dRows.length > 0) {
        selected = dRows[Math.floor(rng() * dRows.length)];
        selectionReason = "Tree-hopper: 30% legal D move";
      } else if (roll < 0.60 && sRows.length > 0) {
        selected = sRows[Math.floor(rng() * sRows.length)];
        selectionReason = "Tree-hopper: 20% legal S move";
      } else {
        selected = uniqueRows[Math.floor(rng() * uniqueRows.length)];
        selectionReason = "Tree-hopper: 40% random legal move";
      }

      if (selected.action.key !== "DO_NOTHING") {
        const chargePool = [25, 50, 75, 100];
        const rolledCharge = chargePool[Math.floor(rng() * chargePool.length)];
        const clamped = clampReachableAction(
          state,
          slot,
          { key: selected.action.key, charge: rolledCharge },
          liveContext
        );
        if (clamped && C.isLegal(state, slot, clamped)) {
          selected = Object.assign({}, selected, { action: clamped });
        }
      }
    }
    /*
     * LEVEL 2: Cricket (balanced)
     */
    else if (difficulty === "balanced") {
      const sdFailedPreviously = updateCricketSDTracker(state, slot, history);
      const uniqueRows = buildUniqueKeyRows(rows);
      const wRows = uniqueRows.filter(r => getMoveDirection(state, slot, r.action.key) === "W");
      const sdRows = uniqueRows.filter(r => {
        const d = getMoveDirection(state, slot, r.action.key);
        return d === "S" || d === "D";
      });
      const balanceRows = uniqueRows.filter(r => {
        const d = getMoveDirection(state, slot, r.action.key);
        return d === "A" || r.action.key === "DO_NOTHING";
      });
      const idleRow = uniqueRows.find(r => r.action.key === "DO_NOTHING");

      const roll = rng();
      if (roll < 0.20) {
        selected = uniqueRows[0];
        selectionReason = "Cricket: 20% 1st best move";
      } else if (roll < 0.30 && idleRow) {
        selected = idleRow;
        selectionReason = "Cricket: 10% IDLE";
      } else if (roll < 0.50) {
        if (wRows.length > 0) {
          selected = wRows[0];
          selectionReason = "Cricket: 20% legal W move";
        } else if (sdRows.length > 0) {
          selected = sdRows[Math.floor(rng() * sdRows.length)];
          selectionReason = "Cricket: 20% W fallback -> random S/D";
        } else {
          selected = uniqueRows[0];
          selectionReason = "Cricket: 20% W fallback -> 1st best";
        }
      } else if (roll < 0.60 && balanceRows.length > 0) {
        selected = balanceRows[0];
        selectionReason = "Cricket: 10% balance move (A / IDLE)";
      } else {
        const fifthIdx = Math.min(4, uniqueRows.length - 1);
        selected = uniqueRows[fifthIdx] || rows[Math.min(4, rows.length - 1)];
        selectionReason = `Cricket: 40% 5th best move (rank #${fifthIdx + 1})`;
      }

      if (selected.action.key !== "DO_NOTHING") {
        const chargeRng = K.rng(K.hash(seedVal, "cricket_charge", roundNum, slot));
        const highBand = chargeRng() >= 0.50;
        const minBand = highBand ? 76 : 50;
        const maxBand = highBand ? 100 : 75;
        let targetCharge = minBand + Math.floor(chargeRng() * (maxBand - minBand + 1));

        const chosenIsSD = isSDKey(state, slot, selected.action.key);
        const tracker = cricketTrackers[slot];

        if (chosenIsSD && sdFailedPreviously) {
          targetCharge = Math.max(1, targetCharge - 10);
          selectionReason += ` [Charge ${targetCharge}% (-10% failed S/D adjustment)]`;
          if (tracker) {
            tracker.pendingSDPenalty = false;
            tracker.appliedOnRound = roundNum;
          }
        } else {
          selectionReason += ` [Charge ${targetCharge}% (${highBand ? "76-100%" : "50-75%"} band)]`;
        }

        const clamped = clampReachableAction(
          state,
          slot,
          { key: selected.action.key, charge: targetCharge },
          liveContext
        );
        if (clamped && C.isLegal(state, slot, clamped)) {
          selected = Object.assign({}, selected, { action: clamped });
        }
      }

      const tracker = cricketTrackers[slot];
      if (tracker) {
        tracker.lastActionWasSD = isSDKey(state, slot, selected.action.key);
        tracker.enemyLpBefore = Number(state[enemySlot]?.lp || 1600);
      }
    }
    /*
     * LEVEL 3: Beetle (defensive)
     */
    else if (difficulty === "defensive") {
      selected = rows[0];
      const myChi = Number(state[slot]?.chi || 0);
      const oppChi = Number(state[enemySlot]?.chi || 0);
      selectionReason =
        myChi < oppChi
          ? "Beetle: 1st best from Defensive CHI-Recovery Tree (myCHI < oppCHI)"
          : "Beetle: 1st best from Balanced-Offensive Tree (myCHI >= oppCHI)";
    }
    /*
     * LEVEL 4: Bullet Ant (master)
     */
    else if (difficulty === "master" && !rider) {
      const topCount = Math.min(4, rows.length);
      if (isTeacher) {
        selected = rows[0];
        selectionReason = "Bullet Ant (Teacher): Top-1 move";
      } else {
        const pickIdx = Math.floor(rng() * topCount);
        selected = rows[pickIdx];
        selectionReason = `Bullet Ant: Top-4 diversified pick (#${pickIdx + 1} of ${topCount})`;
      }
    }
    /*
     * LEVEL 5: Rider (rider)
     */
    else if (rider) {
      selected = rows[0];
      selectionReason = evaluator
        ? `Rider: Max EV (EV_Tree + EV_Matrix [${loadedMatrixFile || "custom"}] + EV_Live)`
        : "Rider fallback: Max EV (EV_Tree + EV_Live; no active matchup matrix)";
    }

    const baseDebug = result && result.debug ? result.debug : {};
    const finalDebug = Object.assign({}, baseDebug, {
      difficulty: difficulty,
      playstyle: label,
      chosenScore: Number(selected.score.toFixed(3)),
      neural: Boolean(evaluator),
      matrixFile: loadedMatrixFile,
      liveReplan: Boolean(liveContext && !liveContext.isInitial),
      strategy: selectionReason
    });

    return stamp(
      C.normalizeAction(state, slot, selected.action),
      finalDebug
    );
  }

  function remember(history, before, selected) {
    const p1 = Object.assign({}, selected.p1);
    const p2 = Object.assign({}, selected.p2);

    const next = Array.isArray(history) ? history.slice() : [];

    next.push({
      p1: p1,
      p2: p2,
      actions: {
        p1: p1,
        p2: p2
      },
      lpBefore: {
        p1: Number(before && before.p1 ? before.p1.lp : 1600),
        p2: Number(before && before.p2 ? before.p2.lp : 1600)
      },
      fainted: {
        p1: Boolean(before && before.p1 && before.p1.isFainted),
        p2: Boolean(before && before.p2 && before.p2.isFainted)
      }
    });

    return next.slice(-24);
  }

  g.KF_AI = {
    VERSION: VERSION,
    LEVEL_LABELS: LEVEL_LABELS,
    choose: choose,
    remember: remember
  };
})(globalThis);
