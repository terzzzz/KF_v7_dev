/* js/soul_agent.js
 * Exact-matchup checkpoint & 49-Matchup Matrix (data/matrix_r0_vs_r0.json .. r6_vs_r6.json) storage (v7).
 *
 * Build: v5-state256-action17
 * Matrix: v7-7riders-10backup (IndexedDB + Local data/ 49-Matrix Persistence)
 * Patch: charge1-reset1
 */

// Lift 5MB localStorage barrier into Unlimited Temp RAM
if (typeof window !== "undefined" && !Storage.prototype.__kfRam) {
  const RAM = (window.__KF_TEMP_RAM__ = window.__KF_TEMP_RAM__ || {});
  const _get = Storage.prototype.getItem;
  const _set = Storage.prototype.setItem;
  const _remove = Storage.prototype.removeItem;

  Storage.prototype.getItem = function (k) {
    return String(k).startsWith("kf_soul_agent_data_") && k in RAM
      ? RAM[k]
      : _get.call(this, k);
  };

  Storage.prototype.setItem = function (k, v) {
    if (String(k).startsWith("kf_soul_agent_data_")) {
      RAM[k] = String(v);
      try {
        _set.call(this, k, v);
      } catch (_) {
        // Ignore 5MB QuotaExceededError; IndexedDB + RAM handle persistence
      }
      return;
    }
    return _set.call(this, k, v);
  };

  Storage.prototype.removeItem = function (k) {
    if (String(k).startsWith("kf_soul_agent_data_")) {
      delete RAM[k];
    }
    try {
      _remove.call(this, k);
    } catch (_) {}
  };

  Storage.prototype.__kfRam = true;
}

(function (g) {
  "use strict";

  const VERSION = "v5-state256-action17";
  const MASTER_VERSION = "kf-soul-matrix-v7-state256-action17";
  const BUNDLE_VERSION = "kf-soul-rider-bundle-v7-state256-action17";
  const WORKER_VERSION = "kf-soul-ddqn-v5-state256-action17";

  const PATCH = "charge1-reset1";
  const CACHE_TAG = VERSION + "-" + PATCH + "-v7";

  const EXPECTED_SCHEMA =
    "kf-state256-action17-v2-charge1-reset1";

  const STORAGE_KEY =
    "kf_soul_agent_data_v7_matrix_state256_action17_charge1_reset1";

  const IDB_NAME = "kf_soul_agent_idb_v7";
  const IDB_VERSION = 1;
  const IDB_STORE = "matrix_store";

  const ACTIVE_ROSTER_COUNT = 7;
  const BACKUP_SLOT_COUNT = 10;
  const RESERVED_PARAM_SLOTS = 10;
  const TOTAL_MATRIX_SLOTS = ACTIVE_ROSTER_COUNT + BACKUP_SLOT_COUNT;

  const DEFAULT_RIDER_CODES = Object.freeze({
    ichigo: "001",
    nigo: "002",
    v3: "003",
    riderman: "004",
    x: "005",
    amazon: "006",
    stronger: "007",
    skyrider: "008",
    super1: "009",
    zx: "010",
    black: "011",
    shadowmoon: "012",
    rx: "013",
    shin: "014",
    zo: "015",
    j: "016",
    kuuga: "017"
  });

  const RIDER_CODES = { ...DEFAULT_RIDER_CODES };
  const REVERSE_CODES = Object.fromEntries(
    Object.entries(RIDER_CODES).map(([id, code]) => [code, id])
  );

  const store = {
    candidate: { matchups: {}, legacy: null },
    active: { matchups: {}, legacy: null }
  };

  let readyPromise = null;
  let cachedData = null;
  let storageLoaded = false;
  let idbLoaded = false;
  let storageWarning = "";
  let idbOpenPromise = null;
  let pendingIdbWrite = Promise.resolve();

  const warnings = [];

  function formatCodeNumber(num) {
    return String(num).padStart(3, "0");
  }

  function getAllSlotCodes() {
    const codes = [];
    for (let i = 1; i <= TOTAL_MATRIX_SLOTS; i++) {
      codes.push(formatCodeNumber(i));
    }
    return codes;
  }

  function getActiveCodes() {
    if (Array.isArray(cachedData?.riders) && cachedData.riders.length > 0) {
      return cachedData.riders.map((rider, idx) => {
        try {
          return toCode(rider.id);
        } catch (_) {
          return formatCodeNumber(idx + 1);
        }
      });
    }
    const codes = [];
    for (let i = 1; i <= ACTIVE_ROSTER_COUNT; i++) {
      codes.push(formatCodeNumber(i));
    }
    return codes;
  }

  function getBackupCodes() {
    const activeSet = new Set(getActiveCodes());
    return getAllSlotCodes()
      .filter(code => !activeSet.has(code))
      .slice(0, BACKUP_SLOT_COUNT);
  }

  function syncRosterCodes(riders) {
    if (!Array.isArray(riders)) return;

    riders.forEach((rider, index) => {
      const id = String(rider?.id || "").trim().toLowerCase();
      if (!id) return;

      const code = formatCodeNumber(index + 1);
      RIDER_CODES[id] = code;
      REVERSE_CODES[code] = id;
    });
  }

  function toCode(id) {
    if (id && typeof id === "object") {
      id = id.id ?? id.riderId ?? id.key ?? id.name ?? "";
    }

    const value = String(id ?? "").trim().toLowerCase();

    if (Object.prototype.hasOwnProperty.call(RIDER_CODES, value)) {
      return RIDER_CODES[value];
    }

    if (/^\d{3}$/.test(value)) {
      const idx = Number(value);
      if (idx >= 1 && idx <= TOTAL_MATRIX_SLOTS) {
        return value;
      }
    }

    if (/^r([0-6])$/.test(value)) {
      const idx = Number(value.slice(1)) + 1;
      return formatCodeNumber(idx);
    }

    if (/^[0-6]$/.test(value)) {
      const idx = Number(value) + 1;
      return formatCodeNumber(idx);
    }

    throw new Error("Unknown rider ID/code: " + id);
  }

  function fromCode(code) {
    const normalized = String(code || "").trim();
    return REVERSE_CODES[normalized] || normalized;
  }

  /**
   * Converts any rider identifier ("ichigo", "001", "r0", 0) to 0..6 index
   * where r0 = Ichigo (0) .. r6 = Stronger (6).
   */
  function toRiderIndex(id) {
    if (typeof id === "number" && Number.isInteger(id) && id >= 0 && id <= 6) {
      return id;
    }
    const code = toCode(id);
    return Math.max(0, Math.min(6, Number(code) - 1));
  }

  function getMatrixFileName(learner, opponent) {
    const rA = toRiderIndex(learner);
    const rB = toRiderIndex(opponent);
    return `matrix_r${rA}_vs_r${rB}.json`;
  }

  function getCanonicalKey(learner, opponent) {
    return `${toCode(learner)}_${toCode(opponent)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function configureForesight(options = {}) {
    if (typeof g.SoulEnv?.setForesightConfig === "function") {
      return g.SoulEnv.setForesightConfig(options);
    }
    return null;
  }

  function getForesightConfig() {
    if (typeof g.SoulEnv?.getForesightConfig === "function") {
      return g.SoulEnv.getForesightConfig();
    }
    return { enabled: true, horizon: 3, beamWidth: 4 };
  }

  function createDefaultMatchParameters(overrides = null) {
    const foresight = getForesightConfig();
    const defaultReserved = new Array(RESERVED_PARAM_SLOTS).fill(0);
    defaultReserved[0] = Number(foresight?.horizon || 3);

    const base = {
      avgRounds: 0,
      avgFinalLpRatio: 0,
      avgEnemyFinalLpRatio: 0,
      avgDamageDealtRatio: 0,
      avgDamageTakenRatio: 0,
      avgChiEarned: 0,
      avgChiSpent: 0,
      avgNetChiAdvantage: 0,
      avgExecutionCharge: 0,
      priorityWinRate: 0,
      sMoveUsageRate: 0,
      aGuardSuccessRate: 0,
      wBuffCastRate: 0,
      evasionTriggerRate: 0,
      faintInflictedRate: 0,
      faintSufferedRate: 0,
      stanceDistribution: { W: 0, A: 0, S: 0, D: 0, IDLE: 0 },
      buttonDistribution: { J: 0, K: 0, I: 0, L: 0, NONE: 0 },
      reservedSlots: defaultReserved
    };

    if (!overrides || typeof overrides !== "object") {
      return base;
    }

    const merged = {
      ...base,
      ...overrides,
      stanceDistribution: {
        ...base.stanceDistribution,
        ...(overrides.stanceDistribution || {})
      },
      buttonDistribution: {
        ...base.buttonDistribution,
        ...(overrides.buttonDistribution || {})
      },
      reservedSlots: Array.isArray(overrides.reservedSlots)
        ? overrides.reservedSlots
            .slice(0, RESERVED_PARAM_SLOTS)
            .map(v => (Number.isFinite(Number(v)) ? Number(v) : 0))
        : [...defaultReserved]
    };

    while (merged.reservedSlots.length < RESERVED_PARAM_SLOTS) {
      merged.reservedSlots.push(0);
    }

    return merged;
  }

  function assertRuntime() {
    if (
      g.SoulEnv?.SCHEMA !== EXPECTED_SCHEMA ||
      typeof g.SoulEnv?.assertSpec !== "function" ||
      typeof g.SoulNN?.validateJSON !== "function"
    ) {
      throw new Error(
        "SoulAgent requires the charge1-reset1 " +
        "environment and neural modules."
      );
    }
  }

  function fingerprint(checkpoint) {
    if (!checkpoint?.net) {
      throw new Error("Cannot fingerprint a missing network.");
    }

    return String(
      g.KF.hash(JSON.stringify(checkpoint.net))
    );
  }

  function validateCheckpoint(
    checkpoint,
    expectedLearner,
    expectedOpponent
  ) {
    try {
      assertRuntime();

      if (!checkpoint || typeof checkpoint !== "object") {
        throw new Error("Checkpoint is missing.");
      }

      if (checkpoint.version !== WORKER_VERSION) {
        throw new Error(
          "Checkpoint version is incompatible with this build."
        );
      }

      if (checkpoint.spec?.schema !== EXPECTED_SCHEMA) {
        throw new Error(
          "Checkpoint uses an incompatible charging-rule schema."
        );
      }

      g.SoulEnv.assertSpec(checkpoint.spec);
      g.SoulNN.validateJSON(checkpoint.net);

      const sizes = checkpoint.net.sizes;

      if (
        sizes[0] !== checkpoint.spec.input ||
        sizes[sizes.length - 1] !== checkpoint.spec.output
      ) {
        throw new Error(
          "Checkpoint network/schema dimensions disagree."
        );
      }

      const key = getCanonicalKey(
        checkpoint.learnerId,
        checkpoint.opponentId
      );

      if (
        checkpoint.canonicalKey &&
        checkpoint.canonicalKey !== key
      ) {
        throw new Error(
          "Checkpoint IDs disagree with its canonical key."
        );
      }

      if (expectedLearner && expectedOpponent) {
        const expected = getCanonicalKey(
          expectedLearner,
          expectedOpponent
        );

        if (key !== expected) {
          throw new Error(
            `Matchup mismatch: got ${key}, expected ${expected}.`
          );
        }
      }

      for (const field of ["games", "steps"]) {
        if (
          !Number.isSafeInteger(checkpoint[field]) ||
          checkpoint[field] < 0
        ) {
          throw new Error(
            "Invalid checkpoint counter: " + field
          );
        }
      }

      const weightCount = checkpoint.net.layers.reduce(
        (sum, layer) => sum + layer.w.length + layer.b.length,
        0
      );

      return {
        valid: true,
        canonicalKey: key,
        learnerId: checkpoint.learnerId,
        opponentId: checkpoint.opponentId,
        games: checkpoint.games,
        steps: checkpoint.steps,
        weightCount
      };
    } catch (error) {
      return {
        valid: false,
        error: error?.message || String(error)
      };
    }
  }

  function isRiderBundle(payload) {
    return Boolean(
      payload &&
      typeof payload === "object" &&
      (payload.bundleType === "rider_matrix_v7" ||
        payload.version === BUNDLE_VERSION ||
        (payload.matchups && typeof payload.matchups === "object" && !payload.net))
    );
  }

  function validateRiderBundle(bundle, expectedLearner = null) {
    try {
      assertRuntime();

      if (!isRiderBundle(bundle)) {
        throw new Error("Payload is not a v7 Rider Matrix Bundle.");
      }

      if (bundle.schema && bundle.schema !== EXPECTED_SCHEMA) {
        throw new Error("Bundle schema does not match " + EXPECTED_SCHEMA + ".");
      }

      const learnerCode = toCode(bundle.learnerCode || bundle.learnerId);

      if (expectedLearner && toCode(expectedLearner) !== learnerCode) {
        throw new Error(
          `Bundle learner mismatch: got ${learnerCode}, expected ${toCode(expectedLearner)}.`
        );
      }

      const validMatchups = {};
      const entries = Object.entries(bundle.matchups || {});

      for (const [rawKey, cp] of entries) {
        if (!cp) continue;

        const parts = String(rawKey).split("_");
        const oppCode = parts.length === 2 ? parts[1] : cp.opponentId;
        const expectedKey = `${learnerCode}_${toCode(oppCode)}`;

        const validation = validateCheckpoint(
          cp,
          cp.learnerId || fromCode(learnerCode),
          cp.opponentId || fromCode(toCode(oppCode))
        );

        if (!validation.valid) {
          throw new Error(`${expectedKey}: ${validation.error}`);
        }

        validMatchups[validation.canonicalKey] = cp;
      }

      return {
        valid: true,
        learnerCode,
        learnerId: bundle.learnerId || fromCode(learnerCode),
        matchups: validMatchups,
        count: Object.keys(validMatchups).length
      };
    } catch (error) {
      return {
        valid: false,
        error: error?.message || String(error)
      };
    }
  }

  function buildRiderBundle(learner, target = "candidate", fallbackToActive = true) {
    assertRuntime();

    const learnerCode = toCode(learner);
    const learnerId = fromCode(learnerCode);
    const activeCodes = getActiveCodes();
    const backupCodes = getBackupCodes();

    const matchups = {};
    let totalGames = 0;
    let totalSteps = 0;
    let populatedMatchups = 0;

    for (const oppCode of activeCodes) {
      const key = `${learnerCode}_${oppCode}`;
      let cp = store[target]?.matchups?.[key] || null;

      if (!cp && fallbackToActive && target !== "active") {
        cp = store.active?.matchups?.[key] || null;
      }

      if (cp) {
        const copy = clone(cp);
        copy.canonicalKey = key;
        copy.matchParameters = createDefaultMatchParameters(copy.matchParameters);
        matchups[key] = copy;
        totalGames += copy.games || 0;
        totalSteps += copy.steps || 0;
        populatedMatchups++;
      } else {
        matchups[key] = null;
      }
    }

    const backupSlots = {};
    for (const backupCode of backupCodes) {
      const key = `${learnerCode}_${backupCode}`;
      const cp =
        store[target]?.matchups?.[key] ||
        (fallbackToActive ? store.active?.matchups?.[key] : null) ||
        null;
      backupSlots[key] = cp ? clone(cp) : null;
      if (cp) {
        populatedMatchups++;
      }
    }

    if (populatedMatchups === 0) {
      throw new Error(
        `No trained matchups exist yet for Rider ${learnerCode} (${learnerId}).`
      );
    }

    return {
      bundleType: "rider_matrix_v7",
      version: BUNDLE_VERSION,
      masterVersion: MASTER_VERSION,
      workerVersion: WORKER_VERSION,
      trainerBuild: VERSION,
      trainerPatch: PATCH,
      schema: EXPECTED_SCHEMA,
      learnerCode,
      learnerId,
      activeRosterCount: activeCodes.length,
      backupSlotCount: backupCodes.length,
      reservedParamSlotCount: RESERVED_PARAM_SLOTS,
      savedAt: new Date().toISOString(),
      spec: g.SoulEnv.makeSpec(),
      matchups,
      backupSlots,
      riderParameterSummary: {
        totalGames,
        totalSteps,
        populatedMatchups,
        neuralParamsPerMatchup: 42257,
        totalNeuralParamsInBundle: populatedMatchups * 42257,
        max7RiderBundleParams: ACTIVE_ROSTER_COUNT * 42257,
        max17SlotBundleParams: TOTAL_MATRIX_SLOTS * 42257,
        reservedSummarySlots: new Array(RESERVED_PARAM_SLOTS).fill(0)
      }
    };
  }

  // ===========================================================================
  // INDEXEDDB + LOCALSTORAGE HIGH-CAPACITY PERSISTENCE
  // ===========================================================================

  function purgeDuplicateLocalStorageKeys() {
    try {
      const storage = g.localStorage;
      if (!storage) return;
      const toRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (
          key &&
          (key.startsWith("kf_matrix49_v5_") ||
            (key.startsWith("kf_soul_agent_data_") && key !== STORAGE_KEY))
        ) {
          toRemove.push(key);
        }
      }
      toRemove.forEach(k => storage.removeItem(k));
    } catch (_) {}
  }

  function openIndexedDB() {
    if (idbOpenPromise) return idbOpenPromise;

    idbOpenPromise = new Promise(resolve => {
      if (typeof g.indexedDB === "undefined" || !g.indexedDB) {
        resolve(null);
        return;
      }

      try {
        const req = g.indexedDB.open(IDB_NAME, IDB_VERSION);

        req.onupgradeneeded = event => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };

        req.onsuccess = event => {
          resolve(event.target.result);
        };

        req.onerror = () => {
          resolve(null);
        };

        req.onblocked = () => {
          resolve(null);
        };
      } catch (_) {
        resolve(null);
      }
    });

    return idbOpenPromise;
  }

  function serializeStorePayload() {
    return {
      version: MASTER_VERSION,
      patch: PATCH,
      schema: EXPECTED_SCHEMA,
      updatedAt: new Date().toISOString(),
      candidate: { matchups: store.candidate.matchups },
      active: { matchups: store.active.matchups }
    };
  }

  function ingestStoredPayload(payload) {
    if (!payload || payload.version !== MASTER_VERSION) return 0;

    let restored = 0;

    for (const target of ["candidate", "active"]) {
      for (const [key, checkpoint] of Object.entries(
        payload[target]?.matchups || {}
      )) {
        if (!checkpoint) continue;

        const existing = store[target].matchups[key];
        if (
          existing &&
          (existing.games || 0) > (checkpoint.games || 0) &&
          (existing.steps || 0) >= (checkpoint.steps || 0)
        ) {
          continue;
        }

        const validation = validateCheckpoint(checkpoint);

        if (validation.valid && validation.canonicalKey === key) {
          const copy = clone(checkpoint);
          copy.canonicalKey = key;
          copy.matchParameters = createDefaultMatchParameters(
            copy.matchParameters
          );
          store[target].matchups[key] = copy;
          store[target].legacy = copy;
          restored++;
        }
      }
    }

    return restored;
  }

  function writeToIndexedDB(payloadSnapshot) {
    pendingIdbWrite = pendingIdbWrite
      .catch(() => {})
      .then(async () => {
        const db = await openIndexedDB();
        if (!db) return false;

        return new Promise(resolve => {
          try {
            const tx = db.transaction(IDB_STORE, "readwrite");
            const objectStore = tx.objectStore(IDB_STORE);
            objectStore.put(payloadSnapshot, STORAGE_KEY);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
          } catch (_) {
            resolve(false);
          }
        });
      });

    return pendingIdbWrite;
  }

  async function loadFromIndexedDB() {
    if (idbLoaded) return 0;
    idbLoaded = true;

    const db = await openIndexedDB();
    if (!db) return 0;

    const payload = await new Promise(resolve => {
      try {
        const tx = db.transaction(IDB_STORE, "readonly");
        const objectStore = tx.objectStore(IDB_STORE);
        const req = objectStore.get(STORAGE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });

    if (!payload) return 0;
    return ingestStoredPayload(payload);
  }

  function saveToLocalStorage() {
    const payload = serializeStorePayload();

    // Always write full payload to IndexedDB (unlimited browser storage)
    writeToIndexedDB(clone(payload));

    try {
      const storage = g.localStorage;
      if (!storage) {
        storageWarning = "";
        return;
      }

      purgeDuplicateLocalStorageKeys();
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      storageWarning = "";
    } catch (_) {
      // IndexedDB + RAM hold all 49 matrices even when 5MB localStorage is full
      storageWarning = "";
    }
  }

  function loadFromLocalStorage() {
    if (storageLoaded) return;
    storageLoaded = true;

    try {
      purgeDuplicateLocalStorageKeys();
      const storage = g.localStorage;
      if (!storage) return;

      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return;

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (_) {
        warnings.push("Could not parse stored v7 matrix data.");
        return;
      }

      ingestStoredPayload(payload);
    } catch (error) {
      warnings.push(
        "Could not read stored checkpoints: " +
        (error?.message || String(error))
      );
    }
  }

  async function flushStorage() {
    saveToLocalStorage();
    try {
      await pendingIdbWrite;
    } catch (_) {}
  }

  function projectBase() {
    if (typeof document !== "undefined") {
      return document.baseURI;
    }

    return new URL("../", g.location.href).href;
  }

  function riderBundleURL(learner) {
    const code = toCode(learner);
    const url = new URL(
      `data/matrix/${code}.json`,
      projectBase()
    );

    url.searchParams.set("v", CACHE_TAG);
    return url;
  }

  /**
   * Builds candidate URLs for a 1v1 matchup in `data/`:
   * Primary: `data/matrix_r{A}_vs_r{B}.json` (e.g. `data/matrix_r5_vs_r0.json`)
   * Fallback: `data/matrix_r{A}_r{B}.json`
   */
  function matchupMatrixURLs(learner, opponent) {
    const rA = toRiderIndex(learner);
    const rB = toRiderIndex(opponent);
    const base = projectBase();

    const primary = new URL(`data/matrix_r${rA}_vs_r${rB}.json`, base);
    primary.searchParams.set("v", CACHE_TAG);

    const secondary = new URL(`data/matrix_r${rA}_r${rB}.json`, base);
    secondary.searchParams.set("v", CACHE_TAG);

    return [
      { url: primary, label: `data/matrix_r${rA}_vs_r${rB}.json` },
      { url: secondary, label: `data/matrix_r${rA}_r${rB}.json` }
    ];
  }

  function ingestRiderBundleIntoStore(bundle, overwriteActive = true) {
    const validation = validateRiderBundle(bundle);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    let loadedCount = 0;

    const allEntries = {
      ...(bundle.backupSlots || {}),
      ...(bundle.matchups || {})
    };

    for (const [, cp] of Object.entries(allEntries)) {
      if (!cp) continue;

      const check = validateCheckpoint(cp);
      if (!check.valid) continue;

      const key = check.canonicalKey;
      const saved = clone(cp);
      saved.canonicalKey = key;
      saved.matchParameters = createDefaultMatchParameters(saved.matchParameters);

      const existingActive = store.active.matchups[key];
      if (
        overwriteActive ||
        !existingActive ||
        (saved.games || 0) > (existingActive.games || 0)
      ) {
        store.active.matchups[key] = saved;
        store.active.legacy = saved;
      }

      const existingCandidate = store.candidate.matchups[key];
      if (
        !existingCandidate ||
        (saved.games || 0) > (existingCandidate.games || 0)
      ) {
        const candidateCopy = clone(saved);
        store.candidate.matchups[key] = candidateCopy;
        store.candidate.legacy = candidateCopy;
      }

      loadedCount++;
    }

    return {
      learnerCode: validation.learnerCode,
      loadedCount
    };
  }

  function normalizeDriveCheckpoint(rawCp, expectedLearner, expectedOpponent) {
    if (!rawCp || typeof rawCp !== "object") return null;

    // Support raw network JSON `{ sizes, layers }` as well as `{ net: { sizes, layers } }`
    const copy = rawCp.net
      ? clone(rawCp)
      : Array.isArray(rawCp.sizes) && Array.isArray(rawCp.layers)
        ? { net: clone(rawCp) }
        : null;

    if (!copy || !copy.net) return null;

    const canonicalLearnerId = expectedLearner
      ? fromCode(toCode(expectedLearner))
      : copy.learnerId
        ? fromCode(toCode(copy.learnerId))
        : null;

    const canonicalOpponentId = expectedOpponent
      ? fromCode(toCode(expectedOpponent))
      : copy.opponentId
        ? fromCode(toCode(copy.opponentId))
        : null;

    if (canonicalLearnerId) {
      copy.learnerId = canonicalLearnerId;
    }
    if (canonicalOpponentId) {
      copy.opponentId = canonicalOpponentId;
    }

    copy.version = WORKER_VERSION;

    if (
      !copy.spec ||
      copy.spec.schema !== EXPECTED_SCHEMA
    ) {
      if (typeof g.SoulEnv?.makeSpec === "function") {
        copy.spec = g.SoulEnv.makeSpec();
      }
    }

    if (copy.learnerId && copy.opponentId) {
      copy.canonicalKey = getCanonicalKey(copy.learnerId, copy.opponentId);
    }

    if (!Number.isSafeInteger(copy.steps) || copy.steps < 0) {
      copy.steps = Number(copy.steps) > 0 ? Math.floor(Number(copy.steps)) : 0;
    }

    if (!Number.isSafeInteger(copy.games) || copy.games < 0) {
      copy.games = Number(copy.games) > 0
        ? Math.floor(Number(copy.games))
        : copy.steps > 0
          ? Math.max(1, Math.floor(copy.steps / 12))
          : 0;
    }

    const check = validateCheckpoint(copy, expectedLearner, expectedOpponent);
    return check.valid ? copy : null;
  }

  function ingestDriveMatchup(payload, expectedLearner = null, expectedOpponent = null) {
    if (!payload || typeof payload !== "object") {
      return { imported: false, games: 0, steps: 0, checkpoint: null };
    }

    if (isRiderBundle(payload)) {
      const res = ingestRiderBundleIntoStore(payload, true);
      saveToLocalStorage();
      const cp = expectedLearner && expectedOpponent
        ? getSection(expectedLearner, expectedOpponent, "active") ||
          getSection(expectedLearner, expectedOpponent, "candidate")
        : null;
      return { imported: res.loadedCount > 0, games: cp?.games || 0, steps: cp?.steps || 0, checkpoint: cp };
    }

    let imported = false;
    let bestGames = 0;
    let bestSteps = 0;
    let canonicalKey = null;
    let resolvedCheckpoint = null;

    const activeRaw =
      payload.soulActive ||
      payload.activeCheckpoint ||
      (payload.active && payload.active.net ? payload.active : null);

    const candidateRaw =
      payload.soulCandidate ||
      payload.soulCheckpoint ||
      payload.checkpoint ||
      (payload.candidate && payload.candidate.net ? payload.candidate : null) ||
      (payload.net ? payload : null) ||
      (Array.isArray(payload.sizes) && Array.isArray(payload.layers) ? payload : null);

    const validActive = normalizeDriveCheckpoint(
      activeRaw || candidateRaw,
      expectedLearner,
      expectedOpponent
    );

    if (validActive) {
      const key = validActive.canonicalKey;
      const existingAct = store.active.matchups[key];
      if (
        !existingAct ||
        (validActive.games || 0) >= (existingAct.games || 0) ||
        (validActive.steps || 0) >= (existingAct.steps || 0)
      ) {
        resolvedCheckpoint = setActive(validActive);
      } else {
        resolvedCheckpoint = existingAct;
      }
      imported = true;
      canonicalKey = key;
      bestGames = Math.max(bestGames, resolvedCheckpoint.games || 0);
      bestSteps = Math.max(bestSteps, resolvedCheckpoint.steps || 0);
    }

    const validCandidate = normalizeDriveCheckpoint(
      candidateRaw || activeRaw,
      expectedLearner,
      expectedOpponent
    );

    if (validCandidate) {
      const key = validCandidate.canonicalKey;
      const existingCand = store.candidate.matchups[key];
      if (
        !existingCand ||
        (validCandidate.games || 0) > 0 ||
        (validCandidate.steps || 0) > 0 ||
        (existingCand.games || 0) === 0
      ) {
        if (
          !existingCand ||
          (validCandidate.games || 0) >= (existingCand.games || 0) ||
          (validCandidate.steps || 0) >= (existingCand.steps || 0)
        ) {
          const savedCand = setCandidate(validCandidate);
          if (!resolvedCheckpoint) {
            resolvedCheckpoint = savedCand;
          }
          imported = true;
          canonicalKey = key;
          bestGames = Math.max(bestGames, savedCand.games || 0);
          bestSteps = Math.max(bestSteps, savedCand.steps || 0);
        }
      }
    }

    return {
      imported,
      canonicalKey,
      games: bestGames,
      steps: bestSteps,
      checkpoint: resolvedCheckpoint
    };
  }

  /**
   * Fetches the exact 1v1 matchup file from `data/matrix_r{learner}_vs_r{opponent}.json`
   * (e.g. AI Amazon r5 vs Human Ichigo r0 -> `data/matrix_r5_vs_r0.json`)
   * and returns the validated checkpoint object for `ai_worker.js` and `KF_AI.choose()`.
   */
  async function fetchMatchupFromCDN(learner, opponent) {
    assertRuntime();

    const candidates = matchupMatrixURLs(learner, opponent);

    for (const { url, label } of candidates) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;

        const payload = await response.json();
        const ingested = ingestDriveMatchup(payload, learner, opponent);

        if (ingested.checkpoint) {
          const cpCopy = clone(ingested.checkpoint);
          cpCopy.matrixFile = label;
          return cpCopy;
        }
      } catch (_) {
        // Try next candidate path
      }
    }

    // Fallback: check if already in active/candidate store or bundle
    const existing =
      getSection(learner, opponent, "active") ||
      getSection(learner, opponent, "candidate");
    if (existing) {
      return clone(existing);
    }

    try {
      await fetchRiderBundleFromCDN(learner);
      const fromBundle =
        getSection(learner, opponent, "active") ||
        getSection(learner, opponent, "candidate");
      if (fromBundle) {
        return clone(fromBundle);
      }
    } catch (_) {
      // Ignore missing bundle fallback
    }

    throw new Error(
      `Cannot fetch ${getMatrixFileName(learner, opponent)} from data/ folder.`
    );
  }

  async function fetchRiderBundleFromCDN(learner, opponent = null) {
    assertRuntime();

    // If a specific opponent was passed, fetch that 1v1 matrix file directly
    if (opponent && opponent !== "*") {
      return fetchMatchupFromCDN(learner, opponent);
    }

    const code = toCode(learner);
    try {
      const response = await fetch(riderBundleURL(code), {
        cache: "no-store"
      });

      if (response.ok) {
        const payload = await response.json();
        if (isRiderBundle(payload)) {
          const result = ingestRiderBundleIntoStore(payload, true);
          saveToLocalStorage();
          return result;
        }
      }
    } catch (_) {
      // Fall through to per-opponent matrix_rA_vs_rB.json scan
    }

    let loadedCount = 0;
    for (const oppCode of getActiveCodes()) {
      try {
        const cp = await fetchMatchupFromCDN(code, oppCode);
        if (cp) loadedCount++;
      } catch (_) {}
    }

    saveToLocalStorage();
    return {
      learnerCode: code,
      loadedCount
    };
  }

  async function scanAllMatchupsFromRepo() {
    assertRuntime();

    let found = 0;
    const activeCodes = getActiveCodes();
    const jobs = [];

    for (const learnerCode of activeCodes) {
      for (const oppCode of activeCodes) {
        jobs.push(
          (async () => {
            const candidates = matchupMatrixURLs(learnerCode, oppCode);
            for (const { url } of candidates) {
              try {
                const response = await fetch(url, { cache: "no-store" });
                if (!response.ok) continue;

                const payload = await response.json();
                const res = ingestDriveMatchup(payload, learnerCode, oppCode);
                if (res.imported) {
                  found++;
                  return;
                }
              } catch (_) {
                // Missing/offline matrix files do not block startup
              }
            }
          })()
        );
      }
    }

    await Promise.all(jobs);
    saveToLocalStorage();
    return found;
  }

  function ready(forceFetch = false) {
    if (!readyPromise || forceFetch) {
      readyPromise = (async () => {
        assertRuntime();

        cachedData = await g.KF.loadData();
        if (Array.isArray(cachedData?.riders)) {
          syncRosterCodes(cachedData.riders);
        }

        // 1. Load local checkpoints from LocalStorage + IndexedDB first
        loadFromLocalStorage();
        await loadFromIndexedDB();

        // 2. Scan all 49 `data/matrix_rA_vs_rB.json` files from the data folder
        await scanAllMatchupsFromRepo();
        await flushStorage();

        return { data: cachedData };
      })().catch(error => {
        readyPromise = null;
        throw error;
      });
    }

    return readyPromise;
  }

  function getSection(
    learner,
    opponent,
    target = "candidate"
  ) {
    const bucket = store[target];

    if (!bucket) {
      throw new Error("Unknown checkpoint target: " + target);
    }

    if (!learner || !opponent || opponent === "*") {
      return bucket.legacy;
    }

    return bucket.matchups[
      getCanonicalKey(learner, opponent)
    ] || null;
  }

  function getLearnerSections(learner, target = "candidate") {
    const bucket = store[target];
    if (!bucket) {
      throw new Error("Unknown checkpoint target: " + target);
    }

    const learnerCode = toCode(learner);
    const result = {};

    for (const oppCode of getActiveCodes()) {
      const key = `${learnerCode}_${oppCode}`;
      if (bucket.matchups[key]) {
        result[key] = bucket.matchups[key];
      }
    }

    return result;
  }

  function snapshot(target = "candidate") {
    return store[target]?.legacy || null;
  }

  function assertEvaluation(checkpoint, report) {
    if (
      !report ||
      report.kind !== "evaluate" ||
      report.build !== VERSION ||
      report.patch !== PATCH ||
      report.schema !== EXPECTED_SCHEMA ||
      report.cancelled
    ) {
      throw new Error(
        "Evaluation is missing, incomplete, or from another rules patch."
      );
    }

    if (
      !Number.isSafeInteger(report.games) ||
      !Number.isSafeInteger(report.requested) ||
      report.games < 2 ||
      report.games % 2 !== 0 ||
      report.games !== report.requested
    ) {
      throw new Error(
        "Evaluation must complete an even number of at least two matches."
      );
    }

    const checkpointKey = getCanonicalKey(
      checkpoint.learnerId,
      checkpoint.opponentId
    );

    const reportKey = getCanonicalKey(
      report.learner,
      report.opponent
    );

    if (checkpointKey !== reportKey) {
      throw new Error("Evaluation belongs to a different matchup.");
    }

    if (!["network", "rider"].includes(report.learnerPolicy)) {
      throw new Error("Evaluation has an invalid learner policy.");
    }

    const totals = [report.wins, report.losses, report.draws];

    if (
      totals.some(value =>
        !Number.isSafeInteger(value) || value < 0
      ) ||
      totals.reduce((sum, value) => sum + value, 0) !== report.games
    ) {
      throw new Error("Evaluation result totals are inconsistent.");
    }

    const id = fingerprint(checkpoint);

    if (
      String(report.weightsID) !== id ||
      String(report.loadedWeightsID) !== id
    ) {
      throw new Error(
        "Evaluation belongs to different loaded weights."
      );
    }
  }

  function setCandidate(checkpoint) {
    const validation = validateCheckpoint(checkpoint);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const saved = clone(checkpoint);
    saved.canonicalKey = validation.canonicalKey;
    saved.matchParameters = createDefaultMatchParameters(saved.matchParameters);

    if (saved.evaluation) {
      try {
        assertEvaluation(saved, saved.evaluation);
        saved.evaluated = true;
      } catch (_) {
        saved.evaluation = null;
        saved.evaluated = false;
      }
    } else {
      saved.evaluation = null;
      saved.evaluated = false;
    }

    store.candidate.matchups[validation.canonicalKey] = saved;
    store.candidate.legacy = saved;

    saveToLocalStorage();
    return saved;
  }

  function setActive(checkpoint) {
    const validation = validateCheckpoint(checkpoint);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const saved = clone(checkpoint);
    saved.canonicalKey = validation.canonicalKey;
    saved.matchParameters = createDefaultMatchParameters(saved.matchParameters);

    store.active.matchups[validation.canonicalKey] = saved;
    store.active.legacy = saved;

    saveToLocalStorage();
    return saved;
  }

  function importCandidate(payload) {
    if (isRiderBundle(payload)) {
      const validation = validateRiderBundle(payload);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const importedKeys = [];
      const allEntries = {
        ...(payload.backupSlots || {}),
        ...(payload.matchups || {})
      };

      for (const [, cp] of Object.entries(allEntries)) {
        if (!cp) continue;
        const saved = setCandidate(cp);
        importedKeys.push(saved.canonicalKey);
      }

      if (importedKeys.length === 0) {
        throw new Error("Rider Matrix Bundle contained no populated matchup checkpoints.");
      }

      return {
        isBundle: true,
        learnerCode: validation.learnerCode,
        learnerId: validation.learnerId,
        importedKeys,
        canonicalKey: `${validation.learnerCode}.json (${importedKeys.length} matchups)`
      };
    }

    const single = setCandidate(payload);
    return {
      isBundle: false,
      learnerCode: toCode(single.learnerId),
      learnerId: single.learnerId,
      importedKeys: [single.canonicalKey],
      canonicalKey: single.canonicalKey
    };
  }

  function recordEvaluation(target, report) {
    if (!report) {
      throw new Error("Evaluation report is missing.");
    }

    if (Array.isArray(report.matchupReports) && report.matchupReports.length > 0) {
      for (const subReport of report.matchupReports) {
        recordEvaluation(target, subReport);
      }
      return;
    }

    const checkpoint = getSection(
      report.learner,
      report.opponent,
      target
    );

    if (!checkpoint) {
      throw new Error("Evaluated checkpoint no longer exists.");
    }

    const validation = validateCheckpoint(checkpoint);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    assertEvaluation(checkpoint, report);

    checkpoint.evaluation = clone(report);
    checkpoint.evaluated = true;

    saveToLocalStorage();
  }

  function promote(learner, opponent) {
    if (learner && opponent === "*") {
      const learnerCode = toCode(learner);
      const promotedKeys = [];

      for (const oppCode of getActiveCodes()) {
        const key = `${learnerCode}_${oppCode}`;
        const candidate = store.candidate.matchups[key];
        if (!candidate) continue;

        const evaluation = candidate.evaluation;
        if (
          evaluation &&
          evaluation.learnerPolicy === "rider" &&
          !evaluation.cancelled &&
          evaluation.games === evaluation.requested &&
          evaluation.games >= 2
        ) {
          assertEvaluation(candidate, evaluation);
          const saved = clone(candidate);
          store.active.matchups[key] = saved;
          store.active.legacy = saved;
          promotedKeys.push(key);
        }
      }

      if (promotedKeys.length === 0) {
        throw new Error(
          `No evaluated RIDER-policy candidates ready to activate for Rider ${learnerCode}.`
        );
      }

      saveToLocalStorage();
      return { promotedKeys };
    }

    const checkpoint = learner && opponent
      ? getSection(learner, opponent, "candidate")
      : store.candidate.legacy;

    if (!checkpoint) {
      throw new Error("No candidate exists.");
    }

    const validation = validateCheckpoint(checkpoint);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    assertEvaluation(checkpoint, checkpoint.evaluation);

    if (checkpoint.evaluation.learnerPolicy !== "rider") {
      throw new Error(
        "Evaluate this candidate with the RIDER learner policy " +
        "before activation."
      );
    }

    const saved = clone(checkpoint);

    store.active.matchups[validation.canonicalKey] = saved;
    store.active.legacy = saved;

    saveToLocalStorage();
    return saved;
  }

  function getMatchupBreakdown(target = "candidate") {
    if (!store[target]) {
      throw new Error("Unknown checkpoint target: " + target);
    }

    const codes = getActiveCodes();
    const matrix = {};

    for (const learner of codes) {
      matrix[learner] = {};

      for (const opponent of codes) {
        const checkpoint =
          store[target].matchups[`${learner}_${opponent}`];

        matrix[learner][opponent] = {
          hasModel: Boolean(checkpoint),
          games: checkpoint?.games || 0,
          steps: checkpoint?.steps || 0,
          evaluated: Boolean(
            checkpoint?.evaluation &&
            checkpoint.evaluation.learnerPolicy === "rider" &&
            !checkpoint.evaluation.cancelled &&
            checkpoint.evaluation.games === checkpoint.evaluation.requested
          )
        };
      }
    }

    return matrix;
  }

  function downloadRiderBundle(
    learner,
    target = "candidate"
  ) {
    const bundle = buildRiderBundle(learner, target, true);
    const fileName = `${bundle.learnerCode}.json`;

    const blob = new Blob(
      [JSON.stringify(bundle, null, 2)],
      { type: "application/json" }
    );

    if (typeof document !== "undefined") {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = fileName;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return {
      fileName,
      key: bundle.learnerCode,
      populatedMatchups: bundle.riderParameterSummary.populatedMatchups,
      activeRosterCount: bundle.activeRosterCount,
      backupSlotCount: bundle.backupSlotCount,
      sizeMB: (blob.size / 1048576).toFixed(2),
      games: bundle.riderParameterSummary.totalGames
    };
  }

  function downloadMatchupFile(
    learner,
    opponent,
    target = "candidate"
  ) {
    if (learner && opponent && opponent !== "*") {
      const cp =
        getSection(learner, opponent, target) ||
        getSection(learner, opponent, "active");
      if (!cp) {
        throw new Error(`No trained matrix found for ${getMatrixFileName(learner, opponent)}.`);
      }
      const fileName = getMatrixFileName(learner, opponent);
      const blob = new Blob(
        [JSON.stringify(cp, null, 2)],
        { type: "application/json" }
      );
      if (typeof document !== "undefined") {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return {
        fileName,
        key: cp.canonicalKey,
        sizeMB: (blob.size / 1048576).toFixed(2),
        games: cp.games || 0
      };
    }

    return downloadRiderBundle(learner, target);
  }

  function seedFromSearchEngine() {
    throw new Error(
      "Synchronous search-to-network conversion is not supported. " +
      "Use GUIDED WARM-START in the trainer."
    );
  }

  function status() {
    return {
      version: VERSION,
      patch: PATCH,
      schema: EXPECTED_SCHEMA,
      masterVersion: MASTER_VERSION,
      bundleVersion: BUNDLE_VERSION,
      workerVersion: WORKER_VERSION,
      storageKey: STORAGE_KEY,

      activeRosterCount: getActiveCodes().length,
      backupSlotCount: BACKUP_SLOT_COUNT,
      reservedParamSlotCount: RESERVED_PARAM_SLOTS,
      foresightConfig: getForesightConfig(),

      candidate: store.candidate.legacy,
      active: store.active.legacy,

      candidateMatchupsCount:
        Object.keys(store.candidate.matchups).length,

      activeMatchupsCount:
        Object.keys(store.active.matchups).length,

      storageWarning,
      warnings: [...new Set(warnings)]
    };
  }

  g.SoulAgent = {
    VERSION,
    MASTER_VERSION,
    BUNDLE_VERSION,
    WORKER_VERSION,
    PATCH,
    ACTIVE_ROSTER_COUNT,
    BACKUP_SLOT_COUNT,
    RESERVED_PARAM_SLOTS,

    ready,
    flushStorage,
    toCode,
    fromCode,
    toRiderIndex,
    getMatrixFileName,
    formatCodeNumber,
    getActiveCodes,
    getBackupCodes,
    getAllSlotCodes,
    syncRosterCodes,
    getCanonicalKey,
    configureForesight,
    getForesightConfig,
    createDefaultMatchParameters,
    fingerprint,
    validateCheckpoint,
    validateRiderBundle,
    buildRiderBundle,
    isRiderBundle,

    getSection,
    getLearnerSections,
    snapshot,
    setCandidate,
    setActive,
    ingestDriveMatchup,
    importCandidate,
    recordEvaluation,
    promote,

    getMatchupBreakdown,
    downloadRiderBundle,
    downloadMatchupFile,
    fetchRiderBundleFromCDN,
    fetchMatchupFromCDN,
    scanAllMatchupsFromRepo,
    seedFromSearchEngine,
    status
  };
})(globalThis);
