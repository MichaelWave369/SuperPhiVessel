import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessProviderIndependence,PROVIDER_REHEARSAL_SCHEMA,planManualPromptStage,HANDOFF_SCHEMA} from '../ui/provider-independence.mjs';

const local=()=>({name:'synthetic-local:4b',execution_location:'LOCAL_WEIGHTS_REPORTED',classification_basis:'POSITIVE_SIZE_REPORT'});
const cloud=()=>({name:'synthetic-cloud',execution_location:'CLOUD_REFERENCE',classification_basis:'CLOUD_NAME_REFERENCE'});
function common(out) {
  assert.equal(out.schema,PROVIDER_REHEARSAL_SCHEMA);
  assert.equal(out.status,'REVIEW_ONLY_NOT_A_MODEL_ROUTE');
  assert.equal(out.inference_performed,false);
  assert.equal(out.auto_fallback,false);
  assert.equal(out.provider_discovery_independently_verified,false);
  assert.equal(out.canonical_runtime_connected,false);
  assert.equal(out.identity_and_authority,'NONE');
  assert.equal(out.tools_and_memory,'NOT_CONNECTED');
  assert.equal(out.portable_record_restore,'SEPARATE_READER_ONLY');
}
test('default no-inference choice is safe even with every provider absent',()=>{
  const out=assessProviderIndependence();
  common(out);
  assert.equal(out.selected_provider,'NONE');
  assert.equal(out.draft_status,'OFF_BY_OPERATOR_CHOICE');
  assert.equal(out.reported_local_ollama_weights,0);
});
test('provider absent and failed scan never silently use cloud',()=>{
  for(const probeStatus of ['UNAVAILABLE','ERROR']){
    const out=assessProviderIndependence({
      selected:'OLLAMA_LOCAL',probeStatus,ollamaModels:[local()],localTrialEnabled:true
    });
    common(out);
    assert.equal(out.reported_local_ollama_weights,0);
    assert.equal(out.draft_status,'BACKEND_UNAVAILABLE');
    assert.match(out.explanation,/no automatic PhiServe or cloud fallback/i);
  }
});
test('a cloud-only or unclassified Ollama inventory is never eligible for local drafting',()=>{
  const out=assessProviderIndependence({
    selected:'OLLAMA_LOCAL',probeStatus:'AVAILABLE',localTrialEnabled:true,
    ollamaModels:[cloud(),{name:'unknown',execution_location:'UNKNOWN'}]
  });
  common(out);
  assert.equal(out.draft_status,'NO_LOCAL_WEIGHTS_REPORTED');
});
test('positive local size without startup switch does not activate inference',()=>{
  const out=assessProviderIndependence({
    selected:'OLLAMA_LOCAL',probeStatus:'AVAILABLE',ollamaModels:[local()]
  });
  common(out);
  assert.equal(out.reported_local_ollama_weights,1);
  assert.equal(out.draft_status,'OPERATOR_STARTUP_REQUIRED');
});
test('startup and local report still demand separate per-prompt approval',()=>{
  const out=assessProviderIndependence({
    selected:'OLLAMA_LOCAL',probeStatus:'AVAILABLE',
    ollamaModels:[local(),cloud()],localTrialEnabled:true
  });
  common(out);
  assert.equal(out.draft_status,'EXPLICIT_ONE_SHOT_APPROVAL_REQUIRED');
  assert.match(out.explanation,/execution is not guaranteed/i);
});
test('PhiServe on and off never imply a daemon or model is verified',()=>{
  const off=assessProviderIndependence({selected:'PHISERVE_LOCAL'});
  const on=assessProviderIndependence({selected:'PHISERVE_LOCAL',phiServeEnabled:true});
  common(off);common(on);
  assert.equal(off.draft_status,'OPERATOR_STARTUP_REQUIRED');
  assert.equal(on.draft_status,'SEPARATE_DISCOVERY_REQUIRED');
  assert.equal(on.provider_discovery_independently_verified,false);
});
test('invalid or forged inputs are refused',()=>{
  for(const input of [
    {selected:'REMOTE_CLOUD'},
    {probeStatus:'ATTESTED_GPU'},
    {localTrialEnabled:'true'},
    {phiServeEnabled:1},
    {ollamaModels:'not-an-array'},
    {ollamaModels:Array(257).fill(local())}
  ])assert.throws(()=>assessProviderIndependence(input),/INVALID_REHEARSAL_INPUT/);
});
test('local console serves and packages read-only rehearsal, never auto-authorizes',()=>{
  const root=new URL('../',import.meta.url);
  const page=readFileSync(new URL('ui/index.html',root),'utf8');
  const app=readFileSync(new URL('ui/app.js',root),'utf8');
  const server=readFileSync(new URL('server.mjs',root),'utf8');
  const pkg=readFileSync(new URL('../../windows-local/build-portable.ps1',root),'utf8');
  const module=readFileSync(new URL('ui/provider-independence.mjs',root),'utf8');
  assert.match(page,/id="provider-rehearsal-choice"/);
  assert.match(page,/id="provider-rehearsal-capabilities"/);
  assert.match(page,/planning only/);
  assert.match(app,/assessProviderIndependence/);
  assert.match(app,/renderProviderIndependence\(\)/);
  assert.match(app,/providerProbeStatus='ERROR'/);
  assert.match(server,/\['\/provider-independence\.mjs'/);
  assert.match(pkg,/local-console\/ui\/provider-independence\.mjs/);
  assert.doesNotMatch(module,/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\blocalStorage\b|\bindexedDB\b|\beval\s*\(/);
});

test('R6 manual handoff fails closed until a separate local provider is eligible',()=>{
  const cases=[
    assessProviderIndependence(),
    assessProviderIndependence({selected:'OLLAMA_LOCAL'}),
    assessProviderIndependence({selected:'OLLAMA_LOCAL',probeStatus:'UNAVAILABLE',localTrialEnabled:true}),
    assessProviderIndependence({selected:'OLLAMA_LOCAL',probeStatus:'AVAILABLE',ollamaModels:[cloud()],localTrialEnabled:true}),
    assessProviderIndependence({selected:'OLLAMA_LOCAL',probeStatus:'AVAILABLE',ollamaModels:[local()],localTrialEnabled:false}),
    assessProviderIndependence({selected:'PHISERVE_LOCAL',phiServeEnabled:false})
  ];
  for(const assessment of cases){
    const result=planManualPromptStage({assessment,prompt:'Synthetic local question?'});
    assert.equal(result.schema,HANDOFF_SCHEMA);
    assert.equal(result.status,'HELD');
    assert.equal(result.target_input_id,null);
    assert.equal(result.network_request_performed,false);
    assert.equal(result.auto_fallback,false);
    assert.equal(result.authorization_granted,false);
  }
});
test('R6 Ollama editor can be staged but still requires manual model and fresh approval',()=>{
  const assessment=assessProviderIndependence({
    selected:'OLLAMA_LOCAL',probeStatus:'AVAILABLE',ollamaModels:[local(),cloud()],
    localTrialEnabled:true
  });
  const result=planManualPromptStage({assessment,prompt:'Explain an imaginary solar system.'});
  assert.equal(result.status,'READY_TO_STAGE');
  assert.equal(result.target_input_id,'trial-prompt');
  assert.equal(result.provider_switched,false);
  assert.equal(result.inference_performed,false);
  assert.equal(result.model_selected,false);
  assert.equal(result.requires_fresh_per_prompt_approval,true);
  assert.equal(result.requires_manual_model_selection,true);
  assert.equal(result.prompt_included,false);
  assert.ok(!JSON.stringify(result).includes('imaginary solar system'));
});
test('R6 PhiServe mode only stages editor text; never claims model discovery',()=>{
  const assessment=assessProviderIndependence({
    selected:'PHISERVE_LOCAL',phiServeEnabled:true
  });
  const result=planManualPromptStage({assessment,prompt:'Draft a fictional postcard.'});
  assert.equal(result.status,'READY_TO_STAGE');
  assert.equal(result.target_input_id,'desk-live-prompt');
  assert.equal(result.canonical_runtime_connected,false);
  assert.equal(result.authorization_granted,false);
});
test('R6 missing, oversize, control-character and non-string prompts refuse without side effects',()=>{
  const assessment=assessProviderIndependence({
    selected:'OLLAMA_LOCAL',probeStatus:'AVAILABLE',ollamaModels:[local()],localTrialEnabled:true
  });
  for(const prompt of ['', '  ', 'x'.repeat(2001), 'bad\u0000prompt', 'bad\u007fprompt', null, {text:'no'}]){
    const plan=planManualPromptStage({assessment,prompt});
    assert.equal(plan.status,'REFUSED');
    assert.equal(plan.reason,'PROMPT_INVALID');
    assert.equal(plan.network_request_performed,false);
    assert.equal(plan.target_input_id,null);
  }
});
test('R6 fabricated authority or invalid provider assessment is not accepted',()=>{
  const ok=assessProviderIndependence({
    selected:'OLLAMA_LOCAL',probeStatus:'AVAILABLE',ollamaModels:[local()],localTrialEnabled:true
  });
  for(const modified of [
    {...ok,identity_and_authority:'ADMIN'},
    {...ok,canonical_runtime_connected:true},
    {...ok,auto_fallback:true},
    {...ok,inference_performed:true},
    {...ok,selected_provider:'REMOTE_CLOUD'},
    {...ok,status:'MODEL_ROUTE_APPROVED'},
    {...ok,schema:'unknown'}
  ]) assert.throws(()=>planManualPromptStage({
    assessment:modified,prompt:'Harmless synthetic text'
  }),/UNTRUSTED_PROVIDER_ASSESSMENT/);
});
test('R6 UI keeps stage separate from inference, clears old approvals and reads mode only by click',()=>{
  const root=new URL('../',import.meta.url);
  const page=readFileSync(new URL('ui/index.html',root),'utf8');
  const app=readFileSync(new URL('ui/app.js',root),'utf8');
  const module=readFileSync(new URL('ui/provider-independence.mjs',root),'utf8');
  for(const id of ['provider-handoff-check-mode','provider-handoff-prompt',
    'provider-handoff-stage','provider-handoff-status'])
    assert.ok(page.includes('id="'+id+'"'));
  assert.match(page,/Copy prompt into selected local editor/);
  assert.match(page,/never sends the prompt/i);
  assert.match(app,/handoffStage\.addEventListener\('click'/);
  assert.match(app,/planManualPromptStage\(/);
  assert.match(app,/trialProtocol\.value='';loadedProtocolId=null/);
  assert.match(app,/trialApprove\.checked=false/);
  assert.match(app,/select\.value=''; \/\/ Explicit new model choice required/);
  assert.match(app,/approval\.checked=false/);
  assert.match(app,/dest\.dispatchEvent\(new Event\('change'\)\)/);
  assert.match(app,/providerProbeStatus='NOT_SCANNED';providerSnapshot=\[\]/);
  const stage=app.split("handoffStage.addEventListener('click',()=>{")[1]?.split("\n});")[0];
  assert.ok(stage && stage.length>100);
  assert.doesNotMatch(stage,/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bclick\s*\(\)/);
  assert.doesNotMatch(module,/\bfetch\s*\(|\bWebSocket\b|\blocalStorage\b|\bindexedDB\b|\beval\s*\(/);
  assert.match(app,/modeReadButton\.addEventListener\('click',async/);
  assert.match(app,/await fetch\('\/api\/status'/);
});
