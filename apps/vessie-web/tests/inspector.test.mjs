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
