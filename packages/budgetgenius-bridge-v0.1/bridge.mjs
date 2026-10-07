const ALLOWED_EFFECTS = new Set(["PURE", "READ", "PROPOSE", "MUTATE", "IRREVERSIBLE"]);

export function mapDlamContextPacketToBudgetPacket({
  contextPacket,
  taskClass,
  effectClass = "READ",
  dataClassification = "internal",
  tenantId = "superphivessel"
}) {
  requireObject("contextPacket", contextPacket);
  requireString("taskClass", taskClass);
  if (!ALLOWED_EFFECTS.has(effectClass)) throw new Error("invalid BudgetGenius effectClass");

  if (contextPacket.schema_version !== "1") throw new Error("unsupported DLAM context schema_version");
  if (contextPacket.action_authority !== "NONE") throw new Error("DLAM_CONTEXT_AUTHORITY_PROMOTION");
  if (contextPacket.authority_status != null && contextPacket.authority_status !== "CURRENT") {
    throw new Error("DLAM_CONTEXT_AUTHORITY_NOT_CURRENT");
  }
  if (contextPacket.disposition != null && contextPacket.disposition !== "READY") {
    throw new Error(`DLAM_CONTEXT_NOT_READY:${contextPacket.disposition}`);
  }

  for (const key of [
    "packet_id",
    "task_id",
    "namespace_id",
    "agent_id",
    "model_ref",
    "purpose",
    "target_surface",
    "authority_decision_ref",
    "ledger_frontier_ref"
  ]) requireString(`contextPacket.${key}`, contextPacket[key]);

  if (!Number.isInteger(contextPacket.policy_epoch) || contextPacket.policy_epoch < 0) {
    throw new TypeError("contextPacket.policy_epoch must be a non-negative integer");
  }
  if (!Number.isInteger(contextPacket.memory_budget_tokens) || contextPacket.memory_budget_tokens < 0) {
    throw new TypeError("contextPacket.memory_budget_tokens must be a non-negative integer");
  }
  if (!Array.isArray(contextPacket.items)) throw new TypeError("contextPacket.items must be an array");

  const segments = [{
    segmentId: "governance:pv-dlam",
    class: "LOCKED",
    content: {
      policyEpoch: contextPacket.policy_epoch,
      authorityDecisionRef: contextPacket.authority_decision_ref,
      actionAuthority: "NONE",
      ledgerFrontierRef: contextPacket.ledger_frontier_ref,
      indexManifestRef: contextPacket.index_manifest_ref ?? null,
      routerSnapshotRef: contextPacket.router_snapshot_ref ?? null,
      modelRef: contextPacket.model_ref,
      targetSurface: contextPacket.target_surface
    }
  }];

  for (const item of contextPacket.items) {
    requireObject("context item", item);
    requireString("context item.memory_id", item.memory_id);
    if (item.content == null) throw new TypeError(`context item ${item.memory_id} has no content`);
    segments.push({
      segmentId: `memory:${item.memory_id}`,
      class: "LOSSLESS",
      content: structuredClone(item),
      metadata: {
        source: "PV-DLAM",
        memoryId: item.memory_id,
        origin: item.origin ?? null,
        sourceStatus: item.source_status ?? null,
        contentSha256: item.content_sha256 ?? null,
        admittedEventId: item.admitted_event_id ?? null,
        admittedSequence: item.admitted_sequence ?? null
      }
    });
  }

  return Object.freeze({
    packetId: contextPacket.packet_id,
    taskClass,
    effectClass,
    scope: Object.freeze({
      tenantId,
      projectId: contextPacket.namespace_id,
      authorityScope: Object.freeze([]),
      dataClassification,
      purpose: contextPacket.purpose,
      freshnessEpoch: `policy:${contextPacket.policy_epoch}|ledger:${contextPacket.ledger_frontier_ref}`,
      environmentFingerprint: [
        `model:${contextPacket.model_ref}`,
        `surface:${contextPacket.target_surface}`,
        `index:${contextPacket.index_manifest_ref ?? "none"}`
      ].join("|")
    }),
    segments: Object.freeze(segments.map((segment) => Object.freeze(segment))),
    tools: Object.freeze([]),
    metadata: Object.freeze({
      sourceSchema: contextPacket.schema ?? "superphivessel.dlam.context-packet.v0.1",
      taskId: contextPacket.task_id,
      agentId: contextPacket.agent_id,
      geniusProfileRef: contextPacket.genius_profile_ref ?? null,
      authorityDecisionRef: contextPacket.authority_decision_ref,
      actionAuthority: "NONE",
      memoryBudgetTokens: contextPacket.memory_budget_tokens,
      usedMemoryTokens: contextPacket.used_memory_tokens ?? null,
      packetHash: contextPacket.packet_hash ?? null
    })
  });
}

export function mapP3ObservationToCalibrationSample({
  observation,
  auditReceipt,
  routeId,
  effectClass,
  riskClass,
  verifierProfile = "spv-p3",
  contextBand = "default",
  runtimeFamily = "superphivessel"
}) {
  requireObject("observation", observation);
  requireObject("auditReceipt", auditReceipt);
  requireString("routeId", routeId);
  requireString("effectClass", effectClass);
  requireString("riskClass", riskClass);

  if (observation.schema !== "superphivessel.dlam.p3a.v0.1") {
    throw new Error("unsupported P3 observation schema");
  }
  if (observation.learning_mode !== "SHADOW_OBSERVATION_ONLY") {
    throw new Error("P3_OBSERVATION_NOT_SHADOW_ONLY");
  }
  if (observation.may_change_live_route !== false) {
    throw new Error("P3_OBSERVATION_MAY_CHANGE_LIVE_ROUTE");
  }
  if (observation.authority_granted !== false) {
    throw new Error("P3_OBSERVATION_AUTHORITY_PROMOTION");
  }
  if (auditReceipt.outcomeVerified !== true) {
    throw new Error("AUDIT_OUTCOME_NOT_VERIFIED");
  }
  if (!Number.isFinite(auditReceipt.totalCausalCostUsd) || auditReceipt.totalCausalCostUsd < 0) {
    throw new TypeError("auditReceipt.totalCausalCostUsd must be non-negative");
  }

  const ok =
    observation.success === true &&
    observation.evidence_satisfied === true &&
    observation.governance_violation === false &&
    observation.critical_miss === false;

  return Object.freeze({
    context: Object.freeze({
      taskClass: observation.task_class,
      effectClass,
      riskClass,
      verifierProfile,
      contextBand,
      runtimeFamily
    }),
    routeId,
    ok,
    totalCausalCostUsd: auditReceipt.totalCausalCostUsd,
    metadata: Object.freeze({
      routeDecisionId: observation.route_decision_id,
      taskId: observation.task_id,
      profileRef: observation.profile_ref,
      modelRef: observation.model_ref,
      qualityScore: observation.quality_score,
      predictedConfidence: observation.predicted_confidence,
      brierScore: observation.brier_score,
      evidenceSatisfied: observation.evidence_satisfied,
      governanceViolation: observation.governance_violation,
      criticalMiss: observation.critical_miss,
      outcomeSourceRefs: Object.freeze([...(observation.outcome_source_refs ?? [])]),
      authorityGranted: false
    })
  });
}

export function mapSparseFrontierToGrantRequest({
  decision,
  escalationContext
}) {
  requireObject("decision", decision);

  if (decision.schema !== "superphivessel.sparse-frontier.v0.1") {
    throw new Error("unsupported Sparse Frontier decision schema");
  }
  if (decision.authority_granted !== false) throw new Error("SFR_AUTHORITY_PROMOTION");
  if (decision.threshold_learning_active !== false) throw new Error("SFR_LIVE_THRESHOLD_LEARNING_ACTIVE");

  if (!decision.escalated || decision.disposition !== "ESCALATE_INVESTIGATION") {
    return null;
  }

  requireObject("escalationContext", escalationContext);
  if (escalationContext.schema !== "superphivessel.sfr.escalation-context.v0.1") {
    throw new Error("unsupported Sparse Frontier escalation schema");
  }
  if (escalationContext.task_id !== decision.task_id || escalationContext.candidate_id !== decision.candidate_id) {
    throw new Error("SFR_DECISION_CONTEXT_MISMATCH");
  }
  if (escalationContext.action_authority !== "NONE") throw new Error("SFR_CONTEXT_AUTHORITY_PROMOTION");
  if (decision.authority_status !== "CURRENT" || escalationContext.authority_status !== "CURRENT") {
    throw new Error("SFR_AUTHORITY_NOT_CURRENT");
  }

  return Object.freeze({
    kind: "BUDGETGENIUS_COGNITIVE_GRANT_REQUEST",
    taskId: decision.task_id,
    candidateId: decision.candidate_id,
    objective: `Investigate Sparse Frontier escalation for task ${decision.task_id}`,
    trigger: Object.freeze([...(escalationContext.trigger ?? [])]),
    boundedRegion: Object.freeze(structuredClone(escalationContext.bounded_region ?? {})),
    recommendedGeniusRefs: Object.freeze(
      (escalationContext.recommended_geniuses ?? [])
        .map((item) => item?.profile_ref)
        .filter((value) => typeof value === "string" && value)
    ),
    frontierTokenBudget: escalationContext.token_budget,
    authorityDecisionRef: decision.authority_decision_ref,
    authorityStatus: "CURRENT",
    actionAuthority: "NONE",
    source: Object.freeze({
      decisionSchema: decision.schema,
      policyVersion: decision.policy_version,
      frontierScore: decision.frontier_score
    })
  });
}

function requireObject(name, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function requireString(name, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} is required`);
  }
}
