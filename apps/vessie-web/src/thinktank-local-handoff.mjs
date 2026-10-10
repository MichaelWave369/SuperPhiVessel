/* SPV-COMPANY-15: opt-in local ThinkTank draft handoff.
 * The existing ThinkTank bridge has no governed council API. This explicitly
 * opens a bounded UNTRUSTED prompt draft in its UI; it never calls /invoke.
 */
export const LOCAL_THINKTANK_UI='http://127.0.0.1:5173/';
export const LOCAL_THINKTANK_BRIDGE='http://127.0.0.1:3691';
export const LOCAL_HANDOFF_SCHEMA='spv-thinktank-draft.v0.1';
const fail=(ok,code)=>{if(!ok)throw Error('THINKTANK_LOCAL_'+code)};
export function inspectOperatorDirective(text){
 fail(typeof text==='string'&&text.trim().length>=3&&text.length<=1200&&
 !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text),'DIRECTIVE');
 // URL fragments are encoded, NOT encrypted. Refuse obvious high-risk secrets.
 fail(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bsk-[A-Za-z0-9_-]{25,}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b/i.test(text),'SECRET_PATTERN');
 return text.trim();
}
export function buildThinkTankLocalDraft(text,mode='council'){
 const directive=inspectOperatorDirective(text);
 fail(['council','debate','audit','trio','build'].includes(mode),'MODE');
 return {
  schema:LOCAL_HANDOFF_SCHEMA,kind:'operator-directive-draft',
  source:'vessie-human-composed',directive,suggestedMode:mode,
  runRequested:false,executionAuthorityGranted:false,providerKeysTransferred:false
 }
}
export function makeThinkTankLocalHandoffUrl(text,mode='council'){
 const payload=JSON.stringify(buildThinkTankLocalDraft(text,mode));
 const bytes=new TextEncoder().encode(payload);
 fail(bytes.length<=2800,'SIZE');
 let raw='';
 for(let i=0;i<bytes.length;i+=8192){
  raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
 }
 const token=btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
 const address=LOCAL_THINKTANK_UI+'#spv-draft='+token;
 fail(address.length<4200,'SIZE');
 return address
}
export function parseLocalBridgeHealth(json){
 fail(json!==null&&typeof json==='object'&&!Array.isArray(json),'HEALTH');
 fail(json.ok===true&&json.service==='phi-think-tank-provider-bridge'&&
  typeof json.version==='string'&&/^0\.[0-9]+(?:\.[0-9]+)?$/.test(json.version),'SERVICE');
 return {service:json.service,version:json.version,source:'LOCAL_UNAUTHENTICATED_READ_ONLY',
  providerExecutionConfirmed:false,sessionStarted:false,authorityGranted:false}
}
export async function checkThinkTankLocalBridge(requester=fetch,signal){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),5000);
 const abort=()=>controller.abort();
 if(signal){
  if(signal.aborted)controller.abort();
  else signal.addEventListener('abort',abort,{once:true})
 }
 try{
  const res=await requester(LOCAL_THINKTANK_BRIDGE+'/health',{
   method:'GET',mode:'cors',credentials:'omit',redirect:'error',
   cache:'no-store',signal:controller.signal
  });
  fail(res&&typeof res.ok==='boolean','HTTP_RESPONSE');
  if(!res.ok)throw Error('THINKTANK_LOCAL_HTTP_'+String(res.status));
  const size=res.headers?.get?.('content-length');
  fail(size==null||(Number.isSafeInteger(Number(size))&&Number(size)>=0&&Number(size)<=2048),'SIZE');
  return parseLocalBridgeHealth(JSON.parse(await res.text()))
 }catch(e){
  if(e?.name==='AbortError')throw Error('THINKTANK_LOCAL_TIMEOUT_OR_ABORT');
  throw e
 }finally{
  clearTimeout(timer);
  if(signal)signal.removeEventListener('abort',abort)
 }
}
