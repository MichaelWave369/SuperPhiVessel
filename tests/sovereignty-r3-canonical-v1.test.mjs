import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto, createHash} from "node:crypto";
import {inspectCanonical, convertCanonical, CANONICAL_SCHEMA, CANONICAL_VERSION, AUDITED_RUNTIME, AUDITED_BLOB} from "../site/sovereignty/canonical-v1.mjs";
import {verify} from "../tools/sovereignty-r3/portable.mjs";
const sha=content=>createHash("sha256").update(content,"utf8").digest("hex");
function nativeCanon(value) {
  if(Array.isArray(value)) return value.map(nativeCanon);
  if(value && typeof value==="object") {
    const obj={};
    for(const key of Object.keys(value).filter(x=>x!=="bundleHash"&&x!=="bundleHashAlgorithm").sort()){
      obj[key]=nativeCanon(value[key]);
    }
    return obj;
  }
  return value;
}
function sealed(raw) {
  const b=structuredClone(raw);
  b.bundleHashAlgorithm="SHA-256";
  b.bundleHash=sha(JSON.stringify(nativeCanon(b)));
  return JSON.stringify(b);
}
function fixture(){
  const now=1792000000000;
  return {
    schema:CANONICAL_SCHEMA,version:CANONICAL_VERSION,exportedAt:"2026-11-13T19:00:00.000Z",
    sourceRuntime:AUDITED_RUNTIME,sourceVesselId:"vessel_synthetic",
    manifest:{
      identityTravels:true,provenanceTravels:true,evidenceTravels:true,authorityTravels:false,
      providerSecretsIncluded:false,activeBridgeIncluded:false,activeRequestIncluded:false,activeDraftIncluded:false,
      liveLeasesIncluded:false,liveGrantsIncluded:false,receiptsImportMode:"HISTORICAL_ARCHIVE_ONLY",
      receiptArchiveVersion:"PV-RECEIPT-ARCHIVE-0.1",receiptArchiveMerged:true,integrityRequired:true,
      historicalReceiptChain:"LINKED_PORTABLE_HISTORY"
    },
    vessel:{name:"Synthetic vessel",sourceActiveSessionId:"session_demo",stage:"quickchat",profile:"balanced",workspace:null},
    workObject:{
      schema:"phivessel.work.v1",version:"PV-WORK-0.1",id:"work_demo",vesselId:"vessel_synthetic",
      name:"Fictional garden",goal:"Plant imaginary trees.",constraints:"No real-world data.",
      nextAction:"Sketch a fictional park.",grants:["SYNTHETIC_GRANT_SHOULD_NEVER_EXPORT"],evidenceRefs:[],
      candidates:[],openQuestions:[],status:"ACTIVE",authority:"NONE",executionAuthority:"NONE",
      evidenceAuthority:"NONE",workflowAuthority:"NONE",leaseAuthority:"NONE",
      createdAt:now,updatedAt:now
    },
    memory:{
      schema:"phivessel.memory.v3",version:"0.3",vesselId:"vessel_synthetic",updatedAt:now,
      proposals:[{status:"PROPOSED",content:"SYNTHETIC_UNCOMMITTED_PROPOSAL_SHOULD_NEVER_EXPORT"}],
      records:[{
        id:"mem_demo",vesselId:"vessel_synthetic",type:"PREFERENCE",
        status:"ACTIVE",content:"Fictional resident likes moon gardens.",pinned:true,admittedUntil:null,
        allowedChambers:["quickchat"],createdAt:now,updatedAt:now,
        contentHash:"sample",sourceRunId:null,sourceReceiptId:null
      }]
    },
    conversations:[{
      id:"session_demo",title:"Imaginary plant chat",messages:[
        {id:"msg_user",role:"user",content:"Could we plant dream trees?",ts:now},
        {id:"msg_vessel",role:"vessel",content:"Only in our fictional scenario.",ts:now}
      ],
      vesselId:"vessel_synthetic",createdAt:now,updatedAt:now,savedAt:now,archived:false
    }],
    historicalReceipts:[],
    bundleHashAlgorithm:"SHA-256",bundleHash:""
  };
}
test("adapter pinned to exact canonical repo artifact declarations", () => {
  const manifest=JSON.parse(readFileSync(new URL("../runtime/MANIFEST.json",import.meta.url),"utf8"));
  const source=readFileSync(new URL("../"+manifest.runtime.path,import.meta.url),"utf8");
  assert.equal(manifest.runtime.git_blob_sha1,AUDITED_BLOB);
  assert.equal(manifest.runtime.version,"v"+AUDITED_RUNTIME);
  for(const code of [
    "const VESSEL_BUNDLE_SCHEMA='phivessel.bundle.v1'",
    "const VESSEL_BUNDLE_VERSION='PV-BUNDLE-0.1'",
    "const VESSEL_MEMORY_SCHEMA='phivessel.memory.v3'",
    "async function vesselBundleBuild(input)",
    "function vesselBundleCanonical(value)",
    "async function vesselBundleVerifyIntegrity(bundle)",
    "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.12'"
  ]) assert.ok(source.includes(code),"Canonical runtime source contract drifted: "+code);
});
test("audited canonical SHA-256 bundle yields native R0 portable text records",async()=>{
  const input=sealed(fixture());
  const info=await inspectCanonical(input,webcrypto.subtle);
  assert.equal(info.status,"CANONICAL_V1_SHA256_VERIFIED_TEXT_EXTRACTION_ONLY");
  assert.equal(info.conversations,1);
  assert.equal(info.messages,2);
  assert.equal(info.activeMemoryRecords,1);
  assert.equal(info.lossless,false);
  const out=await convertCanonical(input,webcrypto.subtle);
  const records=verify(out.archive).records;
  assert.deepEqual(records.map(x=>x.kind),["conversation","message","message","memory","work_object"]);
  assert.equal(records[1].parent_id,"conversation:session_demo");
  assert.equal(records[3].text,"Fictional resident likes moon gardens.");
  assert.match(records[4].text,/Next action: Sketch a fictional park/);
  assert.match(out.warning,/Text extraction only/);
  for(const forbidden of [
    "SYNTHETIC_GRANT_SHOULD_NEVER_EXPORT",
    "SYNTHETIC_UNCOMMITTED_PROPOSAL_SHOULD_NEVER_EXPORT",
    "admittedUntil","pinned"
  ]) assert.ok(!out.archive.includes(forbidden),"privileged/unsupported metadata leaked: "+forbidden);
});
test("corrupted source, wrong runtime and FNV-only fallback are denied",async()=>{
  const input=sealed(fixture());
  await assert.rejects(inspectCanonical(input.replace("Imaginary plant chat","Altered text"),webcrypto.subtle),/SHA-256 seal mismatch/);
  const drift=fixture();drift.sourceRuntime="2.0-alpha.11.0.54.99";
  await assert.rejects(inspectCanonical(sealed(drift),webcrypto.subtle),/runtime version not audited/);
  const old=fixture();old.bundleHashAlgorithm="FNV1A32_FALLBACK";
  await assert.rejects(inspectCanonical(JSON.stringify(old),webcrypto.subtle),/cryptographic SHA-256 seal required/);
});
test("strongly resealed false authority and unexpected receipt fields still fail boundary gate",async()=>{
  const altered=fixture();altered.manifest.authorityTravels=true;
  await assert.rejects(inspectCanonical(sealed(altered),webcrypto.subtle),/manifest policy mismatch/);
  const extra=fixture();extra.providerCredentials={token:"fake"};
  await assert.rejects(inspectCanonical(sealed(extra),webcrypto.subtle),/fields differ/);
  const badReceipt=fixture();
  badReceipt.historicalReceipts=[{
    chainIndex:0,prevPortableHash:"GENESIS",portableHash:"malicious",sourceHash:"fake",
    originalReceiptType:"ActionGrant",originalId:"grant",authority:"LIVE",
    executionAuthority:"EXECUTE",grantAuthority:"YES",leaseAuthority:"NONE",
    reactivationForbidden:false,source:{secret:"SYNTHETIC"}
  }];
  await assert.rejects(inspectCanonical(sealed(badReceipt),webcrypto.subtle),/historical chain mismatch|receipt boundary mismatch/);
});
test("unsupported/missing per-record timestamps and message roles never fabricate data",async()=>{
  const missing=fixture();delete missing.conversations[0].createdAt;
  await assert.rejects(convertCanonical(sealed(missing),webcrypto.subtle),/conversation createdAt timestamp missing/);
  const role=fixture();role.conversations[0].messages[0].role="system";
  await assert.rejects(convertCanonical(sealed(role),webcrypto.subtle),/message role requires separate review/);
  const invalid=fixture();invalid.memory.records[0].status="PROPOSED";
  await assert.rejects(convertCanonical(sealed(invalid),webcrypto.subtle),/non-active memory record/);
});
test("outer seal is still required even if a historical chain is empty",async()=>{
  const unsealed=fixture();
  await assert.rejects(inspectCanonical(JSON.stringify(unsealed),webcrypto.subtle),/cryptographic SHA-256 seal required/);
});
