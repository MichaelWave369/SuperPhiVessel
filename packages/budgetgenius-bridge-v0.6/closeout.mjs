import { createHash } from "node:crypto";
import {
  CANARY_INFLUENCE_RECEIPT,
  assertLeaseIntegrity,
  recordCanaryOutcome
} from "../budgetgenius-bridge-v0.4/canary-lease.mjs";

export const CANARY_CLOSEOUT_SCHEMA = "superphivessel.budgetgenius.canary-closeout.v0.6";
export const CANARY_CLOSEOUT_RECEIPT = "BudgetGeniusCanaryCloseoutReceipt";
export const CANARY_QUALIFICATION_REPORT_SCHEMA = "superphivessel.budgetgenius.canary-qualification-report.v0.6";
export const CANARY_NBG_WRITEBACK_SCHEMA = "superphivessel.budgetgenius.nbg-canary-outcome.v0.6";

export function evaluateCanaryCloseout({
  lease,
  state,
  influenceReceipt,
  outcome,
  verificationResults,
  verificationPolicy = {},
  baselineEstimatedCostUsd,
  actualUsd = 0,
  attributableCostsUsd = []
}) {
  assertLeaseIntegrity(lease);
  requireObject("state", state);
  requireObject("influenceReceipt", influenceReceipt);
  requireObject("outcome", outcome);

  if (influenceReceipt.receiptType !== CANARY_INFLUENCE_RECEIPT) {
    throw new Error("INVALID_CANARY_INFLUENCE_RECEIPT");
  }
  if (influenceReceipt.leaseId !== lease.leaseId || influenceReceipt.leaseHash !== lease.leaseHash) {
    throw new Error("CANARY_CLOSEOUT_LEASE_MISMATCH");
  }
  if (influenceReceipt.executionAuthorized !== false
      || influenceReceipt.mayDispatch !== false
      || influenceReceipt.executorAuthorizationRequired !== true
      || influenceReceipt.authorityGranted !== false
      || influenceReceipt.paidApprovalGranted !== false) {
    throw new Error("CANARY_INFLUENCE_AUTHORITY_BOUNDARY_VIOLATED");
  }

  const outcomeRecord = recordCanaryOutcome({
    lease,
    state,
    influenceReceipt,
    outcome
  });

  const verification = evaluateVerification(verificationResults, verificationPolicy);
  const tripReasons = [...outcomeRecord.receipt.rollbackReasons];
  if (!verification.ok) tripReasons.push(...verification.reasons);

  const baseline = nonNegativeNumber(baselineEstimatedCostUsd, "baselineEstimatedCostUsd");
  const actual = nonNegativeNumber(actualUsd, "actualUsd");
  if (!Array.isArray(attributableCostsUsd)) throw new TypeError("attributableCostsUsd must be an array");
  const downstream = attributableCostsUsd.reduce(
    (sum, value) => sum + nonNegativeNumber(value, "attributableCostsUsd[]"),
    0
  );
  const totalCausalCostUsd = round(actual + downstream);
  const verifiedOutcome = tripReasons.length === 0;
  const verifiedSavingsUsd = verifiedOutcome
    ? round(Math.max(0, baseline - totalCausalCostUsd))
    : null;

  const definition = Object.freeze({
    schema: CANARY_CLOSEOUT_SCHEMA,
    receiptType: CANARY_CLOSEOUT_RECEIPT,
    version: "0.6",
    leaseId: lease.leaseId,
    leaseHash: lease.leaseHash,
    influenceId: influenceReceipt.influenceId,
    mandateRef: influenceReceipt.mandateRef,
    budgetPassRef: influenceReceipt.budgetPassRef,
    baselineRouteId: influenceReceipt.baselineRouteId,
    canaryRouteId: influenceReceipt.canaryRouteId,
    outcome: Object.freeze({
      criticalMiss: outcomeRecord.receipt.criticalMiss,
      governanceViolation: outcomeRecord.receipt.governanceViolation,
      qualityPass: outcomeRecord.receipt.qualityPass,
      evidenceScore: outcomeRecord.receipt.evidenceScore,
      latencyRegressionPct: outcomeRecord.receipt.latencyRegressionPct
    }),
    verification,
    economics: Object.freeze({
      baselineEstimatedCostUsd: round(baseline),
      actualUsd: round(actual),
      attributableDownstreamCostUsd: round(downstream),
      totalCausalCostUsd,
      verifiedSavingsUsd
    }),
    disposition: verifiedOutcome ? "VERIFIED_CANARY_CLOSEOUT" : "ROLLBACK_REQUIRED",
    verifiedOutcome,
    rollbackRequired: !verifiedOutcome,
    rollbackReasons: Object.freeze(unique(tripReasons)),
    writebackAllowed: verifiedOutcome,
    scopeExpansionAllowed: false,
    requiresFreshBoardDecisionForExpansion: true,
    executionAuthorized: false,
    mayDispatch: false,
    executorAuthorizationRequired: true,
    authorityGranted: false,
    paidApprovalGranted: false
  });

  return Object.freeze({
    ...definition,
    closeoutHash: hashDefinition(definition),
    state: outcomeRecord.state
  });
}

export function buildCanaryWriteback({
  closeoutReceipt,
  qualificationId,
  taskClass
}) {
  assertCloseoutIntegrity(closeoutReceipt);
  requireString("qualificationId", qualificationId);
  requireString("taskClass", taskClass);
  if (closeoutReceipt.writebackAllowed !== true || closeoutReceipt.verifiedOutcome !== true) {
    throw new Error("CANARY_WRITEBACK_REQUIRES_VERIFIED_CLOSEOUT");
  }

  const ledgerEntry = Object.freeze({
    type: "BUDGETGENIUS_CANARY_CLOSEOUT",
    version: "0.6",
    leaseId: closeoutReceipt.leaseId,
    influenceId: closeoutReceipt.influenceId,
    closeoutHash: closeoutReceipt.closeoutHash,
    qualificationId,
    taskClass,
    routeId: closeoutReceipt.canaryRouteId,
    verifiedOutcome: true,
    verifiedSavingsUsd: closeoutReceipt.economics.verifiedSavingsUsd,
    evidenceScore: closeoutReceipt.outcome.evidenceScore,
    latencyRegressionPct: closeoutReceipt.outcome.latencyRegressionPct,
    authorityGranted: false
  });

  const nbgRecord = Object.freeze({
    schema: CANARY_NBG_WRITEBACK_SCHEMA,
    recordId: "nbg-canary:" + closeoutReceipt.closeoutHash.slice(0, 24),
    source: Object.freeze({
      leaseId: closeoutReceipt.leaseId,
      influenceId: closeoutReceipt.influenceId,
      closeoutHash: closeoutReceipt.closeoutHash,
      qualificationId
    }),
    taskClass,
    routeId: closeoutReceipt.canaryRouteId,
    observation: Object.freeze({
      qualityPass: closeoutReceipt.outcome.qualityPass,
      evidenceScore: closeoutReceipt.outcome.evidenceScore,
      latencyRegressionPct: closeoutReceipt.outcome.latencyRegressionPct,
      totalCausalCostUsd: closeoutReceipt.economics.totalCausalCostUsd,
      verifiedSavingsUsd: closeoutReceipt.economics.verifiedSavingsUsd
    }),
    mayChangeLiveRoute: false,
    scopeExpansionAllowed: false,
    authorityGranted: false
  });

  return Object.freeze({ ledgerEntry, nbgRecord });
}

export function buildCanaryQualificationReport({
  closeoutReceipts,
  qualificationId,
  minimumVerifiedCloseouts = 1
}) {
  requireString("qualificationId", qualificationId);
  if (!Array.isArray(closeoutReceipts) || closeoutReceipts.length === 0) {
    throw new TypeError("closeoutReceipts must be a non-empty array");
  }
  if (!Number.isInteger(minimumVerifiedCloseouts) || minimumVerifiedCloseouts < 1) {
    throw new TypeError("minimumVerifiedCloseouts must be a positive integer");
  }

  for (const receipt of closeoutReceipts) assertCloseoutIntegrity(receipt);
  const leaseIds = new Set(closeoutReceipts.map((receipt) => receipt.leaseId));
  if (leaseIds.size !== 1) throw new Error("MIXED_CANARY_LEASES_NOT_ALLOWED");

  const verified = closeoutReceipts.filter((receipt) => receipt.verifiedOutcome === true);
  const rollback = closeoutReceipts.filter((receipt) => receipt.rollbackRequired === true);
  const criticalMisses = closeoutReceipts.filter((receipt) => receipt.outcome.criticalMiss).length;
  const governanceViolations = closeoutReceipts.filter((receipt) => receipt.outcome.governanceViolation).length;
  const qualityFailures = closeoutReceipts.filter((receipt) => !receipt.outcome.qualityPass).length;
  const totalVerifiedSavingsUsd = round(verified.reduce(
    (sum, receipt) => sum + (receipt.economics.verifiedSavingsUsd ?? 0),
    0
  ));

  const ready = verified.length >= minimumVerifiedCloseouts
    && rollback.length === 0
    && criticalMisses === 0
    && governanceViolations === 0
    && qualityFailures === 0;

  return Object.freeze({
    schema: CANARY_QUALIFICATION_REPORT_SCHEMA,
    version: "0.6",
    qualificationId,
    leaseId: closeoutReceipts[0].leaseId,
    disposition: ready ? "CANARY_EVIDENCE_READY_FOR_REVIEW" : "HOLD_OR_ROLLBACK",
    metrics: Object.freeze({
      closeouts: closeoutReceipts.length,
      verifiedCloseouts: verified.length,
      rollbackCloseouts: rollback.length,
      criticalMisses,
      governanceViolations,
      qualityFailures,
      totalVerifiedSavingsUsd
    }),
    evidenceReadyForReview: ready,
    mayRequestNextLeaseReview: ready,
    activationAllowed: false,
    scopeExpansionAllowed: false,
    requiresFreshOperatorStewardBoardDecision: true,
    authorityGranted: false
  });
}

export function assertCloseoutIntegrity(receipt) {
  requireObject("closeoutReceipt", receipt);
  if (receipt.schema !== CANARY_CLOSEOUT_SCHEMA || receipt.receiptType !== CANARY_CLOSEOUT_RECEIPT) {
    throw new Error("UNSUPPORTED_CANARY_CLOSEOUT_RECEIPT");
  }
  const { closeoutHash, state: _state, ...definition } = receipt;
  requireString("closeoutHash", closeoutHash);
  if (hashDefinition(definition) !== closeoutHash) {
    throw new Error("CANARY_CLOSEOUT_INTEGRITY_FAILURE");
  }
  return true;
}

function evaluateVerification(results, policy) {
  if (!Array.isArray(results) || results.length === 0) {
    return Object.freeze({
      ok: false,
      confidence: 0,
      independence: 0,
      reasons: Object.freeze(["NO_VERIFIERS"]),
      verifierIds: Object.freeze([])
    });
  }

  const requireAll = policy.requireAll !== false;
  const minConfidence = unitNumber(policy.minConfidence ?? 0, "verificationPolicy.minConfidence");
  const minIndependence = unitNumber(policy.minIndependence ?? 0, "verificationPolicy.minIndependence");

  const normalized = results.map((result) => {
    requireObject("verificationResult", result);
    if (typeof result.ok !== "boolean") throw new TypeError("verificationResult.ok must be boolean");
    requireString("verificationResult.verifierId", result.verifierId);
    return Object.freeze({
      verifierId: result.verifierId,
      ok: result.ok,
      confidence: unitNumber(result.confidence ?? (result.ok ? 1 : 0), "verificationResult.confidence"),
      independenceScore: unitNumber(result.independenceScore ?? 0, "verificationResult.independenceScore")
    });
  });

  const confidence = normalized.reduce((sum, item) => sum + item.confidence, 0) / normalized.length;
  const independence = Math.max(...normalized.map((item) => item.independenceScore));
  const reasons = [];
  const passRule = requireAll ? normalized.every((item) => item.ok) : normalized.some((item) => item.ok);
  if (!passRule) reasons.push("VERIFIER_FAILURE");
  if (confidence < minConfidence) reasons.push("VERIFICATION_CONFIDENCE_FLOOR");
  if (independence < minIndependence) reasons.push("VERIFIER_INDEPENDENCE_FLOOR");

  return Object.freeze({
    ok: reasons.length === 0,
    confidence: round(confidence),
    independence: round(independence),
    reasons: Object.freeze(reasons),
    verifierIds: Object.freeze(normalized.map((item) => item.verifierId))
  });
}

function hashDefinition(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function unique(values) {
  return [...new Set(values)];
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
  return Math.round((Number(value) + Number.EPSILON) * 1e9) / 1e9;
}
