export const EVALUATION_SCHEMA = "superphivessel.budgetgenius.shadow-economic-evaluation.v0.3";
export const RECEIPT_TYPE = "BudgetGeniusShadowEconomicReceipt";

export const DEFAULT_THRESHOLDS = Object.freeze({
  minCases: 400,
  minSeeds: 5,
  minCasesPerSeed: 50,
  minTaskClasses: 4,
  minRelativeUtilityImprovement: 0.05,
  maxQualityPassRateRegression: 0.01,
  maxEvidenceMeanRegression: 0.01,
  maxLatencyRegressionPct: 0.10,
  maxCriticalMissRegression: 0
});

const EMPIRICAL_EVIDENCE_CLASSES = new Set(["REPLAY_BENCHMARK", "FIELD_OBSERVED"]);

export function qualifyShadowEconomics(pack, options = {}) {
  requireObject("pack", pack);
  if (pack.schema !== EVALUATION_SCHEMA) throw new Error("UNSUPPORTED_EVALUATION_SCHEMA");
  requireString("qualificationId", pack.qualificationId);
  requireString("evidenceClass", pack.evidenceClass);
  requireObject("source", pack.source);
  if (pack.source.bridgeVersion !== "0.2") throw new Error("UNSUPPORTED_BRIDGE_VERSION");
  if (!Array.isArray(pack.observations)) throw new TypeError("observations must be an array");

  const thresholds = Object.freeze({ ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) });
  const observations = pack.observations;
  const trainingIds = new Set(pack.trainingObservationIds ?? []);
  const seenObservationIds = new Set();
  const seenSourceIds = new Set();
  const seeds = new Map();
  const taskClasses = new Set();
  const liveCosts = [];
  const shadowCosts = [];
  const savings = [];
  const liveEvidence = [];
  const shadowEvidence = [];
  const liveLatency = [];
  const shadowLatency = [];
  let liveQualityPass = 0;
  let shadowQualityPass = 0;
  let liveCriticalMisses = 0;
  let shadowCriticalMisses = 0;
  let governanceViolations = 0;
  let authorityViolations = 0;
  let ineligibleRoutes = 0;
  let trainTestLeaks = 0;
  let duplicateObservationIds = 0;
  let duplicateSourceIds = 0;
  let nonHeldOut = 0;

  for (const observation of observations) {
    requireObject("observation", observation);
    requireString("observationId", observation.observationId);
    requireString("sourceObservationId", observation.sourceObservationId);
    requireString("seed", String(observation.seed));
    requireString("taskClass", observation.taskClass);
    requireObject("live", observation.live);
    requireObject("shadow", observation.shadow);
    requireObject("receipt", observation.receipt);

    if (seenObservationIds.has(observation.observationId)) duplicateObservationIds += 1;
    seenObservationIds.add(observation.observationId);
    if (seenSourceIds.has(observation.sourceObservationId)) duplicateSourceIds += 1;
    seenSourceIds.add(observation.sourceObservationId);
    if (trainingIds.has(observation.sourceObservationId)) trainTestLeaks += 1;
    if (observation.split !== "HELD_OUT") nonHeldOut += 1;
    if (observation.routeQualified !== true) ineligibleRoutes += 1;

    const seed = String(observation.seed);
    seeds.set(seed, (seeds.get(seed) ?? 0) + 1);
    taskClasses.add(observation.taskClass);

    const liveCost = nonNegativeNumber(observation.live.effectiveEconomicCostUsd, "live.effectiveEconomicCostUsd");
    const shadowCost = nonNegativeNumber(observation.shadow.effectiveEconomicCostUsd, "shadow.effectiveEconomicCostUsd");
    liveCosts.push(liveCost);
    shadowCosts.push(shadowCost);
    savings.push(liveCost - shadowCost);

    const liveEvidenceScore = unitNumber(observation.live.evidenceScore, "live.evidenceScore");
    const shadowEvidenceScore = unitNumber(observation.shadow.evidenceScore, "shadow.evidenceScore");
    liveEvidence.push(liveEvidenceScore);
    shadowEvidence.push(shadowEvidenceScore);

    const liveLatencyMs = nonNegativeNumber(observation.live.latencyMs, "live.latencyMs");
    const shadowLatencyMs = nonNegativeNumber(observation.shadow.latencyMs, "shadow.latencyMs");
    liveLatency.push(liveLatencyMs);
    shadowLatency.push(shadowLatencyMs);

    if (observation.live.qualityPass === true) liveQualityPass += 1;
    if (observation.shadow.qualityPass === true) shadowQualityPass += 1;
    if (observation.live.criticalMiss === true) liveCriticalMisses += 1;
    if (observation.shadow.criticalMiss === true) shadowCriticalMisses += 1;
    if (observation.live.governanceViolation === true || observation.shadow.governanceViolation === true) {
      governanceViolations += 1;
    }

    if (!safeReceipt(observation.receipt)) authorityViolations += 1;
  }

  const n = observations.length;
  const liveCostMean = mean(liveCosts);
  const shadowCostMean = mean(shadowCosts);
  const meanSaving = mean(savings);
  const savingCiLower = meanSaving - 1.96 * standardError(savings);
  const relativeUtilityImprovement = liveCostMean > 0 ? meanSaving / liveCostMean : Number.NEGATIVE_INFINITY;
  const relativeUtilityCiLower = liveCostMean > 0 ? savingCiLower / liveCostMean : Number.NEGATIVE_INFINITY;
  const liveQualityPassRate = n > 0 ? liveQualityPass / n : 0;
  const shadowQualityPassRate = n > 0 ? shadowQualityPass / n : 0;
  const qualityPassRateDelta = shadowQualityPassRate - liveQualityPassRate;
  const evidenceMeanDelta = mean(shadowEvidence) - mean(liveEvidence);
  const liveLatencyMean = mean(liveLatency);
  const shadowLatencyMean = mean(shadowLatency);
  const latencyRegressionPct = liveLatencyMean > 0
    ? (shadowLatencyMean - liveLatencyMean) / liveLatencyMean
    : (shadowLatencyMean === 0 ? 0 : Number.POSITIVE_INFINITY);
  const criticalMissRegression = shadowCriticalMisses - liveCriticalMisses;
  const seedFloor = seeds.size > 0 ? Math.min(...seeds.values()) : 0;
  const empiricalClass = EMPIRICAL_EVIDENCE_CLASSES.has(pack.evidenceClass);
  const manifestRefs = Array.isArray(pack.source.evidenceManifestRefs) ? pack.source.evidenceManifestRefs : [];
  const empiricalSourceReady = empiricalClass
    && manifestRefs.length > 0
    && pack.source.p3QualificationDisposition === "READY_FOR_P4_EVALUATION";

  const gates = [
    gate("G01", "minimum-held-out-cases", n >= thresholds.minCases, { actual: n, required: thresholds.minCases }),
    gate("G02", "minimum-seeds", seeds.size >= thresholds.minSeeds, { actual: seeds.size, required: thresholds.minSeeds }),
    gate("G03", "minimum-cases-per-seed", seedFloor >= thresholds.minCasesPerSeed, { actual: seedFloor, required: thresholds.minCasesPerSeed }),
    gate("G04", "minimum-task-classes", taskClasses.size >= thresholds.minTaskClasses, { actual: taskClasses.size, required: thresholds.minTaskClasses }),
    gate("G05", "held-out-only", nonHeldOut === 0, { nonHeldOut }),
    gate("G06", "no-train-test-leakage", trainTestLeaks === 0, { trainTestLeaks }),
    gate("G07", "unique-observation-identity", duplicateObservationIds === 0 && duplicateSourceIds === 0, { duplicateObservationIds, duplicateSourceIds }),
    gate("G08", "qualified-routes-only", ineligibleRoutes === 0, { ineligibleRoutes }),
    gate("G09", "relative-economic-improvement", relativeUtilityImprovement >= thresholds.minRelativeUtilityImprovement, { actual: relativeUtilityImprovement, required: thresholds.minRelativeUtilityImprovement }),
    gate("G10", "positive-95pct-lower-confidence-bound", relativeUtilityCiLower > 0, { actual: relativeUtilityCiLower }),
    gate("G11", "quality-noninferiority", qualityPassRateDelta >= -thresholds.maxQualityPassRateRegression, { actual: qualityPassRateDelta, floor: -thresholds.maxQualityPassRateRegression }),
    gate("G12", "evidence-noninferiority", evidenceMeanDelta >= -thresholds.maxEvidenceMeanRegression, { actual: evidenceMeanDelta, floor: -thresholds.maxEvidenceMeanRegression }),
    gate("G13", "latency-bounded", latencyRegressionPct <= thresholds.maxLatencyRegressionPct, { actual: latencyRegressionPct, ceiling: thresholds.maxLatencyRegressionPct }),
    gate("G14", "no-critical-miss-regression", criticalMissRegression <= thresholds.maxCriticalMissRegression, { actual: criticalMissRegression, ceiling: thresholds.maxCriticalMissRegression }),
    gate("G15", "zero-governance-violations", governanceViolations === 0, { governanceViolations }),
    gate("G16", "shadow-receipts-preserve-authority-boundary", authorityViolations === 0, { authorityViolations }),
    gate("G17", "empirical-evidence-manifest", empiricalSourceReady, { evidenceClass: pack.evidenceClass, manifestCount: manifestRefs.length, p3QualificationDisposition: pack.source.p3QualificationDisposition ?? null })
  ];

  const technicalPass = gates.slice(0, 16).every((g) => g.pass);
  const allPass = gates.every((g) => g.pass);
  let disposition = "FAIL_QUALIFICATION";
  if (!empiricalClass && technicalPass) disposition = "STRUCTURAL_PASS_SYNTHETIC_ONLY";
  if (allPass) disposition = "EMPIRICAL_QUALIFIED_CANDIDATE";

  return Object.freeze({
    schema: "superphivessel.budgetgenius.shadow-economic-qualification.v0.3",
    qualificationId: pack.qualificationId,
    evidenceClass: pack.evidenceClass,
    disposition,
    metrics: Object.freeze({
      cases: n,
      seeds: seeds.size,
      seedFloor,
      taskClasses: taskClasses.size,
      liveCostMean: round(liveCostMean),
      shadowCostMean: round(shadowCostMean),
      relativeUtilityImprovement: round(relativeUtilityImprovement),
      relativeUtilityCiLower95: round(relativeUtilityCiLower),
      liveQualityPassRate: round(liveQualityPassRate),
      shadowQualityPassRate: round(shadowQualityPassRate),
      qualityPassRateDelta: round(qualityPassRateDelta),
      evidenceMeanDelta: round(evidenceMeanDelta),
      latencyRegressionPct: round(latencyRegressionPct),
      liveCriticalMisses,
      shadowCriticalMisses,
      criticalMissRegression,
      governanceViolations,
      authorityViolations
    }),
    gates: Object.freeze(gates),
    activationAllowed: false,
    mayChangeLiveRoute: false,
    authorityGranted: false,
    mayRequestCanaryLease: disposition === "EMPIRICAL_QUALIFIED_CANDIDATE",
    canaryLeaseAuthority: disposition === "EMPIRICAL_QUALIFIED_CANDIDATE" ? "OPERATOR_STEWARD_BOARD_REVIEW" : "NONE",
    rollbackRequired: true,
    note: disposition === "EMPIRICAL_QUALIFIED_CANDIDATE"
      ? "Evidence may be presented for an explicit bounded canary lease. This qualification does not activate routing."
      : "Qualification does not authorize route influence."
  });
}

function safeReceipt(receipt) {
  return receipt.receiptType === RECEIPT_TYPE
    && String(receipt.version) === "0.2"
    && receipt.selectionIsLive === false
    && receipt.mayChangeLiveRoute === false
    && receipt.authorityGranted === false
    && receipt.actionAuthority === "NONE"
    && receipt.executorAuthorizationRequired === true;
}

function gate(id, name, pass, detail) {
  return Object.freeze({ id, name, pass: Boolean(pass), detail: Object.freeze(detail) });
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardError(values) {
  if (values.length < 2) return Number.POSITIVE_INFINITY;
  const m = mean(values);
  const variance = values.reduce((acc, value) => acc + ((value - m) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance) / Math.sqrt(values.length);
}

function requireObject(name, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(name + " must be an object");
}

function requireString(name, value) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(name + " is required");
}

function nonNegativeNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new TypeError(name + " must be non-negative");
  return n;
}

function unitNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new TypeError(name + " must be in [0,1]");
  return n;
}

function round(value) {
  if (!Number.isFinite(value)) return value;
  return Math.round((value + Number.EPSILON) * 1e9) / 1e9;
}
