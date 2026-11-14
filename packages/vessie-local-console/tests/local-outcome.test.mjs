import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
  verifyOllamaTrialResponse,OLLAMA_CONSISTENCY_SCHEMA,OllamaConsistencyError
} from '../ui/local-outcome.mjs';

const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
function sample(text='Hello, tiny universe!'){
  const receipt={
    schema:'superphivessel.local-console.trial.receipt.v0.1',
    observation:'LOCAL_OLLAMA_API_RESULT_UNATTESTED',
    timestamp:'2026-11-13T00:00:00.000Z',model:'synthetic-local:4b',
    route:'LOCAL_LOOPBACK_FIXED',experiment_mode:'OPERATOR_ONE_SHOT',
    max_output_tokens_requested:64,protocol_id:null,
    protocol_evidence:'PUBLIC_FIXED_PROMPT_ONLY_NOT_INDEPENDENT_BENCHMARK',
    elapsed_wall_ms:10,ollama_total_duration_ns:10000,
    ollama_load_duration_ns:100,ollama_prompt_tokens:8,
    ollama_prompt_eval_duration_ns:100,ollama_generated_tokens:10,
    ollama_eval_duration_ns:10000,output_token_cap_reached:false,
    ollama_done_reason:'stop',generated_text_sha256:sha(text),
    private_prompt_included:false,generated_text_included:false,
    model_routing_approved:false,cloud_execution_approved:false,authority_granted:false
  };
  return {schema:'superphivessel.local-console.trial.result.v0.1',
    response:text,receipt,authority_granted:false,can_schedule:false,
    model_routing_approved:false};
}
const check=result=>verifyOllamaTrialResponse({
  result,expectedModel:'synthetic-local:4b',expectedTokens:64,cryptoImpl:webcrypto
});
test('R7-O01 valid Unicode text matches SHA-256 without granting attestation or tools',async()=>{
  const text='Hello, 🌌 Φ!\n \u00e9\u6f22\u5b57';
  const out=await check(sample(text));
  assert.equal(out.schema,OLLAMA_CONSISTENCY_SCHEMA);
  assert.equal(out.status,'LOCAL_TEXT_HASH_MATCH_UNATTESTED');
  assert.equal(out.response_text,text);
  assert.equal(out.response_sha256,sha(text));
  assert.equal(out.content_trusted,false);
  assert.equal(out.independent_execution_attestation,false);
  assert.equal(out.model_routing_approved,false);
  assert.equal(out.tool_execution_authorized,false);
  assert.equal(out.canonical_runtime_connected,false);
});
test('R7-O02 mutated text with original receipt refuses to display',async()=>{
  const fixture=sample('One private-looking sentence');
  fixture.response='One DIFFERENT sentence';
  await assert.rejects(check(fixture),e=>e instanceof OllamaConsistencyError &&
    e.code==='OUTPUT_SHA256_MISMATCH');
});
test('R7-O03 invalid, omitted or promoted metadata fails closed',async()=>{
  const cases=[
    r=>{r.authority_granted=true;},
    r=>{r.can_schedule=true;},
    r=>{r.model_routing_approved=true;},
    r=>{r.receipt.authority_granted=true;},
    r=>{r.receipt.model_routing_approved=true;},
    r=>{r.receipt.generated_text_included=true;},
    r=>{r.receipt.private_prompt_included=true;},
    r=>{r.receipt.cloud_execution_approved=true;},
    r=>{r.receipt.model='another-model';},
    r=>{r.receipt.route='CLOUD_API';},
    r=>{r.receipt.generated_text_sha256=null;},
    r=>{r.receipt.max_output_tokens_requested=128;},
    r=>{r.receipt.model_admin_authorized=true;},
    r=>{r.remote_provider_token='FAKE';},
    r=>{r.receipt.observation='GPU_EXECUTED_ATTESTED';},
    r=>{r.receipt.protocol_evidence='MODEL_CERTIFIED';},
    r=>{delete r.receipt.private_prompt_included;},
  ];
  for(const mutate of cases){
    const fixture=sample();
    mutate(fixture);
    await assert.rejects(check(fixture),OllamaConsistencyError);
  }
});
test('R7-O04 explicitly refuse absence of WebCrypto rather than silently trusting data',async()=>{
  await assert.rejects(verifyOllamaTrialResponse({
    result:sample(),expectedModel:'synthetic-local:4b',expectedTokens:64,
    cryptoImpl:{}
  }),e=>e.code==='WEBCRYPTO_REQUIRED');
});
test('R7-O05 selected model and token cap must equal server receipt',async()=>{
  await assert.rejects(verifyOllamaTrialResponse({
    result:sample(),expectedModel:'another-model',expectedTokens:64,
    cryptoImpl:webcrypto
  }),OllamaConsistencyError);
  await assert.rejects(verifyOllamaTrialResponse({
    result:sample(),expectedModel:'synthetic-local:4b',expectedTokens:128,
    cryptoImpl:webcrypto
  }),OllamaConsistencyError);
});
test('R7-O06 UI blocks ambiguity until acknowledgement, clears old model and never auto retries',()=>{
  const root=new URL('../',import.meta.url);
  const page=readFileSync(new URL('ui/index.html',root),'utf8');
  const app=readFileSync(new URL('ui/app.js',root),'utf8');
  const desk=readFileSync(new URL('ui/model-desk-ui.mjs',root),'utf8');
  const server=readFileSync(new URL('server.mjs',root),'utf8');
  const pkg=readFileSync(new URL('../../windows-local/build-portable.ps1',root),'utf8');
  const verifier=readFileSync(new URL('../../windows-local/verify-pages-zip.py',root),'utf8');
  for(const id of ['trial-unknown-recovery','trial-unknown-ack','desk-unknown-recovery','desk-unknown-ack'])
    assert.ok(page.includes('id="'+id+'"'),id);
  assert.match(app,/verifyOllamaTrialResponse/);
  assert.match(app,/trialOutcomeUnknown=true/);
  assert.match(app,/trialRun.disabled=trialOutcomeUnknown/);
  assert.match(app,/trialUnknownAck.addEventListener\('click'/);
  assert.match(app,/providerProbeStatus='NOT_SCANNED';providerSnapshot=\[\]/);
  assert.match(app,/trialPrompt.value=''/);
  assert.match(desk,/draftOutcomeUnknown=true/);
  assert.match(desk,/liveRun.disabled=mode\|\|draftOutcomeUnknown/);
  assert.match(desk,/unknownAck.addEventListener\('click'/);
  assert.match(desk,/liveModel.replaceChildren\(\);liveModel.add/);
  assert.match(desk,/window.confirm/);
  assert.match(server,/\['\/local-outcome.mjs'/);
  assert.match(pkg,/local-console\/ui\/local-outcome.mjs/);
  assert.match(verifier,/local-console\/ui\/local-outcome.mjs/);
  const module=readFileSync(new URL('ui/local-outcome.mjs',root),'utf8');
  assert.doesNotMatch(module,/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\blocalStorage\b|\bindexedDB\b|\beval\s*\(/);
});
