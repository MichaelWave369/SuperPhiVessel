import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createOperatorEnvelope} from '../operator-envelope.mjs';
import {auditOperatorCustodyBatch,BATCH_SCHEMA} from '../custody-batch.mjs';

const pair=generateKeyPairSync('ed25519');
const privatePem=pair.privateKey.export({type:'pkcs8',format:'pem'});
const publicPem=pair.publicKey.export({type:'spki',format:'pem'});
const other=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
const makeBundle=(status='COMPLETED',id='r-01')=>({
  runCapsule:{
    receiptType:'PhiRunCapsule',id,hash:'fastHash-test',
    memoryAuthority:'CONTEXT_ONLY',authorityMode:'AUTO',
    approvedModels:['qwen3:4b'],prompt:'NEVER_LEAK_PROMPT',
    memoryRecallIds:['NEVER_LEAK_MEMORY']
  },
  brainRoute:{
    receiptType:'BrainRouteReceipt',mode:'AUTO',role:'utility',
    selectedModel:'qwen3:4b',configuredModel:'qwen3:4b'
  },
  authorization:{
    receiptType:'ExecutorAuthorizationReceipt',id:'auth-test',
    hash:'fastHash-auth',runCapsuleId:id,runCapsuleHash:'fastHash-test',
    status:'AUTHORIZED',mode:'AUTO',provider:'ollama',model:'qwen3:4b',role:'utility'
  },
  attempts:[{id:'att-test',runCapsuleId:id,authorizationReceiptId:'auth-test',
    provider:'ollama',model:'qwen3:4b',role:'utility',
    status,ts:100,latencyMs:231,raw_error:'LEAK_ERROR'}]
});
const signBundle=(status='COMPLETED',id='r-01',createdAt='2026-10-08T20:00:00.000Z')=>
  createOperatorEnvelope(makeBundle(status,id),privatePem,{operatorReviewed:true,createdAt});
const audit=(packets,key=publicPem)=>auditOperatorCustodyBatch(packets,key);
const clone=x=>JSON.parse(JSON.stringify(x));

test('F01 valid packet is verified for custody, never runtime origin',()=>{
  const r=audit([signBundle()]);
  assert.equal(r.schema,BATCH_SCHEMA);
  assert.equal(r.status,'OPERATOR_SIGNATURES_VERIFIED_SOURCE_UNATTESTED');
  assert.equal(r.verified_operator_signature_count,1);
  assert.equal(r.signed_data_runtime_origin_attested,false);
  assert.equal(r.model_performance_suitable_for_learning,false);
  assert.equal(r.authority_granted,false);
});
test('F02 exact duplicate packet within batch flags replay without reward inflation',()=>{
  const p=signBundle();
  const r=audit([p,clone(p)]);
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.distinct_signed_packet_ids,1);
  assert.equal(r.distinct_redacted_projection_hashes,1);
  assert.equal(r.issue_counts.DUPLICATE_SIGNED_PACKET_IN_BATCH,1);
  assert.equal(r.issue_counts.REPEATED_REDACTED_PROJECTION_INDEPENDENCE_UNPROVEN,1);
});
test('F03 same source projection re-signed has distinct packet but not independent evidence',()=>{
  const a=signBundle(),b=signBundle();
  const r=audit([a,b]);
  assert.equal(r.distinct_signed_packet_ids,2);
  assert.equal(r.distinct_redacted_projection_hashes,1);
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.ok(r.issues.includes('REPEATED_REDACTED_PROJECTION_INDEPENDENCE_UNPROVEN'));
});
test('F04 different recorded statuses yield distinct projections without claiming validity',()=>{
  const r=audit([signBundle('FAILED','r-1'),signBundle('COMPLETED','r-2')]);
  assert.equal(r.distinct_redacted_projection_hashes,2);
  assert.equal(r.claimed_execution_record_counts_unverified.FAILURE_RECORDED,1);
  assert.equal(r.claimed_execution_record_counts_unverified.COMPLETION_RECORDED_UNVERIFIED,1);
  assert.equal(r.independently_verified_answer_quality,false);
});
test('F05 reused packet ID with different signed content is separately classified',()=>{
  const p=signBundle('FAILED','r-01');
  const q=clone(signBundle('COMPLETED','r-02'));
  // Test-only signer deliberately reuses an earlier packet ID and re-signs.
  q.packet.packet_id=p.packet.packet_id;
  q.signature_base64=sign(null,Buffer.from('PV-VESSIE-R3E-OPERATOR-SIGNATURE-V1\n'+
    JSON.stringify({packet:q.packet,signer:q.signer}),'utf8'),pair.privateKey).toString('base64');
  const r=audit([p,q]);
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.issue_counts.REUSED_PACKET_ID_DIFFERENT_SIGNED_CONTENT,1);
  assert.equal(r.distinct_signed_packet_ids,1);
});
test('F06 wrong independent key rejects all evidence',()=>{
  assert.throws(()=>audit([signBundle()],other),/TRUSTED_KEY_MISMATCH/);
});
test('F07 tampered signed packet rejects entire batch without partial success',()=>{
  const p=clone(signBundle());p.packet.packet_id='f'.repeat(32);
  assert.throws(()=>audit([signBundle(),p]),/SIGNATURE_INVALID/);
});
test('F08 missing empty or oversized batch fails closed',()=>{
  assert.throws(()=>audit([]),/BATCH_SIZE_INVALID/);
  assert.throws(()=>audit(Array(33).fill(signBundle())),/BATCH_SIZE_INVALID/);
  assert.throws(()=>audit({packets:[]}),/BATCH_SIZE_INVALID/);
});
test('F09 operator timestamps decreasing flag uncertainty; no false chronology',()=>{
  const r=audit([signBundle('FAILED','r-1','2026-10-09T02:00:00.000Z'),
                 signBundle('COMPLETED','r-2','2026-10-08T20:00:00.000Z')]);
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.issue_counts.OPERATOR_TIMESTAMP_REGRESSION_UNATTESTED,1);
});
test('F10 mixed terminal is never counted as a successful inference',()=>{
  const b=makeBundle('COMPLETED','r-1');
  b.attempts.push({...b.attempts[0],id:'att-fail',status:'FAILED',ts:101});
  const p=createOperatorEnvelope(b,privatePem,{operatorReviewed:true});
  const r=audit([p]);
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.mixed_terminal_record_count,1);
  assert.equal(r.claimed_execution_record_counts_unverified.MIXED_TERMINAL_RECORDS_UNRESOLVED,1);
  assert.equal(r.model_performance_suitable_for_learning,false);
});
test('F11 two independent signatures over same redacted fields do not become double reward',()=>{
  const a=signBundle('COMPLETED','some-run');
  const b=signBundle('COMPLETED','different-run');
  // Raw run IDs disappear from redacted projection; cannot assert identity.
  const r=audit([a,b]);
  assert.equal(r.distinct_redacted_projection_hashes,1);
  assert.ok(r.issues.includes('REPEATED_REDACTED_PROJECTION_INDEPENDENCE_UNPROVEN'));
  assert.equal(r.may_update_model_weights,false);
});
test('F12 report does not disclose prompt, private memory, model or raw IDs',()=>{
  const s=JSON.stringify(audit([signBundle()]));
  for(const token of ['NEVER_LEAK_PROMPT','NEVER_LEAK_MEMORY','qwen3:4b','ollama','r-01','att-test','LEAK_ERROR']){
    assert.equal(s.includes(token),false,token);
  }
});
test('F13 deterministic report checksum for exactly the same ordered signed packets',()=>{
  const p=signBundle();
  const r1=audit([p]),r2=audit([p]);
  assert.equal(r1.report_checksum_sha256,r2.report_checksum_sha256);
});
test('F14 input does not cause cross-batch replay prevention claims',()=>{
  const p=signBundle();
  assert.equal(audit([p]).cross_batch_replay_prevented,false);
  assert.equal(audit([p]).cross_batch_replay_prevented,false);
});
test('F15 invalid packet cannot import claimed authority',()=>{
  const p=clone(signBundle()); p.packet.can_execute=true;
  assert.throws(()=>audit([p]),/PACKET_AUTHORITY_INVALID/);
});
test('F16 unsupported or private payload cannot be echoed on failure',()=>{
  const p=clone(signBundle());p.private_memory='SECRET_EXTRA';
  assert.throws(()=>audit([p]),/ENVELOPE_FIELDS_INVALID/);
});
