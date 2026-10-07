import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  mapDlamContextPacketToBudgetPacket,
  mapP3ObservationToCalibrationSample,
  mapSparseFrontierToGrantRequest
} from "./bridge.mjs";

const budgetGeniusRoot = process.env.BUDGETGENIUS_ROOT;
if (!budgetGeniusRoot) throw new Error("BUDGETGENIUS_ROOT is required");

const bg = await import(pathToFileURL(resolve(budgetGeniusRoot, "src/index.js")).href);

let pass = 0;
function ok(id, name) {
  pass += 1;
  console.log(`PASS ${id} ${name}`);
}

const contextPacket = {
  schema_version: "1",
  schema: "superphivessel.dlam.context-packet.v0.1",
  packet_id: "ctx_bridge_001",
  packet_hash: "sha256:ctx",
  task_id: "task-bridge",
  namespace_id: "project:bridge",
  agent_id: "vessie",
  genius_profile_ref: "ga108:001",
  model_ref: "ollama:test-model",
  purpose: "research",
  target_surface: "brainc",
  policy_epoch: 7,
  authority_decision_ref: "auth:bridge:1",
  authority_status: "CURRENT",
  ledger_frontier_ref: "ledger:frontier:7",
  index_manifest_ref: "fts5:project:bridge:7",
  router_snapshot_ref: "router:static:1",
  memory_budget_tokens: 2048,
  used_memory_tokens: 182,
  disposition: "READY",
  items: [
    {
      memory_id: "mem-1",
      role: "PRIMARY",
      kind: "FACT",
      origin: "OBSERVED",
      source_status: "ACTIVE",
      content: "BudgetGenius bridge fixture.",
      content_sha256: "abc",
      admitted_event_id: "evt-1",
      admitted_sequence: 1,
      links: { contradicts: [], evidence: [], derivation_parents: [] }
    },
    {
      memory_id: "mem-2",
      role: "PROVENANCE",
      kind: "EVIDENCE",
      origin: "VERIFIED",
      source_status: "ACTIVE",
      content: "Independent supporting evidence.",
      content_sha256: "def",
      admitted_event_id: "evt-2",
      admitted_sequence: 2,
      links: { contradicts: [], evidence: [], derivation_parents: ["mem-1"] }
    }
  ],
  action_authority: "NONE"
};

const packetInput = mapDlamContextPacketToBudgetPacket({
  contextPacket,
  taskClass: "research",
  effectClass: bg.EFFECT_CLASS.READ
});
const budgetPacket = bg.createBudgetPacket(packetInput);
assert.equal(budgetPacket.scope.authorityScope.length, 0);
assert.equal(budgetPacket.metadata.actionAuthority, "NONE");
assert.equal(budgetPacket.segments[0].class, bg.SEGMENT_CLASS.LOCKED);
assert.deepEqual(
  budgetPacket.segments.slice(1).map((segment) => segment.class),
  [bg.SEGMENT_CLASS.LOSSLESS, bg.SEGMENT_CLASS.LOSSLESS]
);
ok("C01", "dlam-context-maps-to-governed-budgetpacket");

const exactCache = new bg.GovernedExactCache();
assert.equal(exactCache.put({ packet: budgetPacket, value: { answer: "cached" } }).stored, true);
assert.equal(exactCache.get({ packet: budgetPacket }).hit, true);
const changedFreshness = bg.createBudgetPacket({
  ...packetInput,
  packetId: "ctx_bridge_002",
  scope: {
    ...packetInput.scope,
    freshnessEpoch: "policy:8|ledger:ledger:frontier:8"
  }
});
assert.equal(exactCache.get({ packet: changedFreshness }).hit, false);
ok("C02", "cache-remains-bound-to-dlam-freshness-frontier");

assert.throws(
  () => mapDlamContextPacketToBudgetPacket({
    contextPacket: { ...contextPacket, action_authority: "EXECUTE" },
    taskClass: "research"
  }),
  /AUTHORITY_PROMOTION/
);
ok("C03", "bridge-cannot-promote-dlam-action-authority");

const observation = {
  schema: "superphivessel.dlam.p3a.v0.1",
  route_decision_id: "route-decision-1",
  task_id: "task-bridge",
  task_class: "research",
  profile_ref: "ga108:001",
  model_ref: "ollama:test-model",
  success: true,
  quality_score: 0.98,
  predicted_confidence: 0.95,
  brier_score: 0.0025,
  evidence_satisfied: true,
  governance_violation: false,
  critical_miss: false,
  outcome_source_refs: ["receipt:1"],
  learning_mode: "SHADOW_OBSERVATION_ONLY",
  may_change_live_route: false,
  authority_granted: false
};

const sample = mapP3ObservationToCalibrationSample({
  observation,
  auditReceipt: {
    outcomeVerified: true,
    totalCausalCostUsd: 0.012
  },
  routeId: "ga108:001|ollama:test-model",
  effectClass: bg.EFFECT_CLASS.READ,
  riskClass: bg.RISK_CLASS.NORMAL,
  verifierProfile: "spv-reality-gate-candidate",
  contextBand: "small",
  runtimeFamily: "local"
});

const book = new bg.RouteCalibrationBook();
const contextKey = bg.buildContextKey(sample.context);
for (let i = 0; i < 60; i += 1) {
  book.record({
    contextKey,
    routeId: sample.routeId,
    ok: sample.ok,
    totalCausalCostUsd: sample.totalCausalCostUsd,
    metadata: sample.metadata
  });
}
const mandate = bg.createMandate({
  mandateId: "CM-BRIDGE-1",
  objective: "Exercise cross-repo route calibration",
  poolId: "project:bridge",
  qualityFloor: 0.9,
  evidenceFloor: 0.9,
  maxRiskScore: 0.2,
  maxCostUsd: 1,
  authority: [],
  effectClass: bg.EFFECT_CLASS.READ,
  riskClass: bg.RISK_CLASS.NORMAL
});
const recommendation = bg.recommendLearnedRoute({
  calibrationBook: book,
  contextKey,
  mandate,
  minSamples: 20,
  candidateRoutes: [{
    routeId: sample.routeId,
    evidenceScore: 0.98,
    riskScore: 0.05,
    requiredAuthority: []
  }]
});
assert.equal(recommendation.selected.routeId, sample.routeId);
ok("C04", "verified-p3-outcomes-feed-budgetgenius-calibration");

assert.throws(
  () => mapP3ObservationToCalibrationSample({
    observation,
    auditReceipt: { outcomeVerified: false, totalCausalCostUsd: 0.001 },
    routeId: sample.routeId,
    effectClass: bg.EFFECT_CLASS.READ,
    riskClass: bg.RISK_CLASS.NORMAL
  }),
  /AUDIT_OUTCOME_NOT_VERIFIED/
);
ok("C05", "unverified-outcomes-cannot-train-economic-route-policy");

const decision = {
  schema: "superphivessel.sparse-frontier.v0.1",
  policy_version: "sfr-static-policy-v0.1",
  candidate_id: "candidate-1",
  task_id: "task-bridge",
  disposition: "ESCALATE_INVESTIGATION",
  escalated: true,
  frontier_score: 0.81,
  features: { uncertainty: 0.7 },
  authority_decision_ref: "auth:bridge:1",
  authority_status: "CURRENT",
  authority_granted: false,
  threshold_learning_active: false
};
const escalationContext = {
  schema: "superphivessel.sfr.escalation-context.v0.1",
  task_id: "task-bridge",
  candidate_id: "candidate-1",
  trigger: ["MISSING_EVIDENCE_HIGH_CONSEQUENCE"],
  bounded_region: {
    memory_refs: ["mem-1"],
    evidence_refs: ["receipt:1"],
    state_changes: []
  },
  cheap_layer_prediction: { answer: "uncertain" },
  cheap_layer_confidence: 0.3,
  signals: { consequence: 0.9 },
  authority_decision_ref: "auth:bridge:1",
  authority_status: "CURRENT",
  frontier_role: "INVESTIGATOR_ADVISOR",
  recommended_geniuses: [
    { profile_ref: "ga108:001", authority: "NONE" }
  ],
  token_budget: 4096,
  action_authority: "NONE"
};

const grantRequest = mapSparseFrontierToGrantRequest({ decision, escalationContext });
assert.equal(grantRequest.actionAuthority, "NONE");
assert.deepEqual(grantRequest.recommendedGeniusRefs, ["ga108:001"]);
assert.equal(grantRequest.frontierTokenBudget, 4096);

const grant = bg.createCognitiveGrant({
  grantId: "CG-BRIDGE-1",
  objective: grantRequest.objective,
  poolId: "project:bridge",
  maxCostUsd: 0.15,
  contingencyUsd: 0.05,
  stages: [
    { stageId: "investigate", maxCostUsd: 0.06 },
    { stageId: "verify", maxCostUsd: 0.03 }
  ],
  scope: {
    taskId: grantRequest.taskId,
    candidateId: grantRequest.candidateId,
    recommendedGeniusRefs: grantRequest.recommendedGeniusRefs,
    authorityDecisionRef: grantRequest.authorityDecisionRef,
    actionAuthority: grantRequest.actionAuthority
  }
});
assert.equal(grant.contingencyUsd, 0.05);
assert.equal(grant.scope.actionAuthority, "NONE");
ok("C06", "sparse-frontier-escalation-becomes-bounded-cognitive-grant-request");

const snapshot = bg.compilePolicySnapshot({
  snapshotId: "PS-BRIDGE-1",
  issuedAt: "2026-10-07T20:45:00Z",
  constitutionVersion: bg.CONSTITUTION_VERSION,
  boardPolicyVersion: "spv-bridge-0.1",
  operatingPolicyVersion: "budgetgenius-0.6",
  qualificationVersion: 0,
  priceTableVersion: null,
  directives: {
    dlamContextAuthority: "NONE",
    p3LearningMode: "SHADOW_OBSERVATION_ONLY",
    sparseFrontierAuthority: "NONE"
  },
  precedents: []
});
const signed = bg.signPolicySnapshot(snapshot, {
  keyId: "acceptance-only",
  secret: "fixture-secret-not-runtime-material"
});
assert.equal(bg.verifySignedPolicySnapshot(signed, {
  secret: "fixture-secret-not-runtime-material"
}), true);
ok("C07", "compiled-policy-snapshot-survives-cross-repo-sign-verify");

console.log(`BudgetGenius bridge v0.1: PASS (${pass}/7)`);
