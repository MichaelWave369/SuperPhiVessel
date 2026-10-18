import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,readFileSync,existsSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
 BRIDGE_SNAPSHOT_SCHEMA,BRIDGE_RECEIPT_SCHEMA,
 captureLocalOllamaEvidence,verifyLocalOllamaEvidence
} from '../local-evidence-bridge.mjs';
import {discoverOllama} from '../ollama-probe.mjs';

const NOW='2026-10-17T20:00:00.000Z';
const KEY=()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 return {privateKeyPem:privateKey.export({format:'pem',type:'pkcs8'}),
   publicKeyPem:publicKey.export({format:'pem',type:'spki'})};
};
const available=()=>({
 schema:'superphivessel.gateway.models.v0.1',provider:'OLLAMA',
 provider_origin:'LOCAL_LOOPBACK_FIXED',probe_status:'AVAILABLE',
 models:[
  {name:'granite4.2:8b',execution_location:'LOCAL_WEIGHTS_REPORTED',
   classification_basis:'POSITIVE_SIZE_REPORT',loaded:true,
   size_bytes:5300000000,runtime_vram_bytes:8100000000,
   parameter_size:'8B',quantization:'Q4_K_M',
   remote_host:'DO_NOT_COPY',access_token:'DO_NOT_COPY'},
  {name:'kimi-k3:cloud',execution_location:'CLOUD_REFERENCE',
   classification_basis:'CLOUD_TAG_HINT',loaded:false,size_bytes:0,
   runtime_vram_bytes:null,parameter_size:null,quantization:null}
 ],
 authority_granted:false,can_execute:false
});
const make=(key,raw=available())=>captureLocalOllamaEvidence({
 privateKeyPem:key.privateKeyPem,probe:async()=>raw,
 capturedAt:NOW,nonce:'a'.repeat(32)
});
const verify=(receipt,key,asOf=NOW)=>verifyLocalOllamaEvidence(receipt,{
 publicKeyPem:key.publicKeyPem,asOf
});
test('L32-01 operator one-shot signs sanitized loopback inventory without powers',async()=>{
 const key=KEY(),r=await make(key),v=verify(r,key);
 assert.equal(r.schema,BRIDGE_RECEIPT_SCHEMA);
 assert.equal(r.snapshot.schema,BRIDGE_SNAPSHOT_SCHEMA);
 assert.equal(v.signatureValid,true);
 assert.equal(v.freshness,'FRESH');
 assert.equal(v.modelCount,2);
 assert.equal(r.snapshot.inventory.loadedCount,1);
 assert.equal(r.snapshot.inventory.models[1].executionLocation,'CLOUD_REFERENCE');
 assert.equal(v.importIntoIncidentEvidenceGateAllowed,false);
 assert.equal(v.executionAuthorityGranted,false);
 assert.equal(v.sourceTruthAttested,false);
 assert.ok(!JSON.stringify(r).includes('DO_NOT_COPY'));
 assert.ok(!JSON.stringify(r).includes(key.privateKeyPem));
});
test('L32-02 manipulated model size, status or capture time breaks signature',async()=>{
 const key=KEY(),r=await make(key);
 for(const mutate of [
  x=>{x.snapshot.inventory.models[0].sizeBytes=10;},
  x=>{x.snapshot.inventory.probeStatus='UNAVAILABLE';},
  x=>{x.snapshot.capturedAt='2026-10-17T20:00:05.000Z';}
 ]){
  const x=structuredClone(r);mutate(x);
  assert.throws(()=>verify(x,key),/LOCAL_EVIDENCE_(SIGNATURE_INVALID|UNAVAILABLE_MODELS)/);
 }
});
test('L32-03 a different public key fails independent fingerprint pin',async()=>{
 const real=KEY(),wrong=KEY(),r=await make(real);
 assert.throws(()=>verify(r,wrong),/LOCAL_EVIDENCE_KEY_FINGERPRINT_MISMATCH/);
});
test('L32-04 expired and future observations never get freshness',async()=>{
 const key=KEY(),r=await make(key);
 assert.equal(verify(r,key,'2026-10-17T20:30:00.000Z').freshness,'STALE');
 assert.equal(verify(r,key,'2026-10-17T19:59:00.000Z').freshness,'FUTURE');
});
test('L32-05 signed unavailable observation is not presented as healthy',async()=>{
 const key=KEY(),raw={...available(),probe_status:'UNAVAILABLE',models:[]};
 const r=await make(key,raw),v=verify(r,key);
 assert.equal(v.freshness,'UNAVAILABLE');assert.equal(v.inventoryAvailable,false);
 assert.equal(v.modelCount,0);assert.equal(v.executionAuthorityGranted,false);
});
test('L32-06 model classifications are advisory, and unsupported locality fails closed',async()=>{
 const key=KEY(),raw=available();
 raw.models[0].execution_location='LOCAL_FULLY_TESTED';
 await assert.rejects(make(key,raw),/LOCAL_EVIDENCE_MODEL_LOCATION/);
 const bad=available();bad.models[0].classification_basis='CLOUD_TAG_HINT';
 await assert.rejects(make(key,bad),/LOCAL_EVIDENCE_LOCALITY_BASIS/);
});
test('L32-07 duplicates, oversized inventories and model execution authority refuse',async()=>{
 const key=KEY(),duplicate=available();
 duplicate.models.push({...duplicate.models[0]});
 await assert.rejects(make(key,duplicate),/LOCAL_EVIDENCE_DUPLICATE_MODEL/);
 const huge=available();
 huge.models=Array.from({length:129},(_,i)=>({...huge.models[1],name:'cloud-'+i+':cloud'}));
 await assert.rejects(make(key,huge),/LOCAL_EVIDENCE_PROBE_INVALID/);
 const grant={...available(),authority_granted:true};
 await assert.rejects(make(key,grant),/LOCAL_EVIDENCE_PROBE_INVALID/);
});
test('L32-08 forged authority fields or arbitrary receipt fields refuse',async()=>{
 const key=KEY(),r=await make(key);
 for(const change of [
  x=>{x.executionAuthorityGranted=true;},
  x=>{x.canExecute=true;},
  x=>{x.snapshot.routingApproved=true;},
  x=>{x.signature.algorithm='RSA';}
 ]){
  const x=structuredClone(r);change(x);
  assert.throws(()=>verify(x,key),/LOCAL_EVIDENCE_/);
 }
});
test('L32-09 existing probe performs only GET requests to fixed loopback tags and ps',async()=>{
 const visited=[];
 const response=data=>new Response(JSON.stringify(data),{
  status:200,headers:{'content-type':'application/json'}
 });
 const probe=await discoverOllama({fetchImpl:async(url,opts)=>{
  visited.push({url,method:opts.method,redirect:opts.redirect});
  if(url.endsWith('/api/tags'))return response({models:[{
   name:'granite4.2:8b',size:5300000000,details:{quantization_level:'Q4_K_M'}
  }]});
  if(url.endsWith('/api/ps'))return response({models:[]});
  throw new Error('unexpected route');
 }});
 assert.equal(probe.probe_status,'AVAILABLE');
 assert.deepEqual(visited.map(x=>x.url).sort(),[
  'http://127.0.0.1:11434/api/ps','http://127.0.0.1:11434/api/tags']);
 for(const x of visited){assert.equal(x.method,'GET');assert.equal(x.redirect,'error');}
 const key=KEY(),r=await make(key,probe);
 assert.equal(verify(r,key).freshness,'FRESH');
});
test('L32-10 untrusted client cannot present a cloud alias as local weights',async()=>{
 const key=KEY(),raw=available();
 raw.models[1].execution_location='LOCAL_WEIGHTS_REPORTED';
 raw.models[1].classification_basis='CLOUD_TAG_HINT';
 await assert.rejects(make(key,raw),/LOCAL_EVIDENCE_LOCALITY_BASIS/);
});
test('L32-11 signer enrollment is explicit, out-of-repo, and refuses key overwrite',()=>{
 const root=mkdtempSync(join(tmpdir(),'vessie-key-fixture-'));
 try {
  const dir=join(root,'private-keys');
  const script=fileURLToPath(new URL('../local-evidence-cli.mjs',import.meta.url));
  const run=(args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
  const first=run(['enroll','--key-dir',dir]);
  assert.equal(first.status,0,first.stderr);
  assert.ok(existsSync(join(dir,'private.pem')));
  assert.ok(existsSync(join(dir,'public.pem')));
  const priv=readFileSync(join(dir,'private.pem'),'utf8');
  assert.match(priv,/BEGIN PRIVATE KEY/);
  if(process.platform!=='win32')assert.equal(statSync(join(dir,'private.pem')).mode&0o077,0);
  const second=run(['enroll','--key-dir',dir]);
  assert.equal(second.status,2);
  assert.match(second.stderr,/EXISTING_KEY_REFUSED/);
  assert.equal(readFileSync(join(dir,'private.pem'),'utf8'),priv);
  const inRepo=run(['enroll','--key-dir',resolve('packages/vessie-local-console')]);
  assert.equal(inRepo.status,2);
  assert.match(inRepo.stderr,/REPOSITORY_PATH_DENIED/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('L32-12 verify CLI operates offline using a separately supplied public key',async()=>{
 const key=KEY(),receipt=await make(key);
 const root=mkdtempSync(join(tmpdir(),'vessie-replay-fixture-'));
 try{
  const {writeFileSync}=await import('node:fs');
  const pub=join(root,'pinned-public.pem'),file=join(root,'receipt.json');
  writeFileSync(pub,key.publicKeyPem);
  writeFileSync(file,JSON.stringify(receipt));
  const script=fileURLToPath(new URL('../local-evidence-cli.mjs',import.meta.url));
  const run=spawnSync(process.execPath,[script,'verify','--public-key',pub,
    '--receipt',file],{encoding:'utf8'});
  // Historical fixture is stale on future wall clocks, but signature is checked.
  assert.equal(run.status,3,run.stderr);
  const result=JSON.parse(run.stdout);
  assert.equal(result.signatureValid,true);
  assert.equal(result.freshness,'STALE');
  assert.equal(result.executionAuthorityGranted,false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
