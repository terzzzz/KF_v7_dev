/* js/soul_agent.js
 * Exact-matchup checkpoint & Per-Rider Master Matrix Bundle storage (v7).
 *
 * Build: v5-state256-action17
 * Matrix: v7-7riders-10backup
 * Patch: charge1-reset1
 */

// Lift 5MB localStorage barrier into Unlimited Temp RAM
if (typeof window !== "undefined" && !Storage.prototype.__kfRam) {
  const RAM = (window.__KF_TEMP_RAM__ = window.__KF_TEMP_RAM__ || {});
  const _get = Storage.prototype.getItem, _set = Storage.prototype.setItem;
  Storage.prototype.getItem = function (k) {
    return String(k).startsWith("kf_soul_agent_data_") && k in RAM ? RAM[k] : _get.call(this, k);
  };
  Storage.prototype.setItem = function (k, v) {
    if (String(k).startsWith("kf_soul_agent_data_")) {
      RAM[k] = String(v);
      try { _set.call(this, k, v); } catch (e) {} // Ignore 5MB QuotaExceededError, keep in RAM
      return;
    }
    return _set.call(this, k, v);
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
  let storageWarning = "";

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
    return getAllSlotCodes().filter(code => !activeSet.has(code)).slice(0, BACKUP_SLOT_COUNT);
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
    const value = String(id || "").trim().toLowerCase();

    if (Object.prototype.hasOwnProperty.call(RIDER_CODES, value)) {
      return RIDER_CODES[value];
    }

    if (/^\d{3}$/.test(value)) {
      const idx = Number(value);
      if (idx >= 1 && idx <= TOTAL_MATRIX_SLOTS) {
        return value;
      }
    }

    throw new Error("Unknown rider ID/code: " + id);
  }

  function fromCode(code) {
    const normalized = String(code || "").trim();
    return REVERSE_CODES[normalized] || normalized;
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
    // Slot 0 stores active foresight lookahead horizon n by default
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

  function saveToLocalStorage() {
    try {
      const storage = g.localStorage;

      if (!storage) {
        storageWarning =
          "LocalStorage unavailable. Export Rider bundles to save.";
        return;
      }

      storage.setItem(STORAGE_KEY, JSON.stringify({
        version: MASTER_VERSION,
        patch: PATCH,
        schema: EXPECTED_SCHEMA,
        candidate: { matchups: store.candidate.matchups },
        active: { matchups: store.active.matchups }
      }));

      storageWarning = "";
    } catch (_) {
      storageWarning =
        "Persistent save failed. Models remain in RAM; " +
        "export Rider matrix bundles before closing.";
    }
  }

  function loadFromLocalStorage() {
    if (storageLoaded) return;
    storageLoaded = true;

    try {
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

      if (payload.version !== MASTER_VERSION) {
        return;
      }

      for (const target of ["candidate", "active"]) {
        for (const [key, checkpoint] of Object.entries(
          payload[target]?.matchups || {}
        )) {
          if (!checkpoint || store[target].matchups[key]) continue;

          const validation = validateCheckpoint(checkpoint);

          if (validation.valid && validation.canonicalKey === key) {
            checkpoint.matchParameters = createDefaultMatchParameters(
              checkpoint.matchParameters
            );
            store[target].matchups[key] = checkpoint;
            store[target].legacy = checkpoint;
          }
        }
      }
    } catch (error) {
      warnings.push(
        "Could not read stored checkpoints: " +
        (error?.message || String(error))
      );
    }
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

      if (overwriteActive || !store.active.matchups[key]) {
        store.active.matchups[key] = saved;
        store.active.legacy = saved;
      }

      if (!store.candidate.matchups[key]) {
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

  async function fetchRiderBundleFromCDN(learner) {
    assertRuntime();

    const code = toCode(learner);
    const response = await fetch(riderBundleURL(code), {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Cannot fetch data/matrix/${code}.json: HTTP ${response.status}.`
      );
    }

    const payload = await response.json();

    if (isRiderBundle(payload)) {
      const result = ingestRiderBundleIntoStore(payload, true);
      saveToLocalStorage();
      return result;
    }

    throw new Error(
      `data/matrix/${code}.json is not a v7 Rider Matrix Bundle.`
    );
  }

  async function fetchMatchupFromCDN(learner, opponent) {
    return fetchRiderBundleFromCDN(learner, opponent);
  }

  async function scanAllMatchupsFromRepo() {
    assertRuntime();

    let found = 0;
    const activeCodes = getActiveCodes();

    const jobs = activeCodes.map(async code => {
      try {
        const response = await fetch(riderBundleURL(code), {
          cache: "no-store"
        });

        if (!response.ok) return;

        const payload = await response.json();
        if (!isRiderBundle(payload)) return;

        const result = ingestRiderBundleIntoStore(payload, false);
        found += result.loadedCount;
      } catch (_) {
        // Missing/offline bundle files do not block fresh training.
      }
    });

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

        loadFromLocalStorage();
        await scanAllMatchupsFromRepo();

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
    toCode,
    fromCode,
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
