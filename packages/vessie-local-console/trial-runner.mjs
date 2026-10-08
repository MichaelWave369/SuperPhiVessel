import { createHash } from 'node:crypto';

export const LOCAL_OLLAMA_GENERATE = 'http://127.0.0.1:11434/api/generate';
const MAX_RESPONSE_BYTES=128*1024;
const MAX_OUTPUT_CHARS=6000;
const GENERATION_TIMEOUT_MS=90000;
const safeInt=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const safeReason=value=>['stop','length'].includes(value)?value:'UNREPORTED_OR_UNKNOWN';

async function boundedJson(response){
  if(!response.ok) throw new Error('OLLAMA_GENERATION_UNAVAILABLE');
  const type=response.headers.get('content-type');
  if(!type||!type.toLowerCase().includes('application/json')) throw new Error('OLLAMA_INVALID_TYPE');
  const size=response.headers.get('content-length');
  if(size!==null&&Number(size)>MAX_RESPONSE_BYTES) throw new Error('OLLAMA_OVERSIZE');
  const reader=response.body?.getReader();
  if(!reader) throw new Error('OLLAMA_EMPTY_RESULT');
  const parts=[];let sizeSeen=0;
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      sizeSeen+=value.byteLength;
      if(sizeSeen>MAX_RESPONSE_BYTES){await reader.cancel();throw new Error('OLLAMA_OVERSIZE');}
      parts.push(value);
    }
  }finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(parts.map(x=>Buffer.from(x))).toString('utf8'));}
  catch{throw new Error('OLLAMA_INVALID_RESULT');}
}

export async function runLocalTrial({model,prompt,maxOutputTokens=128,fetchImpl=fetch}={}){
  if(typeof model!=='string'||model.length===0||model.length>128||
      /[\u0000-\u001f\u007f]/.test(model))throw new Error('TRIAL_INPUT_INVALID');
  if(typeof prompt!=='string'||prompt.trim().length===0||prompt.length>2000||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(prompt))throw new Error('TRIAL_INPUT_INVALID');
  if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>128)
    throw new Error('TRIAL_LIMIT_INVALID');
  const started=performance.now();
  const response=await fetchImpl(LOCAL_OLLAMA_GENERATE,{
    method:'POST',
    headers:{'content-type':'application/json','accept':'application/json'},
    redirect:'error',
    signal:AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    body:JSON.stringify({
      model,prompt,stream:false,think:false,
      keep_alive:0,options:{num_predict:maxOutputTokens}
    })
  });
  const result=await boundedJson(response);
  if(!result||typeof result!=='object'||Array.isArray(result)||
      result.done!==true||result.model!==model||
      typeof result.response!=='string'||result.response.length>MAX_OUTPUT_CHARS){
    throw new Error('OLLAMA_RESULT_CONTRACT_INVALID');
  }
  const receipt={
    schema:'superphivessel.local-console.trial.receipt.v0.1',
    observation:'LOCAL_OLLAMA_API_RESULT_UNATTESTED',
    timestamp:new Date().toISOString(),
    model,
    route:'LOCAL_LOOPBACK_FIXED',
    experiment_mode:'OPERATOR_ONE_SHOT',
    max_output_tokens_requested:maxOutputTokens,
    elapsed_wall_ms:Math.round(performance.now()-started),
    // Metadata reported by Ollama, not independently attested.
    ollama_total_duration_ns:safeInt(result.total_duration),
    ollama_load_duration_ns:safeInt(result.load_duration),
    ollama_prompt_tokens:safeInt(result.prompt_eval_count),
    ollama_prompt_eval_duration_ns:safeInt(result.prompt_eval_duration),
    ollama_generated_tokens:safeInt(result.eval_count),
    ollama_eval_duration_ns:safeInt(result.eval_duration),
    // Reaching the request cap is an observation, NOT proof of
    // truncation or of a successful answer.
    output_token_cap_reached:safeInt(result.eval_count)!==null &&
      safeInt(result.eval_count)>=maxOutputTokens,
    ollama_done_reason:safeReason(result.done_reason),
    generated_text_sha256:createHash('sha256').update(result.response).digest('hex'),
    private_prompt_included:false,
    generated_text_included:false,
    model_routing_approved:false,
    cloud_execution_approved:false,
    authority_granted:false
  };
  return {
    schema:'superphivessel.local-console.trial.result.v0.1',
    response:result.response,
    receipt,
    authority_granted:false,
    can_schedule:false,
    model_routing_approved:false
  };
}
