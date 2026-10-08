import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createCanaryLease } from "../budgetgenius-bridge-v0.4/canary-lease.mjs";

const budgetGeniusRoot = process.env.BUDGETGENIUS_ROOT;
if (!budgetGeniusRoot) throw new Error("BUDGETGENIUS_ROOT is required");
const bg = await import(pathToFileURL(resolve(budgetGeniusRoot, "src/index.js")).href);

let passed = 0;
function ok(id, name) {
  passed += 1;
  console.log("PASS " + id + " " + name);
}

const manifest = JSON.parse(readFileSync("runtime/MANIFEST.json", "utf8"));
const canonicalPatch = Number(manifest.runtime.version.match(/\.54\.(\d+)$/)?.[1]);
assert.ok(Number.isInteger(canonicalPatch) && canonicalPatch >= 11);
assert.equal(manifest.canary_runtime?.protocol, "PV-BUDGETGENIUS-CANARY-0.5");
assert.equal(manifest.canary_runtime?.max_decisions, 1);
assert.equal(manifest.canary_runtime?.max_duration_ms, 300000);
assert.equal(manifest.canary_runtime?.paid_spend_usd, 0);
assert.equal(manifest.canary_runtime?.final_executor_authorization_required, true);
ok("C01", "manifest-promotes-explicit-v0.5-one-shot-local-canary-contract");

const runtimeBytes = readFileSync(manifest.runtime.path);
assert.equal(runtimeBytes.length, manifest.runtime.size_bytes);
assert.equal(createHash("sha256").update(runtimeBytes).digest("hex"), manifest.runtime.sha256);
const gitBlobSha1 = createHash("sha1")
  .update(Buffer.from("blob " + runtimeBytes.length + "\0", "utf8"))
  .update(runtimeBytes)
  .digest("hex");
assert.equal(gitBlobSha1, manifest.runtime.git_blob_sha1);
ok("C02", "canonical-runtime-size-sha256-and-git-blob-pin-match");

const html = runtimeBytes.toString("utf8");
assert.ok(html.includes("const SUPER_PHIVESSEL_VERSION='" + manifest.runtime.version.replace(/^v/, "") + "';"));
assert.ok(html.includes("function computeBrokerRoute(opts)"));
assert.ok(html.includes("function executorAuthorizationDecision(capsule,req)"));
assert.ok(html.includes("function authorizeExecutor(capsule,req)"));
ok("C03", "canonical-runtime-retains-budgetcompute-and-final-executor-authorization");

const begin = "/* BUDGETGENIUS_CANARY_RUNTIME_V0_5_BEGIN */";
const end = "/* BUDGETGENIUS_CANARY_RUNTIME_V0_5_END */";
const b0 = html.indexOf(begin);
const b1 = html.indexOf(end);
assert.ok(b0 >= 0 && b1 > b0);
const canarySource = html.slice(b0, b1 + end.length);
ok("C04", "canonical-runtime-contains-executable-v0.5-canary-block");

const computeIndex = html.indexOf("let brokerDecision=computeBrokerRoute(");
const influenceIndex = html.indexOf("brokerDecision=budgetGeniusCanaryRuntimeInfluence", computeIndex);
const providerIndex = html.indexOf("let runProviderRaw=", influenceIndex);
assert.ok(computeIndex >= 0 && influenceIndex > computeIndex && providerIndex > influenceIndex);
ok("C05", "canary-influence-is-wired-after-budgetcompute-before-executor-selection");

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const storage = new MemoryStorage();
const receipts = [];
const events = [];
let discoveredLocal = true;
let operatorApproved = true;
let runCapsuleApproved = true;
let compatible = true;

function fastHash(input) {
  let h = 2166136261;
  for (const ch of String(input)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const context = vm.createContext({
  console,
  crypto: webcrypto,
  TextEncoder,
  Uint8Array,
  localStorage: storage,
  fastHash,
  appendReceipt: (x) => receipts.push(structuredClone(x)),
  phiEventEmit: (name, payload) => events.push({ name, payload: structuredClone(payload) }),
  makeId: (prefix) => prefix + "-fixture-1",
  ollamaModelIsLocal: (model) => discoveredLocal && model === "qwen3:8b",
  brainApprovedModelsState: () => ({ models: operatorApproved ? ["qwen3:8b"] : [] }),
  computeBrokerLocalCompatibility: () => ({ compatible }),
  ACTIVE_RUN_CAPSULE: { approvedModels: ["qwen3:8b"] }
});
vm.runInContext(canarySource, context, { filename: "budgetgenius-canary-v0.5.runtime.js" });

const runtimeInstall = vm.runInContext("budgetGeniusCanaryRuntimeInstall", context);
const runtimeInfluence = vm.runInContext("budgetGeniusCanaryRuntimeInfluence", context);
const runtimeStatus = vm.runInContext("budgetGeniusCanaryRuntimeStatus", context);
const runtimeRevoke = vm.runInContext("budgetGeniusCanaryRuntimeRevoke", context);

const routeId = "ollama::qwen3:8b";
const banker = new bg.BudgetBanker();
banker.createPool({ poolId: "project:spv-canary", limitUsd: 1 });
const ledger = new bg.BudgetLedger();
const mandate = bg.createMandate({
  mandateId: "mandate:bg-live-canary-1",
  objective: "One-shot local BudgetGenius runtime canary",
  poolId: "project:spv-canary",
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
const realBudgetPass = bg.planBudgetPass({
  mandate,
  candidates: [candidate],
  banker,
  ledger
});
assert.equal(realBudgetPass.pass.state, bg.PASS_STATE.RESERVED);
assert.equal(realBudgetPass.pass.selectedRouteId, routeId);
assert.equal(realBudgetPass.pass.reservedUsd, 0);
assert.equal(realBudgetPass.reservation.ok, true);
ok("C06", "real-pinned-budgetgenius-produces-zero-dollar-reserved-budgetpass");

const qualification = Object.freeze({
  qualificationId: "bgq-real-evidence-placeholder",
  disposition: "EMPIRICAL_QUALIFIED_CANDIDATE",
  mayRequestCanaryLease: true,
  activationAllowed: false,
  mayChangeLiveRoute: false,
  authorityGranted: false
});

function approvals() {
  return [
    { role: "OPERATOR", approvalId: "op-1", approverRef: "operator:test" },
    { role: "STEWARD", approvalId: "steward-1", approverRef: "steward:test" },
    { role: "BOARD", approvalId: "board-1", approverRef: "board:test" }
  ];
}

function makeLease(overrides = {}) {
  const now = Date.now();
  const scope = {
    taskClasses: ["code"],
    routeIds: [routeId],
    maxDecisions: 1,
    maxCumulativeShadowSpendUsd: 0,
    maxPerDecisionSpendUsd: 0,
    minOutcomeEvidenceScore: 0.9,
    maxOutcomeLatencyRegressionPct: 0.1,
    ...(overrides.scope ?? {})
  };
  return createCanaryLease({
    qualification,
    leaseId: overrides.leaseId ?? "live-canary-1",
    issuedAt: overrides.issuedAt ?? new Date(now - 1000).toISOString(),
    expiresAt: overrides.expiresAt ?? new Date(now + 120000).toISOString(),
    approvals: overrides.approvals ?? approvals(),
    mandateRef: overrides.mandateRef ?? mandate.mandateId,
    budgetPassRef: overrides.budgetPassRef ?? realBudgetPass.pass.passId,
    scope
  });
}

function baseline(overrides = {}) {
  return {
    id: "broker-baseline-1",
    stage: "builder",
    role: "builder",
    route: "LOCAL",
    provider: "ollama",
    model: "gemma3:12b",
    local: true,
    brokerInitiatedPaid: false,
    requiresPaidApproval: false,
    task: { taskClass: "code", difficultyHint: 55 },
    ...overrides
  };
}

function reset() {
  storage.clear();
  receipts.length = 0;
  events.length = 0;
  discoveredLocal = true;
  operatorApproved = true;
  runCapsuleApproved = true;
  compatible = true;
  context.ACTIVE_RUN_CAPSULE = { approvedModels: ["qwen3:8b"] };
}

reset();
const lease = makeLease();
const armed = await runtimeInstall(lease, realBudgetPass);
assert.equal(armed.status, "ARMED");
assert.equal(armed.candidateModel, "qwen3:8b");
assert.equal(armed.decisionsUsed, 0);
assert.equal(armed.paidSpendCeilingUsd, 0);
assert.equal(armed.executorAuthorizationRequired, true);
assert.equal(armed.authorityGranted, false);
ok("C07", "sha256-valid-v0.4-lease-arms-runtime-only-after-real-budgetpass");

const influenced = runtimeInfluence(baseline(), { needProxy: false, files: [] });
assert.equal(influenced.route, "BUDGETGENIUS_CANARY_LOCAL");
assert.equal(influenced.provider, "ollama");
assert.equal(influenced.model, "qwen3:8b");
assert.equal(influenced.local, true);
assert.equal(influenced.brokerInitiatedPaid, false);
assert.equal(influenced.requiresPaidApproval, false);
assert.equal(influenced.budgetGeniusCanary.executionAuthorized, false);
assert.equal(influenced.budgetGeniusCanary.executorAuthorizationRequired, true);
assert.equal(influenced.budgetGeniusCanary.authorityGranted, false);
assert.equal(influenced.budgetGeniusCanary.paidApprovalGranted, false);
ok("C08", "one-live-route-substitution-occurs-without-execution-or-payment-authority");

assert.equal(runtimeStatus().status, "CONSUMED");
assert.equal(runtimeStatus().decisionsUsed, 1);
const second = runtimeInfluence(baseline({ id: "broker-baseline-2" }), { needProxy: false, files: [] });
assert.equal(second.route, "LOCAL");
assert.equal(second.model, "gemma3:12b");
ok("C09", "one-shot-canary-consumes-itself-and-restores-normal-routing");

reset();
await runtimeInstall(makeLease({ leaseId: "proxy-test" }), realBudgetPass);
const proxy = runtimeInfluence(baseline(), { needProxy: true, files: [] });
assert.equal(proxy.route, "LOCAL");
assert.equal(runtimeStatus().status, "ARMED");
ok("C10", "proxy-and-tool-paths-are-never-canary-influenced");

reset();
await runtimeInstall(makeLease({ leaseId: "stage-test" }), realBudgetPass);
const wrongStage = runtimeInfluence(baseline({ stage: "dreamer" }), { needProxy: false, files: [] });
assert.equal(wrongStage.route, "LOCAL");
assert.equal(runtimeStatus().status, "ARMED");
ok("C11", "live-canary-is-builder-stage-only");

reset();
await runtimeInstall(makeLease({ leaseId: "task-test" }), realBudgetPass);
const wrongTask = runtimeInfluence(baseline({ task: { taskClass: "research" } }), { needProxy: false, files: [] });
assert.equal(wrongTask.route, "LOCAL");
assert.equal(runtimeStatus().status, "ARMED");
ok("C12", "live-canary-is-code-task-only");

reset();
context.ACTIVE_RUN_CAPSULE = { approvedModels: [] };
await runtimeInstall(makeLease({ leaseId: "capsule-test" }), realBudgetPass);
const capsuleDenied = runtimeInfluence(baseline(), { needProxy: false, files: [] });
assert.equal(capsuleDenied.route, "LOCAL");
assert.equal(runtimeStatus().status, "ROLLBACK_REQUIRED");
assert.equal(runtimeStatus().rollbackReason, "RUN_CAPSULE_MODEL_NOT_APPROVED");
ok("C13", "frozen-run-capsule-remains-a-hard-model-veto");

reset();
compatible = false;
await runtimeInstall(makeLease({ leaseId: "compat-test" }), realBudgetPass);
const incompatible = runtimeInfluence(baseline(), { needProxy: false, files: [] });
assert.equal(incompatible.route, "LOCAL");
assert.equal(runtimeStatus().status, "ROLLBACK_REQUIRED");
assert.equal(runtimeStatus().rollbackReason, "CANDIDATE_NOT_COMPATIBLE");
ok("C14", "existing-local-compatibility-gate-remains-a-hard-veto");

reset();
operatorApproved = false;
await assert.rejects(() => runtimeInstall(makeLease({ leaseId: "pool-test" }), realBudgetPass), /CANARY_MODEL_OUTSIDE_OPERATOR_APPROVED_POOL/);
ok("C15", "operator-approved-model-pool-is-required-at-install-time");

reset();
discoveredLocal = false;
await assert.rejects(() => runtimeInstall(makeLease({ leaseId: "local-test" }), realBudgetPass), /CANARY_LOCAL_MODEL_NOT_DISCOVERED/);
ok("C16", "live-canary-refuses-nonlocal-or-undiscovered-models");

reset();
const tamperedLease = { ...makeLease({ leaseId: "tamper-test" }), expiresAt: new Date(Date.now() + 240000).toISOString() };
await assert.rejects(() => runtimeInstall(tamperedLease, realBudgetPass), /CANARY_LEASE_SHA256_MISMATCH/);
ok("C17", "runtime-recomputes-and-verifies-v0.4-lease-sha256");

reset();
const sixMinuteLease = makeLease({
  leaseId: "duration-test",
  issuedAt: new Date(Date.now() - 1000).toISOString(),
  expiresAt: new Date(Date.now() + 359000).toISOString()
});
await assert.rejects(() => runtimeInstall(sixMinuteLease, realBudgetPass), /CANARY_LIVE_DURATION_EXCEEDS_5_MINUTES/);
ok("C18", "live-runtime-tightens-v0.4-duration-to-five-minutes");

reset();
const expiredLease = makeLease({
  leaseId: "expired-test",
  issuedAt: new Date(Date.now() - 240000).toISOString(),
  expiresAt: new Date(Date.now() - 1000).toISOString()
});
await assert.rejects(() => runtimeInstall(expiredLease, realBudgetPass), /CANARY_LEASE_ALREADY_EXPIRED/);
ok("C19", "expired-lease-cannot-arm-the-runtime");

reset();
const twoDecisionLease = makeLease({ leaseId: "decision-test", scope: { maxDecisions: 2 } });
await assert.rejects(() => runtimeInstall(twoDecisionLease, realBudgetPass), /CANARY_LIVE_DECISION_LIMIT_MUST_BE_ONE/);
ok("C20", "live-runtime-tightens-v0.4-to-one-decision");

reset();
const paidLease = makeLease({
  leaseId: "paid-test",
  scope: { maxCumulativeShadowSpendUsd: 0.01, maxPerDecisionSpendUsd: 0.01 }
});
await assert.rejects(() => runtimeInstall(paidLease, realBudgetPass), /CANARY_LIVE_PAID_SPEND_MUST_BE_ZERO/);
ok("C21", "first-live-canary-cannot-spend-paid-provider-credits");

reset();
const wrongPassId = {
  ...realBudgetPass,
  pass: { ...realBudgetPass.pass, passId: "wrong-pass-id" }
};
await assert.rejects(() => runtimeInstall(makeLease({ leaseId: "pass-id-test" }), wrongPassId), /CANARY_BUDGETPASS_NOT_RESERVED_FOR_EXACT_ROUTE/);
ok("C22", "runtime-binds-to-the-exact-budgetpass-id");

reset();
const wrongMandatePass = {
  ...realBudgetPass,
  pass: { ...realBudgetPass.pass, mandateId: "other-mandate" }
};
await assert.rejects(() => runtimeInstall(makeLease({ leaseId: "mandate-test" }), wrongMandatePass), /CANARY_BUDGETPASS_NOT_RESERVED_FOR_EXACT_ROUTE/);
ok("C23", "runtime-binds-budgetpass-to-the-exact-cognitive-mandate");

reset();
const wrongRoutePass = {
  ...realBudgetPass,
  pass: { ...realBudgetPass.pass, selectedRouteId: "ollama::other-model" }
};
await assert.rejects(() => runtimeInstall(makeLease({ leaseId: "route-pass-test" }), wrongRoutePass), /CANARY_BUDGETPASS_NOT_RESERVED_FOR_EXACT_ROUTE/);
ok("C24", "runtime-binds-budgetpass-to-the-exact-local-route");

reset();
await runtimeInstall(makeLease({ leaseId: "revoke-test" }), realBudgetPass);
runtimeRevoke("OPERATOR_TEST_REVOCATION");
const revoked = runtimeInfluence(baseline(), { needProxy: false, files: [] });
assert.equal(revoked.route, "LOCAL");
assert.equal(runtimeStatus().status, "REVOKED");
ok("C25", "explicit-revocation-restores-baseline-before-route-influence");

reset();
await runtimeInstall(makeLease({ leaseId: "snapshot-tamper-test" }), realBudgetPass);
const raw = JSON.parse(storage.getItem("pv_budgetgenius_canary_v05"));
raw.candidateModel = "evil:model";
storage.setItem("pv_budgetgenius_canary_v05", JSON.stringify(raw));
assert.equal(runtimeStatus(), null);
assert.equal(storage.getItem("pv_budgetgenius_canary_v05"), null);
assert.ok(receipts.some((r) => r.reason === "RUNTIME_SNAPSHOT_TAMPER"));
ok("C26", "runtime-snapshot-tamper-fails-closed-and-removes-state");

assert.ok(receipts.length >= 1);
assert.ok(events.length === 0 || events.every((e) => e.name === "budgetgenius.canary_route_influenced"));
assert.ok(html.includes("authorizeExecutor(ACTIVE_RUN_CAPSULE"));
ok("C27", "canary-receipts-coexist-with-unchanged-downstream-executor-authorization");

console.log("BudgetGenius live canary seam v0.5: PASS (" + passed + "/27)");
console.log("NOTE v0.5 is default-off and requires an externally issued empirical v0.4 lease plus a real RESERVED BudgetPass.");
