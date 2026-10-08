import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectReceipt } from '../src/inspector.mjs';

test('valid P1 route remains unverified, not an authority grant', () => {
  const result = inspectReceipt(JSON.stringify({
    schema:'superphivessel.dlam.route-decision.p1c.v0.1',
    decision_id:'route_example',model_ref:'model:abc',authority_granted:false
  }));
  assert.equal(result.recognized,true);
  assert.equal(result.label,'UNVERIFIED_IMPORT');
  assert.equal(result.executionPermitted,false);
  assert.equal(result.verifiedCryptographically,false);
  assert.equal(result.fields.model_ref,'model:abc');
});
test('imported authority claim flags review without enabling anything', () => {
  const result = inspectReceipt(JSON.stringify({
    schema:'superphivessel.dlam.p4a.shadow-plan.v0.1',
    authority_granted:true,may_change_live_route:true
  }));
  assert.equal(result.label,'REVIEW_REQUIRED');
  assert.equal(result.executionPermitted,false);
  assert.ok(result.issues.length);
});
test('invalid JSON, arrays, and oversized payloads fail closed', () => {
  assert.throws(()=>inspectReceipt('{oops'),/Invalid JSON/);
  assert.throws(()=>inspectReceipt('[]'),/Expected a JSON object/);
  assert.throws(()=>inspectReceipt(JSON.stringify({data:'x'.repeat(132000)})),/limit/);
});
test('unknown schema is not trusted', () => {
  const result=inspectReceipt('{"schema":"alien.governance.v999","model_ref":"model:z"}');
  assert.equal(result.recognized,false);
  assert.equal(result.verifiedCryptographically,false);
  assert.ok(result.issues.length);
});
test('raw input content is never echoed into safe summary', () => {
  const result=inspectReceipt(JSON.stringify({
    schema:'superphivessel.dlam.p3a.v0.1',
    content:'private-memory-do-not-render',
    task_id:'t1',
    authority_granted:false,
  }));
  assert.ok(!JSON.stringify(result).includes('private-memory-do-not-render'));
  assert.equal(result.sharesContent,false);
});

test('R3-A import remains visibly unverified even when source self-hash passed', () => {
  const result=inspectReceipt(JSON.stringify({
    schema:'superphivessel.gateway.r3a.routing-trace.v0.1',
    route_decision_id:'route_'+'a'.repeat(32),
    model_ref:'model:'+'b'.repeat(32),
    profile_ref:'ga108:032',
    self_hash_consistent:true,
    external_signature_verified:false,
    source_authenticity_attested:false,
    live_brainc_connected:false,
    authority_granted:false,
    private_prompt:'SHOULD_NOT_APPEAR'
  }));
  assert.equal(result.recognized,true);
  assert.equal(result.label,'UNVERIFIED_IMPORT');
  assert.equal(result.fields.self_hash_consistent,true);
  assert.equal(result.verifiedCryptographically,false);
  assert.equal(result.executionPermitted,false);
  assert.ok(!JSON.stringify(result).includes('SHOULD_NOT_APPEAR'));
});

test('BrainC configured model report never turns into a verified chat execution',()=>{
  const data=inspectReceipt(JSON.stringify({
    schema:'superphivessel.gateway.r3b.brainc-configuration.v0.1',
    source:'BRAINC_V1_LOCAL_READ_ONLY_API',
    probe_status:'AVAILABLE',
    configured_active_model:'braincbrain',
    configured_active_in_inventory:true,
    per_request_effective_model:'UNKNOWN',
    execution_observed:false,
    brainc_routing_trace_verified:false,
    authority_granted:false,
    prompt:'PRIVATE_PROMPT_NEVER_RENDER',
  }));
  assert.equal(data.recognized,true);
  assert.equal(data.fields.per_request_effective_model,'UNKNOWN');
  assert.equal(data.fields.execution_observed,false);
  assert.equal(data.verifiedCryptographically,false);
  assert.equal(data.executionPermitted,false);
  assert.ok(!JSON.stringify(data).includes('PRIVATE_PROMPT_NEVER_RENDER'));
});

test('R3-D mixed terminal records trigger review without granting execution',()=>{
 const result=inspectReceipt(JSON.stringify({
  schema:'superphivessel.gateway.r3c.canonical-route-evidence.v0.1',
  terminal_outcomes_conflict:true,
  terminal_outcome_class:'MIXED_UNRESOLVED',
  execution_record_status:'MIXED_TERMINAL_RECORDS_UNRESOLVED',
  privatePrompt:'SECRET_NOT_TO_RENDER',
  authority_granted:false
 }));
 assert.equal(result.recognized,true);
 assert.equal(result.label,'REVIEW_REQUIRED');
 assert.equal(result.fields.terminal_outcomes_conflict,true);
 assert.equal(result.fields.terminal_outcome_class,'MIXED_UNRESOLVED');
 assert.equal(result.verifiedCryptographically,false);
 assert.equal(result.executionPermitted,false);
 assert.ok(!JSON.stringify(result).includes('SECRET_NOT_TO_RENDER'));
});
test('R3-D flags status-conflict even if imported conflict boolean is false',()=>{
 const x=inspectReceipt(JSON.stringify({
  schema:'superphivessel.gateway.r3c.canonical-route-evidence.v0.1',
  terminal_outcomes_conflict:false,
  execution_record_status:'MIXED_TERMINAL_RECORDS_UNRESOLVED',
 }));
 assert.equal(x.label,'REVIEW_REQUIRED');
 assert.equal(x.executionPermitted,false);
});
test('R3-C native route projection remains untrusted even when completion is recorded',()=>{
 const result=inspectReceipt(JSON.stringify({
  schema:'superphivessel.gateway.r3c.canonical-route-evidence.v0.1',
  source:'VESSIE_CANONICAL_54_12_EXPORTED_RECORDS',
  source_runtime:'v2.0-alpha.11.0.54.12',
  evidence_level:'UNATTESTED_OPERATOR_EXPORTED_RECORDS',
  execution_record_status:'COMPLETION_RECORDED_UNVERIFIED',
  executor_authorized_observed:true,dispatch_attempt_observed:true,
  independent_execution_confirmation:false,independently_verified_answer_quality:false,
  source_authenticity_attested:false,authority_granted:false,
  rawPrompt:'NEVER_LEAK_R3C_PROMPT'
 }));
 assert.equal(result.recognized,true);
 assert.equal(result.label,'UNVERIFIED_IMPORT');
 assert.equal(result.fields.execution_record_status,'COMPLETION_RECORDED_UNVERIFIED');
 assert.equal(result.fields.independent_execution_confirmation,false);
 assert.equal(result.executionPermitted,false);
 assert.equal(result.verifiedCryptographically,false);
 assert.ok(!JSON.stringify(result).includes('NEVER_LEAK_R3C_PROMPT'));
});
