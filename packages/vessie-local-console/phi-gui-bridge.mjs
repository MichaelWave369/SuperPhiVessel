/** Explicitly approved local PhiServe drafting. No tools, URLs or memory. */
import {createHash} from 'node:crypto';
import {DRAFT_SCHEMA,MAX_DRAFT_BYTES} from '../../vessie-phiserve-draft-v0.1/adapter.mjs';
export const PHI_GUI_SCHEMA='superphivessel.local-console.phiserve-draft.v0.1';
export const PHI_GUI_CATALOG_SCHEMA='superphivessel.local-console.phiserve-catalog.v0.1';
export const PHI_GUI_REQUEST_LIMIT=4096;
export const PHI_GUI_RUNS_PER_HOUR=6;
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const hex=/^[0-9a-f]{64}$/;
const control=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export function validatePhiGuiRequest(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).sort().join(',')!=='approve_once,max_output_tokens,model,prompt'||
    input.approve_once!==true||
    typeof input.model!=='string'||!input.model||input.model.length>160||
    /[\u0000-\u001f\u007f]/.test(input.model)||
    typeof input.prompt!=='string'||!input.prompt.trim()||
    input.prompt.length>2000||control.test(input.prompt)||
    Buffer.byteLength(input.prompt,'utf8')>3000||
    !Number.isSafeInteger(input.max_output_tokens)||
    input.max_output_tokens<1||input.max_output_tokens>256){
    throw new Error('PHISERVE_GUI_REQUEST_INVALID');
  }
  return {approved:true,model:input.model,prompt:input.prompt,tokens:input.max_output_tokens};
}
export async function parsePhiGuiBody(req){
  const type=req.headers['content-type'];
  if(typeof type!=='string'||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type))
    throw new Error('PHISERVE_GUI_CONTENT_TYPE_DENIED');
  const declared=req.headers['content-length'];
  if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>PHI_GUI_REQUEST_LIMIT))
    throw new Error('PHISERVE_GUI_CONTENT_LENGTH_DENIED');
  let len=0;const parts=[];
  for await(const piece of req){
    len+=piece.length;
    if(len>PHI_GUI_REQUEST_LIMIT)throw new Error('PHISERVE_GUI_REQUEST_TOO_LARGE');
    parts.push(piece);
  }
  let value;
  try{value=JSON.parse(Buffer.concat(parts).toString('utf8'));}
  catch{throw new Error('PHISERVE_GUI_JSON_INVALID');}
  return validatePhiGuiRequest(value);
}
export function projectPhiGuiCatalog(aliases){
  if(!Array.isArray(aliases)||aliases.length>200||
    !aliases.every(x=>typeof x==='string'&&x.length>0&&x.length<=160&&!/[\u0000-\u001f\u007f]/.test(x))||
    new Set(aliases).size!==aliases.length)throw new Error('PHISERVE_CATALOG_CONTRACT_INVALID');
  return {schema:PHI_GUI_CATALOG_SCHEMA,source:'REGISTERED_GGUF_ALIASES_NOT_HARDWARE_ATTESTED',
    models:[...aliases],model_execution_approved:false,
    authority_granted:false,can_execute:false,model_routing_approved:false};
}
export function projectPhiGuiDraft(result,requested){
  const r=result?.receipt,text=result?.text;
  if(!r||!requested||r.schema!==DRAFT_SCHEMA||r.status!=='LOCAL_TEXT_RETURNED_UNVERIFIED'||
    r.evidence_class!=='OPERATOR_PROCESS_SELF_REPORTED'||r.provider!=='PHISERVE_LOCAL_GGUF'||
    r.attestation!=='NOT_INDEPENDENTLY_VERIFIED'||
    r.approval_scope!=='THIS_SINGLE_DRAFT_REQUEST'||r.user_initiated!==true||
    r.model_alias!==requested.model||r.requested_output_token_cap!==requested.tokens||
    typeof text!=='string'||!text.trim()||Buffer.byteLength(text,'utf8')>MAX_DRAFT_BYTES||
    r.response_chars!==text.length||r.prompt_chars!==requested.prompt.length||
    !hex.test(r.prompt_sha256)||!hex.test(r.response_sha256)||
    r.prompt_sha256!==sha(requested.prompt)||r.response_sha256!==sha(text)||
    typeof r.request_id!=='string'||!r.request_id||r.request_id.length>128||
    typeof r.observed_at!=='string'||r.observed_at.length>40||
    typeof r.note!=='string'||r.note.length>512||
    !['source_input_included','response_text_included','bearer_token_included','memory_accessed',
      'tool_execution_attempted','tool_execution_authorized','route_approved',
      'canonical_runtime_connected','operator_authority_granted'].every(k=>r[k]===false))
    throw new Error('PHISERVE_DRAFT_CONTRACT_INVALID');
  const receipt={
    schema:DRAFT_SCHEMA,status:'LOCAL_TEXT_RETURNED_UNVERIFIED',
    evidence_class:'OPERATOR_PROCESS_SELF_REPORTED',provider:'PHISERVE_LOCAL_GGUF',
    model_alias:requested.model,request_id:r.request_id,observed_at:r.observed_at,
    prompt_sha256:r.prompt_sha256,response_sha256:r.response_sha256,
    prompt_chars:r.prompt_chars,response_chars:r.response_chars,
    requested_output_token_cap:requested.tokens,user_initiated:true,
    approval_scope:'THIS_SINGLE_DRAFT_REQUEST',
    source_input_included:false,response_text_included:false,bearer_token_included:false,
    memory_accessed:false,tool_execution_attempted:false,tool_execution_authorized:false,
    route_approved:false,canonical_runtime_connected:false,operator_authority_granted:false,
    attestation:'NOT_INDEPENDENTLY_VERIFIED',
    note:'Model text is an untrusted proposal only; canonical Vessie routing and executor gates are untouched.',
  };
  return {schema:PHI_GUI_SCHEMA,status:'LOCAL_UNTRUSTED_DRAFT_FOR_HUMAN_REVIEW',
    draft_text:text,receipt,persisted_by_server:false,
    model_routing_approved:false,tool_execution_authorized:false,
    authority_granted:false,canonical_runtime_connected:false};
}
