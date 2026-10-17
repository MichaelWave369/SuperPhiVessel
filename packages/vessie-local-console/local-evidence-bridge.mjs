/* SPV-AM-EG-V3.2: operator-triggered, read-only local Ollama inventory capture.
 * Uses the repo's existing fixed-loopback /api/tags + /api/ps probe.
 * Signatures prove possession of an operator-enrolled local key, NOT source truth.
 * NOT a V3.1 switch-incident source, model approval, attestation, or command.
 */
import {createHash,createPrivateKey,createPublicKey,randomBytes,sign,verify} from 'node:crypto';
import {discoverOllama} from './ollama-probe.mjs';

export const BRIDGE_SNAPSHOT_SCHEMA='superphivessel.local-evidence-bridge.snapshot.v0.1';
export const BRIDGE_RECEIPT_SCHEMA='superphivessel.local-evidence-bridge.signed-receipt.v0.1';
export const BRIDGE_ADAPTER_ID='VESSIE_OLLAMA_BRIDGE_V1';
const MAX_RECEIPT_BYTES=65536;
const MAX_MODELS=128;
const FRESH_MS=15*60*1000;
const FUTURE_TOLERANCE_MS=30000;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const NONCE=/^[a-f0-9]{32}$/;
const LOCATION=['LOCAL_WEIGHTS_REPORTED','CLOUD_REFERENCE','UNKNOWN'];
const BASIS=['REMOTE_METADATA','CLOUD_TAG_HINT','POSITIVE_SIZE_REPORT','INSUFFICIENT_METADATA'];
const noControl=s=>typeof s==='string'&&!/[\u0000-\u001f\u007f]/.test(s);
const integerOrNull=x=>x===null||(Number.isSafeInteger(x)&&x>=0);
const refuse=(yes,code)=>{if(!yes)throw new Error('LOCAL_EVIDENCE_'+code)};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function shape(x,keys){
  refuse(plain(x)&&Object.keys(x).sort().join('|')===[...keys].sort().join('|'),'FIELDS');
}
function canonical(x){
  if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
  if(plain(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  return JSON.stringify(x);
}
const message=x=>Buffer.from('SPV_LOCAL_OLLAMA_OBSERVATION_V3_2\n'+canonical(x),'utf8');
const fingerprint=key=>createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
function iso(value){
  refuse(typeof value==='string'&&ISO.test(value)&&Number.isFinite(Date.parse(value))&&
    new Date(value).toISOString()===value,'TIMESTAMP');
  return Date.parse(value);
}
function text(x,max){return noControl(x)&&x.length>0&&x.length<=max;}
function validateModel(m){
  shape(m,['name','executionLocation','classificationBasis','loaded','sizeBytes',
    'runtimeVramBytes','parameterSize','quantization']);
  refuse(text(m.name,128),'MODEL_NAME');
  refuse(LOCATION.includes(m.executionLocation),'MODEL_LOCATION');
  refuse(BASIS.includes(m.classificationBasis),'MODEL_BASIS');
  refuse(m.executionLocation!=='LOCAL_WEIGHTS_REPORTED'||
    (m.classificationBasis==='POSITIVE_SIZE_REPORT'&&m.sizeBytes>0),'LOCALITY_BASIS');
  refuse(typeof m.loaded==='boolean','LOADED');
  refuse(integerOrNull(m.sizeBytes)&&integerOrNull(m.runtimeVramBytes),'MODEL_SIZE');
  refuse(m.parameterSize===null||text(m.parameterSize,48),'MODEL_PARAMETERS');
  refuse(m.quantization===null||text(m.quantization,48),'MODEL_QUANTIZATION');
}
function validateSnapshot(s){
  shape(s,['schema','adapterId','capturedAt','nonce','inventory','readOnly',
    'executionAuthorityGranted','routingApproved','closureGranted']);
  refuse(s.schema===BRIDGE_SNAPSHOT_SCHEMA&&s.adapterId===BRIDGE_ADAPTER_ID &&
    s.readOnly===true&&s.executionAuthorityGranted===false&&
    s.routingApproved===false&&s.closureGranted===false,'SNAPSHOT_SCOPE');
  iso(s.capturedAt);refuse(typeof s.nonce==='string'&&NONCE.test(s.nonce),'NONCE');
  shape(s.inventory,['source','probeStatus','modelCount','loadedCount','models',
    'modelClassificationIsAdvisory']);
  const i=s.inventory;
  refuse(i.source==='OLLAMA_FIXED_LOOPBACK_TAGS_AND_PS' &&
    ['AVAILABLE','UNAVAILABLE'].includes(i.probeStatus) &&
    i.modelClassificationIsAdvisory===true,'INVENTORY_SCOPE');
  refuse(Array.isArray(i.models)&&i.models.length<=MAX_MODELS &&
    Number.isSafeInteger(i.modelCount)&&i.modelCount===i.models.length &&
    Number.isSafeInteger(i.loadedCount)&&i.loadedCount===i.models.filter(m=>m.loaded).length,
    'MODEL_COUNT');
  refuse(i.probeStatus==='AVAILABLE'||i.modelCount===0,'UNAVAILABLE_MODELS');
  const seen=new Set();
  for(const m of i.models){
    validateModel(m);
    refuse(!seen.has(m.name),'DUPLICATE_MODEL');seen.add(m.name);
  }
}
function projectProbe(p){
  refuse(plain(p)&&p.schema==='superphivessel.gateway.models.v0.1' &&
    p.provider==='OLLAMA'&&p.provider_origin==='LOCAL_LOOPBACK_FIXED' &&
    ['AVAILABLE','UNAVAILABLE'].includes(p.probe_status) &&
    p.authority_granted===false&&p.can_execute===false&&
    Array.isArray(p.models)&&p.models.length<=MAX_MODELS,'PROBE_INVALID');
  const models=p.models.map(m=>{
    refuse(plain(m)&&noControl(m.name)&&m.name.length>0&&m.name.length<=128,
      'PROBE_MODEL_NAME');
    const entry={
      name:m.name,
      executionLocation:m.execution_location,
      classificationBasis:m.classification_basis,
      loaded:m.loaded===true,
      sizeBytes:m.size_bytes??null,
      runtimeVramBytes:m.runtime_vram_bytes??null,
      parameterSize:m.parameter_size??null,
      quantization:m.quantization??null
    };
    validateModel(entry);
    return entry;
  });
  refuse(p.probe_status==='AVAILABLE'||models.length===0,'PROBE_UNAVAILABLE_WITH_MODELS');
  return {
    source:'OLLAMA_FIXED_LOOPBACK_TAGS_AND_PS',
    probeStatus:p.probe_status,
    modelCount:models.length,
    loadedCount:models.filter(m=>m.loaded).length,
    models,
    modelClassificationIsAdvisory:true
  };
}
function keyPrivate(pem){
  refuse(typeof pem==='string'&&pem.length<8192,'PRIVATE_KEY_INPUT');
  let key;try{key=createPrivateKey(pem);}catch{throw new Error('LOCAL_EVIDENCE_PRIVATE_KEY_INVALID');}
  refuse(key.asymmetricKeyType==='ed25519','PRIVATE_KEY_TYPE');
  return key;
}
function keyPublic(pem){
  refuse(typeof pem==='string'&&pem.length<8192,'PUBLIC_KEY_INPUT');
  let key;try{key=createPublicKey(pem);}catch{throw new Error('LOCAL_EVIDENCE_PUBLIC_KEY_INVALID');}
  refuse(key.asymmetricKeyType==='ed25519','PUBLIC_KEY_TYPE');
  return key;
}

/** One explicit capture. Does not run or install models, touch BrainC, or write a ledger.
 * The injected probe is test-only; the CLI uses the real fixed-loopback probe.
 */
export async function captureLocalOllamaEvidence({
  privateKeyPem, probe=discoverOllama, capturedAt=new Date().toISOString(),
  nonce=randomBytes(16).toString('hex')
}={}){
  const key=keyPrivate(privateKeyPem);
  iso(capturedAt);refuse(NONCE.test(nonce),'NONCE');
  const result=await probe();
  const inventory=projectProbe(result);
  const snapshot={
    schema:BRIDGE_SNAPSHOT_SCHEMA,adapterId:BRIDGE_ADAPTER_ID,capturedAt,nonce,
    inventory,readOnly:true,executionAuthorityGranted:false,routingApproved:false,
    closureGranted:false
  };
  validateSnapshot(snapshot);
  const signature=sign(null,message(snapshot),key).toString('base64');
  const receipt={
    schema:BRIDGE_RECEIPT_SCHEMA,snapshot,
    signature:{algorithm:'Ed25519',keyFingerprint:fingerprint(createPublicKey(key)),
      valueBase64:signature},
    sourceTruthAttested:false,persistentLedgerWritten:false,
    closureGranted:false,executionAuthorityGranted:false
  };
  refuse(Buffer.byteLength(JSON.stringify(receipt),'utf8')<=MAX_RECEIPT_BYTES,'RECEIPT_TOO_LARGE');
  return receipt;
}

/** Public key is loaded OUT OF BAND, never trusted from the receipt. */
export function verifyLocalOllamaEvidence(receipt,{publicKeyPem,asOf=new Date().toISOString()}={}){
  shape(receipt,['schema','snapshot','signature','sourceTruthAttested',
    'persistentLedgerWritten','closureGranted','executionAuthorityGranted']);
  refuse(receipt.schema===BRIDGE_RECEIPT_SCHEMA &&
    receipt.sourceTruthAttested===false&&receipt.persistentLedgerWritten===false&&
    receipt.closureGranted===false&&receipt.executionAuthorityGranted===false,
    'RECEIPT_SCOPE');
  refuse(Buffer.byteLength(JSON.stringify(receipt),'utf8')<=MAX_RECEIPT_BYTES,'RECEIPT_TOO_LARGE');
  validateSnapshot(receipt.snapshot);
  shape(receipt.signature,['algorithm','keyFingerprint','valueBase64']);
  refuse(receipt.signature.algorithm==='Ed25519'&&
    typeof receipt.signature.keyFingerprint==='string'&&
    /^[a-f0-9]{64}$/.test(receipt.signature.keyFingerprint) &&
    typeof receipt.signature.valueBase64==='string'&&
    /^[a-zA-Z0-9+/]{86}==$/.test(receipt.signature.valueBase64),'SIGNATURE_FORMAT');
  const key=keyPublic(publicKeyPem);
  refuse(fingerprint(key)===receipt.signature.keyFingerprint,'KEY_FINGERPRINT_MISMATCH');
  const signature=Buffer.from(receipt.signature.valueBase64,'base64');
  refuse(signature.length===64&&signature.toString('base64')===receipt.signature.valueBase64,
    'SIGNATURE_ENCODING');
  refuse(verify(null,message(receipt.snapshot),key,signature),'SIGNATURE_INVALID');
  const age=iso(asOf)-iso(receipt.snapshot.capturedAt);
  const state=age < -FUTURE_TOLERANCE_MS?'FUTURE':
    age>FRESH_MS?'STALE':
    receipt.snapshot.inventory.probeStatus!=='AVAILABLE'?'UNAVAILABLE':'FRESH';
  return {
    schema:'superphivessel.local-evidence-bridge.verification.v0.1',
    signatureValid:true,adapterKeyFingerprint:receipt.signature.keyFingerprint,
    freshness:state,inventoryAvailable:receipt.snapshot.inventory.probeStatus==='AVAILABLE',
    modelCount:receipt.snapshot.inventory.modelCount,
    sourceTruthAttested:false,localHardwareAttested:false,
    executionAuthorityGranted:false,routingApproved:false,
    closureGranted:false,persistentLedgerWritten:false,
    importIntoIncidentEvidenceGateAllowed:false
  };
}
