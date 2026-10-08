import test from 'node:test';
import assert from 'node:assert/strict';
import {assessFieldReceipts} from './assess-field.mjs';

const win=()=>({
 schema:'superphivessel.gateway.r2.windows-pilot.v0.1',
 observation_source:'OPERATOR_WINDOWS_POWERSHELL_LOCAL_TEST',
 fixture:false, generated_at_utc:'2026-10-08T09:30:00Z',
 result:'LOCAL_TLS_AND_REFUSAL_PASS_BROWSER_PENDING',
 checks:['WINDOWS_OS_TLS_TRUST','UNAUTHORIZED_REFUSAL','WRONG_ORIGIN_REFUSAL'].map(check=>({check,result:'PASS'})),
});
const browser=()=>({
 schema:'superphivessel.gateway.r2.browser-field-report.v0.1',
 observation_source:'UNATTESTED_BROWSER_CLIENT',
 generated_at_utc:'2026-10-08T09:31:00Z',
 status:'OPERATOR_REVIEW_REQUIRED',field_qualified:false,
 authority_granted:false,secrets_included:false,credentials_included:false,
 model_names_included:false,host_identity_included:false,model_count_observed:12,
 checks:{
 browser_https_pair:'PASS',browser_status_read:'PASS',
 browser_model_inventory:'PASS',session_revocation_request:'PASS',
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
