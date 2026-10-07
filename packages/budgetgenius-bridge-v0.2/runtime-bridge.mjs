export function mapRunCapsuleToEconomicPolicy(runCapsule) {
  requireObject("runCapsule", runCapsule);
  if (runCapsule.receiptType !== "PhiRunCapsule") throw new Error("NOT_PHI_RUN_CAPSULE");

  const budgetCeilingUsd = nonNegativeNumber(runCapsule.budgetCeilingUsd ?? 0, "budgetCeilingUsd");
  const paidFallbackMode = String(runCapsule.paidFallbackMode ?? "NEVER").toUpperCase();
  if (!["NEVER", "CONFIRM", "AUTO"].includes(paidFallbackMode)) throw new Error("INVALID_PAID_FALLBACK_MODE");

  return Object.freeze({
    runCapsuleId: runCapsule.id ?? null,
    runCapsuleHash: runCapsule.hash ?? null,
    executionPolicy: String(runCapsule.executionPolicy ?? "MANUAL").toUpperCase(),
    paidFallbackMode,
    budgetCeilingUsd,
    activeProvider: runCapsule.activeProvider ?? null,
    approvedModels: Object.freeze([...(runCapsule.approvedModels ?? [])]),
    mayDispatch: false,
    executorAuthorizationRequired: true,
    authority: "NONE",
    source: "PHI_RUN_CAPSULE"
  });
}

export function mapCreditSnapshotToEnvelope(creditSnapshot) {
  requireObject("creditSnapshot", creditSnapshot);
  const reservedUsd = nonNegativeNumber(creditSnapshot.reservedUsd ?? 0, "reservedUsd");
  const ceilingUsd = nonNegativeNumber(creditSnapshot.ceilingUsd ?? 0, "ceilingUsd");
  const hardCeilingEnabled = ceilingUsd > 0;

  return Object.freeze({
    creditRunId: creditSnapshot.id ?? null,
    executionPolicy: creditSnapshot.policy ?? null,
    hardCeilingEnabled,
    ceilingUsd: hardCeilingEnabled ? ceilingUsd : null,
    reservedUsd,
    availableUsd: hardCeilingEnabled ? round(Math.max(0, ceilingUsd - reservedUsd)) : null,
    status: hardCeilingEnabled ? "HARD_CEILING_ACTIVE" : "NO_HARD_CEILING",
    reservationAuthority: "SUPERPHIVESSEL_CREDIT_GOVERNOR",
    budgetGeniusReservationAuthority: "NONE"
  });
}

export function buildConservativePriceTableInput({
  version,
  effectiveAt,
  providerRates,
  candidateModels
}) {
  requireString("version", version);
  requireString("effectiveAt", effectiveAt);
  requireObject("providerRates", providerRates);
  if (!Array.isArray(candidateModels) || candidateModels.length === 0) {
    throw new TypeError("candidateModels are required");
  }

  const seen = new Set();
  const entries = [];
  for (const candidate of candidateModels) {
    requireString("candidate.providerId", candidate.providerId);
    requireString("candidate.modelId", candidate.modelId);
    const providerId = normalizeProvider(candidate.providerId);
    if (providerId === "ollama" && candidate.local === true) continue;

    const rate = providerRates[providerId];
    if (!rate) throw new Error(`MISSING_SPV_CREDIT_RATE:${providerId}`);
    const input = nonNegativeNumber(rate.input, `${providerId}.input`);
    const output = nonNegativeNumber(rate.output, `${providerId}.output`);
    const key = `${providerId}::${candidate.modelId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push(Object.freeze({
      providerId,
      modelId: candidate.modelId,
      inputUsdPer1M: input,
      cachedInputUsdPer1M: input,
      outputUsdPer1M: output,
      batchMultiplier: 1
    }));
  }

  if (entries.length === 0) throw new Error("NO_REMOTE_PRICE_ENTRIES");

  return Object.freeze({
    version,
    effectiveAt,
    source: Object.freeze({
      kind: "SUPERPHIVESSEL_OPERATOR_CONFIGURED_PROVIDER_RATES",
      cacheDiscountProven: false
    }),
    entries: Object.freeze(entries)
  });
}

export function mapGpuRuntimeStateToResidencyEntries(gpuState, {
  hybridThresholdPct = 80
} = {}) {
  requireObject("gpuState", gpuState);
  const models = gpuState.models && typeof gpuState.models === "object" ? gpuState.models : {};
  const out = [];

  for (const [modelId, row] of Object.entries(models)) {
    if (!row || row.loaded !== true) continue;
    const pct = row.gpuResidentPct == null ? null : nonNegativeNumber(row.gpuResidentPct, "gpuResidentPct");
    out.push(Object.freeze({
      modelId,
      resident: true,
      gpuFit: pct != null ? pct >= hybridThresholdPct : false,
      measuredGpuResidentPct: pct,
      vramGb: row.vramBytes == null ? 0 : round(Number(row.vramBytes) / (1024 ** 3)),
      loadMs: 0,
      evictionMs: 0,
      source: "PV-GPU-0.1_MEASURED_RUNTIME",
      measured: pct != null
    }));
  }

  return Object.freeze(out);
}

export function mapComputeBrokerDecisionToShadowRoute({
  decision,
  empiricalStats,
  evidenceScore,
  riskScore,
  inputTokens = null,
  outputTokens = 0,
  latencyMs = null,
  requiredAuthority = []
}) {
  requireObject("decision", decision);
  if (String(decision.version) !== "1.0") throw new Error("UNSUPPORTED_BUDGET_COMPUTE_VERSION");
  requireString("decision.route", decision.route);

  const local = decision.local === true;
  const providerId = normalizeProvider(decision.provider ?? decision.activeProvider);
  const modelId = local ? decision.model : (decision.model ?? decision.remoteModel ?? "provider-default");
  requireString("providerId", providerId);
  requireString("modelId", modelId);

  const successProbability = empiricalStats?.wilsonLowerBound;
  if (successProbability != null && (!Number.isFinite(successProbability) || successProbability < 0 || successProbability > 1)) {
    throw new TypeError("empiricalStats.wilsonLowerBound must be in [0,1]");
  }

  const inTok = inputTokens == null
    ? Number(decision.task?.totalEstimatedInputTokens ?? 0)
    : Number(inputTokens);

  return Object.freeze({
    routeId: `spv:${decision.id ?? "broker"}:${decision.route}:${providerId}:${modelId}`,
    execution: local ? "LOCAL" : "REMOTE",
    providerId,
    modelId,
    inputTokens: nonNegativeNumber(inTok, "inputTokens"),
    outputTokens: nonNegativeNumber(outputTokens, "outputTokens"),
    successProbability,
    evidenceScore: nonNegativeUnit(evidenceScore, "evidenceScore"),
    riskScore: nonNegativeUnit(riskScore, "riskScore"),
    requiredAuthority: Object.freeze([...requiredAuthority]),
    latencyMs: latencyMs == null ? undefined : nonNegativeNumber(latencyMs, "latencyMs"),
    brokerRoute: decision.route,
    brokerMode: decision.mode ?? null,
    brokerPaidMode: decision.paidMode ?? null,
    brokerRequiresPaidApproval: decision.requiresPaidApproval === true,
    metadata: Object.freeze({
      budgetComputeVersion: decision.version,
      difficultyHint: decision.task?.difficultyHint ?? null,
      adjustedDifficultyHint: decision.adjustedDifficultyHint ?? null,
      difficultyIsQualityScore: false,
      difficultyIsTruthScore: false,
      empiricalQualitySource: successProbability == null ? null : "VERIFIED_CALIBRATION",
      executionLocusGuardVersion: decision.executionLocusGuardVersion ?? null,
      originalReason: decision.reason ?? null
    })
  });
}

export function mapP4ShadowPlanToAdvisorySignal(shadowPlan) {
  requireObject("shadowPlan", shadowPlan);
  if (shadowPlan.schema !== "superphivessel.dlam.p4a.shadow-plan.v0.1") {
    throw new Error("UNSUPPORTED_P4_SHADOW_PLAN");
  }
  if (shadowPlan.selection_is_live !== false) throw new Error("P4_SELECTION_BECAME_LIVE");
  if (shadowPlan.may_activate_genius !== false) throw new Error("P4_GENIUS_ACTIVATION_NOT_ALLOWED");
  if (shadowPlan.authority_granted !== false) throw new Error("P4_AUTHORITY_PROMOTION");

  return Object.freeze({
    disposition: shadowPlan.disposition,
    snapshotId: shadowPlan.snapshot_id,
    taskClass: shadowPlan.task_class,
    shadowSelectedRoute: shadowPlan.shadow_selected_route ?? null,
    routeCandidates: Object.freeze(structuredClone(shadowPlan.route_candidates ?? [])),
    advisoryOnly: true,
    selectionIsLive: false,
    mayChangeLiveRoute: false,
    authorityGranted: false
  });
}

export function createShadowEconomicReceipt({
  receiptId,
  brokerDecision,
  budgetGeniusSelection,
  quotes = [],
  p4Signal = null
}) {
  requireString("receiptId", receiptId);
  requireObject("brokerDecision", brokerDecision);

  return Object.freeze({
    receiptType: "BudgetGeniusShadowEconomicReceipt",
    version: "0.2",
    receiptId,
    liveBrokerRoute: Object.freeze({
      route: brokerDecision.route,
      provider: brokerDecision.provider ?? null,
      model: brokerDecision.model ?? null,
      local: brokerDecision.local === true
    }),
    budgetGeniusShadowRouteId: budgetGeniusSelection?.selected?.route?.routeId ?? null,
    p4ShadowRoute: p4Signal?.shadowSelectedRoute ?? null,
    quotes: Object.freeze(quotes.map((quote) => Object.freeze(structuredClone(quote)))),
    selectionIsLive: false,
    mayChangeLiveRoute: false,
    authorityGranted: false,
    actionAuthority: "NONE",
    executorAuthorizationRequired: true,
    note: "Economic comparison only. Super Phi.Vessel live route and Executor Authorization remain unchanged."
  });
}

function normalizeProvider(value) {
  const p = String(value ?? "").toLowerCase();
  if (p === "ollama_cloud" || p === "ollama-cloud") return "ollama_cloud";
  if (p === "claude") return "anthropic";
  return p;
}

function requireObject(name, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function requireString(name, value) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} is required`);
}

function nonNegativeNumber(value, name) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) throw new TypeError(`${name} must be non-negative`);
  return Number(value);
}

function nonNegativeUnit(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new TypeError(`${name} must be in [0,1]`);
  return n;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 1e9) / 1e9;
}
