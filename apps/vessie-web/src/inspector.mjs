const MAX_BYTES = 131072;
const KNOWN = new Set([
  'superphivessel.dlam.route-decision.p1c.v0.1',
  'superphivessel.gateway.r3a.routing-trace.v0.1',
  'superphivessel.gateway.r3b.brainc-configuration.v0.1',
  'superphivessel.gateway.r3c.canonical-route-evidence.v0.1',
  'superphivessel.dlam.p3a.v0.1',
  'superphivessel.dlam.p3a.scorecards.v0.1',
  'superphivessel.dlam.p3b.replay-report.v0.1',
  'superphivessel.dlam.p3c.qualification.v0.1',
  'superphivessel.dlam.p4a.linear-ucb-snapshot.v0.1',
  'superphivessel.dlam.p4a.shadow-plan.v0.1',
  'superphivessel.sfr.decision.v0.1',
]);

const text = (obj, field) => typeof obj[field] === 'string' ? obj[field].slice(0,160) : null;
const boolean = (obj, field) => typeof obj[field] === 'boolean' ? obj[field] : null;

export function inspectReceipt(input) {
  if (typeof input !== 'string' || input.trim() === '') throw new Error('Paste a JSON object to inspect.');
  if (new TextEncoder().encode(input).length > MAX_BYTES) throw new Error('Input exceeds the 128 KiB inspector limit.');
  let obj;
  try { obj = JSON.parse(input); } catch { throw new Error('Invalid JSON.'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Expected a JSON object.');
  const schema = text(obj, 'schema');
  const issues = [];
  if (!schema) issues.push('Missing schema identifier');
  else if (!KNOWN.has(schema)) issues.push('Unrecognized schema; format requires independent review');
  if (obj.authority_granted === true || obj.authorityGranted === true ||
      obj.activation_allowed === true || obj.may_change_live_route === true ||
      obj.may_change_live_thresholds === true) {
    issues.push('An imported record claims authority or live mutation privileges');
  }
  if (schema === 'superphivessel.gateway.r3c.canonical-route-evidence.v0.1' &&
      (obj.terminal_outcomes_conflict === true ||
       obj.execution_record_status === 'MIXED_TERMINAL_RECORDS_UNRESOLVED')) {
    issues.push('Mixed terminal records require operator review; final outcome is unresolved');
  }
  const fields = {};
  for (const key of ['decision_id','route_decision_id','observation_id','snapshot_id','qualification_id','packet_id',
    'task_id','task_class','profile_ref','model_ref','routing_mode','status','disposition','evidence_class',
    'snapshot_hash','qualification_hash','receipt_hash','policy_frontier_ref',
    'route_receipt_hash','projection_hash',
    'source','probe_status','per_request_effective_model',
    'execution_record_status','executor_authorization_status',
    'terminal_outcome_class','evidence_level','source_runtime']) {
    const value = text(obj, key);
    if (value !== null) fields[key] = value;
  }
  for (const key of ['authority_granted','authorityGranted','activation_allowed','may_change_live_route',
    'may_change_live_thresholds','p4_evaluation_allowed','selection_is_live',
    'self_hash_consistent','external_signature_verified','source_authenticity_attested',
    'live_brainc_connected','browser_gateway_connected','can_execute',
    'configuration_only','execution_observed','brainc_routing_trace_verified',
    'model_artifacts_qualified','configured_active_in_inventory','can_change_active_model',
    'independent_execution_confirmation','independently_verified_answer_quality',
    'source_authenticity_attested','brain_route_present','dispatch_attempt_observed',
    'executor_authorized_observed','budgetgenius_influence','budgetgenius_execution_authorized',
    'exact_model_artifact_attested','ga108_genius_identity_attested','live_trace_export_connected',
    'terminal_outcomes_conflict']) {
    const value = boolean(obj,key);
    if (value !== null) fields[key] = value;
  }
  return {
    schema: schema ?? 'MISSING',
    recognized: schema ? KNOWN.has(schema) : false,
    label: issues.some(x=>x.includes('claims authority') || x.includes('Mixed terminal records'))
      ? 'REVIEW_REQUIRED' : 'UNVERIFIED_IMPORT',
    issues,
    fields,
    verifiedCryptographically: false,
    executionPermitted: false,
    sharesContent: false,
  };
}
