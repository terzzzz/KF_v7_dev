/* js/training_ui.js
 * Build: v5-state256-action17
 * Matrix: v7-7riders-10backup (49-Matrix Bidirectional Header Drive Sync Edition)
 * Patch: charge1-reset1
 */
(function (g) {
  "use strict";

  const BUILD = "v5-state256-action17";
  const PATCH = "charge1-reset1";
  const CACHE_TAG = BUILD + "-" + PATCH + "-v7";

  const EXPECTED_SCHEMA =
    "kf-state256-action17-v2-charge1-reset1";

  // Minimum interval (ms) between heavy localStorage writes during live training.
  // Checkpoints are always buffered in RAM and 100% flushed on stop/done.
  const CHECKPOINT_SAVE_THROTTLE_MS = 5000;

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
      <h2>KAMEN FIGHT — v7 RIDER MATRIX TRAINER (49 MATCHUPS + 10 BACKUP SLOTS)</h2>

      <p>
        Build: <strong>${BUILD}</strong> |
        Matrix: <strong>49-Matchup Matrix (7×7 Riders, Header Drive Sync)</strong> |
        Patch: <strong>${PATCH}</strong><br>
        256 inputs / 17 actions (42,257 params/matchup | 295,799 params/Rider | 10 backup slots reserved).
      </p>

      <p>
        Turn-based decision picking with an 8-second charge action bar (1–100%).
        Selecting a different direction resets charging to 1%.
        Repeating the same direction preserves its charge clock.
        Training against <strong>ALL OPPONENTS</strong> cycles across 001..007
        with isolated networks and replay buffers (zero cross-matchup weight pollution).
        Use the <strong>Top Header Panel</strong> to Import/Export all 49 matrices to and from Google Drive.
      </p>

      <div class="soul-fields">
        <label>Learner (Rider)
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
        <button type="button" data-action="tests">RUN PIPELINE TESTS</button>
        ${dedicated
          ? ""
          : '<button type="button" data-action="close">CLOSE</button>'}
      </div>

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

    const outputEl = field("output");
    const statusEl = field("status");
    const allButtons = Array.from(host.querySelectorAll("button"));
    const allInputs = Array.from(
      host.querySelectorAll("select, input")
    );

    let data = null;
    let busy = false;
    let worker = null;
    let stopping = false;

    // Cache for static "First 4 Winning Games" move logs
    let cachedWinsKey = "";
    let cachedWinsBlock = "";

    // In-memory checkpoint buffer for throttled persistence
    const pendingCheckpoints = new Map();
    let lastCheckpointSaveTime = 0;

    function output(text) {
      outputEl.textContent = text;
    }

    function pair() {
      return {
        learner: field("learner").value,
        opponent: field("opponent").value
      };
    }

    // =========================================================================
    // 49-MATRIX HEADER PANEL <-> SOULAGENT BIDIRECTIONAL BRIDGE
    // =========================================================================

    function makeSeededRng(seed) {
      let s = (seed >>> 0) || 0x12345678;
      return function () {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) / 4294967296);
      };
    }

    function createInitializedWeights(seedNumber) {
      const rng = makeSeededRng(seedNumber);
      const randLayer = (fanIn, len) => {
        const scale = Math.sqrt(2 / fanIn);
        const arr = new Array(len);
        for (let i = 0; i < len; i++) {
          const u = (rng() + rng() + rng() - 1.5) * 1.1547;
          arr[i] = Number((u * scale).toFixed(6));
        }
        return arr;
      };
      const zeros = len => new Array(len).fill(0);

      return {
        w1: randLayer(256, 256 * 128),
        b1: zeros(128),
        w2: randLayer(128, 128 * 64),
        b2: zeros(64),
        w3: randLayer(64, 64 * 17),
        b3: zeros(17)
      };
    }

    function findAnyExistingCheckpoint() {
      if (!data || !g.SoulAgent) return null;
      for (const l of data.riders) {
        for (const o of data.riders) {
          const cp =
            g.SoulAgent.getSection(l.id, o.id, "candidate") ||
            g.SoulAgent.getSection(l.id, o.id, "active");
          if (cp && cp.weights) return cp;
        }
      }
      return null;
    }

    function reinitWeightsFromTemplate(templateWeights, seedNumber) {
      const fresh = createInitializedWeights(seedNumber);
      if (!templateWeights || typeof templateWeights !== "object") {
        return fresh;
      }
      const out = {};
      for (const [k, v] of Object.entries(templateWeights)) {
        if (Array.isArray(v) || ArrayBuffer.isView(v)) {
          if (fresh[k] && fresh[k].length === v.length) {
            out[k] = fresh[k].slice();
          } else {
            const rng = makeSeededRng(seedNumber + k.length * 97);
            const isBias = /^b\d/i.test(k) || v.length <= 256;
            out[k] = Array.from({ length: v.length }, () =>
              isBias ? 0 : Number(((rng() - 0.5) * 0.12).toFixed(6))
            );
          }
        } else if (v && typeof v === "object") {
          out[k] = JSON.parse(JSON.stringify(v));
        } else {
          out[k] = v;
        }
      }
      return out;
    }

    function createBlankSoulCheckpoint(learnerId, opponentId, p1Idx, p2Idx) {
      if (!g.SoulAgent) return null;

      const lCode = g.SoulAgent.toCode(learnerId);
      const oCode = g.SoulAgent.toCode(opponentId);
      const mKey = g.SoulAgent.getCanonicalKey(learnerId, opponentId);
      const seedNum = 10000 + (p1Idx + 1) * 100 + (p2Idx + 1);

      // Prefer SoulAgent / SoulNet native factory if present
      if (typeof g.SoulAgent.createBlankCheckpoint === "function") {
        try {
          const cp = g.SoulAgent.createBlankCheckpoint(learnerId, opponentId);
          if (cp && g.SoulAgent.validateCheckpoint(cp, learnerId, opponentId).valid) {
            return cp;
          }
        } catch (_) {}
      }

      const template = findAnyExistingCheckpoint();
      const freshWeights = reinitWeightsFromTemplate(template?.weights, seedNum);

      const base = template ? JSON.parse(JSON.stringify(template)) : {};

      const candidateCp = Object.assign(base, {
        build: BUILD,
        version: BUILD,
        patch: PATCH,
        schema: EXPECTED_SCHEMA,
        learnerId,
        opponentId,
        learnerCode: lCode,
        opponentCode: oCode,
        matchupKey: mKey,
        games: 0,
        steps: 0,
        updates: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        weights: freshWeights,
        weightsID: `init-${mKey}-${seedNum}`,
        updatedAt: new Date().toISOString()
      });

      if (candidateCp.targetWeights) {
        candidateCp.targetWeights = JSON.parse(JSON.stringify(freshWeights));
      }
      delete candidateCp.evaluation;

      const val = g.SoulAgent.validateCheckpoint(candidateCp, learnerId, opponentId);
      return val.valid ? candidateCp : null;
    }

    function extractCheckpointFromPoolEntry(rawEntry, learnerId, opponentId) {
      if (!rawEntry || typeof rawEntry !== "object" || !g.SoulAgent) return null;

      const mKey = g.SoulAgent.getCanonicalKey(learnerId, opponentId);
      const lCode = g.SoulAgent.toCode(learnerId);
      const oCode = g.SoulAgent.toCode(opponentId);

      // Unwrap possible container formats from MatchupPool or Drive JSON
      let cp =
        rawEntry.checkpoint ||
        rawEntry.candidate?.[mKey] ||
        rawEntry.candidate ||
        rawEntry.active?.[mKey] ||
        rawEntry.active ||
        (rawEntry.weights ? rawEntry : null);

      if (!cp || typeof cp !== "object" || !cp.weights) return null;

      const normalized = Object.assign({}, cp, {
        build: BUILD,
        version: BUILD,
        patch: PATCH,
        schema: EXPECTED_SCHEMA,
        learnerId,
        opponentId,
        learnerCode: lCode,
        opponentCode: oCode,
        matchupKey: mKey
      });

      const val = g.SoulAgent.validateCheckpoint(normalized, learnerId, opponentId);
      return val.valid ? normalized : null;
    }

    // Push a single checkpoint from SoulAgent -> Header Panel MatchupPool
    function syncToHeaderPool(cp, selectedLearner) {
      if (!cp || !g.MatchupPool || !g.SoulAgent) return;
      try {
        const lCode = g.SoulAgent.toCode(cp.learnerId || selectedLearner);
        const oCode = g.SoulAgent.toCode(cp.opponentId);
        const p1Idx = parseInt(lCode, 10) - 1;
        const p2Idx = parseInt(oCode, 10) - 1;
        if (
          Number.isInteger(p1Idx) && p1Idx >= 0 && p1Idx < 7 &&
          Number.isInteger(p2Idx) && p2Idx >= 0 && p2Idx < 7
        ) {
          const mId = `r${p1Idx}_vs_r${p2Idx}`;
          if (!g.MatchupPool.pool[mId]) {
            g.MatchupPool.pool[mId] = {
              id: mId,
              p1: p1Idx,
              p2: p2Idx,
              status: "active"
            };
          }
          const entry = g.MatchupPool.pool[mId];
          entry.status = "active";
          entry.steps = cp.steps || 0;
          entry.games = cp.games || 0;
          entry.checkpoint = cp;
          entry.updatedAt = new Date().toISOString();
          if (typeof g.MatchupPool.saveMatchup === "function") {
            g.MatchupPool.saveMatchup(mId);
          }
        }
      } catch (err) {
        console.warn("[Training UI] Header pool sync warning:", err);
      }
    }

    // Full 49-matrix bidirectional sync between Header Panel (MatchupPool) and SoulAgent
    function syncWithHeaderPool(options = {}) {
      if (!data || !g.SoulAgent || !g.MatchupPool || !g.MatchupPool.pool) {
        return { imported: 0, exported: 0, initialized: 0 };
      }

      const preferPool = Boolean(options.preferPool);
      const createMissing = options.createMissing !== false;

      let imported = 0;
      let exported = 0;
      let initializedCount = 0;

      for (let i = 0; i < data.riders.length && i < 7; i++) {
        for (let j = 0; j < data.riders.length && j < 7; j++) {
          const learnerId = data.riders[i].id;
          const opponentId = data.riders[j].id;
          const mId = `r${i}_vs_r${j}`;
          const mKey = g.SoulAgent.getCanonicalKey(learnerId, opponentId);

          const poolEntry =
            g.MatchupPool.pool[mId] ||
            g.MatchupPool.pool[mKey] ||
            null;

          const poolCp = extractCheckpointFromPoolEntry(
            poolEntry,
            learnerId,
            opponentId
          );

          const soulCand = g.SoulAgent.getSection(learnerId, opponentId, "candidate");
          const soulAct = g.SoulAgent.getSection(learnerId, opponentId, "active");
          const soulBest = soulCand || soulAct;

          if (poolCp && (!soulBest || (preferPool && (poolCp.games > 0 || !soulBest.games)) || (poolCp.games || 0) > (soulBest.games || 0) || (poolCp.steps || 0) > (soulBest.steps || 0))) {
            // Header Pool has a newer/imported checkpoint -> load into SoulAgent
            g.SoulAgent.setCandidate(poolCp);
            syncToHeaderPool(poolCp, learnerId);
            imported++;
          } else if (soulBest) {
            // SoulAgent already has a trained/valid checkpoint -> ensure Header Pool has it
            syncToHeaderPool(soulBest, learnerId);
            exported++;
          } else if (createMissing && poolEntry && poolEntry.status === "active") {
            // Slot was marked active in Header Panel (e.g. Init All 49) but had no weights yet
            const blankCp = createBlankSoulCheckpoint(learnerId, opponentId, i, j);
            if (blankCp) {
              g.SoulAgent.setCandidate(blankCp);
              syncToHeaderPool(blankCp, learnerId);
              initializedCount++;
            }
          }
        }
      }

      if (typeof g.MatchupPool.updateUI === "function") {
        g.MatchupPool.updateUI();
      }

      return { imported, exported, initialized: initializedCount };
    }

    // Hook Header Panel (window.MatchupPool) methods so Header buttons immediately
    // update SoulAgent and refresh the train.html UI.
    function hookHeaderPanel() {
      const mp = g.MatchupPool;
      if (!mp || mp._soulTrainerHooked) return;
      mp._soulTrainerHooked = true;

      // 1. Hook Init All 49 Matrices
      if (typeof mp.initAll49 === "function") {
        const origInit = mp.initAll49.bind(mp);
        mp.initAll49 = function (...args) {
          const res = origInit(...args);
          const stats = syncWithHeaderPool({ preferPool: false, createMissing: true });
          refresh();
          output(
            `Header Panel: Initialized all 49 matrices in SoulAgent.\n` +
            `Preserved existing trained models: ${stats.exported} | Freshly initialized: ${stats.initialized}`
          );
          return res;
        };
      }

      // 2. Hook Pull 49 Matrices <- Google Drive
      mp.pullFromDrive = async function () {
        const scriptUrl = mp.getScriptUrl?.();
        if (!scriptUrl) {
          alert("Please enter your deployed Google Apps Script Web App URL first.");
          return;
        }
        mp.setDriveStatus?.("Pulling 49 matrices from Google Drive...", "#ffa502");
        try {
          const url =
            `${scriptUrl}?action=pullAll&folderId=${encodeURIComponent(mp.driveFolderId)}` +
            `&t=${Date.now()}`;

          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const remoteMatrices = await res.json();

          let loaded = 0;
          if (remoteMatrices && typeof remoteMatrices === "object") {
            for (let i = 0; i < 7 && i < (data?.riders?.length || 7); i++) {
              for (let j = 0; j < 7 && j < (data?.riders?.length || 7); j++) {
                const mId = `r${i}_vs_r${j}`;
                const lCode = String(i + 1).padStart(3, "0");
                const oCode = String(j + 1).padStart(3, "0");
                const mKey = `${lCode}_${oCode}`;

                // Support r0_vs_r0.json, 001_001.json, or nested 001.json rider bundles
                const remoteEntry =
                  remoteMatrices[mId] ||
                  remoteMatrices[mKey] ||
                  remoteMatrices[lCode]?.candidate?.[mKey] ||
                  remoteMatrices[lCode]?.active?.[mKey] ||
                  null;

                if (remoteEntry) {
                  const learnerId = data.riders[i].id;
                  const opponentId = data.riders[j].id;
                  const extractedCp = extractCheckpointFromPoolEntry(
                    remoteEntry,
                    learnerId,
                    opponentId
                  );

                  mp.pool[mId] = Object.assign({}, mp.pool[mId] || {}, {
                    id: mId,
                    p1: i,
                    p2: j,
                    status: "active",
                    steps: extractedCp?.steps ?? remoteEntry.steps ?? 0,
                    games: extractedCp?.games ?? remoteEntry.games ?? 0,
                    checkpoint: extractedCp || mp.pool[mId]?.checkpoint || null,
                    updatedAt: remoteEntry.updatedAt || new Date().toISOString()
                  });

                  mp.saveMatchup?.(mId);
                  loaded++;
                }
              }
            }
          }

          const syncStats = syncWithHeaderPool({
            preferPool: true,
            createMissing: true
          });

          mp.updateUI?.();
          refresh();

          if (loaded === 0) {
            mp.setDriveStatus?.(
              "Drive folder returned 0 saved files ({}) — synced local 49 matrices instead. Click 'Sync 49 Matrices → Google Drive' to upload.",
              "#ffa502"
            );
            output(
              "GOOGLE DRIVE PULL INFO\n" +
              "The Google Drive folder returned an empty set ({}).\n" +
              "All 49 local matrices have been prepared in SoulAgent.\n" +
              "Click 'Sync 49 Matrices → Google Drive' in the top header panel to upload them to your Drive folder."
            );
          } else {
            mp.setDriveStatus?.(
              `Pulled ${loaded} / 49 matrices from Google Drive (${syncStats.imported} loaded into Trainer).`,
              "#00ff88"
            );
            output(
              `GOOGLE DRIVE PULL COMPLETE\n` +
              `Pulled ${loaded} matrices from Google Drive.\n` +
              `Imported ${syncStats.imported} checkpoints into SoulAgent (preserved ${syncStats.exported}, initialized ${syncStats.initialized}).`
            );
          }
        } catch (err) {
          console.error("[GDrive Pull Error]", err);
          mp.setDriveStatus?.(`Pull failed: ${err.message}`, "#ff4757");
        }
      };

      // 3. Hook Sync 49 Matrices -> Google Drive (CORS-safe text/plain + batched by Rider row)
      mp.syncToDrive = async function () {
        const scriptUrl = mp.getScriptUrl?.();
        if (!scriptUrl) {
          alert("Please enter your deployed Google Apps Script Web App URL first.");
          return;
        }

        // Ensure all latest SoulAgent checkpoints are flushed into MatchupPool before upload
        syncWithHeaderPool({ preferPool: false, createMissing: true });
        refresh();

        mp.setDriveStatus?.("Syncing 49 matrices to Google Drive (7 batches)...", "#ffa502");

        try {
          let totalSaved = 0;

          // Upload 7 matchups at a time (1 Rider row per request) so payload stays well under
          // Google Apps Script POST body size limits and uses CORS-safe text/plain
          for (let i = 0; i < 7; i++) {
            const batchMatrices = {};
            for (let j = 0; j < 7; j++) {
              const mId = `r${i}_vs_r${j}`;
              if (mp.pool[mId]) {
                batchMatrices[mId] = mp.pool[mId];
              }
            }

            mp.setDriveStatus?.(
              `Syncing Rider 00${i + 1} matrices (${i + 1}/7) to Google Drive...`,
              "#ffa502"
            );

            const payload = {
              action: "syncAll",
              folderId: mp.driveFolderId,
              timestamp: new Date().toISOString(),
              matrices: batchMatrices
            };

            const res = await fetch(scriptUrl, {
              method: "POST",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`HTTP ${res.status} on batch ${i + 1}`);
            const json = await res.json();
            totalSaved += Number(json.savedCount ?? 7);
          }

          mp.setDriveStatus?.(
            `Synced ${totalSaved} / 49 matrices to Google Drive (${new Date().toLocaleTimeString()})`,
            "#00ff88"
          );
          output(
            `GOOGLE DRIVE SYNC COMPLETE\n` +
            `Uploaded ${totalSaved} / 49 matchup matrices (with full neural network checkpoints) to Google Drive folder ${mp.driveFolderId}.`
          );
        } catch (err) {
          console.error("[GDrive Sync Error]", err);
          mp.setDriveStatus?.(`Sync failed: ${err.message}`, "#ff4757");
        }
      };
    }

    function flushPendingCheckpoints(selectedLearner) {
      if (pendingCheckpoints.size === 0) return false;

      for (const cp of pendingCheckpoints.values()) {
        const validation = g.SoulAgent.validateCheckpoint(
          cp,
          cp?.learnerId || selectedLearner,
          cp?.opponentId
        );

        if (!validation.valid) {
          throw new Error(validation.error);
        }

        g.SoulAgent.setCandidate(cp);
        syncToHeaderPool(cp, selectedLearner);
      }

      pendingCheckpoints.clear();
      lastCheckpointSaveTime = performance.now();
      return true;
    }

    function refreshStatusOnly() {
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
            ? `Selected Learner: Rider ${learnerCode} (${learnerCode}_001 .. ${learnerCode}_${codes[codes.length - 1] || "007"} Auto-Cycle + 10 backup slots)`
            : `Selected Matchup: ${agent.getCanonicalKey(selected.learner, selected.opponent)}`
          : "Loading matchup data…",

        isMulti
          ? `Rider ${learnerCode} Candidate Matchups: ${candCount} / ${codes.length} active matchups populated`
          : `Candidate: ${
              candidate
                ? `${candidate.games} games / ${candidate.steps} accepted decisions`
                : "none — fresh training available"
            }`,

        isMulti
          ? `Rider ${learnerCode} Active Matchups: ${actCount} / ${codes.length} active matchups populated`
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

      statusEl.textContent = lines.join("\n");

      return {
        isMulti,
        candidate,
        active,
        learnerCandidateMap,
        candCount,
        actCount
      };
    }

    function refresh() {
      const {
        isMulti,
        candidate,
        active,
        learnerCandidateMap,
        candCount,
        actCount
      } = refreshStatusOnly();

      allButtons.forEach(element => {
        element.disabled = busy || !data;
      });

      allInputs.forEach(element => {
        element.disabled = busy || !data;
      });

      button("stop").disabled = !worker || stopping;

      const close = button("close");
      if (close) close.disabled = busy;

      if (!busy && data) {
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

    function formatWinningGamesBlock(firstWinningGames, firstWinningGamesCount = 0) {
      if (!Array.isArray(firstWinningGames)) {
        return firstWinningGamesCount > 0 ? cachedWinsBlock : "";
      }

      if (firstWinningGames.length === 0) {
        return "";
      }

      const lastGame = firstWinningGames[firstWinningGames.length - 1];
      const signature = `${firstWinningGames.length}:${lastGame?.gameNumber ?? 0}:${lastGame?.matchupKey ?? ""}:${lastGame?.difficulty ?? ""}`;

      if (signature === cachedWinsKey && cachedWinsBlock) {
        return cachedWinsBlock;
      }

      const winLines = [
        "",
        "======================================================================",
        "FIRST 4 WINNING GAMES PER DIFFICULTY & PER OPPONENT — MOVE SEQUENCES",
        "======================================================================"
      ];

      const groupedWins = new Map();

      for (const game of firstWinningGames) {
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

        winLines.push(
          "",
          `=== [ ${oppHeader} | Difficulty: ${group.difficultyLabel} ] (${group.games.length} / 4 Wins) ===`
        );

        group.games.forEach((game, idx) => {
          const winRank = game.bucketWinIndex || (idx + 1);
          const maxRank = game.bucketMaxWins || 4;
          const gameNum = game.gameNumber || (idx + 1);
          const totalRounds = game.totalRounds || game.moves?.length || 0;
          const slotTag = game.learnerSlot ? `, Slot: ${game.learnerSlot}` : "";

          winLines.push(
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

              winLines.push(`  R${rNum}: Learner [ ${lAction} @ ${lCharge} ]${lLp} vs Opponent [ ${oAction} @ ${oCharge} ]${oLp}`);
            });
          }
        });
      }

      cachedWinsKey = signature;
      cachedWinsBlock = winLines.join("\n");
      return cachedWinsBlock;
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

      const winsBlock = formatWinningGamesBlock(
        report.firstWinningGames,
        report.firstWinningGamesCount
      );
      if (winsBlock) {
        lines.push(winsBlock);
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

    function finishWorker(expectedWorker = worker, selectedLearner = null) {
      if (expectedWorker !== worker) return;

      try {
        flushPendingCheckpoints(selectedLearner || field("learner").value);
      } catch (err) {
        console.error("[Training UI] Checkpoint flush error:", err);
      }

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

      cachedWinsKey = "";
      cachedWinsBlock = "";
      pendingCheckpoints.clear();
      lastCheckpointSaveTime = 0;

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

          finishWorker(currentWorker, selected.learner);
        };

        currentWorker.onmessageerror = () => {
          if (worker !== currentWorker) return;

          output(
            "WORKER ERROR\nCould not deserialize a worker message."
          );

          finishWorker(currentWorker, selected.learner);
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
              const cpKey = g.SoulAgent.getCanonicalKey(
                cp?.learnerId || selected.learner,
                cp?.opponentId || selected.opponent
              );

              pendingCheckpoints.set(cpKey, cp);

              const now = performance.now();
              if (now - lastCheckpointSaveTime >= CHECKPOINT_SAVE_THROTTLE_MS) {
                flushPendingCheckpoints(selected.learner);
                refreshStatusOnly();
              }
            } else if (message.type === "progress") {
              output(formatReport(message.report));
            } else if (message.type === "done") {
              flushPendingCheckpoints(selected.learner);

              const report = message.report;

              if (
                !training &&
                !report.cancelled &&
                report.games === report.requested
              ) {
                g.SoulAgent.recordEvaluation(target, report);
                syncWithHeaderPool({ preferPool: false, createMissing: false });
              }

              output(
                formatReport(report) +
                (
                  training
                    ? "\n\nCandidate matchup(s) retained in RAM/LocalStorage and synced to the 49-Matrix Header Panel."
                    : report.cancelled
                      ? "\n\nIncomplete evaluation was not recorded for activation."
                      : "\n\nEvaluation finished and recorded."
                )
              );

              finishWorker(currentWorker, selected.learner);
            } else if (message.type === "error") {
              throw new Error(message.error);
            } else {
              throw new Error(
                "Unknown training worker message: " + message.type
              );
            }
          } catch (error) {
            output("JOB ERROR\n" + error.message);
            finishWorker(currentWorker, selected.learner);
          }
        };

        currentWorker.postMessage({ type: "start", job });
      } catch (error) {
        finishWorker(worker, selected.learner);
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
              button("stop").disabled = true;

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

            syncWithHeaderPool({ preferPool: false, createMissing: false });
            refresh();

            output(
              isMulti
                ? `Activated ${promoted.promotedKeys.length} matchups for Rider ${g.SoulAgent.toCode(selected.learner)}:\n${promoted.promotedKeys.join(", ")}`
                : "Selected candidate activated.\nNew matches can use it."
            );
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
      },

      syncHeaderPool(options) {
        const res = syncWithHeaderPool(options);
        refresh();
        return res;
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

      // Hook the Top Header Panel and perform initial bidirectional sync across all 49 slots
      hookHeaderPanel();
      const syncStats = syncWithHeaderPool({
        preferPool: false,
        createMissing: true
      });

      output(
        "Ready (v7 49-Matrix Mode).\n" +
        `Header Pool <-> SoulAgent Synced (Imported: ${syncStats.imported}, Preserved: ${syncStats.exported}, Initialized: ${syncStats.initialized}).\n` +
        "Select ALL OPPONENTS to auto-cycle training across all Riders with isolated matchup networks.\n" +
        "Use the Top Header Panel to Import/Export all 49 matrices to and from Google Drive."
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
