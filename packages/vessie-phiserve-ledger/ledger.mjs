/**
 * Vessie/PhiServe acceptance ledger R1.
 * Pure, strict redacted receipt validation and record projection.
 * No network, tools, model inference, secret ingestion or promotion.
 */
import {createHash} from 'node:crypto';

export const RECEIPT_SCHEMA='VESSIE_PHISERVE_HOSTED_CPU_ACCEPTANCE_V1';
export const ENTRY_SCHEMA='VESSIE_PHISERVE_ACCEPTANCE_LEDGER_ENTRY_V1';
export const SCOPE='GITHUB_HOSTED_UBUNTU_CPU_RUNNER';
export const MAX_RECEIPT_BYTES=16*1024;
const HEX64=/^[0-9a-f]{64}$/;
const SHA40=/^[0-9a-f]{40}$/;
const safeAlias=/^[a-z0-9][a-z0-9._-]{0,79}$/;
const iso=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const CHECKS=Object.freeze([
  'session_authentication_required',
  'model_catalog_authenticated',
  'cross_origin_request_denied',
  'missing_approval_denied',
  'real_model_inference_response',
  'model_reply_sha256_matched',
  'human_review_redacted',
  'read_only_mode_denied',
]);
const FALSE_FLAGS=Object.freeze([
  'raw_prompt_included','raw_response_included','bearer_token_included',
  'private_memory_accessed','model_routing_approved','agent_action_authorized',
  'user_pc_accessed','user_rtx_5070_tested','local_browser_gui_clicked',
  'independent_hardware_attestation',
]);
const RECEIPT_FIELDS=Object.freeze([
  'schema','status','execution_context','model_alias','gguf_source',
  'gguf_quantization','gguf_sha256','response_sha256',
  'receipt_file_sha256','response_characters','elapsed_wall_ms',
  'checks',...FALSE_FLAGS,'source_commit',
]);
const ENTRY_FIELDS=Object.freeze([
  'schema','record_id','source','observation','classification',
]);
const SOURCE_FIELDS=Object.freeze([
  'kind','repository','workflow_run_id','artifact_id','run_created_at',
  'artifact_file','artifact_receipt_sha256','github_run_url',
]);
const OBSERVATION_FIELDS=Object.freeze([
  'receipt_schema','status','execution_context','model_alias','gguf_source',
  'gguf_quantization','gguf_sha256','response_sha256',
  'receipt_file_sha256','response_characters','elapsed_wall_ms',
  'checks','source_commit',
]);
const CLASS_FIELDS=Object.freeze([
  'record_kind','scope','machine_verified','independently_attested',
  'user_gpu_verified','browser_gui_click_verified','human_quality_reviewed',
  'canonical_promotion_approved','model_routing_approved','agent_authority_granted',
  'response_hash_equality_required',
]);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw new Error(code)};
const equalKeys=(o,keys,code)=>{
  if(!o||typeof o!=='object'||Array.isArray(o)||
     Object.keys(o).sort().join('\0')!==[...keys].sort().join('\0'))fail(code);
};
const assertInt=(v,min,max,code)=>{
  if(!Number.isSafeInteger(v)||v<min||v>max)fail(code);
};

/** JSON.parse on its own silently accepts duplicate object keys: refuse them. */
export function parseUniqueJSON(bytes){
  const raw=typeof bytes==='string'?bytes:Buffer.from(bytes).toString('utf8');
  if(Buffer.byteLength(raw,'utf8')>MAX_RECEIPT_BYTES||raw.length===0||
     raw.includes('\uFFFD'))fail('LEDGER_JSON_SIZE_OR_ENCODING');
  let obj;
  try{obj=JSON.parse(raw);}catch{fail('LEDGER_JSON_INVALID');}
  let at=0;
  const space=()=>{while(at<raw.length&&/\s/.test(raw[at]))at++;};
  function stringToken(){
    const start=at;
    if(raw[at]!=='"')fail('LEDGER_JSON_EXPECT_STRING');
    at++;
    let done=false;
    while(at<raw.length){
      const ch=raw[at++];
      if(ch==='\\'){at++;continue;}
      if(ch==='"'){done=true;break;}
    }
    if(!done)fail('LEDGER_JSON_UNTERMINATED_STRING');
    return JSON.parse(raw.slice(start,at));
  }
  function value(depth){
    if(depth>8)fail('LEDGER_JSON_NESTING_EXCEEDED');
    space();
    if(raw[at]==='{'){
      at++;space();
      const names=new Set();
      if(raw[at]==='}'){at++;return;}
      while(at<raw.length){
        const name=stringToken();
        if(names.has(name))fail('LEDGER_JSON_DUPLICATE_FIELD');
        names.add(name);space();
        if(raw[at++]!==':')fail('LEDGER_JSON_EXPECT_COLON');
        value(depth+1);space();
        if(raw[at]==='}'){at++;return;}
        if(raw[at++]!==',')fail('LEDGER_JSON_EXPECT_COMMA');
        space();
      }
      fail('LEDGER_JSON_EXPECT_OBJECT_END');
    }
    if(raw[at]==='['){
      at++;space();
      if(raw[at]===']'){at++;return;}
      while(at<raw.length){
        value(depth+1);space();
        if(raw[at]===']'){at++;return;}
        if(raw[at++]!==',')fail('LEDGER_JSON_EXPECT_ARRAY_COMMA');
      }
      fail('LEDGER_JSON_EXPECT_ARRAY_END');
    }
    if(raw[at]==='"'){stringToken();return;}
    const start=at;
    while(at<raw.length&&!/[\s,\]}]/.test(raw[at]))at++;
    if(at===start)fail('LEDGER_JSON_EXPECT_VALUE');
    JSON.parse(raw.slice(start,at));
  }
  value(0);space();
  if(at!==raw.length)fail('LEDGER_JSON_TRAILING_DATA');
  return obj;
}

export function validateReceipt(receipt){
  equalKeys(receipt,RECEIPT_FIELDS,'LEDGER_RECEIPT_UNKNOWN_OR_MISSING_FIELDS');
  equalKeys(receipt.checks,CHECKS,'LEDGER_RECEIPT_CHECKS_UNKNOWN_OR_MISSING');
  if(receipt.schema!==RECEIPT_SCHEMA||
     receipt.status!=='HOSTED_CPU_PHI_VESSIE_ACCEPTANCE_PASSED'||
     receipt.execution_context!==SCOPE)fail('LEDGER_RECEIPT_WRONG_SCOPE_OR_STATUS');
  if(!safeAlias.test(receipt.model_alias)||
     !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(receipt.gguf_source)||
     !/^[A-Za-z0-9_]{1,32}$/.test(receipt.gguf_quantization))
    fail('LEDGER_MODEL_IDENTITY_INVALID');
  for(const field of ['gguf_sha256','response_sha256','receipt_file_sha256'])
    if(!HEX64.test(receipt[field]))fail('LEDGER_DIGEST_INVALID');
  if(!SHA40.test(receipt.source_commit))fail('LEDGER_SOURCE_COMMIT_INVALID');
  assertInt(receipt.response_characters,1,100000,'LEDGER_RESPONSE_LENGTH_INVALID');
  assertInt(receipt.elapsed_wall_ms,0,30*60*1000,'LEDGER_LATENCY_INVALID');
  for(const check of CHECKS)
    if(receipt.checks[check]!==true)fail('LEDGER_TRANSPORT_CONTROL_NOT_PASSED');
  for(const field of FALSE_FLAGS)
    if(receipt[field]!==false)fail('LEDGER_AUTHORITY_OR_PRIVACY_FLAG_INVALID');
  return receipt;
}

export function makeEntry(receiptBytes,metadata){
  const raw=Buffer.from(receiptBytes);
  const receipt=validateReceipt(parseUniqueJSON(raw));
  if(!metadata||typeof metadata!=='object')fail('LEDGER_SOURCE_METADATA_REQUIRED');
  equalKeys(metadata,['runId','artifactId','runCreatedAt'],'LEDGER_SOURCE_METADATA_FIELDS');
  assertInt(metadata.runId,1,Number.MAX_SAFE_INTEGER,'LEDGER_RUN_ID_INVALID');
  assertInt(metadata.artifactId,1,Number.MAX_SAFE_INTEGER,'LEDGER_ARTIFACT_ID_INVALID');
  if(typeof metadata.runCreatedAt!=='string'||!iso.test(metadata.runCreatedAt)||
     Number.isNaN(Date.parse(metadata.runCreatedAt)))
    fail('LEDGER_RUN_TIMESTAMP_INVALID');
  const run=metadata.runId;
  return {
    schema:ENTRY_SCHEMA,
    record_id:'gha-'+run,
    source:{
      kind:'GITHUB_ACTIONS_ARTIFACT_SELF_REPORTED',
      repository:'MichaelWave369/SuperPhiVessel',
      workflow_run_id:run,
      artifact_id:metadata.artifactId,
      run_created_at:metadata.runCreatedAt,
      artifact_file:'acceptance.json',
      artifact_receipt_sha256:digest(raw),
      github_run_url:'https://github.com/MichaelWave369/SuperPhiVessel/actions/runs/'+run,
    },
    observation:{
      receipt_schema:receipt.schema,
      status:receipt.status,
      execution_context:receipt.execution_context,
      model_alias:receipt.model_alias,
      gguf_source:receipt.gguf_source,
      gguf_quantization:receipt.gguf_quantization,
      gguf_sha256:receipt.gguf_sha256,
      response_sha256:receipt.response_sha256,
      receipt_file_sha256:receipt.receipt_file_sha256,
      response_characters:receipt.response_characters,
      elapsed_wall_ms:receipt.elapsed_wall_ms,
      checks:Object.fromEntries(CHECKS.map(key=>[key,true])),
      source_commit:receipt.source_commit,
    },
    classification:{
      record_kind:'SELF_REPORTED_HOSTED_INTEGRATION_OBSERVATION',
      scope:'HOSTED_LINUX_CPU_ONLY',
      machine_verified:false,independently_attested:false,
      user_gpu_verified:false,browser_gui_click_verified:false,
      human_quality_reviewed:false,canonical_promotion_approved:false,
      model_routing_approved:false,agent_authority_granted:false,
      response_hash_equality_required:false,
    },
  };
}

export function validateEntry(entry,receiptBytes){
  equalKeys(entry,ENTRY_FIELDS,'LEDGER_ENTRY_FIELDS_INVALID');
  equalKeys(entry.source,SOURCE_FIELDS,'LEDGER_ENTRY_SOURCE_FIELDS_INVALID');
  equalKeys(entry.observation,OBSERVATION_FIELDS,'LEDGER_ENTRY_OBSERVATION_FIELDS_INVALID');
  equalKeys(entry.observation.checks,CHECKS,'LEDGER_ENTRY_CHECK_FIELDS_INVALID');
  equalKeys(entry.classification,CLASS_FIELDS,'LEDGER_ENTRY_CLASSIFICATION_FIELDS_INVALID');
  if(entry.source.kind!=='GITHUB_ACTIONS_ARTIFACT_SELF_REPORTED'||
     entry.source.repository!=='MichaelWave369/SuperPhiVessel'||
     entry.source.artifact_file!=='acceptance.json')
    fail('LEDGER_ENTRY_PROVENANCE_INVALID');
  const expected=makeEntry(receiptBytes,{
    runId:entry.source.workflow_run_id,
    artifactId:entry.source.artifact_id,
    runCreatedAt:entry.source.run_created_at,
  });
  if(JSON.stringify(entry)!==JSON.stringify(expected))
    fail('LEDGER_ENTRY_DERIVED_FIELDS_MISMATCH');
  return entry;
}

export function summary(entries){
  if(!Array.isArray(entries))fail('LEDGER_ENTRIES_MUST_BE_ARRAY');
  const ids=new Set(),artifacts=new Set();
  const sorted=[...entries].sort((a,b)=>a.source.workflow_run_id-b.source.workflow_run_id);
  const groups=new Map(),alerts=[];
  for(const e of sorted){
    if(ids.has(e.record_id)||artifacts.has(e.source.artifact_id))
      fail('LEDGER_DUPLICATE_RUN_OR_ARTIFACT');
    ids.add(e.record_id);artifacts.add(e.source.artifact_id);
    const v=e.observation;
    const key=[v.execution_context,v.model_alias,v.gguf_sha256,v.source_commit].join('|');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(e);
    for(const old of sorted){
      if(old===e||old.source.workflow_run_id>=e.source.workflow_run_id)continue;
      if(old.observation.model_alias===v.model_alias&&
         old.observation.gguf_sha256!==v.gguf_sha256){
        alerts.push({record_id:e.record_id,kind:'MODEL_HASH_CHANGED_REVIEW_REQUIRED'});
        break;
      }
    }
  }
  const tracks=[...groups.values()].map(items=>{
    const last=items[items.length-1],v=last.observation;
    const durations=items.map(x=>x.observation.elapsed_wall_ms).sort((a,b)=>a-b);
    const middle=durations[Math.floor(durations.length/2)];
    const median=durations.length%2?middle:(durations[durations.length/2-1]+middle)/2;
    const responses=new Set(items.map(x=>x.observation.response_sha256)).size;
    // R1 timings are not controlled benchmarks. A large shift after three
    // similar historical runs is an *advisory review signal*, not a CI fail.
    if(items.length>=4){
      const prior=items.slice(0,-1).map(x=>x.observation.elapsed_wall_ms).sort((a,b)=>a-b);
      const n=prior.length,reference=n%2?prior[Math.floor(n/2)]:
        (prior[n/2-1]+prior[n/2])/2;
      const latest=last.observation.elapsed_wall_ms;
      if(reference>0 && latest>=reference*3 && latest-reference>=1000)
        alerts.push({record_id:last.record_id,kind:'LATENCY_VARIATION_REVIEW_REQUIRED'});
    }
    // Unfixed random seed / prompt fingerprint in R1. Variation is
    // NOT categorized as quality regression or failed equivalence.
    return {
      model_alias:v.model_alias,scope:v.execution_context,
      gguf_sha256:v.gguf_sha256,source_commit:v.source_commit,
      runs:items.length,median_elapsed_wall_ms:median,
      distinct_response_hashes:responses,
      repeatability:items.length>=2?'MULTIPLE_HOSTED_OBSERVATIONS':'SINGLE_HOSTED_OBSERVATION',
      response_hash_variation_is_regression:false,
      latency_comparison:'OBSERVATIONAL_ONLY_NOT_DETERMINISTIC_BENCHMARK',
    };
  });
  return {
    schema:'VESSIE_PHISERVE_ACCEPTANCE_LEDGER_SUMMARY_V1',
    total_entries:entries.length,
    tracks,alerts,
    independent_hardware_attestation:false,
    user_rtx_5070_qualified:false,
    canonical_model_promotion_approved:false,
    automatic_routing_granted:false,
    no_real_user_prompt_or_response_stored:true,
  };
}

export function jsonLine(obj){return JSON.stringify(obj,null,2)+'\n';}
