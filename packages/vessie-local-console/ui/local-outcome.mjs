// R7 browser-local integrity gate for one operator-approved Ollama result.
// A matching hash is data consistency, not independent model execution proof.
// Never imports network, storage, authority, or provider-selection code.
export const OLLAMA_CONSISTENCY_SCHEMA='spv.sovereignty.ollama-text-consistency.v0.1';
const RESULT_KEYS=['schema','response','receipt','authority_granted','can_schedule','model_routing_approved'].sort().join('|');
const RECEIPT_KEYS=[
  'schema','observation','timestamp','model','route','experiment_mode',
  'max_output_tokens_requested','protocol_id','protocol_evidence',
  'elapsed_wall_ms','ollama_total_duration_ns','ollama_load_duration_ns',
  'ollama_prompt_tokens','ollama_prompt_eval_duration_ns',
  'ollama_generated_tokens','ollama_eval_duration_ns',
  'output_token_cap_reached','ollama_done_reason','generated_text_sha256',
  'private_prompt_included','generated_text_included',
  'model_routing_approved','cloud_execution_approved','authority_granted'
].sort().join('|');
const HEX_SHA=/^[a-f0-9]{64}$/;
export class OllamaConsistencyError extends Error {
  constructor(code){super(code);this.name='OllamaConsistencyError';this.code=code;}
}
function exactKeys(object,expected){
  return object!==null&&typeof object==='object'&&!Array.isArray(object)&&
    Object.keys(object).sort().join('|')===expected;
}
export async function verifyOllamaTrialResponse({
  result,expectedModel,expectedTokens,cryptoImpl=globalThis.crypto
}={}){
  if(!exactKeys(result,RESULT_KEYS)||!exactKeys(result.receipt,RECEIPT_KEYS))
    throw new OllamaConsistencyError('RESULT_KEYS_INVALID');
  const receipt=result.receipt;
  if(typeof expectedModel!=='string'||expectedModel.length<1||expectedModel.length>128||
     /[\u0000-\u001f\u007f]/.test(expectedModel)||
     ![64,128].includes(expectedTokens)||
     result.schema!=='superphivessel.local-console.trial.result.v0.1' ||
     result.authority_granted!==false||result.can_schedule!==false||
     result.model_routing_approved!==false||
     typeof result.response!=='string'||result.response.length>6000||
     receipt.schema!=='superphivessel.local-console.trial.receipt.v0.1'||
     receipt.observation!=='LOCAL_OLLAMA_API_RESULT_UNATTESTED'||
     receipt.model!==expectedModel||receipt.route!=='LOCAL_LOOPBACK_FIXED'||
     receipt.experiment_mode!=='OPERATOR_ONE_SHOT'||
     receipt.max_output_tokens_requested!==expectedTokens||
     receipt.protocol_evidence!=='PUBLIC_FIXED_PROMPT_ONLY_NOT_INDEPENDENT_BENCHMARK'||
     (receipt.protocol_id!==null&&(typeof receipt.protocol_id!=='string'||
       receipt.protocol_id.length>128||/[\u0000-\u001f\u007f]/.test(receipt.protocol_id)))||
     typeof receipt.timestamp!=='string'||receipt.timestamp.length>40||
     receipt.private_prompt_included!==false||receipt.generated_text_included!==false||
     receipt.model_routing_approved!==false||receipt.cloud_execution_approved!==false||
     receipt.authority_granted!==false||
     !HEX_SHA.test(receipt.generated_text_sha256) ||
     !['stop','length','UNREPORTED_OR_UNKNOWN'].includes(receipt.ollama_done_reason)||
     typeof receipt.output_token_cap_reached!=='boolean')
    throw new OllamaConsistencyError('RESULT_CONTRACT_INVALID');
  if(!cryptoImpl?.subtle?.digest)
    throw new OllamaConsistencyError('WEBCRYPTO_REQUIRED');
  const actual=Array.from(new Uint8Array(await cryptoImpl.subtle.digest(
    'SHA-256',new TextEncoder().encode(result.response)
  ))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(actual!==receipt.generated_text_sha256)
    throw new OllamaConsistencyError('OUTPUT_SHA256_MISMATCH');
  // The caller may show text only AFTER validating the whole result.
  return Object.freeze({
    schema:OLLAMA_CONSISTENCY_SCHEMA,
    status:'LOCAL_TEXT_HASH_MATCH_UNATTESTED',
    response_text:result.response,
    receipt:Object.freeze({...receipt}),
    response_sha256:actual,
    provider:'OLLAMA_LOCAL',
    independent_execution_attestation:false,
    content_trusted:false,
    model_routing_approved:false,
    tool_execution_authorized:false,
    canonical_runtime_connected:false
  });
}
