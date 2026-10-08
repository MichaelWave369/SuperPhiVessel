import test from 'node:test';
import assert from 'node:assert/strict';
import {assessFieldReceipts} from './assess-field.mjs';

const win=()=>({
 schema:'superphivessel.gateway.r2.windows-pilot.v0.1',
 observation_source:'OPERATOR_WINDOWS_POWERSHELL_LOCAL_TEST',
 fixture:false, platform:'WINDOWS',gateway_target:'HTTPS_LOOPBACK',
 browser_pairing_qualified:false,operator_promotion_approved:false,
 authority_granted:false,check_count:3,
 generated_at_utc:'2026-10-08T09:30:00Z',
 result:'LOCAL_TLS_AND_REFUSAL_PASS_BROWSER_PENDING',
 checks:['WINDOWS_OS_TLS_TRUST','UNAUTHORIZED_REFUSAL','WRONG_ORIGIN_REFUSAL'].map(check=>({check,result:'PASS'})),
});
const browser=()=>({
 schema:'superphivessel.gateway.r2.browser-field-report.v0.2',
 revocation_proof_scope:'BROWSER_OBSERVED_DENIAL_NOT_MACHINE_ATTESTED',
 passed_checks:5,installed_models_approved:false,browser_restrictions_bypassed:false,
 observation_source:'UNATTESTED_BROWSER_CLIENT',
 generated_at_utc:'2026-10-08T09:31:00Z',
 status:'OPERATOR_REVIEW_REQUIRED',field_qualified:false,
 authority_granted:false,secrets_included:false,credentials_included:false,
 model_names_included:false,host_identity_included:false,model_count_observed:12,
 checks:{
 browser_https_pair:'PASS',browser_status_read:'PASS',
 browser_model_inventory:'PASS',session_revocation_request:'PASS',
 revoked_session_denied:'PASS',
 }
});
test('R2F01 structurally complete receipts stay review-only and unattested',()=>{
 const r=assessFieldReceipts(win(),browser());
 assert.equal(r.status,'OBSERVED_PENDING_OPERATOR_REVIEW');
 assert.equal(r.physically_qualified,false);
 assert.equal(r.machine_identity_authenticated,false);
 assert.equal(r.authority_granted,false);
});
test('R2F02 missing browser receipt blocks',()=>{
 const r=assessFieldReceipts(win(),null);
 assert.equal(r.status,'BLOCKED_FIELD_EVIDENCE');
});
test('R2F03 Windows strict trust failure blocks even if browser says success',()=>{
 const w=win();w.checks[0].result='BLOCKED';
 assert.equal(assessFieldReceipts(w,browser()).status,'BLOCKED_FIELD_EVIDENCE');
});
test('R2F04 browser model failure blocks',()=>{
 const b=browser();b.checks.browser_model_inventory='FAIL';
 assert.equal(assessFieldReceipts(win(),b).status,'BLOCKED_FIELD_EVIDENCE');
});
test('R2F05 missing revocation blocks and never approves routing',()=>{
 const b=browser();b.checks.session_revocation_request='NOT_RUN';
 const r=assessFieldReceipts(win(),b);
 assert.equal(r.status,'BLOCKED_FIELD_EVIDENCE');
 assert.equal(r.model_routing_approved,false);
});
test('R2F06 client claim of field qualification is rejected',()=>{
 const b=browser();b.field_qualified=true;
 assert.equal(assessFieldReceipts(win(),b).status,'BLOCKED_FIELD_EVIDENCE');
});
test('R2F07 unknown/missing model count blocks',()=>{
 const b=browser();b.model_count_observed=null;
 assert.equal(assessFieldReceipts(win(),b).status,'BLOCKED_FIELD_EVIDENCE');
});
test('R2F08 malformed or duplicate Windows check blocks',()=>{
 const w=win();w.checks.push(w.checks[0]);
 assert.equal(assessFieldReceipts(w,browser()).status,'BLOCKED_FIELD_EVIDENCE');
});
test('R2F09 input secrets cannot appear in final assessment',()=>{
 const secret='d'.repeat(64),b=browser();
 b.code=secret;b.session_token=secret;
 const out=JSON.stringify(assessFieldReceipts(win(),b));
 assert.equal(out.includes(secret),false);
 assert.equal(out.includes('session_token'),false);
});

test('R2F10 old v0.1 browser receipt cannot pass v0.2 revocation pilot',()=>{
 const b=browser();b.schema='superphivessel.gateway.r2.browser-field-report.v0.1';
 const x=assessFieldReceipts(win(),b);
 assert.equal(x.status,'BLOCKED_FIELD_EVIDENCE');
 assert.equal(x.physically_qualified,false);
});
test('R2F11 acknowledged DELETE without denied bearer check must block',()=>{
 const b=browser();b.checks.revoked_session_denied='NOT_RUN';b.passed_checks=4;
 const x=assessFieldReceipts(win(),b);
 assert.equal(x.status,'BLOCKED_FIELD_EVIDENCE');
 assert.ok(x.issues.some(t=>t.includes('revoked_session_denied')));
 assert.equal(x.authority_granted,false);
});
test('R2F12 browser may not claim policy bypass or installed model approval',()=>{
 const b=browser();b.browser_restrictions_bypassed=true;
 assert.equal(assessFieldReceipts(win(),b).status,'BLOCKED_FIELD_EVIDENCE');
 const c=browser();c.installed_models_approved=true;
 assert.equal(assessFieldReceipts(win(),c).status,'BLOCKED_FIELD_EVIDENCE');
});
test('R2F13 Windows report count and platform claims are checked',()=>{
 const w=win();w.check_count=2;
 assert.equal(assessFieldReceipts(w,browser()).status,'BLOCKED_FIELD_EVIDENCE');
 const a=win();a.gateway_target='PUBLIC_HTTP';
 assert.equal(assessFieldReceipts(a,browser()).status,'BLOCKED_FIELD_EVIDENCE');
});
test('R2F14 incomplete browser check count is not accepted',()=>{
 const b=browser();b.passed_checks=4;
 assert.equal(assessFieldReceipts(win(),b).status,'BLOCKED_FIELD_EVIDENCE');
});
