import assert from "node:assert/strict";
import { EVALUATION_SCHEMA, qualifyShadowEconomics } from "../budgetgenius-bridge-v0.3/qualification.mjs";
import {
  createCanaryLease,
  createCanaryState,
  evaluateCanaryProposal,
  applyCanaryInfluence,
  recordCanaryOutcome,
  revokeCanaryLease,
  resolveRouteAfterLeaseState,
  renewCanaryLease,
  assertLeaseIntegrity
} from "./canary-lease.mjs";

let passed = 0;
function ok(id, name) {
  passed += 1;
  console.log("PASS " + id + " " + name);
}

function makeQualification(evidenceClass = "REPLAY_BENCHMARK") {
  const taskClasses = ["code", "research", "translation", "build"];
  const observations = Array.from({ length: 400 }, (_, i) => ({
    observationId: "eval-" + i,
    sourceObservationId: "source-" + i,
    seed: "seed-" + (i % 5),
    taskClass: taskClasses[i % 4],
    split: "HELD_OUT",
    routeQualified: true,
    live: {
      effectiveEconomicCostUsd: 1,
      qualityPass: true,
      evidenceScore: 0.97,
      latencyMs: 100,
      criticalMiss: false,
      governanceViolation: false
    },
    shadow: {
      effectiveEconomicCostUsd: 0.9,
      qualityPass: true,
      evidenceScore: 0.97,
      latencyMs: 102,
      criticalMiss: false,
      governanceViolation: false
    },
    receipt: {
      receiptType: "BudgetGeniusShadowEconomicReceipt",
      version: "0.2",
      selectionIsLive: false,
      mayChangeLiveRoute: false,
      authorityGranted: false,
      actionAuthority: "NONE",
      executorAuthorizationRequired: true
    }
  }));
  return qualifyShadowEconomics({
    schema: EVALUATION_SCHEMA,
    qualificationId: "bgq-canary-vector",
    evidenceClass,
    source: {
      bridgeVersion: "0.2",
      p3QualificationDisposition: evidenceClass === "SYNTHETIC_QUALIFICATION_FIXTURE"
        ? "STRUCTURAL_PASS_SYNTHETIC_ONLY"
        : "READY_FOR_P4_EVALUATION",
      evidenceManifestRefs: evidenceClass === "SYNTHETIC_QUALIFICATION_FIXTURE"
        ? []
        : ["manifest:test-only"]
    },
    trainingObservationIds: [],
    observations
  });
}

function validApprovals() {
  return [
    { role: "OPERATOR", approvalId: "approval-operator-1", approverRef: "operator:test" },
    { role: "STEWARD", approvalId: "approval-steward-1", approverRef: "steward:test" },
    { role: "BOARD", approvalId: "approval-board-1", approverRef: "board:test" }
  ];
}

function createValidLease(overrides = {}) {
  return createCanaryLease({
    qualification: overrides.qualification ?? makeQualification(),
    leaseId: overrides.leaseId ?? "canary-lease-1",
    issuedAt: overrides.issuedAt ?? "2026-10-07T22:55:00Z",
    expiresAt: overrides.expiresAt ?? "2026-10-07T23:10:00Z",
    approvals: overrides.approvals ?? validApprovals(),
    mandateRef: overrides.mandateRef ?? "mandate:bg-canary-1",
    budgetPassRef: overrides.budgetPassRef ?? "budgetpass:bg-canary-1",
    scope: overrides.scope ?? {
      taskClasses: ["code"],
      routeIds: ["candidate:qwen3:8b"],
      maxDecisions: 3,
      maxCumulativeShadowSpendUsd: 0.15,
      maxPerDecisionSpendUsd: 0.05,
      minOutcomeEvidenceScore: 0.90,
      maxOutcomeLatencyRegressionPct: 0.10
    }
  });
}

function passReceipt(lease, overrides = {}) {
  return {
    decision: overrides.decision ?? "ALLOW",
    leaseId: overrides.leaseId ?? lease.leaseId,
    mandateRef: overrides.mandateRef ?? lease.mandateRef,
    authorityGranted: overrides.authorityGranted ?? false,
    executorAuthorizationRequired: overrides.executorAuthorizationRequired ?? true
  };
}

function allowedProposal(lease, state, overrides = {}) {
  return evaluateCanaryProposal({
    lease,
    state,
    now: overrides.now ?? "2026-10-07T23:00:00Z",
    taskClass: overrides.taskClass ?? "code",
    baselineRouteId: overrides.baselineRouteId ?? "spv:live:baseline",
    proposedRouteId: overrides.proposedRouteId ?? "candidate:qwen3:8b",
    shadowSpendUsd: overrides.shadowSpendUsd ?? 0.03,
    budgetPassReceipt: overrides.budgetPassReceipt ?? passReceipt(lease)
  });
}

const empirical = makeQualification();
assert.equal(empirical.disposition, "EMPIRICAL_QUALIFIED_CANDIDATE");
assert.equal(empirical.mayRequestCanaryLease, true);
assert.equal(empirical.activationAllowed, false);
ok("C01", "v0.3-empirical-candidate-is-the-only-entry-condition");

const synthetic = makeQualification("SYNTHETIC_QUALIFICATION_FIXTURE");
assert.throws(
  () => createValidLease({ qualification: synthetic }),
  /QUALIFICATION_NOT_EMPIRICAL_CANDIDATE/
);
ok("C02", "synthetic-qualification-cannot-mint-a-canary-lease");

assert.throws(
  () => createValidLease({ approvals: validApprovals().filter((x) => x.role !== "BOARD") }),
  /MISSING_REQUIRED_APPROVAL:BOARD/
);
ok("C03", "operator-steward-board-approval-is-required");

assert.throws(
  () => createValidLease({ expiresAt: "2026-10-07T23:30:01Z" }),
  /LEASE_DURATION_EXCEEDS_HARD_LIMIT/
);
ok("C04", "lease-duration-has-a-hard-thirty-minute-ceiling");

assert.throws(
  () => createValidLease({
    scope: {
      taskClasses: ["code"],
      routeIds: ["candidate:qwen3:8b"],
      maxDecisions: 11,
      maxCumulativeShadowSpendUsd: 0.15,
      maxPerDecisionSpendUsd: 0.05
    }
  }),
  /DECISION_LIMIT_EXCEEDS_HARD_LIMIT/
);
ok("C05", "decision-count-has-a-hard-ceiling");

const lease = createValidLease();
assert.equal(assertLeaseIntegrity(lease), true);
assert.equal(lease.authority.mayDispatch, false);
assert.equal(lease.authority.mayBypassExecutorAuthorization, false);
assert.equal(lease.renewal.selfRenewalAllowed, false);
ok("C06", "valid-lease-is-hash-pinned-and-non-self-extending");

const state0 = createCanaryState(lease);
const proposal = allowedProposal(lease, state0);
assert.equal(proposal.routeInfluenceAllowed, true);
assert.equal(proposal.executionAuthorized, false);
ok("C07", "bounded-route-influence-can-be-proposed-inside-lease-scope");

const applied = applyCanaryInfluence({
  lease,
  state: state0,
  proposal,
  influenceId: "influence-1"
});
assert.equal(applied.state.decisionsUsed, 1);
assert.equal(applied.state.cumulativeShadowSpendUsd, 0.03);
assert.equal(applied.receipt.routeChanged, true);
assert.equal(applied.receipt.executionAuthorized, false);
assert.equal(applied.receipt.executorAuthorizationRequired, true);
assert.equal(applied.receipt.paidApprovalGranted, false);
ok("C08", "route-influence-receipt-preserves-final-executor-and-paid-approval-gates");

const budgetDenied = allowedProposal(lease, state0, {
  budgetPassReceipt: passReceipt(lease, { decision: "DENY" })
});
assert.equal(budgetDenied.routeInfluenceAllowed, false);
assert.ok(budgetDenied.reasons.includes("BUDGETPASS_DENIED"));
ok("C09", "budgetpass-denial-vetoes-canary-influence");

const wrongTask = allowedProposal(lease, state0, { taskClass: "research" });
assert.equal(wrongTask.routeInfluenceAllowed, false);
assert.ok(wrongTask.reasons.includes("TASK_CLASS_OUT_OF_SCOPE"));
ok("C10", "task-class-scope-is-enforced");

const wrongRoute = allowedProposal(lease, state0, { proposedRouteId: "candidate:frontier" });
assert.equal(wrongRoute.routeInfluenceAllowed, false);
assert.ok(wrongRoute.reasons.includes("ROUTE_OUT_OF_SCOPE"));
ok("C11", "route-scope-is-enforced");

const perDecisionSpend = allowedProposal(lease, state0, { shadowSpendUsd: 0.051 });
assert.equal(perDecisionSpend.routeInfluenceAllowed, false);
assert.ok(perDecisionSpend.reasons.includes("PER_DECISION_SPEND_EXCEEDED"));
ok("C12", "per-decision-spend-cap-is-enforced");

const nearlySpent = Object.freeze({ ...state0, cumulativeShadowSpendUsd: 0.14 });
const cumulativeSpend = allowedProposal(lease, nearlySpent, { shadowSpendUsd: 0.02 });
assert.equal(cumulativeSpend.routeInfluenceAllowed, false);
assert.ok(cumulativeSpend.reasons.includes("CUMULATIVE_SPEND_EXCEEDED"));
ok("C13", "cumulative-spend-cap-is-enforced");

const exhausted = Object.freeze({ ...state0, decisionsUsed: 3 });
const exhaustedProposal = allowedProposal(lease, exhausted);
assert.equal(exhaustedProposal.routeInfluenceAllowed, false);
assert.ok(exhaustedProposal.reasons.includes("DECISION_LIMIT_EXHAUSTED"));
ok("C14", "decision-budget-exhaustion-stops-influence");

const expired = allowedProposal(lease, state0, { now: lease.expiresAt });
assert.equal(expired.routeInfluenceAllowed, false);
assert.ok(expired.reasons.includes("LEASE_EXPIRED"));
ok("C15", "expiry-is-immediate-and-fail-closed");

const mismatchedPass = allowedProposal(lease, state0, {
  budgetPassReceipt: passReceipt(lease, { leaseId: "other-lease" })
});
assert.equal(mismatchedPass.routeInfluenceAllowed, false);
assert.ok(mismatchedPass.reasons.includes("BUDGETPASS_LEASE_MISMATCH"));
ok("C16", "budgetpass-receipt-is-bound-to-the-exact-lease");

const qualityTrip = recordCanaryOutcome({
  lease,
  state: applied.state,
  influenceReceipt: applied.receipt,
  outcome: {
    qualityPass: false,
    evidenceScore: 0.97,
    latencyRegressionPct: 0.01,
    criticalMiss: false,
    governanceViolation: false
  }
});
assert.equal(qualityTrip.state.status, "ROLLBACK_REQUIRED");
assert.ok(qualityTrip.receipt.rollbackReasons.includes("QUALITY_FAILURE"));
ok("C17", "quality-failure-trips-automatic-rollback");

const criticalTrip = recordCanaryOutcome({
  lease,
  state: applied.state,
  influenceReceipt: applied.receipt,
  outcome: {
    qualityPass: true,
    evidenceScore: 0.97,
    latencyRegressionPct: 0.01,
    criticalMiss: true,
    governanceViolation: false
  }
});
assert.equal(criticalTrip.state.status, "ROLLBACK_REQUIRED");
assert.ok(criticalTrip.receipt.rollbackReasons.includes("CRITICAL_MISS"));
ok("C18", "critical-miss-is-non-tradable-and-trips-rollback");

const governanceTrip = recordCanaryOutcome({
  lease,
  state: applied.state,
  influenceReceipt: applied.receipt,
  outcome: {
    qualityPass: true,
    evidenceScore: 0.97,
    latencyRegressionPct: 0.01,
    criticalMiss: false,
    governanceViolation: true
  }
});
assert.equal(governanceTrip.state.status, "ROLLBACK_REQUIRED");
assert.ok(governanceTrip.receipt.rollbackReasons.includes("GOVERNANCE_VIOLATION"));
ok("C19", "governance-violation-is-non-tradable-and-trips-rollback");

const evidenceTrip = recordCanaryOutcome({
  lease,
  state: applied.state,
  influenceReceipt: applied.receipt,
  outcome: {
    qualityPass: true,
    evidenceScore: 0.89,
    latencyRegressionPct: 0.01,
    criticalMiss: false,
    governanceViolation: false
  }
});
assert.ok(evidenceTrip.receipt.rollbackReasons.includes("EVIDENCE_FLOOR_BREACH"));
ok("C20", "outcome-evidence-floor-is-a-live-tripwire");

const latencyTrip = recordCanaryOutcome({
  lease,
  state: applied.state,
  influenceReceipt: applied.receipt,
  outcome: {
    qualityPass: true,
    evidenceScore: 0.97,
    latencyRegressionPct: 0.11,
    criticalMiss: false,
    governanceViolation: false
  }
});
assert.ok(latencyTrip.receipt.rollbackReasons.includes("LATENCY_TRIPWIRE"));
ok("C21", "latency-regression-is-a-live-tripwire");

const rolledBackRoute = resolveRouteAfterLeaseState({
  lease,
  state: criticalTrip.state,
  baselineRouteId: "spv:live:baseline",
  proposedRouteId: "candidate:qwen3:8b"
});
assert.equal(rolledBackRoute.selectedRouteId, "spv:live:baseline");
assert.equal(rolledBackRoute.canaryInfluenceApplied, false);
ok("C22", "rollback-restores-the-existing-live-broker-route");

const revoked = revokeCanaryLease({ lease, state: applied.state, revokedBy: "operator:test" });
const revokedRoute = resolveRouteAfterLeaseState({
  lease,
  state: revoked,
  baselineRouteId: "spv:live:baseline",
  proposedRouteId: "candidate:qwen3:8b"
});
assert.equal(revoked.status, "REVOKED");
assert.equal(revokedRoute.selectedRouteId, "spv:live:baseline");
ok("C23", "explicit-revocation-is-immediate");

const tampered = { ...lease, expiresAt: "2026-10-08T01:00:00Z" };
assert.throws(() => assertLeaseIntegrity(tampered), /CANARY_LEASE_INTEGRITY_FAILURE/);
ok("C24", "lease-tampering-is-detected");

assert.throws(() => renewCanaryLease(lease), /SELF_RENEWAL_NOT_ALLOWED/);
ok("C25", "optimizer-cannot-renew-its-own-lease");

console.log("BudgetGenius bounded canary lease v0.4: PASS (" + passed + "/25)");
console.log("NOTE this acceptance is a deterministic canary drill. The package remains runtime-unwired.");
