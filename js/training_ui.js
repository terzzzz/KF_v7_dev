/* js/training_ui.js
 * Build: v5-state256-action17
 * Matrix: v7-7riders-10backup
 * Patch: charge1-reset1
 */
(function (g) {
  "use strict";

  const BUILD = "v5-state256-action17";
  const PATCH = "charge1-reset1";
  const CACHE_TAG = BUILD + "-" + PATCH + "-v7";

  const EXPECTED_SCHEMA =
    "kf-state256-action17-v2-charge1-reset1";

  let initialized = false;

  async function initialize() {
    if (initialized) return;
    initialized = true;

    const dedicated =
      document.getElementById("soul-training-root");

    const host = dedicated || document.createElement("dialog");

    if (!dedicated) {
      host.id = "soul-training-dialog";
      document.body.appendChild(host);
    }

    host.classList.add("soul-tools");

    host.innerHTML = `
      <h2>KAMEN FIGHT — v7 RIDER MATRIX TRAINER (7 RIDERS + 10 BACKUP SLOTS)</h2>

      <p>
        Build: <strong>${BUILD}</strong> |
        Matrix: <strong>v7 Per-Rider Bundle (001.json – 007.json)</strong> |
        Patch: <strong>${PATCH}</strong><br>
        256 inputs / 17 actions (42,257 params/matchup | 295,799 params/Rider bundle | 10 backup slots reserved).
      </p>

      <p>
        Turn-based decision picking with an 8-second charge action bar (1–100%).
        Selecting a different direction resets charging to 1%.
        Repeating the same direction preserves its charge clock.
        Training against <strong>ALL OPPONENTS</strong> cycles across 001..007
        with isolated networks and replay buffers (zero cross-matchup weight pollution).
      </p>

      <div class="soul-fields">
        <label>Learner (Rider Matrix File)
          <select data-field="learner"></select>
        </label>

        <label>Opponent
          <select data-field="opponent"></select>
        </label>

        <label>Opponent controller
          <select data-field="mode">
            <option value="mixed">MIXED — 30 each of Tree-hopper / Cricket / Beetle / Bullet Ant cycle</option>
            <option value="easy">Tree-hopper — Level 1 (Novice)</option>
            <option value="balanced">Cricket — Level 2 (Balance)</option>
            <option value="defensive">Beetle — Level 3 (Defensive)</option>
            <option value="master">Bullet Ant — Level 4 (Master)</option>
            <option value="rider">Rider — Level 5 (Reverse active matchup matrix)</option>
          </select>
        </label>

        <label>Reward
          <select data-field="reward-mode">
            <option value="standard">Dense LP / CHI + terminal</option>
            <option value="terminal_only">Terminal win/loss only</option>
          </select>
        </label>

        <label>Evaluation learner policy
          <select data-field="evaluation-policy">
            <option value="rider">Rider — live EV + Matrix search policy</option>
            <option value="network">Direct network — diagnostic</option>
          </select>
        </label>

        <label>Training matches
          <input data-field="train-count"
                 type="number"
                 min="2"
                 max="100000"
                 step="1"
                 value="420">
        </label>

        <label>Evaluation matches
          <input data-field="eval-count"
                 type="number"
                 min="2"
                 max="100000"
                 step="2"
                 value="140">
        </label>

        <label>Guidance % (0–100)
          <input data-field="guide-pct"
                 type="number"
                 min="0"
                 max="100"
                 step="1"
                 value="25">
        </label>

        <label>Initial Epsilon %
          <input data-field="initial-epsilon"
                 type="number"
                 min="1"
                 max="100"
                 step="1"
                 value="20">
        </label>

        <label class="soul-checkbox-label">
          <input data-field="win-only" type="checkbox">
          <span>Only winning matches update candidate</span>
        </label>

        <label>Seed
          <input data-field="seed"
                 type="number"
                 min="0"
                 max="4294967295"
                 step="1"
                 value="12345">
        </label>
      </div>

      <div class="soul-buttons">
        <button type="button" data-action="train">TRAIN / RESUME</button>
        <button type="button" data-action="warm">GUIDED WARM-START</button>
        <button type="button" data-action="eval-candidate">EVALUATE CANDIDATE</button>
        <button type="button" data-action="eval-active">EVALUATE ACTIVE</button>
        <button type="button" data-action="promote">ACTIVATE CANDIDATE(S)</button>
        <button type="button" data-action="stop" disabled>STOP</button>
      </div>

      <div class="soul-buttons">
        <button type="button" data-action="export">EXPORT RIDER MATRIX (00X.json)</button>
        <button type="button" data-action="import">IMPORT MATRIX / CHECKPOINT</button>
        <button type="button" data-action="sync">LOAD REPO RIDER MATRIX</button>
        <button type="button" data-action="tests">RUN PIPELINE TESTS</button>
        ${dedicated
          ? ""
          : '<button type="button" data-action="close">CLOSE</button>'}
      </div>

      <input data-field="file"
             type="file"
             accept=".json,application/json"
             hidden>

      <pre data-field="status"></pre>
      <pre data-field="output" aria-live="polite">Loading…</pre>
    `;

    if (!document.getElementById("soul-tools-styles")) {
      const style = document.createElement("style");
      style.id = "soul-tools-styles";

      style.textContent = `
        .soul-tools {
          box-sizing: border-box;
          width: min(1100px, 96vw);
          max-height: 92vh;
          overflow: auto;
          padding: 20px;
          color: #e9fff9;
          background: #10151c;
          border: 2px solid #00d9b2;
          border-radius: 12px;
          font: 15px/1.5 system-ui, sans-serif;
        }

        dialog.soul-tools::backdrop {
          background: #000c;
        }

        .soul-tools h2 {
          color: #00ffcc;
        }

        .soul-warning {
          color: #ffd68a;
        }

        .soul-fields,
        .soul-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 14px 0;
        }

        .soul-fields label {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .soul-fields label.soul-checkbox-label {
          flex-direction: row;
          align-items: center;
          gap: 8px;
          margin-top: auto;
          padding-bottom: 8px;
          cursor: pointer;
          user-select: none;
        }

        .soul-fields label.soul-checkbox-label input {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #00d9b2;
        }

        .soul-tools input,
        .soul-tools select,
        .soul-tools button {
          padding: 8px;
          font: inherit;
        }

        .soul-tools button {
          cursor: pointer;
          color: white;
          background: #174b43;
          border: 1px solid #00bda0;
          border-radius: 5px;
        }

        .soul-tools button:disabled {
          opacity: .4;
          cursor: default;
        }

        .soul-tools pre {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
      `;

      document.head.appendChild(style);
    }

    const field = name =>
      host.querySelector(`[data-field="${name}"]`);

    const button = name =>
      host.querySelector(`[data-action="${name}"]`);

    let data = null;
    let busy = false;
    let worker = null;
    let stopping = false;

    function output(text) {
      field("output").textContent = text;
    }

    function pair() {
      return {
        learner: field("learner").value,
        opponent: field("opponent").value
      };
    }

    function refresh() {
      const selected = pair();
      const agent = g.SoulAgent;
      const isMulti = selected.opponent === "*";

      const validSelection = Boolean(
        selected.learner && selected.opponent && agent
      );

      const learnerCode = validSelection
        ? agent.toCode(selected.learner)
        : "---";

      const candidate = validSelection && !isMulti
        ? agent.getSection(
            selected.learner,
            selected.opponent,
            "candidate"
          )
        : null;

      const active = validSelection && !isMulti
        ? agent.getSection(
            selected.learner,
            selected.opponent,
            "active"
          )
        : null;

      const learnerCandidateMap = validSelection
        ? agent.getLearnerSections(selected.learner, "candidate")
        : {};
      const learnerActiveMap = validSelection
        ? agent.getLearnerSections(selected.learner, "active")
        : {};

      const candCount = Object.keys(learnerCandidateMap).length;
      const actCount = Object.keys(learnerActiveMap).length;

      const status = agent?.status?.() || {
        storageWarning: "",
        warnings: []
      };

      const codes = agent ? agent.getActiveCodes() : [];

      const lines = [
        validSelection
          ? isMulti
            ? `Selected Bundle: ${learnerCode}.json (${learnerCode}_001 .. ${learnerCode}_${codes[codes.length - 1] || "007"} Auto-Cycle + 10 backup slots)`
            : `Selected Matchup: ${agent.getCanonicalKey(selected.learner, selected.opponent)} (in ${learnerCode}.json)`
          : "Loading matchup data…",

        isMulti
          ? `Rider ${learnerCode} Candidate Bundle: ${candCount} / ${codes.length} active matchups populated`
          : `Candidate: ${
              candidate
                ? `${candidate.games} games / ${candidate.steps} accepted decisions`
                : "none — fresh training available"
            }`,

        isMulti
          ? `Rider ${learnerCode} Active Bundle: ${actCount} / ${codes.length} active matchups populated`
          : `Active: ${
              active
                ? `${active.games} games / ${active.steps} accepted decisions`
                : "none"
            }`,

        status.storageWarning,
        ...(status.warnings || [])
      ].filter(Boolean);

      if (data && agent) {
        lines.push("", `CANDIDATE MATCHUP MATRIX (${codes.length}x${codes.length} ACTIVE + 10 BACKUP SLOTS)`);

        const matrix = agent.getMatchupBreakdown("candidate");

        lines.push(
          "     " + codes.map(code => code.padStart(7)).join(" ")
        );

        for (const code of codes) {
          lines.push(
            code + "  " +
            codes.map(opponent => {
              const entry = matrix[code]?.[opponent];
              if (!entry || !entry.hasModel) return "-".padStart(7);
              const tag = entry.evaluated ? `${entry.games}*` : String(entry.games);
              return tag.padStart(7);
            }).join(" ")
          );
        }
      }

      field("status").textContent = lines.join("\n");

      host.querySelectorAll("button").forEach(element => {
        element.disabled = busy || !data;
      });

      host.querySelectorAll(
        "select, input:not([type=file])"
      ).forEach(element => {
        element.disabled = busy || !data;
      });

      button("stop").disabled = !worker || stopping;

      const close = button("close");
      if (close) close.disabled = busy;

      if (!busy && data) {
        const hasAnyLearnerModel = candCount > 0 || actCount > 0;
        button("export").disabled = !hasAnyLearnerModel;

        if (isMulti) {
          button("eval-candidate").disabled = candCount === 0;
          button("eval-active").disabled = actCount === 0;

          const anyPromotable = Object.values(learnerCandidateMap).some(cp => {
            const ev = cp?.evaluation;
            return Boolean(
              ev &&
              ev.learnerPolicy === "rider" &&
              !ev.cancelled &&
              ev.games === ev.requested &&
              ev.games >= 2
            );
          });
          button("promote").disabled = !anyPromotable;
        } else {
          button("eval-candidate").disabled = !candidate;
          button("eval-active").disabled = !active;

          const evaluation = candidate?.evaluation;

          button("promote").disabled = !(
            evaluation &&
            evaluation.learnerPolicy === "rider" &&
            !evaluation.cancelled &&
            evaluation.games === evaluation.requested &&
            evaluation.games >= 2
          );
        }
      }
    }

    function integer(name, min, max) {
      const value = Number(field(name).value);

      if (
        !Number.isSafeInteger(value) ||
        value < min ||
        value > max
      ) {
        throw new Error(
          `${name} must be an integer from ${min} to ${max}.`
        );
      }

      return value;
    }

    function formatReport(report) {
      const training = report.kind === "train";
      const targetTag = String(report.target || "candidate").toUpperCase();

      const lines = [
        training
          ? report.warmStart
            ? `GUIDED WARM-START [${targetTag}]`
            : `TRAINING [${targetTag}]`
          : `EVALUATION [${targetTag}]`,

        `Build: ${report.build}`,
        `Patch: ${report.patch}`,
        `Matchup: ${report.learner} -> ${report.opponent}`,
        `Target model: ${targetTag}`,
        `Learner policy: ${report.learnerPolicy}`,
        `Opponent: ${report.effectiveOpponent}`,
        `Reward: ${report.rewardMode}`,
        "",
        `Completed: ${report.games} / ${report.requested}`,
        `W / L / D: ${report.wins} / ${report.losses} / ${report.draws}`,
        `Win rate: ${report.winRate.toFixed(1)}%`,
        `Average rounds: ${report.averageRounds.toFixed(1)}`,
        `Matches/minute: ${report.matchesPerMinute.toFixed(1)}`,
        `Recorded round decisions: ${report.transitions}`,
        `Elapsed: ${report.seconds.toFixed(1)}s`,
        `Mean selected Q, this job: ${report.avgQ.toFixed(4)}`
      ];

      if (training) {
        lines.push(
          "",
          `Win-only updates: ${
            report.winOnly
              ? "ENABLED — losses/draws discarded"
              : "DISABLED — all matches update"
          }`,

          `Guidance probability: ${
            (100 * report.guideProbability).toFixed(1)
          }%${
            Number.isFinite(report.guidePct) && !report.warmStart
              ? ` (Input: ${report.guidePct}%)`
              : ""
          }`,

          `Scheduled epsilon: ${
            (100 * report.epsilon).toFixed(1)
          }% (Initial: ${report.initialEpsilon}%)`,

          `Imitation coefficient: ${
            report.imitationCoefficient.toFixed(4)
          }`,

          `Replay entries (isolated per matchup): ${report.replaySize}`,
          `Gradient updates: ${report.updates}`,
          `Latest combined training loss: ${report.loss.toFixed(6)}`
        );

        if (report.updateStats) {
          const s = report.updateStats;

          lines.push(
            "Replay samples used — Win/Dmg/Loss/Other: " +
            `${s.win}/${s.damage}/${s.loss}/${s.neutral}`
          );
        }
      } else {
        lines.push(
          "",
          `Checkpoint fingerprint: ${report.weightsID}`,
          `Loaded fingerprint: ${report.loadedWeightsID}`,
          "No gradient updates or epsilon exploration."
        );
      }

      if (report.matchParameters) {
        const mp = report.matchParameters;
        lines.push(
          "",
          "MATCH PARAMETER TELEMETRY (ACTIVE CONTEXT + 10 RESERVED SLOTS)",
          `  Avg Final LP (Own / Opp): ${(100 * mp.avgFinalLpRatio).toFixed(1)}% / ${(100 * mp.avgEnemyFinalLpRatio).toFixed(1)}%`,
          `  Avg Damage (Dealt / Taken): ${(100 * mp.avgDamageDealtRatio).toFixed(1)}% / ${(100 * mp.avgDamageTakenRatio).toFixed(1)}%`,
          `  Avg Chi/Round (Earned / Spent / NetAdv): ${mp.avgChiEarned.toFixed(2)} / ${mp.avgChiSpent.toFixed(2)} / ${mp.avgNetChiAdvantage.toFixed(2)}`,
          `  Avg Execution Charge: ${mp.avgExecutionCharge.toFixed(1)}% | Priority Win Rate: ${(100 * mp.priorityWinRate).toFixed(1)}%`,
          `  S-Move Rate: ${(100 * mp.sMoveUsageRate).toFixed(1)}% | A-Guard Counter Rate: ${(100 * mp.aGuardSuccessRate).toFixed(1)}%`,
          `  W-Buff Rate: ${(100 * mp.wBuffCastRate).toFixed(1)}% | Evasion Trigger Rate: ${(100 * mp.evasionTriggerRate).toFixed(1)}%`,
          `  Faint Rate (Inflicted / Suffered): ${(100 * mp.faintInflictedRate).toFixed(1)}% / ${(100 * mp.faintSufferedRate).toFixed(1)}%`,
          `  Reserved Parameter Slots: [${(mp.reservedSlots || []).length} backup slots ready]`
        );
      }

      const counts = report.wasdRatio?.counts;

      if (counts) {
        const total = Math.max(
          1,
          Object.values(counts).reduce(
            (sum, value) => sum + value,
            0
          )
        );

        lines.push(
          "",
          "ROUND ACTION USAGE — includes forced recovery"
        );

        for (const [stance, count] of Object.entries(counts)) {
          lines.push(
            `${stance.padEnd(4)} ${String(count).padStart(7)} ` +
            `${(100 * count / total).toFixed(1)}%`
          );
        }

        lines.push("", "STANCE: J / K / I / L / NONE");

        for (const [stance, row] of Object.entries(
          report.moveBreakdown?.moveMatrix || {}
        )) {
          lines.push(
            `${stance}: ${row.J} / ${row.K} / ${row.I} / ` +
            `${row.L} / ${row.NONE}`
          );
        }
      }

      lines.push("", "BREAKDOWN");

      for (const [label, row] of Object.entries(
        report.breakdown || {}
      )) {
        lines.push(
          `${label}: ${row.wins}W ${row.losses}L ${row.draws}D`
        );
      }

      if (Array.isArray(report.firstWinningGames) && report.firstWinningGames.length > 0) {
        lines.push(
          "",
          "======================================================================",
          "FIRST 4 WINNING GAMES PER DIFFICULTY & PER OPPONENT — MOVE SEQUENCES",
          "======================================================================"
        );

        // Group wins by (Matchup / Opponent) + Difficulty while preserving discovery order
        const groupedWins = new Map();

        for (const game of report.firstWinningGames) {
          const mKey = game.matchupKey || "UNKNOWN_MATCHUP";
          const diffKey = game.difficulty || "default";
          const groupKey = `${mKey}|${diffKey}`;

          if (!groupedWins.has(groupKey)) {
            groupedWins.set(groupKey, {
              matchupKey: mKey,
              opponentId: game.opponentId || "",
              opponentName: game.opponentName || game.opponentId || "",
              difficulty: diffKey,
              difficultyLabel: game.difficultyLabel || diffKey,
              games: []
            });
          }

          groupedWins.get(groupKey).games.push(game);
        }

        for (const group of groupedWins.values()) {
          const oppHeader = group.opponentName
            ? `${group.matchupKey} (vs ${group.opponentName})`
            : group.matchupKey;

          lines.push(
            "",
            `=== [ ${oppHeader} | Difficulty: ${group.difficultyLabel} ] (${group.games.length} / 4 Wins) ===`
          );

          group.games.forEach((game, idx) => {
            const winRank = game.bucketWinIndex || (idx + 1);
            const maxRank = game.bucketMaxWins || 4;
            const gameNum = game.gameNumber || (idx + 1);
            const totalRounds = game.totalRounds || game.moves?.length || 0;
            const slotTag = game.learnerSlot ? `, Slot: ${game.learnerSlot}` : "";

            lines.push(
              "",
              `--- WIN #${winRank}/${maxRank} [${group.matchupKey} | ${group.difficultyLabel}] (Match #${gameNum}${slotTag}, ${totalRounds} Rounds) ---`
            );

            if (Array.isArray(game.moves) && game.moves.length > 0) {
              game.moves.forEach(m => {
                const rNum = String(m.round || "").padStart(2);
                const lAction = String(m.learnerMove || "DO_NOTHING").padEnd(10);
                const lCharge = String(m.learnerCharge ?? 0).padStart(3) + "%";
                const lLp = m.learnerLp !== undefined
                  ? ` (LP:${String(m.learnerLp).padStart(4)} Chi:${String(m.learnerChi).padStart(2)} Fnt:${String(m.learnerFaint).padStart(2)})`
                  : "";

                const oAction = String(m.oppMove || "DO_NOTHING").padEnd(10);
                const oCharge = String(m.oppCharge ?? 0).padStart(3) + "%";
                const oLp = m.oppLp !== undefined
                  ? ` (LP:${String(m.oppLp).padStart(4)} Chi:${String(m.oppChi).padStart(2)} Fnt:${String(m.oppFaint).padStart(2)})`
                  : "";

                lines.push(`  R${rNum}: Learner [ ${lAction} @ ${lCharge} ]${lLp} vs Opponent [ ${oAction} @ ${oCharge} ]${oLp}`);
              });
            }
          });
        }
      }

      if (report.cancelled) {
        lines.push(
          "",
          "STOPPED — partial job.",
          "Decision totals may include an unfinished match."
        );
      } else if (stopping) {
        lines.push("", "Stop requested; waiting for the worker.");
      }

      return lines.join("\n");
    }

    function finishWorker(expectedWorker = worker) {
      if (expectedWorker !== worker) return;

      worker?.terminate();
      worker = null;
      busy = false;
      stopping = false;
      refresh();
    }

    async function start(
      kind,
      target = "candidate",
      warmStart = false
    ) {
      if (busy) return;
      if (!data) throw new Error("Training data is not ready.");

      if (location.protocol === "file:") {
        throw new Error("Serve the project over HTTP/HTTPS.");
      }

      if (typeof g.Worker !== "function") {
        throw new Error("Web Workers are unavailable.");
      }

      const selected = pair();
      const training = kind === "train";
      const isMulti = selected.opponent === "*";
      const mode = field("mode").value;

      const checkpointsByMatchup = {};
      const opponentCheckpointsByMatchup = {};

      const opponentList = isMulti
        ? data.riders.map(r => r.id)
        : [selected.opponent];

      for (const oppId of opponentList) {
        const key = g.SoulAgent.getCanonicalKey(selected.learner, oppId);
        const cp = training
          ? (
              g.SoulAgent.getSection(selected.learner, oppId, "candidate") ||
              g.SoulAgent.getSection(selected.learner, oppId, "active")
            )
          : g.SoulAgent.getSection(selected.learner, oppId, target);

        if (cp) {
          const validation = g.SoulAgent.validateCheckpoint(
            cp,
            selected.learner,
            oppId
          );
          if (!validation.valid) {
            throw new Error(`${key}: ${validation.error}`);
          }
          checkpointsByMatchup[key] = cp;
        }

        if (mode === "rider") {
          const revKey = g.SoulAgent.getCanonicalKey(oppId, selected.learner);
          const revCp = g.SoulAgent.getSection(oppId, selected.learner, "active");
          if (revCp) {
            const revVal = g.SoulAgent.validateCheckpoint(
              revCp,
              oppId,
              selected.learner
            );
            if (!revVal.valid) {
              throw new Error(`Reverse model ${revKey}: ${revVal.error}`);
            }
            opponentCheckpointsByMatchup[revKey] = revCp;
          }
        }
      }

      const checkpoint = !isMulti
        ? checkpointsByMatchup[
            g.SoulAgent.getCanonicalKey(selected.learner, selected.opponent)
          ] || null
        : null;

      const opponentCheckpoint = !isMulti && mode === "rider"
        ? opponentCheckpointsByMatchup[
            g.SoulAgent.getCanonicalKey(selected.opponent, selected.learner)
          ] || null
        : null;

      if (!training && Object.keys(checkpointsByMatchup).length === 0) {
        throw new Error(
          "No checkpoint exists for the selected matchup(s)."
        );
      }

      let matches = integer(
        training ? "train-count" : "eval-count",
        2,
        100000
      );

      if (!training) {
        const evalOpponentsCount = isMulti
          ? Math.max(1, Object.keys(checkpointsByMatchup).length)
          : 1;
        const stepMultiple = 2 * evalOpponentsCount;
        if (matches % stepMultiple !== 0) {
          matches = Math.ceil(matches / stepMultiple) * stepMultiple;
          field("eval-count").value = matches;
        }
      }

      const guidePct = integer("guide-pct", 0, 100);
      const initialEpsilon = integer("initial-epsilon", 1, 100);
      const winOnly = Boolean(field("win-only").checked);

      const teacher =
        warmStart &&
        ["easy", "balanced", "defensive", "master"].includes(mode)
          ? mode
          : "master";

      const job = {
        build: BUILD,
        patch: PATCH,
        schema: EXPECTED_SCHEMA,

        kind,
        target,
        data,
        checkpoint,
        opponentCheckpoint,
        checkpointsByMatchup,
        opponentCheckpointsByMatchup,

        matches,
        seed: integer("seed", 0, 4294967295),

        learner: selected.learner,
        opponent: selected.opponent,
        mode,

        rewardMode: field("reward-mode").value,
        guidePct,
        guideHoldPct: guidePct,
        guideZeroPct: guidePct,
        initialEpsilon,
        winOnly,
        teacher,
        warmStart,

        learnerPolicy: training
          ? "network"
          : field("evaluation-policy").value
      };

      busy = true;
      stopping = false;
      refresh();
      output("Starting worker…");

      try {
        const url = new URL(
          "js/training_worker.js",
          document.baseURI
        );

        url.searchParams.set("v", CACHE_TAG);

        const currentWorker = new Worker(url);
        worker = currentWorker;
        refresh();

        currentWorker.onerror = event => {
          if (worker !== currentWorker) return;

          output(
            "WORKER ERROR\n" +
            (event.message || "Unknown worker error.")
          );

          finishWorker(currentWorker);
        };

        currentWorker.onmessageerror = () => {
          if (worker !== currentWorker) return;

          output(
            "WORKER ERROR\nCould not deserialize a worker message."
          );

          finishWorker(currentWorker);
        };

        currentWorker.onmessage = event => {
          if (worker !== currentWorker) return;

          try {
            const message = event.data;

            if (
              message?.build !== BUILD ||
              message.patch !== PATCH ||
              message.schema !== EXPECTED_SCHEMA
            ) {
              throw new Error(
                "Worker patch/schema mismatch. " +
                "Reload the updated files and clear stale script caches."
              );
            }

            if (message.type === "checkpoint") {
              const cp = message.checkpoint;
              const validation = g.SoulAgent.validateCheckpoint(
                cp,
                cp?.learnerId || selected.learner,
                cp?.opponentId
              );

              if (!validation.valid) {
                throw new Error(validation.error);
              }

              g.SoulAgent.setCandidate(cp);
              refresh();
            } else if (message.type === "progress") {
              output(formatReport(message.report));
            } else if (message.type === "done") {
              const report = message.report;

              if (
                !training &&
                !report.cancelled &&
                report.games === report.requested
              ) {
                g.SoulAgent.recordEvaluation(target, report);
              }

              output(
                formatReport(report) +
                (
                  training
                    ? `\n\nCandidate matchup(s) retained in RAM/LocalStorage. Click EXPORT RIDER MATRIX (${g.SoulAgent.toCode(selected.learner)}.json) to save all matchups.`
                    : report.cancelled
                      ? "\n\nIncomplete evaluation was not recorded for activation."
                      : "\n\nEvaluation finished and recorded."
                )
              );

              finishWorker(currentWorker);
            } else if (message.type === "error") {
              throw new Error(message.error);
            } else {
              throw new Error(
                "Unknown training worker message: " + message.type
              );
            }
          } catch (error) {
            output("JOB ERROR\n" + error.message);
            finishWorker(currentWorker);
          }
        };

        currentWorker.postMessage({ type: "start", job });
      } catch (error) {
        finishWorker();
        throw error;
      }
    }

    field("learner").addEventListener("change", refresh);
    field("opponent").addEventListener("change", refresh);

    if (!dedicated) {
      host.addEventListener("cancel", event => {
        if (busy) event.preventDefault();
      });
    }

    host.addEventListener("click", async event => {
      const clicked = event.target.closest("[data-action]");

      if (!clicked || clicked.disabled) return;

      try {
        const selected = pair();

        switch (clicked.dataset.action) {
          case "train":
            await start("train");
            break;

          case "warm":
            await start("train", "candidate", true);
            break;

          case "eval-candidate":
            await start("evaluate", "candidate");
            break;

          case "eval-active":
            await start("evaluate", "active");
            break;

          case "stop":
            if (worker && !stopping) {
              stopping = true;
              worker.postMessage({ type: "stop" });
              refresh();

              output(
                "Stop requested.\n" +
                "Waiting for the current synchronous operation to yield…"
              );
            }
            break;

          case "promote": {
            const isMulti = selected.opponent === "*";
            if (!g.confirm(
              isMulti
                ? `Activate all RIDER-evaluated candidates for Rider ${g.SoulAgent.toCode(selected.learner)}?`
                : "Activate this exact-matchup candidate?"
            )) {
              break;
            }

            const promoted = g.SoulAgent.promote(
              selected.learner,
              selected.opponent
            );

            refresh();

            output(
              isMulti
                ? `Activated ${promoted.promotedKeys.length} matchups for Rider ${g.SoulAgent.toCode(selected.learner)}:\n${promoted.promotedKeys.join(", ")}`
                : "Selected candidate activated.\nNew matches can use it."
            );
            break;
          }

          case "export": {
            const result = g.SoulAgent.downloadRiderBundle(
              selected.learner,
              "candidate"
            );

            output(
              `Exported Master Rider Bundle: ${result.fileName}\n` +
              `Populated Matchups: ${result.populatedMatchups} / ${result.activeRosterCount} active (+ ${result.backupSlotCount} backup slots reserved)\n` +
              `Total Games in Bundle: ${result.games}; Size: ${result.sizeMB} MB\n` +
              `Place ${result.fileName} inside data/matrix/${result.fileName}`
            );
            break;
          }

          case "import":
            field("file").click();
            break;

          case "sync": {
            const code = g.SoulAgent.toCode(selected.learner);
            if (!g.confirm(
              `Load data/matrix/${code}.json from repository into ACTIVE?`
            )) {
              break;
            }

            busy = true;
            refresh();

            try {
              const res = await g.SoulAgent.fetchRiderBundleFromCDN(
                selected.learner
              );

              output(
                `Loaded data/matrix/${res.learnerCode}.json into ACTIVE (${res.loadedCount} matchups).`
              );
            } finally {
              busy = false;
              refresh();
            }
            break;
          }

          case "tests":
            busy = true;
            refresh();
            output("Running pipeline tests…");

            try {
              if (typeof g.runSoulPipelineTests !== "function") {
                throw new Error(
                  "Load soul_pipeline_tests.js before training_ui.js."
                );
              }

              const result = await g.runSoulPipelineTests();
              output(result.lines.join("\n"));
            } finally {
              busy = false;
              refresh();
            }
            break;

          case "close":
            if (!busy && !dedicated) host.close();
            break;
        }
      } catch (error) {
        output("ERROR\n" + (error?.message || String(error)));
        refresh();
      }
    });

    field("file").addEventListener("change", async event => {
      const input = event.target;
      const file = input.files?.[0];

      if (!file || busy) {
        input.value = "";
        return;
      }

      busy = true;
      refresh();

      try {
        const payload = JSON.parse(await file.text());
        const imported = g.SoulAgent.importCandidate(payload);

        output(
          imported.isBundle
            ? `Imported Rider Matrix Bundle (${imported.learnerCode}.json) into CANDIDATE.\n` +
              `Matchups loaded (${imported.importedKeys.length}): ${imported.importedKeys.join(", ")}`
            : `Imported single matchup checkpoint into CANDIDATE: ${imported.canonicalKey}`
        );
      } catch (error) {
        output("IMPORT ERROR\n" + error.message);
      } finally {
        input.value = "";
        busy = false;
        refresh();
      }
    });

    g.SoulTrainer = {
      open() {
        if (dedicated) {
          host.scrollIntoView({ block: "start" });
        } else if (!host.open) {
          host.showModal();
        }
      },

      isBusy() {
        return busy;
      }
    };

    refresh();

    try {
      if (
        g.SoulAgent?.VERSION !== BUILD ||
        typeof g.SoulAgent?.ready !== "function" ||
        g.SoulEnv?.SCHEMA !== EXPECTED_SCHEMA
      ) {
        throw new Error(
          "Training modules are missing or use incompatible charging rules."
        );
      }

      data = (await g.SoulAgent.ready()).data;

      const allOption = document.createElement("option");
      allOption.value = "*";
      allOption.textContent = `ALL OPPONENTS [001–${g.SoulAgent.formatCodeNumber ? g.SoulAgent.getActiveCodes().slice(-1)[0] : "007"} Auto-Cycle]`;
      field("opponent").appendChild(allOption);

      for (const rider of data.riders) {
        for (const name of ["learner", "opponent"]) {
          const option = document.createElement("option");
          option.value = rider.id;

          option.textContent =
            `${rider.name} [${g.SoulAgent.toCode(rider.id)}]`;

          field(name).appendChild(option);
        }
      }

      field("learner").value = data.riders[0].id;
      field("opponent").value = "*";

      output(
        "Ready (v7 Per-Rider Matrix Mode).\n" +
        "Select ALL OPPONENTS to auto-cycle training across all Riders with isolated matchup networks,\n" +
        "then click EXPORT RIDER MATRIX to save a single 001.json bundle."
      );
    } catch (error) {
      data = null;
      output("INITIALIZATION ERROR\n" + error.message);
    }

    refresh();
  }

  function launch() {
    initialize().catch(error => {
      console.error("[Training UI]", error);

      const host =
        document.getElementById("soul-training-root") ||
        document.getElementById("soul-training-dialog");

      if (host) {
        host.textContent =
          "TRAINING UI ERROR\n" +
          (error?.message || String(error));
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", launch, {
      once: true
    });
  } else {
    launch();
  }
})(window);
