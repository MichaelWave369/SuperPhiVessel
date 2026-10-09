// Pure manual export/import of redacted bench evidence.
// Not signed, encrypted, persisted, uploaded, or a route authorization.
import {MAX_BENCH_ENTRIES} from './evidence-bench.mjs';
import {safeProtocolId} from './trial-protocols.mjs';
export const BUNDLE_SCHEMA='superphivessel.local-console.evidence-bench.bundle.v0.1';
export const MAX_BUNDLE_BYTES=65536;

const PERF='PERFORMANCE_RECEIPT',REVIEW='HUMAN_REVIEW';
const perfKeys=[
 'kind','model','output_sha256','observed_at','trial_elapsed_ms','model_load_ns',
 'prompt_eval_ns','generation_eval_ns','generated_tokens','prompt_tokens',
 'token_cap_requested','token_cap_reached','stop_reason','provenance',
 'prompt_included','generated_text_included','authority_granted'
].sort();
const perfKeysWithProtocol=[...perfKeys,'protocol_id'].sort();
const reviewKeys=[
 'kind','model','output_sha256','observed_at','helpfulness','completeness',
 'verification','provenance','prompt_included','generated_text_included',
 'authority_granted'
].sort();
const bundleKeys=[
 'schema','created_at','scope','source_trust','max_entries','evidence_count',
 'entries','prompt_included','generated_text_included',
 'free_text_notes_included','automatic_ranking_performed',
 'quality_gate_approved','model_routing_approved','cloud_execution_approved',
 'authority_granted'
].sort();
const ratings=['1','2','3','4','5','NOT_ASSESSED'];
const completeness=['APPEARS_COMPLETE','POSSIBLY_CUT_OFF','UNSURE'];
const verification=['NOT_CHECKED','OPERATOR_CHECKED_SUPPORTED','OPERATOR_CHECKED_CONTRADICTED'];
const stops=['stop','length','UNREPORTED_OR_UNKNOWN'];
const validModel=x=>typeof x==='string'&&x.length>0&&x.length<=128&&
  !/[\u0000-\u001f\u007f]/.test(x);
const validIso=x=>typeof x==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&
  !Number.isNaN(Date.parse(x));
const validHash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const safeNullableInt=x=>x===null||(Number.isSafeInteger(x)&&x>=0);
function requireValue(ok,code){if(!ok)throw new Error(code);}
function exactKeys(value,expected){
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    JSON.stringify(Object.keys(value).sort())===JSON.stringify(expected);
}
const identity=x=>[x.kind,x.model,x.output_sha256,x.observed_at].join('|');

// No fields from external JSON are forwarded without explicit validation.
// Exact keyset rejects prompts, raw model output, credentials, and notes.
export function sanitizePortableEntry(raw){
  requireValue(raw&&typeof raw==='object'&&!Array.isArray(raw),'BUNDLE_ENTRY_INVALID');
  const isPerf=raw.kind===PERF;
  const isReview=raw.kind===REVIEW;
  requireValue((isPerf&&(exactKeys(raw,perfKeys)||exactKeys(raw,perfKeysWithProtocol)))||
    (isReview&&exactKeys(raw,reviewKeys)),'BUNDLE_ENTRY_FIELDS_INVALID');
  requireValue(validModel(raw.model)&&validHash(raw.output_sha256)&&
    validIso(raw.observed_at)&&raw.prompt_included===false&&
    raw.generated_text_included===false&&raw.authority_granted===false,
    'BUNDLE_ENTRY_PRIVACY_OR_REF_INVALID');
  if(isPerf){
    requireValue(raw.protocol_id===undefined||raw.protocol_id===null||
      safeProtocolId(raw.protocol_id)!==null,'BUNDLE_PROTOCOL_INVALID');
    requireValue(raw.provenance==='IMPORTED_OR_OPERATOR_CAPTURED_UNATTESTED'&&
      [raw.trial_elapsed_ms,raw.model_load_ns,raw.prompt_eval_ns,
       raw.generation_eval_ns,raw.generated_tokens,raw.prompt_tokens].every(safeNullableInt)&&
      Number.isInteger(raw.token_cap_requested)&&raw.token_cap_requested>=1&&
      raw.token_cap_requested<=128&&typeof raw.token_cap_reached==='boolean'&&
      stops.includes(raw.stop_reason),'BUNDLE_PERFORMANCE_INVALID');
    return Object.freeze({
      kind:PERF,model:raw.model,output_sha256:raw.output_sha256,observed_at:raw.observed_at,
      protocol_id:safeProtocolId(raw.protocol_id),
      trial_elapsed_ms:raw.trial_elapsed_ms,model_load_ns:raw.model_load_ns,
      prompt_eval_ns:raw.prompt_eval_ns,generation_eval_ns:raw.generation_eval_ns,
      generated_tokens:raw.generated_tokens,prompt_tokens:raw.prompt_tokens,
      token_cap_requested:raw.token_cap_requested,token_cap_reached:raw.token_cap_reached,
      stop_reason:raw.stop_reason,provenance:'IMPORTED_OR_OPERATOR_CAPTURED_UNATTESTED',
      prompt_included:false,generated_text_included:false,authority_granted:false
    });
  }
  requireValue(raw.provenance==='OPERATOR_SELF_REPORT_UNATTESTED'&&
    ratings.includes(raw.helpfulness)&&completeness.includes(raw.completeness)&&
    verification.includes(raw.verification),'BUNDLE_REVIEW_INVALID');
  return Object.freeze({
    kind:REVIEW,model:raw.model,output_sha256:raw.output_sha256,
    observed_at:raw.observed_at,helpfulness:raw.helpfulness,
    completeness:raw.completeness,verification:raw.verification,
    provenance:'OPERATOR_SELF_REPORT_UNATTESTED',
    prompt_included:false,generated_text_included:false,authority_granted:false
  });
}

function distinctOrFail(list) {
  const found=new Map();
  for(const raw of list){
    const record=sanitizePortableEntry(raw);
    const key=identity(record);
    const old=found.get(key);
    if(old){
      if(JSON.stringify(old)!==JSON.stringify(record))throw new Error('BUNDLE_CONFLICTING_DUPLICATE');
    }else found.set(key,record);
  }
  return [...found.values()];
}

export function exportPortableBench(entries,{createdAt=new Date().toISOString()}={}){
  requireValue(Array.isArray(entries)&&entries.length>0&&
    entries.length<=MAX_BENCH_ENTRIES,'BUNDLE_EXPORT_BOUNDS');
  requireValue(validIso(createdAt),'BUNDLE_EXPORT_DATE_INVALID');
  const sanitized=distinctOrFail(entries);
  return Object.freeze({
    schema:BUNDLE_SCHEMA,
    created_at:createdAt,
    scope:'OPERATOR_CHOSEN_PORTABLE_REDACTED',
    source_trust:'UNATTESTED_OPERATOR_SELECTED_JSON',
    max_entries:MAX_BENCH_ENTRIES,
    evidence_count:sanitized.length,
    entries:Object.freeze(sanitized),
    prompt_included:false,generated_text_included:false,
    free_text_notes_included:false,automatic_ranking_performed:false,
    quality_gate_approved:false,model_routing_approved:false,
    cloud_execution_approved:false,authority_granted:false
  });
}

export function importPortableBench(current,raw){
  requireValue(Array.isArray(current)&&current.length<=MAX_BENCH_ENTRIES,
    'BUNDLE_INVALID_CURRENT_STATE');
  requireValue(exactKeys(raw,bundleKeys),'BUNDLE_SCHEMA_FIELDS_INVALID');
  requireValue(raw.schema===BUNDLE_SCHEMA&&validIso(raw.created_at)&&
    raw.scope==='OPERATOR_CHOSEN_PORTABLE_REDACTED'&&
    raw.source_trust==='UNATTESTED_OPERATOR_SELECTED_JSON'&&
    raw.max_entries===MAX_BENCH_ENTRIES&&
    Number.isInteger(raw.evidence_count)&&raw.evidence_count>=1&&
    raw.evidence_count<=MAX_BENCH_ENTRIES&&
    Array.isArray(raw.entries)&&raw.entries.length===raw.evidence_count&&
    raw.prompt_included===false&&raw.generated_text_included===false&&
    raw.free_text_notes_included===false&&
    raw.automatic_ranking_performed===false&&
    raw.quality_gate_approved===false&&
    raw.model_routing_approved===false&&raw.cloud_execution_approved===false&&
    raw.authority_granted===false,'BUNDLE_SCHEMA_OR_AUTHORITY_INVALID');
  const existing=distinctOrFail(current);
  const imported=distinctOrFail(raw.entries);
  requireValue(imported.length===raw.evidence_count,'BUNDLE_DUPLICATES_INVALID');
  // Transactional merge: a conflict or >24 records rejects the ENTIRE
  // import, leaving the caller's previous bench unchanged.
  const merged=distinctOrFail([...existing,...imported]);
  requireValue(merged.length<=MAX_BENCH_ENTRIES,'BUNDLE_CAPACITY_EXCEEDED');
  return Object.freeze(merged);
}
