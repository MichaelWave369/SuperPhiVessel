import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  mapRunCapsuleToEconomicPolicy,
  mapCreditSnapshotToEnvelope,
  buildConservativePriceTableInput,
  mapGpuRuntimeStateToResidencyEntries,
  mapComputeBrokerDecisionToShadowRoute,
  mapP4ShadowPlanToAdvisorySignal,
  createShadowEconomicReceipt
} from "./runtime-bridge.mjs";

const budgetGeniusRoot = process.env.BUDGETGENIUS_ROOT;
if (!budgetGeniusRoot) throw new Error("BUDGETGENIUS_ROOT is required");
const bg = await import(pathToFileURL(resolve(budgetGeniusRoot, "src/index.js")).href);

let passed = 0;
function ok(id, name) {
  passed += 1;
  console.log(`PASS ${id} ${name}`);
}

const manifest = JSON.parse(readFileSync("runtime/MANIFEST.json", "utf8"));
const runtimeSource = readFileSync(manifest.runtime.path, "utf8");
for (const marker of [
  "const BUDGET_COMPUTE_VERSION='1.0';",
  "function computeBrokerRoute(opts)",
  "function creditSnapshot()",
  "function gpuRuntimeState()",
  "function frozenRunCapsule(opts)",
  "function executorAuthorizationDecision(capsule,req)"
]) {
  assert.ok(runtimeSource.includes(marker), `canonical runtime seam missing: ${marker}`);
}
ok("C00", "canonical-runtime-exposes-pinned-economic-and-authorization-seams");

const runCapsule = {
  receiptType: "PhiRunCapsule",
  version: "1.0.0",
  id: "run-1",
  hash: "hash-run-1",
  executionPolicy: "MANUAL",
  paidFallbackMode: "CONFIRM",
  budgetCeilingUsd: 0.25,
  activeProvider: "openai",
  approvedModels: ["qwen3:8b"]
};
const economicPolicy = mapRunCapsuleToEconomicPolicy(runCapsule);
assert.equal(economicPolicy.mayDispatch, false);
assert.equal(economicPolicy.executorAuthorizationRequired, true);
assert.equal(economicPolicy.authority, "NONE");
assert.equal(economicPolicy.paidFallbackMode, "CONFIRM");
ok("C01", "run-capsule-maps-to-economic-policy-not-execution-authority");

const creditEnvelope = mapCreditSnapshotToEnvelope({
  id: "credit-1",
  reservedUsd: 0.07,
  ceilingUsd: 0.25,
  policy: "MANUAL"
});
assert.equal(creditEnvelope.availableUsd, 0.18);
assert.equal(creditEnvelope.reservationAuthority, "SUPERPHIVESSEL_CREDIT_GOVERNOR");
assert.equal(creditEnvelope.budgetGeniusReservationAuthority, "NONE");

const noCeiling = mapCreditSnapshotToEnvelope({
  id: "credit-2",
  reservedUsd: 0,
  ceilingUsd: 0,
  policy: "MANUAL"
});
assert.equal(noCeiling.status, "NO_HARD_CEILING");
assert.equal(noCeiling.availableUsd, null);
ok("C02", "credit-governor-remains-single-paid-reservation-authority");

const priceInput = buildConservativePriceTableInput({
  version: "spv-credit-fixture-1",
  effectiveAt: "2026-10-07T21:15:00Z",
  providerRates: {
    openai: { input: 1.25, output: 10.0 }
  },
  candidateModels: [
    { providerId: "openai", modelId: "frontier-fixture", local: false }
  ]
});
assert.equal(priceInput.entries[0].cachedInputUsdPer1M, priceInput.entries[0].inputUsdPer1M);
assert.equal(priceInput.source.cacheDiscountProven, false);
const prices = bg.createPriceTable(priceInput);
const quoted = bg.quoteTokenCost({
  priceTable: prices,
  providerId: "openai",
  modelId: "frontier-fixture",
  inputTokens: 10_000,
  cachedInputTokens: 10_000,
  outputTokens: 1_000
});
assert.equal(quoted.costUsd, 0.0225);
ok("C03", "provider-rates-map-conservatively-without-phantom-cache-discount");

const gpuState = {
  version: "PV-GPU-0.1",
  status: "OK",
  models: {
    "qwen3:8b": {
      loaded: true,
      sizeBytes: 8 * 1024 ** 3,
      vramBytes: 7.8 * 1024 ** 3,
      gpuResidentPct: 98
    },
    "too-big:30b": {
      loaded: true,
      sizeBytes: 18 * 1024 ** 3,
      vramBytes: 7 * 1024 ** 3,
      gpuResidentPct: 39
    }
  }
};
const residencyEntries = mapGpuRuntimeStateToResidencyEntries(gpuState);
assert.equal(residencyEntries.length, 2);
assert.equal(residencyEntries.find((x) => x.modelId === "qwen3:8b").gpuFit, true);
assert.equal(residencyEntries.find((x) => x.modelId === "too-big:30b").gpuFit, false);

const gpuRegistry = new bg.GpuResidencyRegistry();
for (const entry of residencyEntries) {
  gpuRegistry.set(entry.modelId, {
    resident: entry.resident,
    gpuFit: entry.gpuFit,
    loadMs: entry.loadMs,
    evictionMs: entry.evictionMs,
    vramGb: entry.vramGb
  });
}
assert.equal(bg.quoteGpuResidency({
  registry: gpuRegistry,
  modelId: "qwen3:8b"
}).resident, true);
ok("C04", "measured-pv-gpu-state-feeds-budgetgenius-residency");

const localDecision = {
  version: "1.0",
  executionLocusGuardVersion: "PV-ELG-0.1",
  id: "broker-local",
  mode: "LOCAL_FIRST",
  paidMode: "CONFIRM",
  route: "LOCAL",
  provider: "ollama",
  model: "qwen3:8b",
  local: true,
  requiresPaidApproval: false,
  task: {
    taskClass: "code",
    difficultyHint: 68,
    totalEstimatedInputTokens: 8_000
  },
  reason: "LOCAL_FIRST prefers abundant local compute"
};

const missingCalibration = mapComputeBrokerDecisionToShadowRoute({
  decision: localDecision,
  empiricalStats: null,
  evidenceScore: 0.95,
  riskScore: 0.05,
  outputTokens: 1_000
});
assert.equal(missingCalibration.successProbability, undefined);
assert.equal(missingCalibration.metadata.difficultyHint, 68);
assert.equal(missingCalibration.metadata.difficultyIsQualityScore, false);
ok("C05", "budgetcompute-difficulty-never-masquerades-as-quality");

const localRoute = mapComputeBrokerDecisionToShadowRoute({
  decision: localDecision,
  empiricalStats: { wilsonLowerBound: 0.97 },
  evidenceScore: 0.95,
  riskScore: 0.05,
  outputTokens: 1_000
});

const remoteDecision = {
  ...localDecision,
  id: "broker-remote-shadow",
  mode: "COST_AWARE",
  route: "REMOTE_GATED",
  provider: "openai",
  model: "frontier-fixture",
  remoteProvider: "openai",
  local: false,
  requiresPaidApproval: true,
  task: {
    ...localDecision.task,
    difficultyHint: 88
  },
  reason: "shadow alternative only"
};
const remoteRoute = mapComputeBrokerDecisionToShadowRoute({
  decision: remoteDecision,
  empiricalStats: { wilsonLowerBound: 0.99 },
  evidenceScore: 0.99,
  riskScore: 0.03,
  outputTokens: 1_000
});

const mandate = bg.createMandate({
  mandateId: "CM-SPV-SHADOW-1",
  objective: "Shadow compare allowed SPV runtime routes",
  poolId: "project:spv",
  qualityFloor: 0.95,
  evidenceFloor: 0.9,
  maxRiskScore: 0.2,
  maxCostUsd: 0.25,
  authority: [],
  effectClass: bg.EFFECT_CLASS.READ,
  riskClass: bg.RISK_CLASS.NORMAL
});

const comparison = bg.selectRuntimeRoute({
  routes: [localRoute, remoteRoute],
  mandate,
  priceTable: prices,
  gpuRegistry,
  policy: {
    movementUsdPerSecond: 0.002,
    latencyUsdPerSecond: 0,
    spillThresholdMs: 100_000
  },
  runtime: { expectedWaitMs: 0 }
});
assert.equal(comparison.selected.route.routeId, localRoute.routeId);
assert.equal(comparison.selected.providerCostUsd, 0);
assert.ok(comparison.quotes.find((x) => x.route.routeId === remoteRoute.routeId).providerCostUsd > 0);
ok("C06", "budgetgenius-can-shadow-compare-empirically-qualified-runtime-routes");

const p4Plan = {
  schema: "superphivessel.dlam.p4a.shadow-plan.v0.1",
  disposition: "SHADOW_RECOMMENDATION",
  snapshot_id: "p4-snapshot-1",
  task_class: "code",
  profile_shortlist: ["ga108:001"],
  route_candidates: [{ route_key: "ga108:001|qwen3:8b", ucb: 0.91 }],
  shadow_selected_route: { route_key: "ga108:001|qwen3:8b" },
  selection_is_live: false,
  may_activate_genius: false,
  authority_granted: false
};
const p4Signal = mapP4ShadowPlanToAdvisorySignal(p4Plan);
assert.equal(p4Signal.advisoryOnly, true);
assert.equal(p4Signal.mayChangeLiveRoute, false);
assert.equal(p4Signal.authorityGranted, false);
assert.throws(
  () => mapP4ShadowPlanToAdvisorySignal({ ...p4Plan, selection_is_live: true }),
  /P4_SELECTION_BECAME_LIVE/
);
ok("C07", "p4-learned-routing-remains-advisory-through-economic-bridge");

const receipt = createShadowEconomicReceipt({
  receiptId: "bg-shadow-1",
  brokerDecision: localDecision,
  budgetGeniusSelection: comparison,
  quotes: comparison.quotes.map((quote) => ({
    routeId: quote.route.routeId,
    runtimeEligible: quote.runtimeEligible,
    providerCostUsd: quote.providerCostUsd,
    effectiveEconomicCostUsd: quote.effectiveEconomicCostUsd,
    rejectionReasons: quote.qualification.reasons
  })),
  p4Signal
});
assert.equal(receipt.selectionIsLive, false);
assert.equal(receipt.mayChangeLiveRoute, false);
assert.equal(receipt.authorityGranted, false);
assert.equal(receipt.actionAuthority, "NONE");
assert.equal(receipt.executorAuthorizationRequired, true);
ok("C08", "shadow-economic-receipt-cannot-change-live-route");

console.log(`BudgetGenius runtime bridge v0.2: PASS (${passed}/9)`);
