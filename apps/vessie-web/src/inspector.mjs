const MAX_BYTES = 131072;
const KNOWN = new Set([
  'superphivessel.dlam.route-decision.p1c.v0.1',
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
  const fields = {};
  for (const key of ['decision_id','route_decision_id','observation_id','snapshot_id','qualification_id','packet_id',
    'task_id','task_class','profile_ref','model_ref','routing_mode','status','disposition','evidence_class',
    'snapshot_hash','qualification_hash','receipt_hash','policy_frontier_ref']) {
    const value = text(obj, key);
    if (value !== null) fields[key] = value;
  }
  for (const key of ['authority_granted','authorityGranted','activation_allowed','may_change_live_route',
    'may_change_live_thresholds','p4_evaluation_allowed','selection_is_live']) {
    const value = boolean(obj,key);
    if (value !== null) fields[key] = value;
  }
  return {
    schema: schema ?? 'MISSING',
    recognized: schema ? KNOWN.has(schema) : false,
    label: issues.some(x=>x.includes('claims authority')) ? 'REVIEW_REQUIRED' : 'UNVERIFIED_IMPORT',
    issues,
    fields,
    verifiedCryptographically: false,
    executionPermitted: false,
    sharesContent: false,
  };
}
