import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessProviderIndependence,PROVIDER_REHEARSAL_SCHEMA} from '../ui/provider-independence.mjs';

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
