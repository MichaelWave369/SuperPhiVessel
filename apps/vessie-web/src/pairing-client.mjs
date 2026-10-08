export const LOCAL_GATEWAY = 'https://127.0.0.1:8790';

async function safeResponse(response) {
  if(!response.ok) throw new Error(response.status===403?'Gateway refused this session or pairing':
    response.status===429?'Gateway rate limit reached':'Gateway unavailable or refused request');
  const data=await response.json();
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Unexpected gateway response');
  return data;
}
function init(method, body, session) {
  const headers={'Accept':'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(session)headers.Authorization='Bearer '+session;
  return {method,mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',headers,
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(6000)};
}
export async function pairGateway(code,fetcher=fetch) {
  if(typeof code!=='string'|| !/^[a-f0-9]{64}$/i.test(code)) throw new Error('Expected a 64-character pairing secret from your local terminal');
  const result=await safeResponse(await fetcher(LOCAL_GATEWAY+'/v1/pair',init('POST',{code})));
  if(result.schema!=='superphivessel.gateway.browser-session.v0.1' ||
    typeof result.session_token!=='string'|| !/^[a-f0-9]{64}$/i.test(result.session_token)||
    result.authority_granted!==false||result.can_execute!==false||result.can_read_memory!==false){
    throw new Error('Unexpected gateway pairing contract; no session admitted');
  }
  return result.session_token;
}
export async function gatewayStatus(session,fetcher=fetch) {
  if(!/^[a-f0-9]{64}$/i.test(session))throw new Error('Invalid local session');
  const result=await safeResponse(await fetcher(LOCAL_GATEWAY+'/v1/status',init('GET',undefined,session)));
  if(result.schema!=='superphivessel.gateway.status.v0.2'||result.authority_granted!==false)
    throw new Error('Gateway status contract mismatch');
  return result;
}
export async function gatewayModels(session,fetcher=fetch) {
  if(!/^[a-f0-9]{64}$/i.test(session))throw new Error('Invalid local session');
  const result=await safeResponse(await fetcher(LOCAL_GATEWAY+'/v1/models',init('GET',undefined,session)));
  if(result.schema!=='superphivessel.gateway.models.v0.1' ||
    result.authority_granted!==false||result.can_execute!==false||
    !Array.isArray(result.models)||result.models.length>256)throw new Error('Gateway model contract mismatch');
  const models=result.models.map(x=>({
    name:typeof x.name==='string'?x.name.slice(0,128):'',
    loaded:x.loaded===true,
    quantization:typeof x.quantization==='string'?x.quantization.slice(0,48):'Unknown',
    size_bytes:Number.isSafeInteger(x.size_bytes)?x.size_bytes:null,
    runtime_vram_bytes:Number.isSafeInteger(x.runtime_vram_bytes)?x.runtime_vram_bytes:null,
    routing_approved:false,
    execution_authorized:false,
  })).filter(x=>x.name);
  return {count:models.length,models,probe_status:result.probe_status};
}
export async function revokeGateway(session,fetcher=fetch){
  if(!/^[a-f0-9]{64}$/i.test(session))return;
  await safeResponse(await fetcher(LOCAL_GATEWAY+'/v1/session',init('DELETE',undefined,session)));
}
