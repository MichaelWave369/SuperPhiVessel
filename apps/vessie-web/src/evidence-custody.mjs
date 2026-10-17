/* SPV-AM-EG-V3.1: source custody + replayable shadow receipts.
 * Key admission is operator-controlled and OUTSIDE model-produced JSON.
 * A valid adapter signature proves control of an enrolled key, NOT factual truth.
 * Hashes detect accidental/tampered receipts when independently anchored;
 * an unsigned JSON hash is not identity authentication.
 * No effects, Anti-M ledger writes, routing, permissions or DONE.
 */
import {evaluateEvidenceGate,EVIDENCE_GATE_POLICY} from './evidence-gate.mjs';

export const CUSTODY_SCHEMA='superphivessel.evidence-gate.custody.v0.1';
export const CUSTODY_RECEIPT_SCHEMA='superphivessel.evidence-gate.shadow-receipt.v0.1';
export const CUSTODY_POLICY='SPV-AM-EG-V3.1';
const REPORT_MAX_MS=7*24*60*60*1000;
const OBSERVATION_MAX_MS=15*60*1000;
const FUTURE_SKEW_MS=30*1000;
const MAX_BYTES=65536;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const B64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const reject=(ok,code)=>{if(!ok)throw new Error('CUSTODY_'+code)};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function exact(x,keys){
  reject(isObj(x)&&Object.keys(x).sort().join('|')===[...keys].sort().join('|'),'FIELDS');
}
function time(x){
  reject(typeof x==='string'&&ISO.test(x)&&Number.isFinite(Date.parse(x))&&
    new Date(x).toISOString()===x,'TIME');
  return Date.parse(x);
}
function canonical(x){
  if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
  if(isObj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  return JSON.stringify(x);
}
function bytes(s){return new TextEncoder().encode(s);}
function binary(s){
  reject(typeof s==='string'&&s.length<=1024&&s.length>0&&B64.test(s),'BASE64');
  const normalized=btoa(atob(s));
  reject(normalized===s,'BASE64');
  return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}
function hex(bytesArr){return [...bytesArr].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function sha256(x){
  reject(typeof globalThis.crypto?.subtle?.digest==='function','CRYPTO_UNAVAILABLE');
  return hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes(x))));
}
function sizeCheck(x){
  reject(bytes(JSON.stringify(x)).length<=MAX_BYTES,'SIZE');
}
/* Public signing transcript; signing itself belongs only to the enrolled adapter. */
export function adapterMessage(source, adapterId, capturedAt){
  return 'SPV_EVIDENCE_SOURCE_V3_1\n'+canonical({adapterId,capturedAt,source});
}
async function verifiedSignature(source,record,key){
  if(typeof key!=='string')return false;
  try{
    const pub=await globalThis.crypto.subtle.importKey('raw',binary(key),
      {name:'Ed25519'},false,['verify']);
    return await globalThis.crypto.subtle.verify(
      {name:'Ed25519'},pub,binary(record.signature),
      bytes(adapterMessage(source,record.adapterId,record.capturedAt)));
  }catch{return false;}
}
function validateCustody(custody){
  exact(custody,['schema','records']);
  reject(custody.schema===CUSTODY_SCHEMA,'SCHEMA');
  reject(Array.isArray(custody.records)&&custody.records.length>=1&&
    custody.records.length<=24,'LIMIT');
  const ids=new Set();
  for(const c of custody.records){
    exact(c,['sourceId','adapterId','capturedAt','signature']);
    reject(typeof c.sourceId==='string'&&ID.test(c.sourceId)&&!ids.has(c.sourceId),'SOURCE_ID');
    ids.add(c.sourceId);
    reject(typeof c.adapterId==='string'&&ID.test(c.adapterId),'ADAPTER_ID');
    time(c.capturedAt);
    reject(c.signature===null||(typeof c.signature==='string'&&
      c.signature.length<=1024&&B64.test(c.signature)),'SIGNATURE_FORMAT');
  }
}
function validateContextShape(context){
  exact(context,['schema','sources']);
  reject(Array.isArray(context.sources)&&context.sources.length>=1&&
    context.sources.length<=24,'SOURCE_COUNT');
}
/* Trust keys are injected by host code/config, never accepted from a proposal,
 * receipt, pasted UI input or a model. Empty keyring = no verified admissions.
 */
export async function assessCustodiedProposal(input,asOf,trustKeys=Object.create(null)){
  exact(input,['proposal','context','custody']);sizeCheck(input);
  validateContextShape(input.context);validateCustody(input.custody);
  const asOfMs=time(asOf);
  reject(isObj(trustKeys)&&Object.keys(trustKeys).length<=16,'KEYRING');
  const contextIds=new Set(input.context.sources.map(s=>s.id));
  const custodyIds=new Set(input.custody.records.map(r=>r.sourceId));
  const violations=[];
  const add=code=>{if(!violations.includes(code))violations.push(code);};
  if(contextIds.size!==input.context.sources.length)add('DUPLICATE_CONTEXT_ID');
  for(const id of contextIds)if(!custodyIds.has(id))add('MISSING_CUSTODY');
  for(const id of custodyIds)if(!contextIds.has(id))add('UNMATCHED_CUSTODY');
  const lookup=new Map(input.context.sources.map(s=>[s.id,s]));
  for(const c of input.custody.records){
    const s=lookup.get(c.sourceId);
    if(!s)continue;
    const age=asOfMs-Date.parse(c.capturedAt);
    if(age < -FUTURE_SKEW_MS){add('FUTURE_EVIDENCE');continue;}
    if(s.provenance==='REPORTED'){
      if(c.adapterId!=='OPERATOR_REPORT'||c.signature!==null||s.kind!=='REPORT'){
        add('REPORT_CUSTODY_INVALID');
      }
      if(age>REPORT_MAX_MS)add('STALE_REPORT');
    }else if(s.provenance==='VERIFIED'){
      if(age>OBSERVATION_MAX_MS)add('STALE_VERIFIED_OBSERVATION');
      if(c.adapterId==='OPERATOR_REPORT'||c.signature===null){
        add('UNSIGNED_VERIFIED_OBSERVATION');
      }else if(!Object.hasOwn(trustKeys,c.adapterId)){
        add('UNTRUSTED_ADAPTER');
      }else if(!await verifiedSignature(s,c,trustKeys[c.adapterId])){
        add('INVALID_ADAPTER_SIGNATURE');
      }
    }else{
      add('UNKNOWN_PROVENANCE');
    }
  }
  let gateVerdict=null;
  if(!violations.length){
    gateVerdict=evaluateEvidenceGate(input.proposal,input.context);
  }
  return {
    schema:'superphivessel.evidence-gate.custody-verdict.v0.1',
    policyVersion:CUSTODY_POLICY,
    gatePolicyVersion:EVIDENCE_GATE_POLICY,
    decision:violations.length?'REJECT_CUSTODY':
      gateVerdict.decision==='REJECT'?'REJECT_POLICY':'ALLOW_ASSESSMENT_ONLY',
    custodyViolations:violations,
    gateVerdict,
    trustScope:'ENROLLED_KEY_SIGNATURE_OR_OPERATOR_REPORT_ONLY',
    signatureConfirmsSourceTruth:false,
    persistentLedgerWritten:false,
    closureGranted:false,
    executionAuthorityGranted:false
  };
}
export async function createShadowReceipt(input,asOf,trustKeys=Object.create(null)){
  const result=await assessCustodiedProposal(input,asOf,trustKeys);
  const head={
    schema:CUSTODY_RECEIPT_SCHEMA,asOf,input:structuredClone(input),result,
    receiptIntegrity:'UNSIGNED_SHA256_LOCAL_REPLAY_ONLY',
    persistentLedgerWritten:false,closureGranted:false,executionAuthorityGranted:false
  };
  const digest=await sha256('SPV_EVIDENCE_SHADOW_RECEIPT_V3_1\n'+canonical(head));
  const receipt={...head,sha256:digest};
  sizeCheck(receipt);
  return receipt;
}
export async function replayShadowReceipt(receipt,trustKeys=Object.create(null),currentAsOf=null){
  exact(receipt,['schema','asOf','input','result','receiptIntegrity',
    'persistentLedgerWritten','closureGranted','executionAuthorityGranted','sha256']);
  reject(receipt.schema===CUSTODY_RECEIPT_SCHEMA,'RECEIPT_SCHEMA');
  reject(receipt.receiptIntegrity==='UNSIGNED_SHA256_LOCAL_REPLAY_ONLY'&&
    receipt.persistentLedgerWritten===false&&receipt.closureGranted===false&&
    receipt.executionAuthorityGranted===false,'RECEIPT_AUTHORITY');
  reject(typeof receipt.sha256==='string'&&/^[0-9a-f]{64}$/.test(receipt.sha256),'HASH');
  sizeCheck(receipt);
  const {sha256:digest,...head}=receipt;
  reject(await sha256('SPV_EVIDENCE_SHADOW_RECEIPT_V3_1\n'+canonical(head))===digest,'HASH_MISMATCH');
  const historical=await assessCustodiedProposal(receipt.input,receipt.asOf,trustKeys);
  reject(canonical(historical)===canonical(receipt.result),'REPLAY_MISMATCH');
  const current=currentAsOf===null?null:
    await assessCustodiedProposal(receipt.input,currentAsOf,trustKeys);
  return {historical,current,hashVerified:true,externalAuthenticityProven:false,
    closureGranted:false,executionAuthorityGranted:false};
}
