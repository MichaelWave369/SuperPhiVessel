// Sovereignty R5: read-only provider-choice rehearsal for the localhost console.
// No network, storage, model call, canonical route mutation, or permission transfer.
export const PROVIDER_REHEARSAL_SCHEMA='spv.sovereignty.provider-rehearsal.v0.1';
export const PROVIDER_CHOICES=Object.freeze(['NONE','OLLAMA_LOCAL','PHISERVE_LOCAL']);
const PROBE_STATES=new Set(['NOT_SCANNED','AVAILABLE','UNAVAILABLE','ERROR']);
const localSizeReported=model=>model&&model.execution_location==='LOCAL_WEIGHTS_REPORTED' &&
  model.classification_basis==='POSITIVE_SIZE_REPORT';

export function assessProviderIndependence({
  selected='NONE',probeStatus='NOT_SCANNED',ollamaModels=[],
  localTrialEnabled=false,phiServeEnabled=false
}={}){
  if(!PROVIDER_CHOICES.includes(selected) || !PROBE_STATES.has(probeStatus) ||
     !Array.isArray(ollamaModels) || ollamaModels.length>256 ||
     typeof localTrialEnabled!=='boolean'||typeof phiServeEnabled!=='boolean')
    throw new TypeError('INVALID_REHEARSAL_INPUT');
  // Source-reported weight metadata, NEVER local GPU or model execution attestation.
  const localCount=probeStatus==='AVAILABLE'
    ?ollamaModels.filter(localSizeReported).length:0;
  let draftStatus;
  let explanation;
  if(selected==='NONE'){
    draftStatus='OFF_BY_OPERATOR_CHOICE';
    explanation='No inference selected. Local console reading and file-only reviews remain separate.';
  }else if(selected==='OLLAMA_LOCAL'){
    if(probeStatus==='NOT_SCANNED'){
      draftStatus='NOT_SCANNED';
      explanation='Request an explicit Ollama inventory scan first. No local model availability has been observed.';
    }else if(probeStatus!=='AVAILABLE'){
      draftStatus='BACKEND_UNAVAILABLE';
      explanation='No usable current Ollama inventory. There is no automatic PhiServe or cloud fallback.';
    }else if(localCount===0){
      draftStatus='NO_LOCAL_WEIGHTS_REPORTED';
      explanation='No positive local weight-size report. Cloud references and unknown entries do not qualify.';
    }else if(!localTrialEnabled){
      draftStatus='OPERATOR_STARTUP_REQUIRED';
      explanation='Local weights are reported, but one-shot trials are OFF. Restart with the separate local-trial launcher.';
    }else{
      draftStatus='EXPLICIT_ONE_SHOT_APPROVAL_REQUIRED';
      explanation='Local weights are reported and the separate trial startup is enabled. Select a model and approve each prompt in the trial controls; execution is not guaranteed.';
    }
  }else if(!phiServeEnabled){
    draftStatus='OPERATOR_STARTUP_REQUIRED';
    explanation='PhiServe desk mode is OFF. Its separate launcher and private local token file are required; this panel does not enable it.';
  }else{
    draftStatus='SEPARATE_DISCOVERY_REQUIRED';
    explanation='PhiServe desk mode is enabled, but this panel has not verified a registered GGUF or a live daemon. Use the separate Model Desk discovery and approve each prompt.';
  }
  return Object.freeze({
    schema:PROVIDER_REHEARSAL_SCHEMA,
    status:'REVIEW_ONLY_NOT_A_MODEL_ROUTE',
    selected_provider:selected,
    draft_status:draftStatus,
    explanation,
    reported_local_ollama_weights:localCount,
    provider_discovery_independently_verified:false,
    inference_performed:false,
    auto_fallback:false,
    hosted_api_required_for_this_panel:false,
    portable_record_restore:'SEPARATE_READER_ONLY',
    tools_and_memory:'NOT_CONNECTED',
    identity_and_authority:'NONE',
    canonical_runtime_connected:false,
    capabilities:Object.freeze([
      Object.freeze({name:'Local text generation',status:draftStatus}),
      Object.freeze({name:'Portable text record reading',status:'SEPARATE_OFFLINE_READER_ONLY'}),
      Object.freeze({name:'Provider switching for canonical Vessie',status:'NOT_CONNECTED'}),
      Object.freeze({name:'Tools, memory admission and execution',status:'NOT_AUTHORIZED'})
    ])
  });
}


// R6: prepare an operator-directed prompt COPY into an already guarded local
// form. The result is only a UI plan. It does not select a model, execute,
// contact a provider, authorize a request, or persist prompt text.
export const HANDOFF_SCHEMA='spv.sovereignty.manual-prompt-stage.v0.1';
export function planManualPromptStage({assessment,prompt}={}){
  if(!assessment || assessment.schema!==PROVIDER_REHEARSAL_SCHEMA ||
     assessment.status!=='REVIEW_ONLY_NOT_A_MODEL_ROUTE' ||
     !PROVIDER_CHOICES.includes(assessment.selected_provider) ||
     assessment.inference_performed!==false || assessment.auto_fallback!==false ||
     assessment.canonical_runtime_connected!==false ||
     assessment.identity_and_authority!=='NONE'){
    throw new TypeError('UNTRUSTED_PROVIDER_ASSESSMENT');
  }
  const response=(status,reason,target=null)=>Object.freeze({
    schema:HANDOFF_SCHEMA,status,reason,target_input_id:target,
    prompt_included:false,model_selected:false,
    provider_switched:false,inference_performed:false,
    network_request_performed:false,auto_fallback:false,
    authorization_granted:false,canonical_runtime_connected:false,
    requires_manual_model_selection:true,
    requires_fresh_per_prompt_approval:true
  });
  if(typeof prompt!=='string' || !prompt.trim() || prompt.length>2000 ||
     /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(prompt)){
    return response('REFUSED','PROMPT_INVALID');
  }
  if(assessment.selected_provider==='OLLAMA_LOCAL' &&
     assessment.draft_status==='EXPLICIT_ONE_SHOT_APPROVAL_REQUIRED'){
    return response('READY_TO_STAGE','OLLAMA_EDITOR_ONLY','trial-prompt');
  }
  if(assessment.selected_provider==='PHISERVE_LOCAL' &&
     assessment.draft_status==='SEPARATE_DISCOVERY_REQUIRED'){
    return response('READY_TO_STAGE','PHISERVE_EDITOR_ONLY','desk-live-prompt');
  }
  return response('HELD','PROVIDER_OR_STARTUP_NOT_READY');
}
