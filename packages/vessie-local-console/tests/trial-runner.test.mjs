import test from 'node:test';
import assert from 'node:assert/strict';
import {runLocalTrial,LOCAL_OLLAMA_GENERATE} from '../trial-runner.mjs';

function upstream({response='Hello there!',model='qwen3:4b',done=true,extra={}}={}){
  return new Response(JSON.stringify({
    model,done,response,total_duration:900000000,load_duration:3000000,
    prompt_eval_count:12,eval_count:6,eval_duration:400000000,...extra
  }),{status:200,headers:{'content-type':'application/json'}});
}
test('TR01 exact loopback POST, bounded options, no network override from prompt',async()=>{
  let calls=0;
  const out=await runLocalTrial({
    model:'qwen3:4b',prompt:'Give a short greeting.',maxOutputTokens:64,
    fetchImpl:async(url,opts)=>{
      calls++;
      assert.equal(url,LOCAL_OLLAMA_GENERATE);
      assert.equal(url,'http://127.0.0.1:11434/api/generate');
      assert.equal(opts.method,'POST');assert.equal(opts.redirect,'error');
      const body=JSON.parse(opts.body);
      assert.deepEqual(Object.keys(body).sort(),['keep_alive','model','options','prompt','stream','think'].sort());
      assert.equal(body.model,'qwen3:4b');
      assert.equal(body.prompt,'Give a short greeting.');
      assert.equal(body.stream,false);assert.equal(body.think,false);
      assert.equal(body.keep_alive,0);assert.equal(body.options.num_predict,64);
      assert.ok(opts.signal);
      return upstream();
    }
  });
  assert.equal(calls,1);
  assert.equal(out.response,'Hello there!');
  assert.equal(out.receipt.ollama_generated_tokens,6);
  assert.equal(out.receipt.ollama_prompt_tokens,12);
  assert.equal(out.receipt.private_prompt_included,false);
  assert.equal(out.receipt.generated_text_included,false);
  assert.equal(out.model_routing_approved,false);
  assert.equal(out.authority_granted,false);
  assert.ok(!JSON.stringify(out.receipt).includes('Hello there'));
  assert.ok(!JSON.stringify(out.receipt).includes('Give a short'));
  assert.match(out.receipt.generated_text_sha256,/^[a-f0-9]{64}$/);
});
test('TR02 refuse invalid prompt, token limit, model name before network',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;throw Error('SHOULD_NOT_CONTACT');};
  for(const args of [
    {model:'',prompt:'text'},
    {model:'qwen3:4b',prompt:''},
    {model:'qwen3:4b',prompt:'X'.repeat(2001)},
    {model:'qwen3:4b',prompt:'hi',maxOutputTokens:129},
    {model:'qwen3:4b',prompt:'hi',maxOutputTokens:0},
    {model:'qwen3:4b\n',prompt:'hi'}
  ]) await assert.rejects(runLocalTrial({...args,fetchImpl}));
  assert.equal(calls,0);
});
test('TR03 reject non-JSON, aborted, incomplete or mismatched upstream',async()=>{
  for(const res of [
    new Response('secret',{status:500,headers:{'content-type':'application/json'}}),
    new Response('bad',{status:200,headers:{'content-type':'text/html'}}),
    upstream({done:false}),
    upstream({model:'NOT_THE_SELECTED_MODEL'}),
    upstream({response:'x'.repeat(6001)})
  ]){
    await assert.rejects(runLocalTrial({model:'qwen3:4b',prompt:'hi',fetchImpl:async()=>res}));
  }
});
test('TR04 refuse impossible statistics without echoing custom upstream fields',async()=>{
  const result=await runLocalTrial({
    model:'qwen3:4b',prompt:'test',
    fetchImpl:async()=>upstream({extra:{
      eval_count:-3,prompt_eval_count:9.4,
      private_api_key:'SENSITIVE_DO_NOT_INCLUDE'
    }})
  });
  assert.equal(result.receipt.ollama_generated_tokens,null);
  assert.equal(result.receipt.ollama_prompt_tokens,null);
  assert.ok(!JSON.stringify(result).includes('SENSITIVE_DO_NOT_INCLUDE'));
});
test('TR05 refuse declared response larger than cap before parsing',async()=>{
  await assert.rejects(runLocalTrial({model:'qwen3:4b',prompt:'test',
    fetchImpl:async()=>new Response('A'.repeat(131073),{
      status:200,headers:{'content-type':'application/json'}
    })}));
});
