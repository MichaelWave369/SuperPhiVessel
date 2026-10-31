import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  verifyPhiServeDraftPair,makePhiServeDeskReview,ModelDeskError,
  MODEL_DESK_SCHEMA,SOURCE_DRAFT_SCHEMA,MAX_RECEIPT_BYTES,MAX_TEXT_BYTES,
} from '../ui/model-desk.mjs';
const enc=new TextEncoder();
const TEXT='An untrusted model draft. 世界. Human review required.';
const hash=x=>createHash('sha256').update(x).digest('hex');
const ts='2026-10-31T20:23:45.000Z';
const fixture=(text=TEXT)=>({
  schema:SOURCE_DRAFT_SCHEMA,status:'LOCAL_TEXT_RETURNED_UNVERIFIED',
  evidence_class:'OPERATOR_PROCESS_SELF_REPORTED',
  provider:'PHISERVE_LOCAL_GGUF',model_alias:'registered-gguf',
  request_id:'fixture-request-1',observed_at:ts,
  prompt_sha256:'a'.repeat(64),response_sha256:hash(text),
  prompt_chars:19,response_chars:text.length,requested_output_token_cap:128,
  user_initiated:true,approval_scope:'THIS_SINGLE_DRAFT_REQUEST',
  source_input_included:false,response_text_included:false,
  bearer_token_included:false,memory_accessed:false,
  tool_execution_attempted:false,tool_execution_authorized:false,
  route_approved:false,canonical_runtime_connected:false,
  operator_authority_granted:false,attestation:'NOT_INDEPENDENTLY_VERIFIED',
  note:'Model text is an untrusted proposal only; canonical Vessie routing and executor gates are untouched.',
});
const pair=(receipt=fixture(),text=TEXT)=>({
  receiptBytes:enc.encode(JSON.stringify(receipt,null,2)+'\n'),
  draftBytes:enc.encode(text),cryptoImpl:webcrypto,
});
test('MD01 exact UTF-8 bytes match local receipt without granting evidence authority',async()=>{
  const result=await verifyPhiServeDraftPair(pair());
  assert.equal(result.status,'LOCAL_FILE_CONSISTENCY_MATCH_ONLY');
  assert.equal(result.draft_text,TEXT);
  assert.equal(result.response_sha256,hash(TEXT));
  assert.equal(result.provenance_independently_authenticated,false);
  assert.equal(result.model_executed_independently_witnessed,false);
  assert.equal(result.physical_gpu_execution_verified,false);
  assert.equal(result.operator_authority_granted,false);
  assert.ok(Object.isFrozen(result));
});
test('MD02 edits to model text refuse SHA-256 parity',async()=>{
  const edited=TEXT.replace('Human','Robot');
  assert.equal(edited.length,TEXT.length);
  await assert.rejects(verifyPhiServeDraftPair(pair(fixture(),edited)),
    error=>error.code==='DRAFT_SHA256_MISMATCH');
});
test('MD03 altered authority or fake independent attestation is rejected',async()=>{
  for(const change of [
    {operator_authority_granted:true},{tool_execution_authorized:true},
    {route_approved:true},{canonical_runtime_connected:true},
    {memory_accessed:true},{bearer_token_included:true},
    {user_initiated:false},{status:'READY_FOR_EXECUTION'},
    {attestation:'PROVEN_GPU_EXECUTION'},{provider:'REMOTE_CLOUD'},
  ]){
    await assert.rejects(verifyPhiServeDraftPair(pair({...fixture(),...change})),
      error=>error.code==='RECEIPT_CONTRACT_OR_AUTHORITY_INVALID');
  }
});
test('MD04 extra secret fields or injected actions are rejected',async()=>{
  await assert.rejects(verifyPhiServeDraftPair(pair({...fixture(),
    hidden_token:'SECRET',activateExecutor:true})),
    error=>error.code==='RECEIPT_CONTRACT_OR_AUTHORITY_INVALID');
});
test('MD05 missing, malformed, nonobject, and wrong-schema receipts rejected',async()=>{
  for(const receiptBytes of [
    new Uint8Array(),enc.encode('{bad'),enc.encode('[]'),
    enc.encode('"string"'),enc.encode('{"untrusted":true}'),
  ]){
    await assert.rejects(verifyPhiServeDraftPair({...pair(),receiptBytes}),
      error=>error instanceof ModelDeskError);
  }
});
test('MD06 empty, invalid-UTF8 and oversized drafts rejected',async()=>{
  for(const [value,code] of [
    [new Uint8Array(),'DRAFT_FILE_INVALID_OR_OVERSIZED'],
    [new Uint8Array(MAX_TEXT_BYTES+1),'DRAFT_FILE_INVALID_OR_OVERSIZED'],
    [new Uint8Array([0xc3,0x28]),'DRAFT_UTF8_INVALID'],
  ]){
    await assert.rejects(verifyPhiServeDraftPair({...pair(),draftBytes:value}),
      error=>error.code===code);
  }
  await assert.rejects(verifyPhiServeDraftPair(pair(fixture('  '),'  ')),
    error=>error.code==='DRAFT_EMPTY');
});
test('MD07 oversized JSON receipt is rejected',async()=>{
  await assert.rejects(verifyPhiServeDraftPair({
    ...pair(),receiptBytes:enc.encode('x'.repeat(MAX_RECEIPT_BYTES+1)),
  }),error=>error instanceof ModelDeskError);
});
test('MD08 forged hashes, counts, aliases or cap are refused',async()=>{
  for(const change of [
    {response_sha256:'F'.repeat(64)},{prompt_sha256:'invalid'},
    {response_chars:1},{prompt_chars:-1},
    {requested_output_token_cap:999},{model_alias:'evil\nheader'},
  ])await assert.rejects(verifyPhiServeDraftPair(pair({...fixture(),...change})),
    error=>error.code==='RECEIPT_CONTRACT_OR_AUTHORITY_INVALID'||
      error.code==='DRAFT_CHARACTER_COUNT_MISMATCH');
});
test('MD09 human review is a redacted categorical self-report, never approval',async()=>{
  const verified=await verifyPhiServeDraftPair(pair());
  const receipt=makePhiServeDeskReview(verified,{
    usefulness:'SOMEWHAT_USEFUL',completeness:'UNSURE',
    verification:'NOT_CHECKED',reviewedAt:ts,
  });
  assert.equal(receipt.schema,MODEL_DESK_SCHEMA);
  assert.equal(receipt.source_response_sha256,hash(TEXT));
  for(const k of ['operator_authority_granted','tool_execution_authorized',
    'canonical_runtime_connected','model_routing_approved','quality_gate_approved',
    'can_promote','may_deploy','prompt_included',
    'generated_text_included','bearer_token_included'])assert.equal(receipt[k],false,k);
  assert.ok(Object.isFrozen(receipt));
  assert.doesNotMatch(JSON.stringify(receipt),/An untrusted model draft|Human review required|secret/);
});
test('MD10 forged verified-shaped objects cannot become human review receipts',()=>{
  const forged={...fixture(),status:'LOCAL_FILE_CONSISTENCY_MATCH_ONLY',
    receipt_file_sha256:'b'.repeat(64),content_trusted:false};
  assert.throws(()=>makePhiServeDeskReview(forged,{
    usefulness:'VERY_USEFUL',completeness:'UNSURE',verification:'NOT_CHECKED',reviewedAt:ts,
  }),error=>error.code==='REVIEW_REQUIRES_MATCHED_UNTRUSTED_DRAFT');
});
test('MD11 review categories and timestamp are bounded',async()=>{
  const verified=await verifyPhiServeDraftPair(pair());
  for(const args of [
    {usefulness:'ALLOW_EXECUTION',completeness:'UNSURE',verification:'NOT_CHECKED',reviewedAt:ts},
    {usefulness:'VERY_USEFUL',completeness:'APPROVED',verification:'NOT_CHECKED',reviewedAt:ts},
    {usefulness:'VERY_USEFUL',completeness:'UNSURE',verification:'CERTIFIED',reviewedAt:ts},
    {usefulness:'VERY_USEFUL',completeness:'UNSURE',verification:'NOT_CHECKED',reviewedAt:'tomorrow'},
  ])assert.throws(()=>makePhiServeDeskReview(verified,args));
});
test('MD12 browser view is file-only with safe textContent and allowlisted assets',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const ui=readFileSync(root+'ui/model-desk-ui.mjs','utf8');
  const app=readFileSync(root+'ui/app.js','utf8');
  const server=readFileSync(root+'server.mjs','utf8');
  assert.match(app,/import '\.\/model-desk-ui\.mjs'/);
  assert.match(server,/'\/model-desk\.mjs'/);
  assert.match(server,/'\/model-desk-ui\.mjs'/);
  for(const bad of [/fetch\(/,/localStorage/,/sessionStorage/,/innerHTML\s*=/,/\beval\(/]){
    assert.equal(bad.test(ui),false,String(bad));
  }
  assert.match(ui,/\.textContent=pair\.draft_text/);
  assert.match(ui,/\.files\?\.\[0\]/);
});
test('MD13 missing WebCrypto refuses even matching input files',async()=>{
  await assert.rejects(verifyPhiServeDraftPair({...pair(),cryptoImpl:{}}),
    error=>error.code==='WEBCRYPTO_REQUIRED');
});
