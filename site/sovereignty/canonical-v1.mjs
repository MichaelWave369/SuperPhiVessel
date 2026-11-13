// Audited against canonical runtime/MANIFEST.json v2.0-alpha.11.0.54.12 source blob
// c9dc18eb76be9883d18014de129c07cf78c5a498, PV-BUNDLE-0.1 / phivessel.bundle.v1.
// Read-only, browser-side extraction of TEXT records. No identity/runtime restoration.
import {sha256, convert} from "./portable-web.mjs";

export const CANONICAL_SCHEMA = "phivessel.bundle.v1";
export const CANONICAL_VERSION = "PV-BUNDLE-0.1";
export const AUDITED_RUNTIME = "2.0-alpha.11.0.54.12";
export const AUDITED_BLOB = "c9dc18eb76be9883d18014de129c07cf78c5a498";
const MAX_BYTES = 2_000_000;
const MAX_ITEMS = 500;
const textBytes = new TextEncoder();
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const RESERVED = new Set(["__proto__", "prototype", "constructor"]);
function deny(text) {throw new Error("Canonical bundle refused: " + text);}
function isObj(obj) {return !!obj && typeof obj === "object" && !Array.isArray(obj);}
function requireObject(obj,label) {if(!isObj(obj))deny(label + " must be object");return obj;}
function exactFields(obj, fields, label) {
  requireObject(obj,label);
  if(Object.keys(obj).length!==fields.length || fields.some(k=>!Object.hasOwn(obj,k)))deny(label + " fields differ from audited schema");
}
function validString(value,label,limit=240,empty=false) {
  if(typeof value!=="string"||value.length>limit||(!empty&&!value.trim()))deny(label + " not a bounded string");
  return value;
}
function identity(value,label) {
  validString(value,label,128);
  if(!idPattern.test(value))deny(label + " invalid identifier");
  return value;
}
function epochUtc(value,label) {
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<=0||value>8.64e15)deny(label + " timestamp missing or invalid");
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))deny(label + " date invalid");
  return date.toISOString();
}
function iso(value,label) {
  validString(value,label,32);
  if(!UTC.test(value)||!Number.isFinite(Date.parse(value)))deny(label + " invalid ISO timestamp");
  return value;
}
// Mirrors vesselBundleCanonical(): recursively sorts keys and excludes only
// bundleHash and bundleHashAlgorithm, including nested occurrences.
function canonicalize(value,depth=0) {
  if(depth>32)deny("nested object limit exceeded");
  if(Array.isArray(value)) {
    if(value.length>3000)deny("array limit exceeded");
    return value.map(item=>canonicalize(item,depth+1));
  }
  if(isObj(value)){
    const keys=Object.keys(value);
    if(keys.length>600 || keys.some(key=>RESERVED.has(key)))deny("untrusted object key");
    const out=Object.create(null);
    keys.filter(key=>key!=="bundleHash"&&key!=="bundleHashAlgorithm").sort().forEach(key=>{
      out[key]=canonicalize(value[key],depth+1);
    });
    return out;
  }
  if(typeof value==="number"&&!Number.isFinite(value))deny("non-finite number");
  return value;
}
// Exact existing runtime's fastHash() for linked historical receipt verification.
// This is NOT cryptographic; the outer SHA-256 seal is mandatory here.
function fastHash(value) {
  let h=2166136261;
  const str=String(value||"");
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return ("00000000"+(h>>>0).toString(16)).slice(-8);
}
function verifyReceiptChain(receipts) {
  if(!Array.isArray(receipts)||receipts.length>3000)deny("historical receipts not a bounded array");
  let previous="GENESIS";
  for(let i=0;i<receipts.length;i++){
    const r=requireObject(receipts[i],"historical receipt");
    const payload={
      index:i,prev:previous,
      sourceHash:r.sourceHash||fastHash(JSON.stringify(r.source||{})),
      type:r.originalReceiptType||null,
      id:r.originalId||null
    };
    const digest=fastHash(JSON.stringify(payload));
    if(r.chainIndex!==i||r.prevPortableHash!==previous||r.portableHash!==digest)deny("historical chain mismatch at index "+i);
    if(r.authority!=="HISTORICAL_RECORD_ONLY"||r.executionAuthority!=="NONE"||
       r.grantAuthority!=="NONE"||r.leaseAuthority!=="NONE"||r.reactivationForbidden!==true){
      deny("historical receipt boundary mismatch at index "+i);
    }
    previous=digest;
  }
}
function validateBoundary(bundle) {
  exactFields(bundle,["schema","version","exportedAt","sourceRuntime","sourceVesselId","manifest","vessel","workObject","memory","conversations","historicalReceipts","bundleHashAlgorithm","bundleHash"],"bundle");
  if(bundle.schema!==CANONICAL_SCHEMA||bundle.version!==CANONICAL_VERSION)deny("unsupported bundle schema/version");
  // Only SHA-256-sealed canonical bundles are accepted; no FNV fallback security illusion.
  if(bundle.bundleHashAlgorithm!=="SHA-256"||!(/^[a-f0-9]{64}$/.test(bundle.bundleHash)))deny("cryptographic SHA-256 seal required");
  iso(bundle.exportedAt,"exportedAt");
  validString(bundle.sourceRuntime,"sourceRuntime",120);
  // Require the exact reviewed source version for this narrow adapter.
  if(bundle.sourceRuntime!==AUDITED_RUNTIME)deny("source runtime version not audited");
  validString(bundle.sourceVesselId,"sourceVesselId",128);
  const m=requireObject(bundle.manifest,"manifest");
  for(const [key,value] of Object.entries({
    identityTravels:true,provenanceTravels:true,evidenceTravels:true,authorityTravels:false,
    providerSecretsIncluded:false,activeBridgeIncluded:false,activeRequestIncluded:false,
    activeDraftIncluded:false,liveLeasesIncluded:false,liveGrantsIncluded:false,
    integrityRequired:true
  })) if(m[key]!==value)deny("manifest policy mismatch: "+key);
  if(m.receiptsImportMode!=="HISTORICAL_ARCHIVE_ONLY"||m.historicalReceiptChain!=="LINKED_PORTABLE_HISTORY")deny("receipt custody policy mismatch");
  const memory=requireObject(bundle.memory,"memory");
  if(memory.schema!=="phivessel.memory.v3"||!Array.isArray(memory.records)||memory.records.length>MAX_ITEMS)deny("memory schema or count invalid");
  if(!Array.isArray(bundle.conversations)||bundle.conversations.length>MAX_ITEMS)deny("conversation count invalid");
  requireObject(bundle.workObject,"workObject");
  requireObject(bundle.vessel,"vessel");
  verifyReceiptChain(bundle.historicalReceipts);
}
export async function inspectCanonical(sourceText, subtle=globalThis.crypto?.subtle) {
  if(typeof sourceText!=="string"||textBytes.encode(sourceText).byteLength>MAX_BYTES)deny("source exceeds 2MB pilot limit");
  let b;
  try{b=JSON.parse(sourceText);}catch{deny("invalid JSON");}
  validateBoundary(b);
  const computed=await sha256(JSON.stringify(canonicalize(b)),subtle);
  if(computed!==b.bundleHash)deny("bundle SHA-256 seal mismatch");
  // Counts only; no exported private values or historical receipt source.
  const messageCount=b.conversations.reduce((n,c)=>{
    if(!isObj(c)||!Array.isArray(c.messages)||c.messages.length>MAX_ITEMS)deny("malformed conversation messages");
    return n+c.messages.length;
  },0);
  if(messageCount>MAX_ITEMS)deny("message count exceeds pilot limit");
  return {
    status:"CANONICAL_V1_SHA256_VERIFIED_TEXT_EXTRACTION_ONLY",
    schema:b.schema,version:b.version,sourceRuntime:b.sourceRuntime,
    bundleHash:b.bundleHash,
    conversations:b.conversations.length,messages:messageCount,
    activeMemoryRecords:b.memory.records.length,
    historicalReceiptsExcluded:b.historicalReceipts.length,
    lossless:false,
    authority:"NONE"
  };
}
function rows(bundle) {
  const out={conversations:[],messages:[],memories:[],work_objects:[]};
  for(const c of bundle.conversations){
    requireObject(c,"conversation");
    const id=identity(c.id,"conversation id");
    const title=validString(c.title,"conversation title",240,true);
    const createdAt=epochUtc(c.createdAt,"conversation createdAt");
    const updatedAt=epochUtc(c.updatedAt||c.savedAt,"conversation updatedAt");
    if(!Array.isArray(c.messages))deny("missing messages");
    out.conversations.push({uid:id,label:title||"Conversation",body:"Conversation transcript is stored as linked message rows.",first_seen:createdAt,last_seen:updatedAt});
    for(const message of c.messages){
      requireObject(message,"message");
      const role=validString(message.role,"message role",40);
      if(role!=="user"&&role!=="vessel")deny("message role requires separate review");
      out.messages.push({
        uid:identity(message.id,"message id"),
        label:role,
        body:validString(message.content,"message text",20000,true),
        first_seen:epochUtc(message.ts,"message timestamp"),
        last_seen:epochUtc(message.ts,"message timestamp"),
        conversation_uid:id
      });
    }
  }
  for(const m of bundle.memory.records){
    requireObject(m,"memory record");
    if(m.status!=="ACTIVE")deny("non-active memory record needs separate export policy");
    out.memories.push({
      uid:identity(m.id,"memory id"),
      label:validString(m.type,"memory type",100),
      body:validString(m.content,"memory content",20000),
      first_seen:epochUtc(m.createdAt,"memory createdAt"),
      last_seen:epochUtc(m.updatedAt,"memory updatedAt")
    });
  }
  const w=bundle.workObject;
  const parts=[
    ["Goal",w.goal],["Constraints",w.constraints],["Next action",w.nextAction]
  ];
  const workText=parts.map(([label,value])=>label+": "+validString(value,"work."+label,4000,true)).join("\n\n");
  out.work_objects.push({
    uid:identity(w.id,"WorkObject id"),
    label:validString(w.name,"WorkObject name",240,true)||"WorkObject",
    body:workText,
    first_seen:epochUtc(w.createdAt,"workObject createdAt"),
    last_seen:epochUtc(w.updatedAt,"workObject updatedAt")
  });
  if(out.conversations.length+out.messages.length+out.memories.length+1>MAX_ITEMS)deny("portable record count exceeds 500");
  return out;
}
export async function convertCanonical(sourceText, subtle=globalThis.crypto?.subtle) {
  const evidence=await inspectCanonical(sourceText,subtle);
  const bundle=JSON.parse(sourceText);
  const flat=rows(bundle);
  const flatSource=JSON.stringify(flat);
  const sourceId="canonical_v1_"+evidence.bundleHash.slice(0,16);
  const fields=(parent=false)=>({
    id:["uid"],title:["label"],text:["body"],
    created_at:["first_seen"],updated_at:["last_seen"],
    parent_id:parent?["conversation_uid"]:null
  });
  const config={
    schema:"spv.sovereignty.operator-map.v0.1",
    source_sha256:await sha256(flatSource,subtle),
    exported_at:bundle.exportedAt,
    collections:[
      {kind:"conversation",source_id:sourceId,items_path:["conversations"],parent_kind:null,fields:fields()},
      {kind:"message",source_id:sourceId,items_path:["messages"],parent_kind:"conversation",fields:fields(true)},
      {kind:"memory",source_id:sourceId,items_path:["memories"],parent_kind:null,fields:fields()},
      {kind:"work_object",source_id:sourceId,items_path:["work_objects"],parent_kind:null,fields:fields()}
    ]
  };
  const result=await convert(flatSource,JSON.stringify(config),subtle);
  return {...result,evidence,warning:"Text extraction only: memory horizon/pins, work grants, message attachments and historical receipt contents are not represented. No identity or authority can transfer."};
}
