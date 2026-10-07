import { createHash } from "node:crypto";

export const CANARY_LEASE_SCHEMA = "superphivessel.budgetgenius.canary-lease.v0.4";
export const CANARY_STATE_SCHEMA = "superphivessel.budgetgenius.canary-state.v0.4";
export const CANARY_INFLUENCE_RECEIPT = "BudgetGeniusCanaryInfluenceReceipt";
export const CANARY_OUTCOME_RECEIPT = "BudgetGeniusCanaryOutcomeReceipt";

const REQUIRED_APPROVAL_ROLES = Object.freeze(["OPERATOR", "STEWARD", "BOARD"]);
const HARD_LIMITS = Object.freeze({
  maxDurationMs: 30 * 60 * 1000,
  maxDecisions: 10,
  maxCumulativeShadowSpendUsd: 1.0,
  maxPerDecisionSpendUsd: 0.10,
  maxTaskClasses: 4,
  maxRouteIds: 8
});

export function createCanaryLease({
  qualification,
  leaseId,
  issuedAt,
  expiresAt,
  approvals,
  mandateRef,
  budgetPassRef,
  scope
}) {
  requireObject("qualification", qualification);
  requireString("leaseId", leaseId);
  requireString("issuedAt", issuedAt);
  requireString("expiresAt", expiresAt);
  requireString("mandateRef", mandateRef);
  requireString("budgetPassRef", budgetPassRef);
  requireObject("scope", scope);

  if (qualification.disposition !== "EMPIRICAL_QUALIFIED_CANDIDATE") {
    throw new Error("QUALIFICATION_NOT_EMPIRICAL_CANDIDATE");
  }
  if (qualification.mayRequestCanaryLease !== true) {
    throw new Error("QUALIFICATION_CANNOT_REQUEST_CANARY");
  }
  if (qualification.activationAllowed !== false || qualification.mayChangeLiveRoute !== false || qualification.authorityGranted !== false) {
    throw new Error("QUALIFICATION_AUTHORITY_BOUNDARY_VIOLATED");
  }

  const approvalSet = validateApprovals(approvals);
  const issuedMs = parseTime(issuedAt, "issuedAt");
  const expiresMs = parseTime(expiresAt, "expiresAt");
  if (expiresMs <= issuedMs) throw new Error("LEASE_EXPIRY_NOT_AFTER_ISSUE");
  if ((expiresMs - issuedMs) > HARD_LIMITS.maxDurationMs) throw new Error("LEASE_DURATION_EXCEEDS_HARD_LIMIT");

  const normalizedScope = normalizeScope(scope);

  const definition = Object.freeze({
    schema: CANARY_LEASE_SCHEMA,
    leaseId,
    qualificationId: qualification.qualificationId,
    qualificationDisposition: qualification.disposition,
    issuedAt,
    expiresAt,
    approvals: approvalSet,
    mandateRef,
    budgetPassRef,
    scope: normalizedScope,
    authority: Object.freeze({
      routeInfluenceOnly: true,
      mayDispatch: false,
      mayGrantPaidApproval: false,
      mayMintAuthority: false,
      mayBypassExecutorAuthorization: false,
      executorAuthorizationRequired: true,
      reservationAuthority: "SUPERPHIVESSEL_CREDIT_GOVERNOR"
    }),
    rollback: Object.freeze({
      baseline: "LIVE_BROKER_ROUTE",
      automatic: true,
      requiredOnCriticalMiss: true,
      requiredOnGovernanceViolation: true,
      requiredOnQualityFailure: true
    }),
    renewal: Object.freeze({
      selfRenewalAllowed: false,
      selfExtensionAllowed: false,
      scopeBroadeningAllowed: false
    })
  });

  return Object.freeze({
    ...definition,
    leaseHash: hashLease(definition)
  });
}

export function createCanaryState(lease) {
  assertLeaseIntegrity(lease);
  return Object.freeze({
    schema: CANARY_STATE_SCHEMA,
    leaseId: lease.leaseId,
    leaseHash: lease.leaseHash,
    status: "ACTIVE",
    decisionsUsed: 0,
    cumulativeShadowSpendUsd: 0,
    rollbackReason: null,
    revokedBy: null
  });
}

export function evaluateCanaryProposal({
  lease,
  state,
  now,
  taskClass,
  baselineRouteId,
  proposedRouteId,
  shadowSpendUsd,
  budgetPassReceipt
}) {
  assertLeaseAndState(lease, state);
  requireString("now", now);
  requireString("taskClass", taskClass);
  requireString("baselineRouteId", baselineRouteId);
  requireString("proposedRouteId", proposedRouteId);
  requireObject("budgetPassReceipt", budgetPassReceipt);

  const reasons = [];
  const nowMs = parseTime(now, "now");
  const expiresMs = parseTime(lease.expiresAt, "expiresAt");
  const spend = nonNegativeNumber(shadowSpendUsd, "shadowSpendUsd");

  if (state.status !== "ACTIVE") reasons.push("LEASE_NOT_ACTIVE");
  if (nowMs >= expiresMs) reasons.push("LEASE_EXPIRED");
  if (!lease.scope.taskClasses.includes(taskClass)) reasons.push("TASK_CLASS_OUT_OF_SCOPE");
  if (!lease.scope.routeIds.includes(proposedRouteId)) reasons.push("ROUTE_OUT_OF_SCOPE");
  if (baselineRouteId === proposedRouteId) reasons.push("NO_ROUTE_CHANGE");
  if (spend > lease.scope.maxPerDecisionSpendUsd) reasons.push("PER_DECISION_SPEND_EXCEEDED");
  if ((state.cumulativeShadowSpendUsd + spend) > lease.scope.maxCumulativeShadowSpendUsd) reasons.push("CUMULATIVE_SPEND_EXCEEDED");
  if (state.decisionsUsed >= lease.scope.maxDecisions) reasons.push("DECISION_LIMIT_EXHAUSTED");

  if (budgetPassReceipt.decision !== "ALLOW") reasons.push("BUDGETPASS_DENIED");
  if (budgetPassReceipt.leaseId !== lease.leaseId) reasons.push("BUDGETPASS_LEASE_MISMATCH");
  if (budgetPassReceipt.mandateRef !== lease.mandateRef) reasons.push("BUDGETPASS_MANDATE_MISMATCH");
  if (budgetPassReceipt.authorityGranted !== false) reasons.push("BUDGETPASS_AUTHORITY_PROMOTION");
  if (budgetPassReceipt.executorAuthorizationRequired !== true) reasons.push("EXECUTOR_GATE_NOT_PRESERVED");

  const allowed = reasons.length === 0;
  return Object.freeze({
    disposition: allowed ? "CANARY_ROUTE_INFLUENCE_ALLOWED" : "CANARY_ROUTE_INFLUENCE_DENIED",
    routeInfluenceAllowed: allowed,
    baselineRouteId,
    proposedRouteId,
    shadowSpendUsd: spend,
    reasons: Object.freeze(reasons),
    mayDispatch: false,
    executionAuthorized: false,
    executorAuthorizationRequired: true,
    authorityGranted: false,
    paidApprovalGranted: false
  });
}

export function applyCanaryInfluence({
  lease,
  state,
  proposal,
  influenceId
}) {
  assertLeaseAndState(lease, state);
  requireObject("proposal", proposal);
  requireString("influenceId", influenceId);
  if (proposal.routeInfluenceAllowed !== true || proposal.disposition !== "CANARY_ROUTE_INFLUENCE_ALLOWED") {
    throw new Error("CANARY_PROPOSAL_NOT_ALLOWED");
  }
  if (state.status !== "ACTIVE") throw new Error("LEASE_NOT_ACTIVE");

  const nextState = Object.freeze({
    ...state,
    decisionsUsed: state.decisionsUsed + 1,
    cumulativeShadowSpendUsd: round(state.cumulativeShadowSpendUsd + proposal.shadowSpendUsd)
  });

  const receipt = Object.freeze({
    receiptType: CANARY_INFLUENCE_RECEIPT,
    version: "0.4",
    influenceId,
    leaseId: lease.leaseId,
    leaseHash: lease.leaseHash,
    mandateRef: lease.mandateRef,
    budgetPassRef: lease.budgetPassRef,
    baselineRouteId: proposal.baselineRouteId,
    canaryRouteId: proposal.proposedRouteId,
    routeChanged: true,
    routeInfluenceAuthorizedByLease: true,
    executionAuthorized: false,
    mayDispatch: false,
    executorAuthorizationRequired: true,
    authorityGranted: false,
    paidApprovalGranted: false
  });

  return Object.freeze({ state: nextState, receipt });
}

export function recordCanaryOutcome({
  lease,
  state,
  influenceReceipt,
  outcome
}) {
  assertLeaseAndState(lease, state);
  requireObject("influenceReceipt", influenceReceipt);
  requireObject("outcome", outcome);
  if (influenceReceipt.receiptType !== CANARY_INFLUENCE_RECEIPT) throw new Error("INVALID_INFLUENCE_RECEIPT");
  if (influenceReceipt.leaseId !== lease.leaseId || influenceReceipt.leaseHash !== lease.leaseHash) {
    throw new Error("INFLUENCE_RECEIPT_LEASE_MISMATCH");
  }

  const evidenceScore = unitNumber(outcome.evidenceScore, "outcome.evidenceScore");
  const latencyRegressionPct = finiteNumber(outcome.latencyRegressionPct, "outcome.latencyRegressionPct");
  const criticalMiss = outcome.criticalMiss === true;
  const governanceViolation = outcome.governanceViolation === true;
  const qualityPass = outcome.qualityPass === true;

  const tripReasons = [];
  if (criticalMiss) tripReasons.push("CRITICAL_MISS");
  if (governanceViolation) tripReasons.push("GOVERNANCE_VIOLATION");
  if (!qualityPass) tripReasons.push("QUALITY_FAILURE");
  if (evidenceScore < lease.scope.minOutcomeEvidenceScore) tripReasons.push("EVIDENCE_FLOOR_BREACH");
  if (latencyRegressionPct > lease.scope.maxOutcomeLatencyRegressionPct) tripReasons.push("LATENCY_TRIPWIRE");

  const rollback = tripReasons.length > 0;
  const nextState = Object.freeze({
    ...state,
    status: rollback ? "ROLLBACK_REQUIRED" : state.status,
    rollbackReason: rollback ? tripReasons.join("|") : state.rollbackReason
  });

  const receipt = Object.freeze({
    receiptType: CANARY_OUTCOME_RECEIPT,
    version: "0.4",
    leaseId: lease.leaseId,
    influenceId: influenceReceipt.influenceId,
    criticalMiss,
    governanceViolation,
    qualityPass,
    evidenceScore,
    latencyRegressionPct,
    rollbackRequired: rollback,
    rollbackReasons: Object.freeze(tripReasons),
    authorityGranted: false
  });

  return Object.freeze({ state: nextState, receipt });
}

export function revokeCanaryLease({ lease, state, revokedBy }) {
  assertLeaseAndState(lease, state);
  requireString("revokedBy", revokedBy);
  return Object.freeze({
    ...state,
    status: "REVOKED",
    rollbackReason: "EXPLICIT_REVOCATION",
    revokedBy
  });
}

export function resolveRouteAfterLeaseState({
  lease,
  state,
  baselineRouteId,
  proposedRouteId
}) {
  assertLeaseAndState(lease, state);
  requireString("baselineRouteId", baselineRouteId);
  requireString("proposedRouteId", proposedRouteId);
  if (state.status !== "ACTIVE") {
    return Object.freeze({
      selectedRouteId: baselineRouteId,
      source: "ROLLBACK_BASELINE",
      canaryInfluenceApplied: false
    });
  }
  return Object.freeze({
    selectedRouteId: proposedRouteId,
    source: "ACTIVE_CANARY_LEASE",
    canaryInfluenceApplied: true
  });
}

export function renewCanaryLease() {
  throw new Error("SELF_RENEWAL_NOT_ALLOWED");
}

export function assertLeaseIntegrity(lease) {
  requireObject("lease", lease);
  if (lease.schema !== CANARY_LEASE_SCHEMA) throw new Error("UNSUPPORTED_CANARY_LEASE_SCHEMA");
  const { leaseHash, ...definition } = lease;
  requireString("leaseHash", leaseHash);
  if (hashLease(definition) !== leaseHash) throw new Error("CANARY_LEASE_INTEGRITY_FAILURE");
  return true;
}

function assertLeaseAndState(lease, state) {
  assertLeaseIntegrity(lease);
  requireObject("state", state);
  if (state.schema !== CANARY_STATE_SCHEMA) throw new Error("UNSUPPORTED_CANARY_STATE_SCHEMA");
  if (state.leaseId !== lease.leaseId || state.leaseHash !== lease.leaseHash) throw new Error("CANARY_STATE_LEASE_MISMATCH");
}

function normalizeScope(scope) {
  const taskClasses = uniqueStrings(scope.taskClasses, "scope.taskClasses");
  const routeIds = uniqueStrings(scope.routeIds, "scope.routeIds");
  if (taskClasses.length === 0 || taskClasses.length > HARD_LIMITS.maxTaskClasses) throw new Error("TASK_CLASS_SCOPE_TOO_BROAD");
  if (routeIds.length === 0 || routeIds.length > HARD_LIMITS.maxRouteIds) throw new Error("ROUTE_SCOPE_TOO_BROAD");

  const maxDecisions = positiveInteger(scope.maxDecisions, "scope.maxDecisions");
  if (maxDecisions > HARD_LIMITS.maxDecisions) throw new Error("DECISION_LIMIT_EXCEEDS_HARD_LIMIT");

  const maxCumulativeShadowSpendUsd = nonNegativeNumber(scope.maxCumulativeShadowSpendUsd, "scope.maxCumulativeShadowSpendUsd");
  if (maxCumulativeShadowSpendUsd > HARD_LIMITS.maxCumulativeShadowSpendUsd) throw new Error("CUMULATIVE_SPEND_EXCEEDS_HARD_LIMIT");

  const maxPerDecisionSpendUsd = nonNegativeNumber(scope.maxPerDecisionSpendUsd, "scope.maxPerDecisionSpendUsd");
  if (maxPerDecisionSpendUsd > HARD_LIMITS.maxPerDecisionSpendUsd) throw new Error("PER_DECISION_SPEND_EXCEEDS_HARD_LIMIT");
  if (maxPerDecisionSpendUsd > maxCumulativeShadowSpendUsd) throw new Error("PER_DECISION_SPEND_EXCEEDS_CUMULATIVE_CAP");

  const minOutcomeEvidenceScore = unitNumber(scope.minOutcomeEvidenceScore ?? 0.90, "scope.minOutcomeEvidenceScore");
  const maxOutcomeLatencyRegressionPct = nonNegativeNumber(scope.maxOutcomeLatencyRegressionPct ?? 0.10, "scope.maxOutcomeLatencyRegressionPct");

  return Object.freeze({
    taskClasses: Object.freeze(taskClasses),
    routeIds: Object.freeze(routeIds),
    maxDecisions,
    maxCumulativeShadowSpendUsd,
    maxPerDecisionSpendUsd,
    minOutcomeEvidenceScore,
    maxOutcomeLatencyRegressionPct
  });
}

function validateApprovals(approvals) {
  if (!Array.isArray(approvals)) throw new TypeError("approvals must be an array");
  const normalized = approvals.map((approval) => {
    requireObject("approval", approval);
    requireString("approval.role", approval.role);
    requireString("approval.approvalId", approval.approvalId);
    return Object.freeze({
      role: approval.role.toUpperCase(),
      approvalId: approval.approvalId,
      approverRef: approval.approverRef ?? null
    });
  });
  const roles = new Set(normalized.map((x) => x.role));
  for (const role of REQUIRED_APPROVAL_ROLES) {
    if (!roles.has(role)) throw new Error("MISSING_REQUIRED_APPROVAL:" + role);
  }
  if (roles.size !== normalized.length) throw new Error("DUPLICATE_APPROVAL_ROLE");
  return Object.freeze(normalized);
}

function hashLease(definition) {
  return createHash("sha256").update(canonicalJson(definition)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function uniqueStrings(value, name) {
  if (!Array.isArray(value)) throw new TypeError(name + " must be an array");
  const out = value.map((x) => {
    requireString(name + "[]", x);
    return x;
  });
  if (new Set(out).size !== out.length) throw new Error(name + " contains duplicates");
  return out;
}

function parseTime(value, name) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new TypeError(name + " must be an ISO timestamp");
  return ms;
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

function finiteNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new TypeError(name + " must be finite");
  return n;
}

function unitNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new TypeError(name + " must be in [0,1]");
  return n;
}

function positiveInteger(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new TypeError(name + " must be a positive integer");
  return n;
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e9) / 1e9;
}
