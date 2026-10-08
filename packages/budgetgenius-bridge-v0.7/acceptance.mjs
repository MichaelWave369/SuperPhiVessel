import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createCanaryLease,
  createCanaryState,
  evaluateCanaryProposal,
  applyCanaryInfluence
} from "../budgetgenius-bridge-v0.4/canary-lease.mjs";

import {
  assertRuntimeOutcomeReceipt,
  normalizeRuntimeInfluenceReceipt,
  closeRuntimeOutcome,
  runtimeOutcomeRollbackReceipt,
  buildRuntimeOutcomeReceiptFixture
} from "./outcome-handoff.mjs";

const budgetGeniusRoot = process.env.BUDGETGENIUS_ROOT;
if (!budgetGeniusRoot) throw new Error("BUDGETGENIUS_ROOT is required");
const bg = await import(pathToFileURL(resolve(budgetGeniusRoot, "src/index.js")).href);

let passed = 0;
function ok(id, name) {
  passed += 1;
  console.log("PASS " + id + " " + name);
}

const manifest = JSON.parse(readFileSync("runtime/MANIFEST.json", "utf8"));
assert.equal(manifest.runtime.version, "v2.0-alpha.11.0.54.12");
assert.equal(manifest.canary_runtime?.outcome_handoff_protocol, "PV-BUDGETGENIUS-OUTCOME-0.7");
assert.equal(manifest.canary_runtime?.outcome_success_state, "AWAITING_VERIFICATION");
assert.equal(manifest.canary_runtime?.outcome_failure_state, "ROLLBACK_REQUIRED");
assert.equal(manifest.canary_runtime?.verified_writeback_authority, false);
assert.equal(manifest.canary_runtime?.scope_expansion_authority, false);
ok("C01", "manifest-promotes-v0.7-outcome-handoff-with-no-verification-or-expansion-authority");

const runtimeBytes = readFileSync(manifest.runtime.path);
assert.equal(runtimeBytes.length, manifest.runtime.size_bytes);
assert.equal(createHash("sha256").update(runtimeBytes).digest("hex"), manifest.runtime.sha256);
const gitBlobSha1 = createHash("sha1")
  .update(Buffer.from("blob " + runtimeBytes.length + "\0", "utf8"))
  .update(runtimeBytes)
  .digest("hex");
assert.equal(gitBlobSha1, manifest.runtime.git_blob_sha1);
ok("C02", "canonical-v0.7-runtime-size-sha256-and-git-blob-pin-match");

const html = runtimeBytes.toString("utf8");
assert.ok(html.includes("const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.12';"));
assert.ok(html.includes("BUDGETGENIUS_CANARY_RUNTIME_V0_5_BEGIN"));
assert.ok(html.includes("BUDGETGENIUS_CANARY_OUTCOME_RUNTIME_V0_7_BEGIN"));
assert.ok(html.includes("authorizeExecutor(ACTIVE_RUN_CAPSULE"));
ok("C03", "v0.7-retains-v0.5-live-canary-and-downstream-executor-authorization");

const successAnchor = "computeBrokerRecord(brokerDecision,'COMPLETED',first.receipt,null,runProvider);await budgetGeniusCanaryRuntimeOutcomeHandoff(brokerDecision,first,{status:'COMPLETED',executor:runProvider});return first;";
const failureAnchor = "computeBrokerRecord(brokerDecision,'FAILED',firstErr&&firstErr.receipt||null,firstErr,runProvider);await budgetGeniusCanaryRuntimeOutcomeHandoff";
assert.ok(html.includes(successAnchor));
assert.ok(html.includes(failureAnchor));
ok("C04", "outcome-capture-is-wired-to-first-attempt-success-and-pre-fallback-failure");

const routeId = "ollama::qwen3:8b";
const banker = new bg.BudgetBanker();
banker.createPool({ poolId: "project:spv-canary-v07", limitUsd: 1 });
const ledger = new bg.BudgetLedger();
const mandate = bg.createMandate({
  mandateId: "mandate:bg-live-canary-v07",
  objective: "Normalize canonical runtime outcome into verified closeout",
  poolId: "project:spv-canary-v07",
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
const budgetPass = bg.planBudgetPass({ mandate, candidates: [candidate], banker, ledger });
assert.equal(budgetPass.pass.state, bg.PASS_STATE.RESERVED);
ok("C05", "real-pinned-budgetgenius-reserves-the-exact-zero-dollar-route");

const qualification = Object.freeze({
  qualificationId: "bgq-v07-fixture",
  disposition: "EMPIRICAL_QUALIFIED_CANDIDATE",
  mayRequestCanaryLease: true,
  activationAllowed: false,
  mayChangeLiveRoute: false,
  authorityGranted: false
});
const now = Date.now();
const lease = createCanaryLease({
  qualification,
  leaseId: "canary-v07-lease-1",
  issuedAt: new Date(now - 1000).toISOString(),
  expiresAt: new Date(now + 120000).toISOString(),
  approvals: [
    { role: "OPERATOR", approvalId: "op-v07", approverRef: "operator:test" },
    { role: "STEWARD", approvalId: "st-v07", approverRef: "steward:test" },
    { role: "BOARD", approvalId: "bd-v07", approverRef: "board:test" }
  ],
  mandateRef: mandate.mandateId,
  budgetPassRef: budgetPass.pass.passId,
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
const influence = applyCanaryInfluence({
  lease,
  state: state0,
  proposal,
  influenceId: "runtime-influence-v07"
});
assert.equal(influence.receipt.authorityGranted, false);
ok("C06", "fixture-route-influence-preserves-the-existing-authority-boundary");

const runtimeOutcome = buildRuntimeOutcomeReceiptFixture({
  lease,
  influence: influence.receipt,
  executionStatus: "COMPLETED",
  actualExecutor: routeId,
  actualProvider: "ollama",
  actualModel: "qwen3:8b",
  timestamp: 7
});
assert.equal(assertRuntimeOutcomeReceipt(runtimeOutcome), true);
assert.equal(runtimeOutcome.closeoutStatus, "AWAITING_VERIFICATION");
assert.equal(runtimeOutcome.verifiedOutcome, false);
assert.equal(runtimeOutcome.writebackAllowed, false);
ok("C07", "successful-execution-is-captured-as-awaiting-verification-not-verified-quality");

const normalized = normalizeRuntimeInfluenceReceipt(runtimeOutcome);
assert.equal(normalized.leaseId, lease.leaseId);
assert.equal(normalized.canaryRouteId, routeId);
assert.equal(normalized.executionAuthorized, false);
assert.equal(normalized.authorityGranted, false);
ok("C08", "canonical-runtime-influence-normalizes-into-v0.6-closeout-identity");

const closeout = closeRuntimeOutcome({
  lease,
  runtimeOutcome,
  outcome: {
    qualityPass: true,
    evidenceScore: 0.97,
    latencyRegressionPct: 0.02,
    criticalMiss: false,
    governanceViolation: false
  },
  verificationResults: [
    {
      verifierId: "reality-gate:test",
      ok: true,
      confidence: 0.99,
      independenceScore: 0.95
    }
  ],
  verificationPolicy: {
    requireAll: true,
    minConfidence: 0.9,
    minIndependence: 0.8
  },
  baselineEstimatedCostUsd: 0.05,
  actualUsd: 0,
  attributableCostsUsd: [0.005]
});
assert.equal(closeout.disposition, "VERIFIED_CANARY_CLOSEOUT");
assert.equal(closeout.economics.verifiedSavingsUsd, 0.045);
assert.equal(closeout.scopeExpansionAllowed, false);
assert.equal(closeout.authorityGranted, false);
ok("C09", "independent-verification-converts-runtime-observation-into-v0.6-verified-closeout");

const failedRuntimeOutcome = buildRuntimeOutcomeReceiptFixture({
  lease,
  influence: influence.receipt,
  executionStatus: "FAILED",
  errorCode: "OLLAMA_REQUEST_FAILED",
  timestamp: 8
});
assert.equal(assertRuntimeOutcomeReceipt(failedRuntimeOutcome), true);
assert.equal(failedRuntimeOutcome.closeoutStatus, "ROLLBACK_REQUIRED");
const rollback = runtimeOutcomeRollbackReceipt(failedRuntimeOutcome);
assert.equal(rollback.rollbackRequired, true);
assert.equal(rollback.writebackAllowed, false);
assert.equal(rollback.scopeExpansionAllowed, false);
assert.equal(rollback.authorityGranted, false);
ok("C10", "failed-canary-attempt-becomes-rollback-evidence-before-any-fallback-can-claim-credit");

assert.throws(
  () => closeRuntimeOutcome({
    lease,
    runtimeOutcome: failedRuntimeOutcome,
    outcome: {
      qualityPass: true,
      evidenceScore: 1,
      latencyRegressionPct: 0,
      criticalMiss: false,
      governanceViolation: false
    },
    verificationResults: [{ verifierId: "fake", ok: true, confidence: 1, independenceScore: 1 }],
    baselineEstimatedCostUsd: 0.05
  }),
  /RUNTIME_OUTCOME_NOT_COMPLETED/
);
ok("C11", "failed-runtime-outcome-cannot-be-promoted-into-a-clean-closeout");

const tampered = {
  ...runtimeOutcome,
  actualModel: "evil:model"
};
assert.throws(() => assertRuntimeOutcomeReceipt(tampered), /RUNTIME_OUTCOME_INTEGRITY_FAILURE/);
ok("C12", "runtime-outcome-tampering-fails-integrity");

const promoted = {
  ...runtimeOutcome,
  authorityGranted: true
};
assert.throws(() => assertRuntimeOutcomeReceipt(promoted), /RUNTIME_OUTCOME_AUTHORITY_BOUNDARY_VIOLATED/);
ok("C13", "runtime-outcome-rejects-authority-promotion");

const otherLease = { ...lease, leaseId: "other-lease" };
assert.throws(
  () => closeRuntimeOutcome({
    lease: otherLease,
    runtimeOutcome,
    outcome: {
      qualityPass: true,
      evidenceScore: 1,
      latencyRegressionPct: 0,
      criticalMiss: false,
      governanceViolation: false
    },
    verificationResults: [{ verifierId: "v", ok: true, confidence: 1, independenceScore: 1 }],
    baselineEstimatedCostUsd: 0.05
  }),
  /RUNTIME_OUTCOME_LEASE_MISMATCH/
);
ok("C14", "runtime-outcome-cannot-cross-lease-boundaries");

console.log("BudgetGenius canonical outcome handoff v0.7: PASS (" + passed + "/14)");
console.log("NOTE v0.7 captures execution truth automatically; quality verification and writeback remain separately governed.");
