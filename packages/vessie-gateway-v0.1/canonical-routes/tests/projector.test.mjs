import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCanonicalRoute,CanonicalTraceError} from '../projector.mjs';

const run=()=>({
 receiptType:'PhiRunCapsule',version:'0.1',id:'run_fixture-001',
 hash:'fastHash_fixture1',memoryAuthority:'CONTEXT_ONLY',
 authorityMode:'AUTO',executionPolicy:'LOCAL_ONLY',
 approvedModels:['granite4.2:8b','qwen3:4b'],
 taskHash:'private_task_hash',memoryRecallIds:['private_memory_001'],
 roleMappings:{utility:'granite4.2:8b'},requestId:'sensitive-user-request-id',
 prompt:'SENTINEL_PRIVATE_PROMPT',
});
const route=()=>({
 receiptType:'BrainRouteReceipt',version:'0.1',mode:'AUTO',
 role:'utility',configuredModel:'qwen3:4b',
 recommendedModel:'granite4.2:8b',selectedModel:'granite4.2:8b',
 recommendationApplied:true,approvedPool:['granite4.2:8b','qwen3:4b'],
 candidateScores:[{model:'granite4.2:8b',reason:'SECRET_SCORE_DIAGNOSTIC'}],
});
const auth=()=>({
 receiptType:'ExecutorAuthorizationReceipt',id:'auth_fixture1',
 hash:'fastHash_auth1',runCapsuleId:'run_fixture-001',
 runCapsuleHash:'fastHash_fixture1',status:'AUTHORIZED',
 mode:'AUTO',provider:'ollama',model:'granite4.2:8b',role:'utility',
 approvedPool:['granite4.2:8b','qwen3:4b'],
 reason:'AUTHORIZED_BY_FROZEN_RUN_GRANT',
});
const attempt=(status='COMPLETED',id='attempt-fixture1')=>({
 id,version:'0.1',runCapsuleId:'run_fixture-001',
 authorizationReceiptId:'auth_fixture1',
 provider:'ollama',model:'granite4.2:8b',role:'utility',
 status,outcome:'COMPLETED',latencyMs:210,ts:1000,
 errorCode:'SENSITIVE_INTERNAL_ERROR',private_log:'LEAK_SENTINEL'
});
const canary=()=>({
 receiptType:'BudgetGeniusCanaryInfluenceReceipt',id:'bg-fixture',
 canaryRoute:'BUDGETGENIUS_CANARY_LOCAL',
 canaryProvider:'ollama',canaryModel:'granite4.2:8b',
 routeChanged:true,routeInfluenceAuthorizedByLease:true,
 executionAuthorized:false,mayDispatch:false,
 executorAuthorizationRequired:true,authorityGranted:false,
 paidApprovalGranted:false,paidSpendUsd:0,
 leaseHash:'private-canary-lease-hash',
});
const bundle=()=>({runCapsule:run(),brainRoute:route(),authorization:auth(),attempts:[attempt()]});
function refuse(f){
 assert.throws(f,(e)=>e instanceof CanonicalTraceError && e.message.length>0);
}
test('C01 completed records never imply independent execution or quality verification',()=>{
 const x=projectCanonicalRoute(bundle());
 assert.equal(x.execution_record_status,'COMPLETION_RECORDED_UNVERIFIED');
 assert.equal(x.executor_authorized_observed,true);
 assert.equal(x.dispatch_attempt_observed,true);
 assert.equal(x.independent_execution_confirmation,false);
 assert.equal(x.independently_verified_answer_quality,false);
});
test('C02 correct selected model and actual authorized model are separately recorded',()=>{
 const x=projectCanonicalRoute(bundle(),{operatorNames:true});
 assert.equal(x.brain_model_selected,'granite4.2:8b');
 assert.equal(x.brain_model_configured,'qwen3:4b');
 assert.equal(x.executor_model,'granite4.2:8b');
 assert.equal(x.brain_recommendation_applied,true);
});
test('C03 default report omits all raw model/provider names and private fields',()=>{
 const x=projectCanonicalRoute(bundle());
 const text=JSON.stringify(x);
 for(const secret of ['granite4.2:8b','qwen3:4b','ollama','private_task_hash',
  'private_memory_001','SENTINEL_PRIVATE_PROMPT',
  'sensitive-user-request-id','SECRET_SCORE_DIAGNOSTIC','LEAK_SENTINEL',
  'fastHash_auth1'])assert.equal(text.includes(secret),false,secret);
 assert.equal(x.executor_model,'REDACTED_OPERATOR_MODEL');
});
test('C04 no attempt means authorized but not executed',()=>{
 const b=bundle();b.attempts=[];
 assert.equal(projectCanonicalRoute(b).execution_record_status,'AUTHORIZED_NOT_OBSERVED_EXECUTING');
});
test('C05 no authorization means selected only',()=>{
 const b=bundle();b.authorization=null;b.attempts=[];
 assert.equal(projectCanonicalRoute(b).execution_record_status,'SELECTION_ONLY');
});
test('C06 no BrainRoute still permits matching run/auth/attempt, but no selection claim',()=>{
 const b=bundle();b.brainRoute=null;
 const x=projectCanonicalRoute(b);
 assert.equal(x.brain_route_present,false);
 assert.equal(x.selected_model_source,'NO_BRAIN_ROUTE_RECEIPT');
 assert.equal(x.execution_record_status,'COMPLETION_RECORDED_UNVERIFIED');
});
test('C07 frozen run capsule alone produces no model execution claim',()=>{
 const x=projectCanonicalRoute({runCapsule:run()});
 assert.equal(x.execution_record_status,'FROZEN_RUN_ONLY');
 assert.equal(x.dispatch_attempt_observed,false);
});
test('C08 denied authorization cannot have attempt evidence',()=>{
 const b=bundle();b.authorization.status='DENIED';
 refuse(()=>projectCanonicalRoute(b));
});
test('C09 denied authorization without attempts stays denied',()=>{
 const b=bundle();b.authorization.status='DENIED';b.attempts=[];
 assert.equal(projectCanonicalRoute(b).execution_record_status,'EXECUTOR_DENIED');
});
test('C10 cross-run authorization mismatches refused',()=>{
 const b=bundle();b.authorization.runCapsuleId='run_other';
 refuse(()=>projectCanonicalRoute(b));
});
test('C11 cross-run hash mismatch refused',()=>{
 const b=bundle();b.authorization.runCapsuleHash='changed';
 refuse(()=>projectCanonicalRoute(b));
});
test('C12 attempt must match exact authorization receipt',()=>{
 const b=bundle();b.attempts[0].authorizationReceiptId='auth_other';
 refuse(()=>projectCanonicalRoute(b));
});
test('C13 attempt wrong model/provider cannot be reassociated',()=>{
 const b=bundle();b.attempts[0].model='qwen3:4b';
 refuse(()=>projectCanonicalRoute(b));
 const c=bundle();c.attempts[0].provider='remote';
 refuse(()=>projectCanonicalRoute(c));
});
test('C14 duplicate attempt IDs refused',()=>{
 const b=bundle();b.attempts.push(attempt('FAILED'));
 refuse(()=>projectCanonicalRoute(b));
});
test('C15 invalid or unknown status cannot be relabeled completed',()=>{
 const b=bundle();b.attempts[0].status='QUALITY_VERIFIED';
 refuse(()=>projectCanonicalRoute(b));
});
test('C16 failed attempt is not completion',()=>{
 const b=bundle();b.attempts[0].status='FAILED';
 const x=projectCanonicalRoute(b);
 assert.equal(x.execution_record_status,'FAILURE_RECORDED');
 assert.equal(x.dispatch_completed_count,0);
});
test('C17 dispatch started is not completion',()=>{
 const b=bundle();b.attempts[0].status='DISPATCH_STARTED';
 assert.equal(projectCanonicalRoute(b).execution_record_status,'DISPATCH_STARTED_NO_FINAL_OUTCOME');
});
test('C18 multiple attempts count separately, completion remains unverified',()=>{
 const b=bundle();b.attempts=[attempt('DISPATCH_STARTED','try-1'),attempt('FAILED','try-2'),attempt('COMPLETED','try-3')];
 const x=projectCanonicalRoute(b);
 assert.equal(x.dispatch_started_count,1);
 assert.equal(x.dispatch_failed_count,1);
 assert.equal(x.dispatch_completed_count,1);
 assert.equal(x.execution_record_status,'COMPLETION_RECORDED_UNVERIFIED');
});
test('C19 invalid authoritative route mode mismatch refused',()=>{
 const b=bundle();b.brainRoute.mode='LOCKED';
 refuse(()=>projectCanonicalRoute(b));
});
test('C20 proposed selected local model outside frozen pool refused',()=>{
 const b=bundle();b.brainRoute.selectedModel='outsider:7b';
 refuse(()=>projectCanonicalRoute(b));
});
test('C21 authorized Ollama model outside frozen pool refused',()=>{
 const b=bundle();b.authorization.model='outsider:7b';
 b.attempts[0].model='outsider:7b';
 refuse(()=>projectCanonicalRoute(b));
});
test('C22 Brain route and executor mismatch cannot be explained without canary',()=>{
 const b=bundle();b.authorization.model='qwen3:4b';
 b.attempts[0].model='qwen3:4b';
 refuse(()=>projectCanonicalRoute(b));
});
test('C23 correctly bounded canary influence never grants execution',()=>{
 const b=bundle();b.budgetGeniusInfluence=canary();
 const x=projectCanonicalRoute(b);
 assert.equal(x.budgetgenius_influence,true);
 assert.equal(x.budgetgenius_execution_authorized,false);
 assert.equal(x.can_execute,false);
 assert.equal(x.authority_granted,false);
});
test('C24 canary influence alone is not authorization or dispatch',()=>{
 const b={runCapsule:run(),budgetGeniusInfluence:canary()};
 const x=projectCanonicalRoute(b);
 assert.equal(x.execution_record_status,'ROUTE_INFLUENCE_NOT_EXECUTED');
 assert.equal(x.executor_authorized_observed,false);
});
test('C25 canary cannot bypass final executor authorization',()=>{
 const b=bundle();b.budgetGeniusInfluence=canary();b.authorization.model='qwen3:4b';
 b.attempts[0].model='qwen3:4b';
 refuse(()=>projectCanonicalRoute(b));
});
test('C26 canary attempting to mint authority rejected',()=>{
 const b=bundle();b.budgetGeniusInfluence=canary();
 b.budgetGeniusInfluence.executionAuthorized=true;
 refuse(()=>projectCanonicalRoute(b));
});
test('C27 raw prompt and receipt hashes never exported by default or operator view',()=>{
 const x=projectCanonicalRoute(bundle(),{operatorNames:true});
 for(const secret of ['SENTINEL_PRIVATE_PROMPT','fastHash_fixture1','private_memory_001','SECRET_SCORE_DIAGNOSTIC']){
   assert.ok(!JSON.stringify(x).includes(secret));
 }
});
test('C28 projector deterministic for same evidence',()=>{
 const a=projectCanonicalRoute(bundle());
 const b=projectCanonicalRoute(bundle());
 assert.equal(a.projection_hash,b.projection_hash);
});
test('C29 no source authenticity or model artifact attestation claimed',()=>{
 const x=projectCanonicalRoute(bundle());
 assert.equal(x.source_authenticity_attested,false);
 assert.equal(x.cryptographic_signature_verified,false);
 assert.equal(x.exact_model_artifact_attested,false);
 assert.equal(x.ga108_genius_identity_attested,false);
});
test('C30 local unauthorized extra fields cannot override policy boundary',()=>{
 const b=bundle();b.authority_granted=true;b.can_execute=true;
 const x=projectCanonicalRoute(b);
 assert.equal(x.authority_granted,false);
 assert.equal(x.can_execute,false);
 assert.equal(x.may_change_live_route,false);
});
test('C31 attempt with no auth refused even if run capsule exists',()=>{
 const b={runCapsule:run(),attempts:[attempt()]};
 refuse(()=>projectCanonicalRoute(b));
});
test('C32 imported source pool or memory boundary not silently accepted',()=>{
 const b=bundle();b.runCapsule.memoryAuthority='WRITE';
 refuse(()=>projectCanonicalRoute(b));
});
test('C33 malformed run identity fails closed',()=>{
 const b=bundle();b.runCapsule.id='<script>';
 refuse(()=>projectCanonicalRoute(b));
});
test('C34 oversized/negative latency fails closed',()=>{
 const b=bundle();b.attempts[0].latencyMs=-20;
 refuse(()=>projectCanonicalRoute(b));
});
