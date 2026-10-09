/**
 * SPV-SCOUT-01. Operator-pasted PhiBot handoff metadata.
 * No request, no storage, no raw file upload and absolutely no routing rights.
 *
 * The incoming SHA digest is a self-reported string; the browser has no
 * qualification.json bytes or independently trusted identity to verify it.
 */
const MAX_BYTES=4096;
const KEYS=[
  'schema','evidence_class','mode','qualification_result','source_run_id',
  'source_mission_id','local_model','qualified_at','source_expires_at',
  'review_freshness','receipt_digest_sha256','integrity',
  'public_source_authenticated','identity_authenticated','signer_authenticated',
  'independent_execution_attested','reality_gate_granted',
  'tool_calls_authorized','memory_admitted','agent_spawned',
  'phios_isolation_qualified','vessie_connected','routing_influence',
];
const ZERO_FLAGS=[
  'public_source_authenticated','identity_authenticated','signer_authenticated',
  'independent_execution_attested','reality_gate_granted','tool_calls_authorized',
  'memory_admitted','agent_spawned','phios_isolation_qualified','vessie_connected'
];
function refuse(ok,code) {
  if(!ok)throw new Error('SCOUT_HANDOFF_'+code);
}
function record(x) {
  return x!==null && typeof x==='object' && !Array.isArray(x);
}
function timestamp(x) {
  refuse(typeof x==='string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x),
    'TIME_FORMAT');
  const parsed=Date.parse(x);
  refuse(Number.isFinite(parsed),'TIME_FORMAT');
  return parsed;
}
export function inspectScoutHandoff(text,now=Date.now()) {
  refuse(typeof text==='string' && text.trim().length>0,'EMPTY');
  refuse(new TextEncoder().encode(text).length<=MAX_BYTES,'SIZE');
  refuse(Number.isSafeInteger(now) && now>0,'CLOCK');
  let r;
  try{r=JSON.parse(text);}catch{throw new Error('SCOUT_HANDOFF_JSON');}
  refuse(record(r) && Object.keys(r).sort().join('|')===KEYS.slice().sort().join('|'),
    'FIELDS');
  refuse(r.schema==='phibot.scout-vessie-handoff.v0.1' &&
    r.evidence_class==='LOCAL_SELF_REPORTED_FORMAT_AND_DIGEST_ONLY' &&
    r.mode==='MANUAL_OPERATOR_COPY_ONLY' &&
    r.qualification_result==='PASS_LOCAL_SCOUT_SHADOW' &&
    r.source_mission_id==='phibot.scout.public-repo-health.v1' &&
    r.integrity==='DOMAIN_SEPARATED_DIGEST_MATCH' &&
    r.routing_influence==='NONE' &&
    (r.review_freshness==='CURRENT_WITHIN_SOURCE_WINDOW' ||
      r.review_freshness==='HISTORICAL_EXPIRED_OR_NOT_YET_CURRENT'),
    'SCOPE');
  refuse(ZERO_FLAGS.every(k=>r[k]===false),'AUTHORITY');
  refuse(typeof r.source_run_id==='string' &&
    /^[1-9]\d{0,18}$/.test(r.source_run_id) &&
    Number.isSafeInteger(Number(r.source_run_id)) &&
    typeof r.local_model==='string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,79}$/.test(r.local_model) &&
    typeof r.receipt_digest_sha256==='string' &&
    /^[a-f0-9]{64}$/.test(r.receipt_digest_sha256),
    'IDENTIFIERS');
  const qualified=timestamp(r.qualified_at);
  const expires=timestamp(r.source_expires_at);
  refuse(expires>=qualified && qualified<=now+300000,'TIMELINE');
  const freshness=now>=qualified && now<=expires ?
    'CURRENT_WITHIN_SOURCE_WINDOW':'HISTORICAL_EXPIRED_OR_NOT_YET_CURRENT';
  return Object.freeze({
    schema:'superphivessel.scout-handoff-review.v0.1',
    display_status:'OPERATOR_PASTED_SELF_REPORTED_PASS',
    local_model:r.local_model,
    source_run_id:r.source_run_id,
    qualified_at:r.qualified_at,
    source_expires_at:r.source_expires_at,
    source_freshness_at_review:freshness,
    source_freshness_when_exported:r.review_freshness,
    receipt_digest_prefix:r.receipt_digest_sha256.slice(0,12),
    digest_verified_in_browser:false,
    source_authenticated:false,
    operator_identity_verified:false,
    local_execution_independently_attested:false,
    integration:'UNWIRED_REVIEW_ONLY',
    vessie_connected:false,
    model_started_by_cockpit:false,
    routing_influence:'NONE',
    authority_granted:false,
    memory_admitted:false,
    tools_executed:false,
    agent_spawned:false,
  });
}
