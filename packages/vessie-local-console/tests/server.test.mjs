import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import {createLocalConsole} from '../server.mjs';

const fixture=()=>({
  schema:'superphivessel.gateway.models.v0.1',
  probe_status:'AVAILABLE',authority_granted:false,can_execute:false,
  models:[{
    name:'synthetic-fixture:3b',loaded:true,quantization:'Q4_K_M',
    parameter_size:'3B',size_bytes:1234567,runtime_vram_bytes:100000,
    routing_approved:true,execution_authorized:true,private_key:'NEVER_PRINT'
  }]
});
function request(port,path='/',{method='GET',headers={},body=undefined}={}){
  return new Promise((resolve,reject)=>{
    const req=httpRequest({hostname:'127.0.0.1',port,path,method,
      headers:{Host:'127.0.0.1:'+port,...headers}},res=>{
      const chunks=[];
      res.on('data',c=>chunks.push(c));
      res.on('end',()=>resolve({
        code:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.once('error',reject);
    req.end(body);
  });
}
async function withServer(run,options={}){
  const g=await createLocalConsole({port:0,probe:async()=>fixture(),...options});
  try{return await run(g);} finally {await new Promise(resolve=>g.server.close(resolve));}
}
function token(html) {
  return html.match(/<meta name="vessie-readonly-token" content="([a-f0-9]{64})">/)?.[1];
}
test('L01 binds only 127.0.0.1 and has an ephemeral read-only secret',async()=>{
  await withServer(async g=>{
    assert.equal(g.server.address().address,'127.0.0.1');
    const page=await request(g.port);
    assert.equal(page.code,200);
    assert.match(page.headers['content-security-policy'],/default-src 'none'/);
    assert.equal(page.headers['access-control-allow-origin'],undefined);
    assert.equal(page.headers['set-cookie'],undefined);
    assert.match(token(page.text),/^[a-f0-9]{64}$/);
    assert.ok(!page.text.includes('synthetic-fixture'));
    assert.ok(!page.text.includes('NEVER_PRINT'));
  });
});
test('L02 local API refuses unauthenticated reads',async()=>{
  await withServer(async g=>{
    const r=await request(g.port,'/api/models');
    assert.equal(r.code,403);
    assert.equal(JSON.parse(r.text).authority_granted,false);
  });
});
test('L03 local API returns only sanitized model fields, never approval',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await request(g.port,'/api/models',{headers:{Authorization:'Bearer '+key}});
    assert.equal(r.code,200);
    const result=JSON.parse(r.text);
    assert.equal(result.model_count,1);
    assert.equal(result.models[0].name,'synthetic-fixture:3b');
    assert.equal(result.models[0].routing_approved,false);
    assert.equal(result.models[0].execution_authorized,false);
    assert.equal(result.can_execute,false);
    assert.equal(result.authority_granted,false);
    assert.ok(!r.text.includes('NEVER_PRINT'));
  });
});
test('L04 status never claims execution or remote model connection',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await request(g.port,'/api/status',{headers:{Authorization:'Bearer '+key}});
    assert.equal(r.code,200);
    const data=JSON.parse(r.text);
    assert.equal(data.mode,'LOCAL_READ_ONLY');
    assert.equal(data.cloud_connected,false);
    assert.equal(data.brainc_connected,false);
    assert.equal(data.authority_granted,false);
  });
});
test('L05 hostile Origin and Fetch-Site are refused even with session',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    assert.equal((await request(g.port,'/api/models',{headers:{
      Authorization:'Bearer '+key,Origin:'https://attacker.example'
    }})).code,403);
    assert.equal((await request(g.port,'/api/models',{headers:{
      Authorization:'Bearer '+key,'Sec-Fetch-Site':'cross-site'
    }})).code,403);
  });
});
test('L06 DNS rebinding, proxy forwarding and cookies are refused',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    assert.equal((await request(g.port,'/api/models',{headers:{
      Host:'evil.example',Authorization:'Bearer '+key
    }})).code,403);
    assert.equal((await request(g.port,'/api/models',{headers:{
      Authorization:'Bearer '+key,'X-Forwarded-Host':'evil.example'
    }})).code,403);
    assert.equal((await request(g.port,'/api/models',{headers:{
      Authorization:'Bearer '+key,Cookie:'x=y'
    }})).code,403);
  });
});
test('L07 execution, POST, preflight and arbitrary path unavailable',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const a={Authorization:'Bearer '+key};
    assert.equal((await request(g.port,'/api/models',{method:'POST',headers:a})).code,405);
    assert.equal((await request(g.port,'/api/models',{method:'OPTIONS',headers:a})).code,405);
    assert.equal((await request(g.port,'/api/chat',{method:'POST',headers:a})).code,405);
    assert.equal((await request(g.port,'/execute',{headers:a})).code,404);
    assert.equal((await request(g.port,'/ollama-probe.mjs')).code,404);
    assert.equal((await request(g.port,'/api/models?secret=1',{headers:a})).code,405);
  });
});
test('L08 scripts/styles static and no remote scripts loaded',async()=>{
  await withServer(async g=>{
    const js=await request(g.port,'/app.js');
    const css=await request(g.port,'/style.css');
    assert.equal(js.code,200);
    assert.equal(css.code,200);
    assert.match(js.headers['content-type'],/javascript/);
    assert.match(css.headers['content-type'],/css/);
    assert.equal(js.headers['access-control-allow-origin'],undefined);
    assert.ok(js.text.includes('textContent'));
    assert.ok(!js.text.includes('innerHTML'));
  });
});
test('L09 malformed or authority-claiming upstream cannot become success',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await request(g.port,'/api/models',{headers:{Authorization:'Bearer '+key}});
    assert.equal(r.code,503);
  },{probe:async()=>({...fixture(),can_execute:true})});
});
test('L10 upstream failures are generic and do not reveal contents',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await request(g.port,'/api/models',{headers:{Authorization:'Bearer '+key}});
    assert.equal(r.code,503);
    assert.ok(!r.text.includes('SECRET_UPSTREAM'));
  },{probe:async()=>{throw new Error('SECRET_UPSTREAM');}});
});
test('L11 new local console process invalidates prior bearer',async()=>{
  let previous=null;
  await withServer(async g=>{previous=token((await request(g.port)).text);});
  await withServer(async g=>{
    const fresh=token((await request(g.port)).text);
    assert.notEqual(previous,fresh);
    const r=await request(g.port,'/api/models',{headers:{Authorization:'Bearer '+previous}});
    assert.equal(r.code,403);
  });
});
test('L12 no browser launch occurs unless explicitly provided',async()=>{
  let launches=0;
  await withServer(async g=>{
    assert.ok(g.port>0);
  },{launchBrowser:()=>{launches++;}});
  assert.equal(launches,1);
  await withServer(async()=>{});
  assert.equal(launches,1);
});
test('L13 rate limit applies to authenticated API requests',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const h={Authorization:'Bearer '+key};
    for(let i=0;i<30;i++)assert.equal((await request(g.port,'/api/status',{headers:h})).code,200);
    assert.equal((await request(g.port,'/api/status',{headers:h})).code,429);
  });
});
test('L14 declared unavailable Ollama inventory is not fabricated',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await request(g.port,'/api/models',{headers:{Authorization:'Bearer '+key}});
    assert.equal(r.code,200);
    const data=JSON.parse(r.text);
    assert.equal(data.probe_status,'UNAVAILABLE');
    assert.equal(data.model_count,0);
    assert.deepEqual(data.models,[]);
    assert.equal(data.can_execute,false);
  },{probe:async()=>({...fixture(),probe_status:'UNAVAILABLE',models:[]})});
});


test('L15 cloud references and local-size reports are counted without execution grants',async()=>{
  const augmented={...fixture(),models:[
    {...fixture().models[0],execution_location:'LOCAL_WEIGHTS_REPORTED',
      classification_basis:'POSITIVE_SIZE_REPORT'},
    {name:'qwen3-coder:480b-cloud',size_bytes:0,loaded:false,
      execution_location:'CLOUD_REFERENCE',classification_basis:'CLOUD_TAG_HINT',
      private_remote_host:'SHOULD_NEVER_LEAK',routing_approved:true,
      execution_authorized:true},
    {name:'opaque:latest',size_bytes:0,loaded:false,execution_location:'FALSE_LOCAL',
      classification_basis:'MALICIOUS',routing_approved:true}
  ]};
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await request(g.port,'/api/models',{headers:{Authorization:'Bearer '+key}});
    assert.equal(r.code,200);
    const data=JSON.parse(r.text);
    assert.deepEqual(data.classification_counts,{
      local_weights_reported:1,cloud_references:1,unknown:1
    });
    assert.equal(data.classification_is_advisory,true);
    assert.equal(data.cloud_execution_approved,false);
    assert.equal(data.can_execute,false);
    assert.equal(data.authority_granted,false);
    assert.equal(data.models[1].execution_location,'CLOUD_REFERENCE');
    assert.equal(data.models[1].routing_approved,false);
    assert.equal(data.models[1].execution_authorized,false);
    assert.equal(data.models[2].execution_location,'UNKNOWN');
    assert.equal(data.models[2].classification_basis,'INSUFFICIENT_METADATA');
    assert.ok(!r.text.includes('SHOULD_NEVER_LEAK'));
    assert.ok(!r.text.includes('MALICIOUS'));
  },{probe:async()=>augmented});
});
test('L16 cloud model naming never makes server launch an inference request',async()=>{
  let calls=0;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    await request(g.port,'/api/models',{headers:{Authorization:'Bearer '+key}});
    assert.equal(calls,1);
    assert.equal((await request(g.port,'/api/chat',{method:'POST'})).code,405);
    assert.equal(calls,1);
  },{probe:async()=>{calls++;return {...fixture(),models:[{
      name:'kimi-k3:cloud',size_bytes:0,
      execution_location:'CLOUD_REFERENCE',classification_basis:'REMOTE_METADATA'
    }]};}});
});
test('L17 local UI never claims cloud reference is INSTALLED or reports 0 GiB of GPU fit',async()=>{
  await withServer(async g=>{
    const script=(await request(g.port,'/app.js')).text;
    assert.ok(script.includes("CLOUD REF"));
    assert.ok(script.includes("LOCAL FILE"));
    assert.ok(script.includes('Cloud reference (not locally stored weights)'));
    assert.ok(!script.includes("badge.textContent=item.loaded?'LOADED':'INSTALLED'"));
  });
});

const localFixture=()=>({
  ...fixture(),
  models:[{
    name:'qwen3:4b',execution_location:'LOCAL_WEIGHTS_REPORTED',
    classification_basis:'POSITIVE_SIZE_REPORT',size_bytes:12345
  },{
    name:'qwen3-coder:480b-cloud',execution_location:'CLOUD_REFERENCE',
    classification_basis:'CLOUD_TAG_HINT',size_bytes:0
  }]
});
const fakeTrial=({model,prompt,maxOutputTokens})=>({
  schema:'superphivessel.local-console.trial.result.v0.1',
  response:'LOCAL_RESPONSE_ONLY',
  receipt:{
    schema:'superphivessel.local-console.trial.receipt.v0.1',
    timestamp:'2026-10-08T00:00:00Z',model,elapsed_wall_ms:22,
    private_prompt_included:false,generated_text_included:false,
    ollama_generated_tokens:5,model_routing_approved:false,authority_granted:false
  },
  authority_granted:false,can_schedule:false,model_routing_approved:false
});
async function trialRequest(port,token,model='qwen3:4b',more={}){
  return request(port,'/api/local-trial',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({model,prompt:'Say hello',max_output_tokens:64,approve_once:true,...more})
  });
}
test('L18 default read-only startup cannot invoke local inference even with bearer',async()=>{
  let runs=0;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const s=JSON.parse((await request(g.port,'/api/status',{headers:{
      Authorization:'Bearer '+key
    }})).text);
    assert.equal(s.local_trial_enabled,false);
    assert.equal(s.model_execution_enabled,false);
    const r=await trialRequest(g.port,key);
    assert.equal(r.code,403);
    assert.equal(JSON.parse(r.text).error,'LOCAL_TRIAL_DISABLED');
    assert.equal(runs,0);
  },{probe:async()=>localFixture(),trialRunner:async()=>{runs++;return fakeTrial({model:'qwen3:4b'});}});
});
test('L19 opt-in trial requires live bearer and affirmative approve_once',async()=>{
  let calls=0;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    assert.equal((await trialRequest(g.port,'invalid')).code,403);
    const r=await trialRequest(g.port,key,'qwen3:4b',{approve_once:false});
    assert.equal(r.code,400);
    assert.equal(calls,0);
    const status=JSON.parse((await request(g.port,'/api/status',{headers:{
      Authorization:'Bearer '+key
    }})).text);
    assert.equal(status.local_trial_enabled,true);
    assert.equal(status.model_routing_approved,false);
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async()=>{calls++;return fakeTrial({model:'qwen3:4b'});}});
});
test('L20 accepted trial runs exactly one local selected model with bounded receipt',async()=>{
  let calls=0;let args=null;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await trialRequest(g.port,key);
    assert.equal(r.code,200);
    const result=JSON.parse(r.text);
    assert.equal(calls,1);
    assert.deepEqual(args,{model:'qwen3:4b',prompt:'Say hello',maxOutputTokens:64});
    assert.equal(result.response,'LOCAL_RESPONSE_ONLY');
    assert.equal(result.receipt.model,'qwen3:4b');
    assert.equal(result.receipt.private_prompt_included,false);
    assert.equal(result.receipt.generated_text_included,false);
    assert.equal(result.model_routing_approved,false);
    assert.equal(result.can_schedule,false);
    assert.ok(!r.text.includes('Say hello'));
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async inArgs=>{
    calls++;args=inArgs;return fakeTrial(inArgs);
  }});
});
test('L21 remote references, unknown metadata, or unavailable inventory refused',async()=>{
  let calls=0;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    assert.equal((await trialRequest(g.port,key,'qwen3-coder:480b-cloud')).code,403);
    assert.equal((await trialRequest(g.port,key,'no-such-model:latest')).code,403);
    assert.equal(calls,0);
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async()=>{calls++;return fakeTrial({model:'qwen3:4b'});}});
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    assert.equal((await trialRequest(g.port,key)).code,403);
  },{trialEnabled:true,probe:async()=>({...localFixture(),probe_status:'UNAVAILABLE'})});
});
test('L22 cross-site and forged host denied before reaching local trial',async()=>{
  let calls=0;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const body=JSON.stringify({model:'qwen3:4b',prompt:'hi',approve_once:true,max_output_tokens:64});
    assert.equal((await request(g.port,'/api/local-trial',{
      method:'POST',body,
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',
        Origin:'https://not-vessie.example'}
    })).code,403);
    assert.equal((await request(g.port,'/api/local-trial',{
      method:'POST',body,
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',
        Host:'attacker.example'}
    })).code,403);
    assert.equal(calls,0);
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async()=>{calls++;return fakeTrial({model:'qwen3:4b'});}});
});
test('L23 extra dangerous POST body keys and oversized body rejected',async()=>{
  let calls=0;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    for(const extra of [
      {model:'qwen3:4b',prompt:'hi',approve_once:true,max_output_tokens:64,system:'BYPASS'},
      {model:'qwen3:4b',prompt:'hi',approve_once:true,max_output_tokens:1000},
      {model:'qwen3:4b',prompt:'X'.repeat(2500),approve_once:true,max_output_tokens:64}
    ]){
      const r=await request(g.port,'/api/local-trial',{
        method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify(extra)
      });
      assert.equal(r.code,400);
    }
    assert.equal(calls,0);
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async()=>{calls++;return fakeTrial({model:'qwen3:4b'});}});
});
test('L24 no more than 6 operator-approved trials per hour',async()=>{
  let calls=0;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    for(let i=0;i<6;i++)assert.equal((await trialRequest(g.port,key)).code,200);
    assert.equal((await trialRequest(g.port,key)).code,429);
    assert.equal(calls,6);
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async args=>{calls++;return fakeTrial(args);}});
});
test('L25 trial failures show generic error and never reveal upstream secrets',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await trialRequest(g.port,key);
    assert.equal(r.code,503);
    assert.ok(!r.text.includes('SECRET_PATH'));
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async()=>{throw Error('SECRET_PATH');}});
});
test('L26 local UI requires checkbox and confirm and does not auto-run generation',async()=>{
  await withServer(async g=>{
    const html=(await request(g.port)).text;
    const js=(await request(g.port,'/app.js')).text;
    assert.ok(html.includes('trial-approve'));
    assert.ok(html.includes('trial-export'));
    assert.ok(js.includes('window.confirm'));
    assert.ok(js.includes('approve_once:true'));
    assert.ok(js.includes("trialRun.addEventListener('click'"));
    assert.ok(!js.includes("setInterval("));
  });
});


test('L27 extended timing receipt is allowlisted and upstream secret stop reason suppressed',async()=>{
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await trialRequest(g.port,key);
    assert.equal(r.code,200);
    const receipt=JSON.parse(r.text).receipt;
    assert.equal(receipt.ollama_prompt_eval_duration_ns,1300000000);
    assert.equal(receipt.output_token_cap_reached,true);
    assert.equal(receipt.ollama_done_reason,'UNREPORTED_OR_UNKNOWN');
    assert.equal(receipt.authority_granted,false);
    assert.equal(receipt.generated_text_included,false);
    assert.equal(receipt.private_prompt_included,false);
    assert.ok(!r.text.includes('SECRET_ORIGIN'));
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async args=>({
    ...fakeTrial(args),
    receipt:{
      ...fakeTrial(args).receipt,
      ollama_prompt_eval_duration_ns:1300000000,
      output_token_cap_reached:true,
      ollama_done_reason:'SECRET_ORIGIN',
      private_session_token:'SECRET_ORIGIN'
    }
  })});
});
test('L28 local trial UI shows measured phase breakdown without interpreting model placement',async()=>{
  await withServer(async g=>{
    const html=(await request(g.port)).text;
    const js=(await request(g.port,'/app.js')).text;
    assert.ok(html.includes('id="trial-timing"'));
    assert.ok(js.includes('ollama_prompt_eval_duration_ns'));
    assert.ok(js.includes('Other/unattributed Ollama time'));
    assert.ok(js.includes('does not prove the answer was truncated'));
    assert.ok(js.includes('Not an independent GPU or routing benchmark.'));
  });
});


test('L29 human-review helper is served only as explicitly allowlisted same-origin JS',async()=>{
  await withServer(async g=>{
    const local=await request(g.port,'/review-evidence.mjs');
    assert.equal(local.code,200);
    assert.match(local.headers['content-type'],/javascript/);
    assert.match(local.headers['content-security-policy'],/default-src 'none'/);
    assert.equal(local.headers['access-control-allow-origin'],undefined);
    assert.ok(local.text.includes('makeHumanReview'));
    assert.equal((await request(g.port,'/ui/review-evidence.mjs')).code,404);
    assert.equal((await request(g.port,'/review-evidence.mjs',{headers:{
      Host:'untrusted.example'
    }})).code,403);
  });
});
test('L30 review requires a completed live trial and explicitly clicked export',async()=>{
  await withServer(async g=>{
    const html=(await request(g.port)).text;
    const js=(await request(g.port,'/app.js')).text;
    assert.match(html,/<script type="module" src="\/app\.js"><\/script>/);
    assert.ok(html.includes('id="human-review"'));
    assert.ok(html.includes('id="review-helpfulness"'));
    assert.ok(html.includes('id="review-verification"'));
    assert.ok(html.includes('id="review-export"'));
    assert.ok(js.includes('makeHumanReview('));
    assert.ok(js.includes("reviewSubmit.addEventListener('click'"));
    assert.ok(js.includes("reviewExport.addEventListener('click'"));
    assert.ok(js.includes('resetHumanReview();'));
    assert.ok(js.includes("field.addEventListener('change'"));
    assert.ok(js.includes('humanReviewReceipt=null;'));
    assert.ok(js.includes('reviewExport.disabled=true;'));
    assert.ok(!js.includes('innerHTML'));
  });
});


test('L31 pure evidence-bench helper served only as allowlisted same-origin local module',async()=>{
  await withServer(async g=>{
    const r=await request(g.port,'/evidence-bench.mjs');
    assert.equal(r.code,200);
    assert.match(r.headers['content-type'],/javascript/);
    assert.equal(r.headers['access-control-allow-origin'],undefined);
    assert.match(r.text,/export function addBenchEvidence/);
    assert.match(r.text,/export function buildBenchSummary/);
    assert.equal((await request(g.port,'/ui/evidence-bench.mjs')).code,404);
    assert.equal((await request(g.port,'/evidence-bench.mjs',{headers:{
      Origin:'https://michaelwave369.github.io'
    }})).code,403);
  });
});
test('L32 evidence bench requires deliberate in-memory import/export and never auto-schedules prompts',async()=>{
  await withServer(async g=>{
    const html=(await request(g.port)).text;
    const js=(await request(g.port,'/app.js')).text;
    assert.ok(html.includes('id="bench-import"'));
    assert.ok(html.includes('id="bench-add-performance"'));
    assert.ok(html.includes('id="bench-add-review"'));
    assert.ok(html.includes('id="bench-export"'));
    assert.ok(html.includes('id="bench-clear"'));
    assert.ok(js.includes('addBenchEvidence('));
    assert.ok(js.includes('buildBenchSummary('));
    assert.ok(js.includes('file.text()'));
    assert.ok(js.includes('file.size>16384'));
    assert.ok(js.includes("benchImportSelected.addEventListener('click'"));
    assert.ok(js.includes("benchExport.addEventListener('click'"));
    assert.ok(js.includes("benchClear.addEventListener('click'"));
    assert.ok(!js.includes('localStorage'));
    assert.ok(!js.includes('indexedDB'));
    assert.ok(!js.includes('setInterval('));
    assert.ok(!js.includes('innerHTML'));
    assert.equal((await request(g.port,'/api/bench')).code,404);
    assert.equal((await request(g.port,'/api/import-evidence',{method:'POST'})).code,405);
  });
});

test('L33 portable evidence helper only served on allowlisted same-origin route',async()=>{
  await withServer(async g=>{
    const r=await request(g.port,'/portable-bench.mjs');
    assert.equal(r.code,200);
    assert.match(r.headers['content-type'],/javascript/);
    assert.equal(r.headers['access-control-allow-origin'],undefined);
    assert.match(r.text,/export function exportPortableBench/);
    assert.match(r.text,/export function importPortableBench/);
    assert.equal((await request(g.port,'/ui/portable-bench.mjs')).code,404);
    assert.equal((await request(g.port,'/portable-bench.mjs',{headers:{
      Origin:'https://michaelwave369.github.io'
    }})).code,403);
  });
});
test('L34 bench bundle export/import is user-selected without server route or background persistence',async()=>{
  await withServer(async g=>{
    const html=(await request(g.port)).text;
    const js=(await request(g.port,'/app.js')).text;
    assert.ok(html.includes('id="bench-save-portable"'));
    assert.ok(html.includes('64 KiB maximum'));
    assert.ok(js.includes("import {BUNDLE_SCHEMA,MAX_BUNDLE_BYTES,exportPortableBench,importPortableBench}"));
    assert.ok(js.includes("benchSavePortable.addEventListener('click'"));
    assert.ok(js.includes("benchImportSelected.addEventListener('click'"));
    assert.ok(js.includes('file.size>MAX_BUNDLE_BYTES'));
    assert.ok(js.includes('file.size>16384'));
    assert.ok(js.includes('if(parsed?.schema===BUNDLE_SCHEMA)'));
    assert.ok(!js.includes('localStorage'));
    assert.ok(!js.includes('indexedDB'));
    assert.ok(!js.includes('setInterval('));
    assert.ok(!js.includes('innerHTML'));
    assert.equal((await request(g.port,'/api/bench-bundle')).code,404);
    assert.equal((await request(g.port,'/api/bench-bundle',{method:'POST'})).code,405);
  });
});


test('L35 protocol-labeled local trial requires exact public text and cap, never auto-runs',async()=>{
  const {TRIAL_PROTOCOLS}=await import('../ui/trial-protocols.mjs');
  const protocol=TRIAL_PROTOCOLS[0];
  let calls=0;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const body=(extra={})=>JSON.stringify({
      model:'qwen3:4b',prompt:protocol.prompt,
      max_output_tokens:protocol.max_output_tokens,
      approve_once:true,protocol_id:protocol.id,...extra
    });
    const send=async value=>request(g.port,'/api/local-trial',{
      method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify(value)
    });
    const valid=JSON.parse(body());
    assert.equal((await send({...valid,prompt:valid.prompt+' bad'})).code,400);
    assert.equal((await send({...valid,max_output_tokens:128})).code,400);
    assert.equal((await send({...valid,protocol_id:'untrusted-v1'})).code,400);
    assert.equal((await send({...valid,endpoint:'https://cloud.example'})).code,400);
    assert.equal(calls,0);
    const r=await send(valid);
    assert.equal(r.code,200);
    const data=JSON.parse(r.text);
    assert.equal(calls,1);
    assert.equal(data.receipt.protocol_id,protocol.id);
    assert.equal(data.receipt.protocol_evidence,'PUBLIC_FIXED_PROMPT_ONLY_NOT_INDEPENDENT_BENCHMARK');
    assert.equal(data.receipt.authority_granted,false);
    assert.equal(data.receipt.model_routing_approved,false);
    assert.equal(data.receipt.cloud_execution_approved,false);
    assert.ok(!r.text.includes(protocol.prompt));
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async args=>{
    calls++;return fakeTrial(args);
  }});
});
test('L36 freeform old four-field trials remain unlabeled and read-only mode still refuses',async()=>{
  let calls=0;
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await trialRequest(g.port,key);
    assert.equal(r.code,200);
    const data=JSON.parse(r.text);
    assert.equal(data.receipt.protocol_id,null);
    assert.equal(calls,1);
  },{trialEnabled:true,probe:async()=>localFixture(),trialRunner:async args=>{
    calls++;return fakeTrial(args);
  }});
  await withServer(async g=>{
    const key=token((await request(g.port)).text);
    const r=await trialRequest(g.port,key);
    assert.equal(r.code,403);
  },{trialEnabled:false,probe:async()=>localFixture()});
});
test('L37 protocol definitions are allowlisted local static assets; loading never executes',async()=>{
  await withServer(async g=>{
    const r=await request(g.port,'/trial-protocols.mjs');
    assert.equal(r.code,200);
    assert.match(r.headers['content-type'],/javascript/);
    assert.equal(r.headers['access-control-allow-origin'],undefined);
    assert.ok(r.text.includes('export const TRIAL_PROTOCOLS'));
    assert.equal((await request(g.port,'/ui/trial-protocols.mjs')).code,404);
    assert.equal((await request(g.port,'/trial-protocols.mjs',{
      headers:{Origin:'https://example.com'}
    })).code,403);
    const js=(await request(g.port,'/app.js')).text;
    const html=(await request(g.port)).text;
    assert.ok(js.includes("trialProtocolLoad.addEventListener('click'"));
    assert.ok(js.includes('exactProtocolMatch('));
    assert.ok(html.includes('id="trial-protocol"'));
    assert.ok(html.includes('id="trial-protocol-load"'));
  });
});
