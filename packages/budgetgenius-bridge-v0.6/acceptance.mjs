import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createCanaryLease,
  createCanaryState,
  evaluateCanaryProposal,
  applyCanaryInfluence
} from "../budgetgenius-bridge-v0.4/canary-lease.mjs";

import {
  evaluateCanaryCloseout,
  buildCanaryWriteback,
  buildCanaryQualificationReport,
  assertCloseoutIntegrity
} from "./closeout.mjs";

const budgetGeniusRoot = process.env.BUDGETGENIUS_ROOT;
if (!budgetGeniusRoot) throw new Error("BUDGETGENIUS_ROOT is required");
const bg = await import(pathToFileURL(resolve(budgetGeniusRoot, "src/index.js")).href);

let passed = 0;
function ok(id, name) {
  passed += 1;
  console.log("PASS " + id + " " + name);
}

const routeId = "ollama::qwen3:8b";
const banker = new bg.BudgetBanker();
banker.createPool({ poolId: "project:spv-canary-v06", limitUsd: 1 });
const ledger = new bg.BudgetLedger();

const mandate = bg.createMandate({
  mandateId: "mandate:bg-live-canary-v06",
  objective: "Close one governed local BudgetGenius canary decision",
  poolId: "project:spv-canary-v06",
  qualityFloor: 0.95,
  evidenceFloor: 0.9,
  maxRiskScore: 0.1,
  maxCostUsd: 0,
  authority: [],
  effectClass: bg.EFFECT_CLASS.READ,
  riskClass: bg.RISK_CLASS.NORMAL
});

const candidate = {
  routeId,
  estimatedCostUsd: 0,
  successProbability: 0.99,
  evidenceScore: 0.99,
  riskScore: 0.01,
  requiredAuthority: [],
  latencyMs: 40
};

const budgetPassPlan = bg.planBudgetPass({
  mandate,
  candidates: [candidate],
  banker,
  ledger
});

assert.equal(budgetPassPlan.pass.state, bg.PASS_STATE.RESERVED);
assert.equal(budgetPassPlan.pass.selectedRouteId, routeId);
assert.equal(budgetPassPlan.pass.reservedUsd, 0);
assert.equal(budgetPassPlan.reservation.ok, true);
ok("C01", "real-pinned-budgetgenius-reserves-exact-zero-dollar-canary-route");

const qualification = Object.freeze({
  qualificationId: "bgq-v06-fixture",
  disposition: "EMPIRICAL_QUALIFIED_CANDIDATE",
  mayRequestCanaryLease: true,
  activationAllowed: false,
  mayChangeLiveRoute: false,
  authorityGranted: false
});

const now = Date.now();
const lease = createCanaryLease({
  qualification,
  leaseId: "canary-v06-lease-1",
  issuedAt: new Date(now - 1000).toISOString(),
  expiresAt: new Date(now + 120000).toISOString(),
  approvals: [
    { role: "OPERATOR", approvalId: "op-v06", approverRef: "operator:test" },
    { role: "STEWARD", approvalId: "st-v06", approverRef: "steward:test" },
    { role: "BOARD", approvalId: "bd-v06", approverRef: "board:test" }
  ],
  mandateRef: mandate.mandateId,
  budgetPassRef: budgetPassPlan.pass.passId,
  scope: {
    taskClasses: ["code"],
    routeIds: [routeId],
    maxDecisions: 1,
    maxCumulativeShadowSpendUsd: 0,
    maxPerDecisionSpendUsd: 0,
    minOutcomeEvidenceScore: 0.9,
    maxOutcomeLatencyRegressionPct: 0.1
  }
});

const state0 = createCanaryState(lease);
const proposal = evaluateCanaryProposal({
  lease,
  state: state0,
  now: new Date().toISOString(),
  taskClass: "code",
  baselineRouteId: "ollama::gemma3:12b",
  proposedRouteId: routeId,
  shadowSpendUsd: 0,
  budgetPassReceipt: {
    decision: "ALLOW",
    leaseId: lease.leaseId,
    mandateRef: lease.mandateRef,
    authorityGranted: false,
    executorAuthorizationRequired: true
  }
});

assert.equal(proposal.routeInfluenceAllowed, true);
const influence = applyCanaryInfluence({
  lease,
  state: state0,
  proposal,
  influenceId: "influence-v06-1"
});
assert.equal(influence.state.decisionsUsed, 1);
assert.equal(influence.receipt.executionAuthorized, false);
assert.equal(influence.receipt.authorityGranted, false);
ok("C02", "closeout-fixture-begins-from-governed-route-influence-with-no-execution-authority");

const verificationResults = [
  {
    verifierId: "reality-gate:test",
    ok: true,
    confidence: 0.99,
    independenceScore: 0.95
  }
];

const goodOutcome = {
  qualityPass: true,
  evidenceScore: 0.97,
  latencyRegressionPct: 0.02,
  criticalMiss: false,
  governanceViolation: false
};

const goodCloseout = evaluateCanaryCloseout({
  lease,
  state: influence.state,
  influenceReceipt: influence.receipt,
  outcome: goodOutcome,
  verificationResults,
  verificationPolicy: {
    requireAll: true,
    minConfidence: 0.9,
    minIndependence: 0.8
  },
  baselineEstimatedCostUsd: 0.05,
  actualUsd: 0,
  attributableCostsUsd: [0.005]
});

assert.equal(goodCloseout.disposition, "VERIFIED_CANARY_CLOSEOUT");
assert.equal(goodCloseout.verifiedOutcome, true);
assert.equal(goodCloseout.rollbackRequired, false);
assert.equal(goodCloseout.economics.totalCausalCostUsd, 0.005);
assert.equal(goodCloseout.economics.verifiedSavingsUsd, 0.045);
assert.equal(goodCloseout.scopeExpansionAllowed, false);
assert.equal(goodCloseout.authorityGranted, false);
ok("C03", "clean-outcome-produces-verified-causal-savings-without-scope-expansion");

assert.equal(assertCloseoutIntegrity(goodCloseout), true);
ok("C04", "closeout-receipt-is-hash-bound-and-self-verifiable");

let pass = bg.markDispatched(budgetPassPlan.pass);
pass = bg.markReceived(pass);
pass = bg.markVerified(pass);
const settled = bg.settleBudgetPass({
  pass,
  actualUsd: 0,
  banker,
  ledger,
  baselineEstimatedCostUsd: 0.05
});
const certified = bg.certifySavings({
  receipt: settled.receipt,
  outcomeVerified: goodCloseout.verifiedOutcome,
  attributableCostsUsd: [0.005]
});
assert.equal(settled.pass.state, bg.PASS_STATE.SETTLED);
assert.equal(certified.verifiedSavingsUsd, goodCloseout.economics.verifiedSavingsUsd);
assert.equal(certified.totalCausalCostUsd, goodCloseout.economics.totalCausalCostUsd);
ok("C05", "real-budgetpass-settlement-and-v0.6-closeout-agree-on-causal-savings");

const writeback = buildCanaryWriteback({
  closeoutReceipt: goodCloseout,
  qualificationId: qualification.qualificationId,
  taskClass: "code"
});
ledger.append(writeback.ledgerEntry);
assert.equal(writeback.ledgerEntry.type, "BUDGETGENIUS_CANARY_CLOSEOUT");
assert.equal(writeback.ledgerEntry.authorityGranted, false);
assert.equal(writeback.nbgRecord.mayChangeLiveRoute, false);
assert.equal(writeback.nbgRecord.scopeExpansionAllowed, false);
assert.equal(writeback.nbgRecord.authorityGranted, false);
assert.equal(ledger.all().some((row) => row.type === "BUDGETGENIUS_CANARY_CLOSEOUT"), true);
ok("C06", "verified-closeout-emits-ledger-and-nbg-writeback-with-zero-route-authority");

const report = buildCanaryQualificationReport({
  closeoutReceipts: [goodCloseout],
  qualificationId: qualification.qualificationId,
  minimumVerifiedCloseouts: 1
});
assert.equal(report.disposition, "CANARY_EVIDENCE_READY_FOR_REVIEW");
assert.equal(report.evidenceReadyForReview, true);
assert.equal(report.mayRequestNextLeaseReview, true);
assert.equal(report.activationAllowed, false);
assert.equal(report.scopeExpansionAllowed, false);
assert.equal(report.requiresFreshOperatorStewardBoardDecision, true);
assert.equal(report.authorityGranted, false);
ok("C07", "qualification-report-can-request-review-but-cannot-self-promote-or-expand");

function closeoutFor(outcome, verification = verificationResults) {
  return evaluateCanaryCloseout({
    lease,
    state: influence.state,
    influenceReceipt: influence.receipt,
    outcome,
    verificationResults: verification,
    verificationPolicy: {
      requireAll: true,
      minConfidence: 0.9,
      minIndependence: 0.8
    },
    baselineEstimatedCostUsd: 0.05,
    actualUsd: 0,
    attributableCostsUsd: []
  });
}

const critical = closeoutFor({ ...goodOutcome, criticalMiss: true });
assert.equal(critical.rollbackRequired, true);
assert.ok(critical.rollbackReasons.includes("CRITICAL_MISS"));
assert.equal(critical.economics.verifiedSavingsUsd, null);
ok("C08", "critical-miss-tripwire-cancels-verified-savings-and-requires-rollback");

const quality = closeoutFor({ ...goodOutcome, qualityPass: false });
assert.equal(quality.rollbackRequired, true);
assert.ok(quality.rollbackReasons.includes("QUALITY_FAILURE"));
ok("C09", "quality-failure-tripwire-requires-rollback");

const evidence = closeoutFor({ ...goodOutcome, evidenceScore: 0.5 });
assert.equal(evidence.rollbackRequired, true);
assert.ok(evidence.rollbackReasons.includes("EVIDENCE_FLOOR_BREACH"));
ok("C10", "evidence-floor-breach-requires-rollback");

const latency = closeoutFor({ ...goodOutcome, latencyRegressionPct: 0.5 });
assert.equal(latency.rollbackRequired, true);
assert.ok(latency.rollbackReasons.includes("LATENCY_TRIPWIRE"));
ok("C11", "latency-regression-tripwire-requires-rollback");

const governance = closeoutFor({ ...goodOutcome, governanceViolation: true });
assert.equal(governance.rollbackRequired, true);
assert.ok(governance.rollbackReasons.includes("GOVERNANCE_VIOLATION"));
ok("C12", "governance-violation-tripwire-requires-rollback");

const verifierFail = closeoutFor(goodOutcome, [
  {
    verifierId: "reality-gate:test",
    ok: false,
    confidence: 0.99,
    independenceScore: 0.95
  }
]);
assert.equal(verifierFail.rollbackRequired, true);
assert.ok(verifierFail.rollbackReasons.includes("VERIFIER_FAILURE"));
assert.equal(verifierFail.writebackAllowed, false);
ok("C13", "failed-independent-verification-blocks-writeback-and-savings-certification");

const promotedInfluence = {
  ...influence.receipt,
  authorityGranted: true
};
assert.throws(
  () => evaluateCanaryCloseout({
    lease,
    state: influence.state,
    influenceReceipt: promotedInfluence,
    outcome: goodOutcome,
    verificationResults,
    baselineEstimatedCostUsd: 0.05
  }),
  /CANARY_INFLUENCE_AUTHORITY_BOUNDARY_VIOLATED/
);
ok("C14", "closeout-rejects-any-influence-receipt-that-promotes-authority");

const tampered = {
  ...goodCloseout,
  economics: {
    ...goodCloseout.economics,
    verifiedSavingsUsd: 999
  }
};
assert.throws(() => assertCloseoutIntegrity(tampered), /CANARY_CLOSEOUT_INTEGRITY_FAILURE/);
ok("C15", "tampered-economic-closeout-fails-integrity");

assert.throws(
  () => buildCanaryWriteback({
    closeoutReceipt: critical,
    qualificationId: qualification.qualificationId,
    taskClass: "code"
  }),
  /CANARY_WRITEBACK_REQUIRES_VERIFIED_CLOSEOUT/
);
ok("C16", "rollback-closeout-cannot-enter-nbg-or-ledger-as-verified-evidence");

const mixedReport = buildCanaryQualificationReport({
  closeoutReceipts: [goodCloseout, critical],
  qualificationId: qualification.qualificationId,
  minimumVerifiedCloseouts: 1
});
assert.equal(mixedReport.disposition, "HOLD_OR_ROLLBACK");
assert.equal(mixedReport.evidenceReadyForReview, false);
assert.equal(mixedReport.scopeExpansionAllowed, false);
ok("C17", "one-bad-closeout-holds-qualification-even-when-another-closeout-passed");

const noVerifier = closeoutFor(goodOutcome, []);
assert.equal(noVerifier.rollbackRequired, true);
assert.ok(noVerifier.rollbackReasons.includes("NO_VERIFIERS"));
ok("C18", "no-verifier-closeout-fails-closed");

console.log("BudgetGenius canary closeout v0.6: PASS (" + passed + "/18)");
console.log("NOTE v0.6 certifies outcomes and economics; it does not widen live routing authority.");
