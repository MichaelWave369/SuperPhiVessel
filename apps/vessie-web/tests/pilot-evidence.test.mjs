import test from 'node:test';
import assert from 'node:assert/strict';
import { makeR2BrowserReceipt } from '../src/pilot-evidence.mjs';

test('R2P01 local report has explicit non-attestation',()=>{
  const result=makeR2BrowserReceipt({browser_https_pair:'PASS',browser_status_read:'PASS'});
  assert.equal(result.status,'OPERATOR_REVIEW_REQUIRED');
  assert.equal(result.field_qualified,false);
  assert.equal(result.authority_granted,false);
  assert.equal(result.checks.browser_model_inventory,'NOT_RUN');
});
test('R2P02 report contains no model or pairing secret even if input is malicious',()=>{
  const secret='e'.repeat(64);
  const report=makeR2BrowserReceipt({
    browser_https_pair:'PASS',pairCode:secret,sessionToken:secret,
    modelNames:['secret-model'],hostname:'private-host'
  },{modelCount:3,token:secret});
  const serialized=JSON.stringify(report);
  assert.ok(!serialized.includes(secret));
  assert.ok(!serialized.includes('secret-model'));
  assert.ok(!serialized.includes('private-host'));
  assert.equal(report.model_count_observed,3);
  assert.equal(report.model_names_included,false);
});
test('R2P03 invalid claimed statuses fail closed as NOT_RUN',()=>{
  const receipt=makeR2BrowserReceipt({browser_https_pair:'SELF_APPROVED',session_revocation_request:true});
  assert.equal(receipt.checks.browser_https_pair,'NOT_RUN');
  assert.equal(receipt.checks.session_revocation_request,'NOT_RUN');
});
test('R2P04 exported receipt cannot promote learned routing or execution',()=>{
  const receipt=makeR2BrowserReceipt({
    browser_https_pair:'PASS',
    browser_status_read:'PASS',
    browser_model_inventory:'PASS',
    session_revocation_request:'PASS',
    authority_granted:true,field_qualified:true
  },{modelCount:20});
  assert.equal(receipt.field_qualified,false);
  assert.equal(receipt.installed_models_approved,false);
  assert.equal(receipt.authority_granted,false);
  assert.equal(receipt.status,'OPERATOR_REVIEW_REQUIRED');
});

test('R2P05 five-check report uses new schema and no machine attestation',()=>{
 const receipt=makeR2BrowserReceipt({
   browser_https_pair:'PASS',browser_status_read:'PASS',
   browser_model_inventory:'PASS',session_revocation_request:'PASS',
   revoked_session_denied:'PASS'
 },{modelCount:5});
 assert.equal(receipt.schema,'superphivessel.gateway.r2.browser-field-report.v0.2');
 assert.equal(receipt.passed_checks,5);
 assert.equal(receipt.checks.revoked_session_denied,'PASS');
 assert.equal(receipt.revocation_proof_scope,'BROWSER_OBSERVED_DENIAL_NOT_MACHINE_ATTESTED');
 assert.equal(receipt.authority_granted,false);
});
test('R2P06 omitted revoked session check remains NOT_RUN',()=>{
 const report=makeR2BrowserReceipt({session_revocation_request:'PASS'}, {modelCount:1});
 assert.equal(report.checks.revoked_session_denied,'NOT_RUN');
 assert.equal(report.passed_checks,1);
});
