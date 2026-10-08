import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverOllama, OLLAMA_ORIGIN } from '../ollama-probe.mjs';
import { startGateway } from '../server.mjs';

const TOKEN = 'ab'.repeat(32);
const fixture = () => ({
  schema:'superphivessel.gateway.models.v0.1',
  probe_status:'AVAILABLE',
  model_count:1,
  models:[{name:'test:1b',routing_approved:false,execution_authorized:false}],
  can_execute:false,authority_granted:false,
});

function responseJson(value, status=200, header=true) {
  return new Response(JSON.stringify(value), {status,
    headers: header ? {'content-type':'application/json'} : {}});
}

function fetchMock(url, options={}) {
  assert.ok([OLLAMA_ORIGIN+'/api/tags', OLLAMA_ORIGIN+'/api/ps'].includes(url));
  assert.equal(options.method, 'GET');
  assert.equal(options.redirect, 'error');
  if (url.endsWith('tags')) return Promise.resolve(responseJson({models:[
    {name:'alpha:7b',digest:'a'.repeat(64),size:5200000000,
     details:{quantization_level:'Q4_K_M',parameter_size:'7B',family:'qwen',
      private_path:'C:\\Users\\secrets',api_key:'INTERNAL_SECRET'}},
    {name:'beta:3b',size:2600000000},
  ]}));
  return Promise.resolve(responseJson({models:[{name:'alpha:7b',size_vram:4800000000}]}));
}

async function request(server, path, opts={}) {
  const port=server.address().port;
  return fetch('http://127.0.0.1:'+port+path, {
    redirect:'manual',
    headers:{Authorization:'Bearer '+TOKEN,...opts.headers},
    method:opts.method ?? 'GET',
    body:opts.body,
  });
}

test('G01 on-demand discovery uses only fixed local Ollama GET paths', async()=>{
  const result=await discoverOllama({fetchImpl:fetchMock});
  assert.equal(result.probe_status,'AVAILABLE');
  assert.equal(result.model_count,2);
  assert.equal(result.loaded_model_count,1);
  assert.equal(result.models[0].loaded,true);
  assert.equal(result.models[0].runtime_vram_bytes,4800000000);
  assert.equal(result.models[0].routing_approved,false);
  assert.equal(result.models[0].execution_authorized,false);
  assert.equal(result.models[0].model_ref,null);
  assert.ok(!JSON.stringify(result).includes('INTERNAL_SECRET'));
  assert.ok(!JSON.stringify(result).includes('private_path'));
});
test('G02 unavailable/invalid Ollama fail closed without leaking response',async()=>{
  const result=await discoverOllama({fetchImpl:async()=>{throw new Error('SECRET_CONNECTION_PATH');}});
  assert.equal(result.probe_status,'UNAVAILABLE');
  assert.equal(result.model_count,0);
  assert.ok(!JSON.stringify(result).includes('SECRET_CONNECTION_PATH'));
});
test('G03 malformed/massive model lists are rejected',async()=>{
  const result=await discoverOllama({fetchImpl:async url=>
    responseJson(url.endsWith('tags')?{models:Array.from({length:257},(_,i)=>({name:'m'+i}))}:{models:[]})
  });
  assert.equal(result.probe_status,'UNAVAILABLE');
  assert.equal(result.error_code,'OLLAMA_INVALID_MODELS');
});
test('G04 responses over hard size bound fail closed',async()=>{
  const result=await discoverOllama({fetchImpl:async url=>
    responseJson(url.endsWith('tags')?{models:[],padding:'X'.repeat(530000)}:{models:[]})
  });
  assert.equal(result.probe_status,'UNAVAILABLE');
  assert.equal(result.error_code,'OLLAMA_RESPONSE_TOO_LARGE');
});
test('G05 gateway requires full-entropy token before binding',async()=>{
  await assert.rejects(startGateway({token:'tiny',probe:fixture}),/64-character/);
  await assert.rejects(startGateway({token:'z'.repeat(64),probe:fixture}),/64-character/);
});
test('G06 gateway binds only loopback and advertises no privileges',async()=>{
  const s=await startGateway({token:TOKEN,probe:fixture});
  try{
    assert.equal(s.address().address,'127.0.0.1');
    const r=await request(s,'/v1/status');
    assert.equal(r.status,200);
    const body=await r.json();
    assert.equal(body.canonical_runtime_connected,false);
    assert.equal(body.browser_pairing,'NOT_IMPLEMENTED');
    assert.equal(body.authority_granted,false);
    assert.equal(body.action_authority,'NONE');
  }finally{await new Promise(resolve=>s.close(resolve));}
});
test('G07 unauthorized and wrong token cannot read model list',async()=>{
  let calls=0;
  const s=await startGateway({token:TOKEN,probe:()=>{calls++;return fixture();}});
  try{
    let r=await fetch('http://127.0.0.1:'+s.address().port+'/v1/models');
    assert.equal(r.status,403);
    r=await request(s,'/v1/models',{headers:{Authorization:'Bearer '+'ff'.repeat(32)}});
    assert.equal(r.status,403);
    assert.equal(calls,0);
  }finally{await new Promise(resolve=>s.close(resolve));}
});
test('G08 legitimate read-only models are disclosed only after token validation',async()=>{
  const s=await startGateway({token:TOKEN,probe:fixture});
  try{
    const r=await request(s,'/v1/models');
    assert.equal(r.status,200);
    assert.match(r.headers.get('cache-control'),/no-store/);
    const body=await r.json();
    assert.equal(body.model_count,1);
    assert.equal(body.models[0].routing_approved,false);
  }finally{await new Promise(resolve=>s.close(resolve));}
});
test('G09 browser Origins are refused including Pages origin',async()=>{
  let calls=0;
  const s=await startGateway({token:TOKEN,probe:()=>{calls++;return fixture();}});
  try{
    const r=await request(s,'/v1/models',{headers:{Origin:'https://michaelwave369.github.io'}});
    assert.equal(r.status,403);
    assert.equal(r.headers.get('access-control-allow-origin'),null);
    assert.equal(calls,0);
  }finally{await new Promise(resolve=>s.close(resolve));}
});
test('G10 client cannot POST model execution or invent routes',async()=>{
  let calls=0;
  const s=await startGateway({token:TOKEN,probe:()=>{calls++;return fixture();}});
  try{
    const r=await request(s,'/v1/models',{method:'POST',body:'{"run":true}'});
    assert.equal(r.status,405);
    const r2=await request(s,'/v1/tasks/execute');
    assert.equal(r2.status,404);
    const r3=await request(s,'/v1/models?api_key=secret');
    assert.equal(r3.status,404);
    assert.equal(calls,0);
  }finally{await new Promise(resolve=>s.close(resolve));}
});
test('G11 unavailable probe returns bounded 503, no faked models',async()=>{
  const s=await startGateway({token:TOKEN,probe:async()=>({
    schema:'superphivessel.gateway.models.v0.1',probe_status:'UNAVAILABLE',
    models:[],model_count:0,authority_granted:false,
  })});
  try{
    const r=await request(s,'/v1/models');
    assert.equal(r.status,503);
    assert.equal((await r.json()).model_count,0);
  }finally{await new Promise(resolve=>s.close(resolve));}
});
test('G12 proxy/DNS-rebinding host headers fail closed',async()=>{
  const s=await startGateway({token:TOKEN,probe:fixture});
  try{
    const r=await request(s,'/v1/models',{headers:{Host:'evil.example.org'}});
    assert.equal(r.status,403);
    const r2=await request(s,'/v1/models',{headers:{'X-Forwarded-Host':'evil.example.org'}});
    assert.equal(r2.status,403);
  }finally{await new Promise(resolve=>s.close(resolve));}
});
