import { createHash } from 'node:crypto';

const SCHEMA='superphivessel.gateway.r3c.canonical-route-evidence.v0.1';
const SOURCE='VESSIE_CANONICAL_54_12_EXPORTED_RECORDS';
const MAX_ATTEMPTS=40;
const SAFE_NAME=/^[a-zA-Z0-9][a-zA-Z0-9_.:/@+-]{0,127}$/;
const SAFE_ID=/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const STAGES=new Set(['DISPATCH_STARTED','COMPLETED','FAILED']);
const MAX_LATENCY_MS=3600000;

export class CanonicalTraceError extends Error {
  constructor(reason) {super(reason);this.name='CanonicalTraceError';}
}
function fail(why){throw new CanonicalTraceError(why);}
function obj(x){return x && typeof x==='object' && !Array.isArray(x);}
function bounded(x,regex=SAFE_ID){return typeof x==='string' && regex.test(x);}
function require(x,why){if(!x)fail(why);}
function sha(text){return createHash('sha256').update(text).digest('hex');}
function same(value,expected){return value===expected;}
function booleanFalse(o,key){return o[key]===false;}
function safeModelRef(model,showNames) {
  return showNames ? model : 'REDACTED_OPERATOR_MODEL';
}
function safeProvider(provider,showNames){return showNames ? provider : 'REDACTED_OPERATOR_PROVIDER';}
function allowedMetadata(value){return value==null || bounded(value);}

export function projectCanonicalRoute(bundle,{operatorNames=false}={}){
  require(obj(bundle),'INPUT_NOT_OBJECT');
  require(Object.keys(bundle).length<=20,'INPUT_TOO_MANY_FIELDS');
  const {runCapsule:run,brainRoute:route=null,
    authorization:auth=null,attempts=[],budgetGeniusInfluence:canary=null}=bundle;
  require(obj(run) && run.receiptType==='PhiRunCapsule','RUN_CAPSULE_MISSING');
  require(bounded(run.id) && bounded(run.hash),'RUN_CAPSULE_ID_INVALID');
  require(run.memoryAuthority==='CONTEXT_ONLY','RUN_CAPSULE_MEMORY_BOUNDARY_INVALID');
  // Existing runtime "fastHash" is not cryptographic source authentication.
  require(Array.isArray(run.approvedModels) && run.approvedModels.length<=128,
    'RUN_CAPSULE_APPROVED_POOL_INVALID');
  require(run.approvedModels.every(m=>bounded(m,SAFE_NAME)), 'RUN_CAPSULE_MODEL_INVALID');
  require(run.authorityMode==='ASSIST' || run.authorityMode==='AUTO' ||
    run.authorityMode==='LOCKED','RUN_ROUTING_MODE_INVALID');
  if(run.executionPolicy!=null)require(bounded(run.executionPolicy),'EXEC_POLICY_INVALID');

  let selectedModel=null, configuredModel=null, recommendationApplied=null,
    selectedModelSource='NO_BRAIN_ROUTE_RECEIPT';
  if(route!==null){
    require(obj(route) && route.receiptType==='BrainRouteReceipt','BRAIN_ROUTE_INVALID');
    require(bounded(route.role) && route.role.length<=48,'BRAIN_ROLE_INVALID');
    require(['ASSIST','AUTO','LOCKED'].includes(route.mode),'BRAIN_MODE_INVALID');
    require(route.mode===run.authorityMode,'BRAIN_MODE_CROSS_REFERENCE_INVALID');
    require(route.selectedModel==null || bounded(route.selectedModel,SAFE_NAME),
      'BRAIN_SELECTED_MODEL_INVALID');
    require(route.configuredModel==null || bounded(route.configuredModel,SAFE_NAME),
      'BRAIN_CONFIGURED_MODEL_INVALID');
    require(route.recommendedModel==null || bounded(route.recommendedModel,SAFE_NAME),
      'BRAIN_RECOMMENDED_MODEL_INVALID');
    selectedModel=route.selectedModel??null;
    configuredModel=route.configuredModel??null;
    recommendationApplied=route.recommendationApplied===true;
    if(selectedModel!==null){
      require(run.approvedModels.includes(selectedModel),
        'SELECTED_OUTSIDE_FROZEN_APPROVED_POOL');
    }
    selectedModelSource='REPORTED_BY_NATIVE_BRAIN_ROUTE';
  }

  let proposedCanary=null;
  if(canary!==null){
    require(obj(canary) && canary.receiptType==='BudgetGeniusCanaryInfluenceReceipt',
      'CANARY_RECEIPT_INVALID');
    require(canary.routeChanged===true &&
      canary.routeInfluenceAuthorizedByLease===true &&
      canary.executionAuthorized===false &&
      canary.mayDispatch===false &&
      canary.executorAuthorizationRequired===true &&
      canary.authorityGranted===false &&
      canary.paidApprovalGranted===false &&
      canary.paidSpendUsd===0, 'CANARY_AUTHORITY_BOUNDARY_INVALID');
    require(canary.canaryRoute==='BUDGETGENIUS_CANARY_LOCAL' &&
      canary.canaryProvider==='ollama' &&
      bounded(canary.canaryModel,SAFE_NAME), 'CANARY_MODEL_INVALID');
    require(run.approvedModels.includes(canary.canaryModel),'CANARY_MODEL_OUTSIDE_FROZEN_POOL');
    proposedCanary={status:'ROUTE_INFLUENCE_RECORDED_NOT_EXECUTED',
      provider:canary.canaryProvider,model:canary.canaryModel,
      executionAuthorized:false};
  }

  let authorizationStatus='NO_EXECUTOR_AUTHORIZATION_RECEIPT';
  let executableModel=null,executorProvider=null,executorRole=null;
  let authId=null;
  if(auth!==null){
    require(obj(auth) && auth.receiptType==='ExecutorAuthorizationReceipt',
      'AUTH_RECEIPT_INVALID');
    require(bounded(auth.id) && bounded(auth.hash) &&
      auth.runCapsuleId===run.id && auth.runCapsuleHash===run.hash,
      'AUTH_RUN_REFERENCE_MISMATCH');
    require(auth.status==='AUTHORIZED'||auth.status==='DENIED','AUTH_STATUS_INVALID');
    require(bounded(auth.provider,SAFE_NAME) && bounded(auth.model,SAFE_NAME)
      && bounded(auth.role), 'AUTH_EXECUTOR_IDENTITY_INVALID');
    require(auth.mode===run.authorityMode, 'AUTH_ROUTE_MODE_MISMATCH');
    authId=auth.id;executorProvider=auth.provider;
    executableModel=auth.model;executorRole=auth.role;
    authorizationStatus=auth.status==='AUTHORIZED'?'EXECUTOR_AUTHORIZATION_RECORDED':
      'EXECUTOR_DENIAL_RECORDED';
    // Local approved-pool check is not optional just because an imported
    // receipt says AUTHORIZED; remote executor eligibility remains unverified.
    if(auth.status==='AUTHORIZED' && auth.provider==='ollama'){
      require(run.approvedModels.includes(auth.model),
        'LOCAL_AUTH_OUTSIDE_APPROVED_POOL');
    }
    if(route!==null && auth.status==='AUTHORIZED' && route.role===auth.role &&
       selectedModel && auth.provider==='ollama' && !proposedCanary) {
      require(selectedModel===auth.model, 'BRAIN_SELECTION_AUTHORIZATION_MISMATCH');
    }
    if(proposedCanary && auth.status==='AUTHORIZED'){
      require(executorProvider==='ollama' && executableModel===proposedCanary.model,
        'CANARY_AUTHORIZATION_MISMATCH');
    }
  }

  require(Array.isArray(attempts) && attempts.length<=MAX_ATTEMPTS,'ATTEMPT_LIST_INVALID');
  require(auth!==null || attempts.length===0,'ATTEMPT_WITHOUT_AUTH');
  const seen=new Set();
  const clean=[];
  for(const attempt of attempts){
    require(obj(attempt) && bounded(attempt.id),'ATTEMPT_ID_INVALID');
    require(!seen.has(attempt.id),'DUPLICATE_ATTEMPT_ID');
    seen.add(attempt.id);
    require(attempt.runCapsuleId===run.id && attempt.authorizationReceiptId===authId,
      'ATTEMPT_AUTH_REFERENCE_MISMATCH');
    require(attempt.provider===executorProvider && attempt.model===executableModel &&
      attempt.role===executorRole,'ATTEMPT_EXECUTOR_IDENTITY_MISMATCH');
    require(auth.status==='AUTHORIZED','DENIED_AUTH_WITH_ATTEMPT');
    require(STAGES.has(attempt.status),'ATTEMPT_STATUS_UNKNOWN');
    require(Number.isSafeInteger(attempt.ts)&&attempt.ts>=0,'ATTEMPT_TIMESTAMP_INVALID');
    require(attempt.latencyMs==null ||
      (Number.isSafeInteger(attempt.latencyMs)&&attempt.latencyMs>=0&&
      attempt.latencyMs<=MAX_LATENCY_MS), 'ATTEMPT_LATENCY_INVALID');
    clean.push({status:attempt.status,ts:attempt.ts,latencyMs:attempt.latencyMs??null});
  }
  clean.sort((a,b)=>a.ts-b.ts);
  const completed=clean.filter(x=>x.status==='COMPLETED');
  const failed=clean.filter(x=>x.status==='FAILED');
  const started=clean.filter(x=>x.status==='DISPATCH_STARTED');
  const finalStatus=completed.length>0?'COMPLETION_RECORDED_UNVERIFIED':
    failed.length>0?'FAILURE_RECORDED':
    started.length>0?'DISPATCH_STARTED_NO_FINAL_OUTCOME':
    auth?.status==='DENIED'?'EXECUTOR_DENIED':
    auth?.status==='AUTHORIZED'?'AUTHORIZED_NOT_OBSERVED_EXECUTING':
    canary!==null?'ROUTE_INFLUENCE_NOT_EXECUTED':
    route!==null?'SELECTION_ONLY':'FROZEN_RUN_ONLY';
  const authorizationObserved=auth?.status==='AUTHORIZED';
  const attemptObserved=clean.length>0;
  const lastLatency=clean.length ? clean[clean.length-1].latencyMs : null;
  const evidence={
    schema:SCHEMA,
    source:SOURCE,
    source_runtime:'v2.0-alpha.11.0.54.12',
    source_blob_sha1:'c9dc18eb76be9883d18014de129c07cf78c5a498',
    evidence_level:'UNATTESTED_OPERATOR_EXPORTED_RECORDS',
    run_capsule_present:true,
    frozen_pool_count:run.approvedModels.length,
    routing_mode:run.authorityMode,
    brain_route_present:route!==null,
    brain_route_role:route?.role??null,
    brain_model_configured:configuredModel===null?null:safeModelRef(configuredModel,operatorNames),
    brain_model_selected:selectedModel===null?null:safeModelRef(selectedModel,operatorNames),
    selected_model_source:selectedModelSource,
    brain_recommendation_applied:recommendationApplied,
    budgetgenius_influence:canary!==null,
    budgetgenius_execution_authorized:false,
    executor_authorization_status:authorizationStatus,
    executor_provider:executorProvider===null?null:safeProvider(executorProvider,operatorNames),
    executor_model:executableModel===null?null:safeModelRef(executableModel,operatorNames),
    executor_role:executorRole??null,
    executor_authorized_observed:authorizationObserved,
    dispatch_attempt_observed:attemptObserved,
    dispatch_started_count:started.length,
    dispatch_completed_count:completed.length,
    dispatch_failed_count:failed.length,
    last_recorded_latency_ms:lastLatency,
    execution_record_status:finalStatus,
    independent_execution_confirmation:false,
    independently_verified_answer_quality:false,
    source_authenticity_attested:false,
    cryptographic_signature_verified:false,
    exact_model_artifact_attested:false,
    ga108_genius_identity_attested:false,
    browser_gateway_connected:false,
    live_trace_export_connected:false,
    can_execute:false,
    may_change_live_route:false,
    may_change_live_thresholds:false,
    authority_granted:false,
  };
  // No runtime IDs, task IDs, hashes, memory IDs, raw error codes, role mapping,
  // provider strings or prompt text are exported in default share-safe mode.
  const digest=sha('PV-VESSIE-R3C-REDACTED|' + JSON.stringify(evidence));
  return {...evidence,projection_hash:digest};
}
