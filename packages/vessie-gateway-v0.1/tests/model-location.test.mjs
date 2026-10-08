import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyOllamaAvailability, discoverOllama, OLLAMA_ORIGIN} from '../ollama-probe.mjs';

function response(data) {
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
}
function fixedProbe(tags,active=[]) {
  return discoverOllama({fetchImpl:async (url,options)=>{
    assert.ok([OLLAMA_ORIGIN+'/api/tags',OLLAMA_ORIGIN+'/api/ps'].includes(url));
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    return response({models:url.endsWith('/api/tags')?tags:active});
  }});
}
test('ML01 strong remote metadata distinguishes remote aliases from local size reports',()=>{
  const x=classifyOllamaAvailability({remote_model:'qwen3:remote',size:67108864},'friendly:latest');
  assert.deepEqual(x,{execution_location:'CLOUD_REFERENCE',classification_basis:'REMOTE_METADATA'});
});
test('ML02 Ollama -cloud suffix is labeled a hint, not a verified remote attestation',()=>{
  for(const name of ['deepseek-v3.1:671b-cloud','gpt-oss:120b-cloud','kimi-k3:cloud','qwen3-coder:480b-cloud']){
    const x=classifyOllamaAvailability({size:0},name);
    assert.deepEqual(x,{execution_location:'CLOUD_REFERENCE',classification_basis:'CLOUD_TAG_HINT'});
  }
});
test('ML03 positive local size only implies local-size report, never execution approval',()=>{
  assert.deepEqual(classifyOllamaAvailability({size:8388608},'braincbrain:latest'),{
    execution_location:'LOCAL_WEIGHTS_REPORTED',classification_basis:'POSITIVE_SIZE_REPORT'
  });
});
test('ML04 zero-size non-cloud entry is unknown, not local or remote confirmed',()=>{
  assert.deepEqual(classifyOllamaAvailability({size:0},'custom-model:latest'),{
    execution_location:'UNKNOWN',classification_basis:'INSUFFICIENT_METADATA'
  });
});
test('ML05 cloud tag wins over positive size because it might be only a remote alias',()=>{
  const x=classifyOllamaAvailability({size:128},'test:cloud');
  assert.equal(x.execution_location,'CLOUD_REFERENCE');
  assert.equal(x.classification_basis,'CLOUD_TAG_HINT');
});
test('ML06 remote_host and remote_model values never leak to caller',async()=>{
  const result=await fixedProbe([
    {name:'friendly:latest',size:456,remote_host:'https://SECRET_PRIVATE_REMOTE_ENDPOINT.invalid',
      remote_model:'SECRET_REMOTE_MODEL_NAME'},
    {name:'local:2b',size:23333333},
    {name:'cloud-only:cloud',size:0},
    {name:'zero:latest',size:0}
  ]);
  assert.equal(result.probe_status,'AVAILABLE');
  assert.equal(result.model_count,4);
  const models=new Map(result.models.map(m=>[m.name,m]));
  assert.equal(models.get('friendly:latest').execution_location,'CLOUD_REFERENCE');
  assert.equal(models.get('friendly:latest').classification_basis,'REMOTE_METADATA');
  assert.equal(models.get('local:2b').execution_location,'LOCAL_WEIGHTS_REPORTED');
  assert.equal(models.get('cloud-only:cloud').execution_location,'CLOUD_REFERENCE');
  assert.equal(models.get('zero:latest').execution_location,'UNKNOWN');
  for(const m of result.models) {
    assert.equal(m.routing_approved,false);
    assert.equal(m.execution_authorized,false);
  }
  assert.ok(!JSON.stringify(result).includes('SECRET_PRIVATE_REMOTE_ENDPOINT'));
  assert.ok(!JSON.stringify(result).includes('SECRET_REMOTE_MODEL_NAME'));
});
test('ML07 invalid remote field types do not trigger false remote-verified result',()=>{
  const x=classifyOllamaAvailability({size:500,remote_host:{secret:'x'},remote_model:12},'local:latest');
  assert.equal(x.execution_location,'LOCAL_WEIGHTS_REPORTED');
});
