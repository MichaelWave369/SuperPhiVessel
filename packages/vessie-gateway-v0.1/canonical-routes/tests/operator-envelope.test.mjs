import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createOperatorEnvelope, verifyOperatorEnvelope, ENVELOPE_SCHEMA } from '../operator-envelope.mjs';

const {privateKey, publicKey} = generateKeyPairSync('ed25519');
const priv=privateKey.export({type:'pkcs8',format:'pem'});
const pub=publicKey.export({type:'spki',format:'pem'});
const otherPub=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
const bundle = () => ({
 runCapsule:{
  receiptType:'PhiRunCapsule',id:'run-001',hash:'fastHash-run',
  memoryAuthority:'CONTEXT_ONLY',authorityMode:'AUTO',executionPolicy:'LOCAL_ONLY',
  approvedModels:['qwen3:4b','granite4.2:8b'],
  taskHash:'SECRET_TASK_HASH',prompt:'SENTINEL_PRIVATE_PROMPT',
  memoryRecallIds:['SENTINEL_MEMORY_1']
 },
 brainRoute:{
  receiptType:'BrainRouteReceipt',role:'utility',mode:'AUTO',
  selectedModel:'qwen3:4b',configuredModel:'granite4.2:8b',
  candidateScores:[{raw_private_score:'SECRET_SCORE'}]
 },
 authorization:{
  receiptType:'ExecutorAuthorizationReceipt',id:'auth-001',hash:'fastHash-auth',
  runCapsuleId:'run-001',runCapsuleHash:'fastHash-run',status:'AUTHORIZED',
  mode:'AUTO',provider:'ollama',model:'qwen3:4b',role:'utility'
 },
 attempts:[{
  id:'attempt-001',runCapsuleId:'run-001',authorizationReceiptId:'auth-001',
  provider:'ollama',model:'qwen3:4b',role:'utility',status:'COMPLETED',
  ts:42,latencyMs:321,raw_error:'LEAK_SENTINEL'
 }]
});
const make=()=>createOperatorEnvelope(bundle(),priv,{operatorReviewed:true,
 createdAt:'2026-10-08T20:00:00.000Z'});
const clone=x=>JSON.parse(JSON.stringify(x));
test('E01 independent public key verifies operator signature but not source authenticity',()=>{
 const pkt=make(), result=verifyOperatorEnvelope(pkt,pub);
 assert.equal(pkt.schema,ENVELOPE_SCHEMA);
 assert.equal(result.operator_signature_verified,true);
 assert.equal(result.trusted_operator_key_matched,true);
 assert.equal(result.runtime_origin_verified,false);
 assert.equal(result.source_authenticity_attested,false);
 assert.equal(result.independent_execution_confirmation,false);
 assert.equal(result.independently_verified_answer_quality,false);
 assert.equal(result.can_execute,false);
 assert.equal(result.authority_granted,false);
});
test('E02 explicit local operator review declaration is mandatory',()=>{
 assert.throws(()=>createOperatorEnvelope(bundle(),priv),/OPERATOR_REVIEW_REQUIRED/);
});
test('E03 cannot self-verify without independent public key',()=>{
 assert.throws(()=>verifyOperatorEnvelope(make()),/ERR_INVALID_ARG_TYPE|OFFLINE_ENVELOPE_ERROR|undefined|argument/i);
});
test('E04 wrong operator key must be refused',()=>{
 assert.throws(()=>verifyOperatorEnvelope(make(),otherPub),/TRUSTED_KEY_MISMATCH/);
});
test('E05 changing a signed terminal result fails verification',()=>{
 const pkt=clone(make());
 pkt.packet.projection.execution_record_status='FAILURE_RECORDED';
 assert.throws(()=>verifyOperatorEnvelope(pkt,pub),/PROJECTION_|SIGNATURE_INVALID/);
});
test('E06 changing packet ID invalidates signature',()=>{
 const pkt=clone(make());
 pkt.packet.packet_id='0'.repeat(32);
 assert.throws(()=>verifyOperatorEnvelope(pkt,pub),/SIGNATURE_INVALID/);
});
test('E07 altering fingerprint is refused against trusted key',()=>{
 const pkt=clone(make());
 pkt.signer.key_fingerprint_sha256='0'.repeat(64);
 assert.throws(()=>verifyOperatorEnvelope(pkt,pub),/TRUSTED_KEY_MISMATCH/);
});
test('E08 envelope contains no embedded public key or private key',()=>{
 const pkt=make();
 assert.deepEqual(Object.keys(pkt).sort(),['packet','schema','signature_base64','signer']);
 assert.deepEqual(Object.keys(pkt.signer).sort(),['algorithm','key_fingerprint_sha256','trust']);
 assert.ok(!JSON.stringify(pkt).includes('BEGIN PRIVATE KEY'));
 assert.ok(!JSON.stringify(pkt).includes('BEGIN PUBLIC KEY'));
});
test('E09 redacted envelope excludes prompts, memory, model, provider and raw IDs',()=>{
 const p=make(), s=JSON.stringify(p);
 for(const secret of ['qwen3:4b','granite4.2:8b','ollama','SECRET_TASK_HASH',
  'SENTINEL_PRIVATE_PROMPT','SENTINEL_MEMORY_1','SECRET_SCORE','LEAK_SENTINEL',
  'run-001','auth-001','attempt-001']){
  assert.equal(s.includes(secret),false,secret);
 }
});
test('E10 packet cannot claim execution or routing authority',()=>{
 const pkt=clone(make());
 pkt.packet.can_execute=true;
 assert.throws(()=>verifyOperatorEnvelope(pkt,pub),/PACKET_AUTHORITY_INVALID/);
});
test('E11 unexpected sensitive source fields are refused even with unchanged signature',()=>{
 const pkt=clone(make());
 pkt.packet.projection.prompt='SECRET_VALUE';
 assert.throws(()=>verifyOperatorEnvelope(pkt,pub),/PROJECTION_FIELDS_INVALID/);
});
test('E12 cannot relabel native source as attested',()=>{
 const pkt=clone(make());
 pkt.packet.projection.source_authenticity_attested=true;
 assert.throws(()=>verifyOperatorEnvelope(pkt,pub),/PROJECTION_AUTHORITY_INVALID/);
});
test('E13 mixed completion and failure remain unresolved even when signed',()=>{
 const b=bundle();
 b.attempts.push({...b.attempts[0],id:'attempt-002',status:'FAILED',ts:43});
 const pkt=createOperatorEnvelope(b,priv,{operatorReviewed:true});
 const verified=verifyOperatorEnvelope(pkt,pub);
 assert.equal(verified.execution_record_status,'MIXED_TERMINAL_RECORDS_UNRESOLVED');
 assert.equal(verified.terminal_outcomes_conflict,true);
 assert.equal(verified.independently_verified_answer_quality,false);
});
test('E14 external signer cannot hide mixed terminal class in modified projection',()=>{
 const pkt=clone(make());
 pkt.packet.projection.terminal_outcomes_conflict=true;
 assert.throws(()=>verifyOperatorEnvelope(pkt,pub),/PROJECTION_TERMINAL_CLASS_INVALID/);
});
test('E15 same review produces distinct nonce packets (no replay protection claim)',()=>{
 const a=make(),b=make();
 assert.notEqual(a.packet.packet_id,b.packet.packet_id);
 assert.equal(verifyOperatorEnvelope(a,pub).operator_signature_verified,true);
 assert.equal(verifyOperatorEnvelope(b,pub).operator_signature_verified,true);
});
test('E16 signature mutation is refused',()=>{
 const pkt=clone(make());
 pkt.signature_base64='A'.repeat(86)+'==';
 assert.throws(()=>verifyOperatorEnvelope(pkt,pub),/SIGNATURE_INVALID/);
});
test('E17 non-Ed25519 signing keys cannot be used',()=>{
 const rsa=generateKeyPairSync('rsa',{modulusLength:2048});
 assert.throws(()=>createOperatorEnvelope(bundle(),
  rsa.privateKey.export({type:'pkcs8',format:'pem'}),{operatorReviewed:true}),/ED25519_KEY_REQUIRED/);
});
test('E18 malformed envelope top-level fields and false review flags refused',()=>{
 const pkt=clone(make());
 pkt.packet.operator_review_declared=false;
 assert.throws(()=>verifyOperatorEnvelope(pkt,pub),/PACKET_AUTHORITY_INVALID/);
 const pkt2=clone(make()); pkt2.raw_prompt='SECRET';
 assert.throws(()=>verifyOperatorEnvelope(pkt2,pub),/ENVELOPE_FIELDS_INVALID/);
});
