/* Anti-M v0.1: operator-owned, offline completion contracts.
 * Hash chaining detects bundle modification; it does NOT authenticate a
 * person or independently verify an external build. No execution adapters.
 */
export const ANTIM_SCHEMA='superphivessel.anti-m.bundle.v0.1';
const MAX_BYTES=131072;
const KINDS=['REPO_WRITE','DEPLOY','EXTERNAL_POST','SPEND','CREDENTIAL_USE','OTHER_EFFECT'];
const METHODS=['CI_RUN','HUMAN_TEST','ARTIFACT_HASH','OTHER'];
const HEX=/^[0-9a-f]{64}$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
function refuse(ok,code){if(!ok)throw new Error('ANTIM_'+code);}
function obj(x){return x!==null && typeof x==='object' && !Array.isArray(x);}
function shape(x,keys){refuse(obj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),'FIELDS');}
function str(x,max=200){return typeof x==='string'&&x.trim().length>0&&x.length<=max&&/^[^\u0000-\u001f\u007f]*$/.test(x);}
function checkedText(x,max=200){refuse(str(x,max),'TEXT');}
function id(x){refuse(typeof x==='string'&&ID.test(x),'IDENTIFIER');}
function timestamp(x){refuse(typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x)),'TIME');}
function canonical(x){
  if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
  if(obj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  return JSON.stringify(x);
}
async function digest(x){
  refuse(typeof globalThis.crypto?.subtle?.digest==='function','CRYPTO_UNAVAILABLE');
  const encoded=new TextEncoder().encode('ANTI_M_LEDGER_V0_1\n'+canonical(x));
  const hash=await globalThis.crypto.subtle.digest('SHA-256',encoded);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function assertContract(c){
  shape(c,['id','title','deliverable','criteria']);
  id(c.id);checkedText(c.title,120);checkedText(c.deliverable,300);
  refuse(Array.isArray(c.criteria)&&c.criteria.length>=1&&c.criteria.length<=8,'CRITERIA');
  const seen=new Set();
  for(const cr of c.criteria){
    shape(cr,['id','description']);id(cr.id);checkedText(cr.description,220);
    refuse(!seen.has(cr.id),'DUPLICATE_CRITERION');seen.add(cr.id);
  }
}
function blank(){return {contract:null,actions:[],evidence:[],closed:false,close:null};}
function readiness(s){
  if(!s.contract)return {ready:false,missing:['No contract']};
  const missing=[];
  for(const a of s.actions)if(!a.approval)missing.push('Approval review required: '+a.id);
  for(const c of s.contract.criteria){
    const latest=s.evidence.filter(e=>e.criterionId===c.id).at(-1);
    if(!latest)missing.push('Evidence required: '+c.id);
    else if(latest.result!=='PASS')missing.push('Latest evidence is not passing: '+c.id);
    else if(latest.review?.decision!=='ACCEPT')missing.push('Review required: '+c.id);
  }
  return {ready:missing.length===0,missing};
}
function apply(s,type,p,seq){
  if(type==='CONTRACT_CREATED'){
    refuse(seq===1&&s.contract===null,'CREATE_ORDER');
    shape(p,['contract']);assertContract(p.contract);
    s.contract=p.contract;return;
  }
  refuse(!!s.contract&&!s.closed,'CLOSED_OR_MISSING');
  if(type==='ACTION_DECLARED'){
    shape(p,['id','kind','description']);id(p.id);checkedText(p.description,220);
    refuse(KINDS.includes(p.kind),'ACTION_KIND');
    refuse(s.actions.length<20&&!s.actions.some(a=>a.id===p.id),'ACTION_DUPLICATE');
    s.actions.push({id:p.id,kind:p.kind,description:p.description,approval:null});return;
  }
  if(type==='ACTION_APPROVED'){
    shape(p,['actionId','reviewer']);id(p.actionId);checkedText(p.reviewer,80);
    const a=s.actions.find(x=>x.id===p.actionId);
    refuse(!!a&&!a.approval,'APPROVAL_ORDER');
    a.approval={reviewer:p.reviewer,sequence:seq,authorityGranted:false};return;
  }
  if(type==='EVIDENCE_RECORDED'){
    shape(p,['criterionId','result','method','reference','summary']);
    id(p.criterionId);
    refuse(s.contract.criteria.some(c=>c.id===p.criterionId),'UNKNOWN_CRITERION');
    refuse(['PASS','FAIL'].includes(p.result),'RESULT');
    refuse(METHODS.includes(p.method),'METHOD');
    refuse(typeof p.reference==='string'&&p.reference.length<=300&&
      (/^https:\/\/[^\s\u0000-\u001f]{4,292}$/.test(p.reference)||/^sha256:[0-9a-f]{64}$/.test(p.reference)),'REFERENCE');
    checkedText(p.summary,240);
    refuse(s.evidence.length<80,'EVIDENCE_LIMIT');
    s.evidence.push({...p,sequence:seq,review:null,provenance:'OPERATOR_ENTERED_UNATTESTED'});return;
  }
  if(type==='EVIDENCE_REVIEWED'){
    shape(p,['evidenceSequence','reviewer','decision']);
    checkedText(p.reviewer,80);
    refuse(Number.isSafeInteger(p.evidenceSequence)&&p.evidenceSequence>0,'EVIDENCE_SEQUENCE');
    refuse(['ACCEPT','REJECT'].includes(p.decision),'REVIEW_DECISION');
    const e=s.evidence.find(x=>x.sequence===p.evidenceSequence);
    refuse(!!e&&!e.review,'REVIEW_ORDER');
    refuse(p.decision!=='ACCEPT'||e.result==='PASS','ACCEPT_FAILED');
    e.review={reviewer:p.reviewer,decision:p.decision,sequence:seq,independentlyAttested:false};return;
  }
  if(type==='CLOSED'){
    shape(p,['reviewer','note']);checkedText(p.reviewer,80);checkedText(p.note,240);
    refuse(readiness(s).ready,'NOT_READY');
    s.closed=true;s.close={...p,sequence:seq};return;
  }
  refuse(false,'EVENT_TYPE');
}
function publicState(s,events){
  const check=readiness(s);
  const status=s.closed?'VERIFIED_DONE_LOCAL':
    !s.contract?'EMPTY':
    s.actions.some(a=>!a.approval)?'APPROVAL_HELD':
    check.ready?'READY_TO_CLOSE':'EVIDENCE_PENDING';
  return {...s,readiness:check,status,eventCount:events.length,
    tailHash:events.at(-1)?.hash||null,
    verificationScope:'OPERATOR_REVIEW_PLUS_LOCAL_HASH_CHAIN_ONLY',
    externalExecutionAttested:false,authorityGranted:false};
}
export async function inspectBundle(bundle){
  shape(bundle,['schema','events']);
  refuse(bundle.schema===ANTIM_SCHEMA&&Array.isArray(bundle.events)&&
    bundle.events.length>=1&&bundle.events.length<=110,'BUNDLE');
  refuse(new TextEncoder().encode(JSON.stringify(bundle)).length<=MAX_BYTES,'SIZE');
  const s=blank();let prev='0'.repeat(64);
  for(let i=0;i<bundle.events.length;i++){
    const e=bundle.events[i];
    shape(e,['seq','at','type','payload','prevHash','hash']);
    refuse(e.seq===i+1,'SEQUENCE');timestamp(e.at);
    refuse(e.prevHash===prev&&typeof e.hash==='string'&&HEX.test(e.hash),'HASH_LINK');
    refuse(await digest({seq:e.seq,at:e.at,type:e.type,payload:e.payload,prevHash:e.prevHash})===e.hash,'HASH_MISMATCH');
    apply(s,e.type,e.payload,e.seq);prev=e.hash;
  }
  return publicState(s,bundle.events);
}
export async function createBundle({title,deliverable,criteria},contractId){
  checkedText(title,120);checkedText(deliverable,300);
  refuse(Array.isArray(criteria)&&criteria.length>=1&&criteria.length<=8,'CRITERIA');
  id(contractId);
  const contract={id:contractId,title:title.trim(),deliverable:deliverable.trim(),
    criteria:criteria.map((description,i)=>({id:'c'+(i+1),description:description.trim()}))};
  assertContract(contract);
  const base={schema:ANTIM_SCHEMA,events:[]};
  return appendEvent(base,'CONTRACT_CREATED',{contract});
}
export async function appendEvent(bundle,type,payload){
  shape(bundle,['schema','events']);refuse(bundle.schema===ANTIM_SCHEMA,'SCHEMA');
  if(bundle.events.length)await inspectBundle(bundle);
  else refuse(Array.isArray(bundle.events)&&Object.keys(bundle).length===2,'BUNDLE');
  const seq=bundle.events.length+1;
  const state=blank();
  for(const e of bundle.events)apply(state,e.type,e.payload,e.seq);
  apply(state,type,payload,seq);
  refuse(seq<=110,'EVENT_LIMIT');
  const head={seq,at:new Date().toISOString(),type,payload,prevHash:bundle.events.at(-1)?.hash||'0'.repeat(64)};
  const event={...head,hash:await digest(head)};
  const result={schema:ANTIM_SCHEMA,events:[...bundle.events,event]};
  await inspectBundle(result);
  return result;
}
export async function importBundle(json){
  refuse(typeof json==='string'&&new TextEncoder().encode(json).length<=MAX_BYTES,'SIZE');
  let b;try{b=JSON.parse(json);}catch{throw new Error('ANTIM_JSON');}
  await inspectBundle(b);return b;
}
export async function closureReceipt(bundle){
  const s=await inspectBundle(bundle);
  refuse(s.closed,'NOT_CLOSED');
  return {
    schema:'superphivessel.anti-m.closure-receipt.v0.1',
    contract_id:s.contract.id,title:s.contract.title,deliverable:s.contract.deliverable,
    status:s.status,reviewer:s.close.reviewer,
    evidence:s.contract.criteria.map(c=>{
      const e=s.evidence.filter(x=>x.criterionId===c.id).at(-1);
      return {criterion:c.description,method:e.method,reference:e.reference,
        reviewed_by:e.review.reviewer,result:e.result};
    }),
    actions:s.actions.map(a=>({kind:a.kind,description:a.description,reviewed_by:a.approval.reviewer})),
    ledger_tail_sha256:s.tailHash,ledger_events:s.eventCount,
    integrity:'RECOMPUTED_LOCAL_HASH_CHAIN',
    operator_reviewed:true,external_execution_independently_attested:false,
    operator_identity_authenticated:false,execution_authority_granted:false
  };
}
