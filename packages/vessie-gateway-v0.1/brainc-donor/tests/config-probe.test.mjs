import test from 'node:test';
import assert from 'node:assert/strict';
import { probeBrainC, redactBrainCConfig } from '../config-probe.mjs';

const SOURCE='http://127.0.0.1:8000';
function reply(value, options={}) {
  return new Response(JSON.stringify(value),{
    status:options.status||200,
    headers:options.contentType===false ? {} : {'Content-Type':'application/json'},
  });
}
function api(config={}) {
  const paths=[];
  const fetchImpl=async(url, opts)=>{
    paths.push(url);
    assert.ok([SOURCE+'/models',SOURCE+'/models/active'].includes(url),'Only fixed paths allowed');
    assert.equal(opts.method,'GET');
    assert.equal(opts.credentials,'omit');
    assert.equal(opts.redirect,'error');
    assert.equal(opts.cache,'no-store');
    if(config.fail) throw new Error('secret local path: C:\\private\\credential');
    if(url.endsWith('/active')) return reply(config.activeResponse??{model:'braincbrain'});
    return reply(config.modelsResponse??{models:['qwen3:4b','braincbrain'],active:'braincbrain'});
  };
  return {fetchImpl,paths};
}
test('B01 actual BrainC v1 GET paths only',async()=>{
  const client=api();const result=await probeBrainC(client);
  assert.deepEqual(client.paths.sort(),[SOURCE+'/models',SOURCE+'/models/active'].sort());
  assert.equal(result.probe_status,'AVAILABLE');
  assert.equal(result.configured_active_model,'braincbrain');
});
test('B02 configured active is NOT verified executed model',async()=>{
  const result=await probeBrainC(api());
  assert.equal(result.execution_observed,false);
  assert.equal(result.executed_model_ref,null);
  assert.equal(result.per_request_effective_model,'UNKNOWN');
  assert.equal(result.brainc_routing_trace_verified,false);
});
test('B03 all inventory identities unqualified and non-executable',async()=>{
  const result=await probeBrainC(api());
  assert.equal(result.model_count,2);
  assert.deepEqual(result.models.map(m=>m.name),['braincbrain','qwen3:4b']);
  assert.ok(result.models.every(m=>m.routing_approved===false && m.execution_authorized===false && m.exact_model_ref===null));
});
test('B04 per-user preference not invented from global config',async()=>{
  const result=await probeBrainC(api());
  assert.equal(result.per_user_model_preference_inspected,false);
  assert.equal(result.per_request_effective_model,'UNKNOWN');
  assert.equal(result.brainc_crane_fly_receipt_observed,false);
});
test('B05 endpoint disagreement refuses configured active claim',async()=>{
  const result=await probeBrainC(api({activeResponse:{model:'other:latest'}}));
  assert.equal(result.probe_status,'CONFIGURATION_DISAGREEMENT');
  assert.equal(result.configured_active_model,null);
  assert.equal(result.models.length,0);
  assert.equal(result.execution_observed,false);
});
test('B06 active model absent from inventory is visible as drift, not an executed model',async()=>{
  const result=await probeBrainC(api({modelsResponse:{models:['gemma3:4b'],active:'braincbrain'}}));
  assert.equal(result.probe_status,'AVAILABLE');
  assert.equal(result.configured_active_in_inventory,false);
  assert.equal(result.executed_model_ref,null);
});
test('B07 Ollama/backend offline fails closed and leaks no local error',async()=>{
  const result=await probeBrainC(api({fail:true}));
  assert.equal(result.probe_status,'UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('credential'));
  assert.equal(result.model_count,0);
});
test('B08 invalid content-type and redirect treated as unavailable',async()=>{
  const result=await probeBrainC({fetchImpl:async()=>new Response('abc',{status:302,headers:{Location:'http://evil.test'}})});
  assert.equal(result.probe_status,'UNAVAILABLE');
});
test('B09 invalid source response shape cannot become model evidence',async()=>{
  const result=await probeBrainC(api({modelsResponse:{models:'not-array',active:'braincbrain'}}));
  assert.equal(result.probe_status,'UNAVAILABLE');
});
test('B10 malicious model string rejected rather than reflected',async()=>{
  const result=await probeBrainC(api({modelsResponse:{models:['<script>alert(1)</script>'],active:'braincbrain'}}));
  assert.equal(result.probe_status,'UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('<script>'));
});
test('B11 duplicate and excessive model inventories rejected',async()=>{
  const duplicate=await probeBrainC(api({modelsResponse:{models:['a','a'],active:'a'},activeResponse:{model:'a'}}));
  assert.equal(duplicate.probe_status,'UNAVAILABLE');
  const large=await probeBrainC(api({modelsResponse:{
    models:Array.from({length:129},(_,i)=>'m'+i),active:'m0'
  },activeResponse:{model:'m0'}}));
  assert.equal(large.probe_status,'UNAVAILABLE');
});
test('B12 response body size bound cannot be bypassed with missing length header',async()=>{
  const result=await probeBrainC({fetchImpl:async()=>reply({models:[],active:'a',pad:'x'.repeat(100000)})});
  assert.equal(result.probe_status,'UNAVAILABLE');
});
test('B13 no POST route, model switch, execute or stream',async()=>{
  const client=api();
  const result=await probeBrainC(client);
  assert.equal(result.can_execute,false);
  assert.equal(result.can_change_active_model,false);
  assert.equal(result.may_change_live_route,false);
  assert.equal(result.authority_granted,false);
  assert.equal(client.paths.length,2);
});
test('B14 redacted share report contains no raw model names',async()=>{
  const full=await probeBrainC(api());
  const summary=redactBrainCConfig(full);
  assert.equal(summary.model_names_redacted,true);
  assert.equal(summary.configured_active_model,null);
  assert.equal(summary.models.length,0);
  assert.equal(summary.model_count,2);
  assert.ok(!JSON.stringify(summary).includes('braincbrain'));
  assert.ok(!JSON.stringify(summary).includes('qwen3:4b'));
});
test('B15 redacted report cannot mark execution or attestation successful',async()=>{
  const result=redactBrainCConfig(await probeBrainC(api()));
  assert.equal(result.execution_observed,false);
  assert.equal(result.source_authenticity_attested,false);
  assert.equal(result.operator_review_required,true);
  assert.equal(result.authority_granted,false);
});
test('B16 forged probe schema refused by redaction helper',()=>{
  assert.throws(()=>redactBrainCConfig({schema:'fake',probe_status:'AVAILABLE'}),/SCHEMA_INVALID/);
});
test('B17 checksum repeatable for same local configuration only',async()=>{
  const a=await probeBrainC(api());
  const b=await probeBrainC(api());
  assert.equal(a.local_configuration_checksum,b.local_configuration_checksum);
  assert.equal(a.model_artifacts_qualified,false);
});
test('B18 returned config names are sanitized with bounded lengths',async()=>{
  const result=await probeBrainC(api({modelsResponse:{
    models:['a'.repeat(129)],active:'braincbrain'
  }}));
  assert.equal(result.probe_status,'UNAVAILABLE');
});
