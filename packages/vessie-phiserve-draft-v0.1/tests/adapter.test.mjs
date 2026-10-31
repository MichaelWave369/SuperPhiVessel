import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  DRAFT_SCHEMA, PHISERVE_ORIGIN, DraftError, readPrivatePhiServeToken,
  listPhiServeAliases, runPhiServeDraft,
} from '../adapter.mjs';

const SECRET = 'test-private-PhiServe-operator-secret-1234567890-abcdef';
const MODEL = 'local-qwen-gguf';
function withToken(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vessie-phi-draft-'));
  const file = join(dir, 'private-token.txt');
  writeFileSync(file, SECRET + '\n', { mode: 0o600 });
  chmodSync(file, 0o600);
  return Promise.resolve().then(() => t({ dir, file })).finally(() => rmSync(dir, { recursive: true, force: true }));
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  });
}
function mockPhi({ aliases = [MODEL], body, status = 200 } = {}) {
  const calls = [];
  async function fetchImpl(url, init) {
    calls.push({ url, init });
    assert.ok([PHISERVE_ORIGIN + '/api/tags', PHISERVE_ORIGIN + '/api/chat'].includes(url));
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.headers.Authorization, 'Bearer ' + SECRET);
    if (url.endsWith('/api/tags')) {
      assert.equal(init.method, 'GET');
      return json({ models: aliases.map(name => ({ name, ignored: 'PRIVATE_PATH' })) });
    }
    assert.equal(init.method, 'POST');
    return status === 200
      ? json(body ?? { done:true, model:MODEL,
          message:{ role:'assistant', content:'A draft for the operator.' } })
      : json({ error:'SECRET_UPSTREAM_DETAILS', token:SECRET }, status);
  }
  return { fetchImpl, calls };
}

test('P01 default is a literal loopback PhiServe URL, not a configurable remote endpoint', () => {
  assert.equal(PHISERVE_ORIGIN, 'http://127.0.0.1:11435');
});

test('P02 missing explicit operator approval never reads token or calls inference', async () => withToken(async ({file}) => {
  const mock = mockPhi();
  await assert.rejects(runPhiServeDraft({
    model:MODEL, prompt:'draft a plan', tokenFile:file, fetchImpl:mock.fetchImpl,
  }), error => error.code === 'OPERATOR_APPROVAL_REQUIRED');
  assert.equal(mock.calls.length, 0);
}));

test('P03 token must be user-owned file, never a symlink or world-readable on POSIX', async () => withToken(async ({dir,file}) => {
  assert.equal(readPrivatePhiServeToken(file), SECRET);
  assert.throws(() => readPrivatePhiServeToken(''), error => error.code === 'TOKEN_FILE_REQUIRED');
  assert.throws(() => readPrivatePhiServeToken(join(dir,'missing')), error => error.code === 'TOKEN_FILE_UNAVAILABLE_OR_INSECURE');
  const link = join(dir,'symlink-token');
  symlinkSync(file,link);
  assert.throws(() => readPrivatePhiServeToken(link), error => error.code === 'TOKEN_FILE_UNAVAILABLE_OR_INSECURE');
  if (process.platform !== 'win32') {
    chmodSync(file,0o644);
    assert.throws(() => readPrivatePhiServeToken(file), error => error.code === 'TOKEN_FILE_UNAVAILABLE_OR_INSECURE');
  }
}));

test('P04 catalog only returns sanitised registered alias strings, no extra metadata', async () => withToken(async ({file}) => {
  const mock = mockPhi({aliases:[MODEL,'second-gguf']});
  const aliases = await listPhiServeAliases({tokenFile:file,fetchImpl:mock.fetchImpl});
  assert.deepEqual(aliases,[MODEL,'second-gguf']);
  assert.equal(mock.calls.length,1);
  assert.equal(mock.calls[0].url,PHISERVE_ORIGIN+'/api/tags');
  assert.ok(!JSON.stringify(aliases).includes('PRIVATE_PATH'));
}));

test('P05 one approved draft uses only known model, fixed POST, text-only system/user, bounded output cap', async () => withToken(async ({file}) => {
  const mock = mockPhi();
  const result = await runPhiServeDraft({
    model:MODEL,prompt:'Explain why verification matters.',tokenFile:file,
    approved:true,tokens:97,fetchImpl:mock.fetchImpl,
    now:()=> '2026-10-31T20:00:00Z', requestId:'test-run-1',
  });
  assert.equal(mock.calls.length,2);
  assert.deepEqual(mock.calls.map(x=>x.url),[
    PHISERVE_ORIGIN+'/api/tags',PHISERVE_ORIGIN+'/api/chat']);
  const payload=JSON.parse(mock.calls[1].init.body);
  assert.deepEqual(Object.keys(payload).sort(),['messages','model','options','stream']);
  assert.equal(payload.model,MODEL);
  assert.equal(payload.stream,false);
  assert.deepEqual(payload.options,{num_predict:97});
  assert.deepEqual(payload.messages.map(x=>x.role),['system','user']);
  assert.equal(payload.messages[1].content,'Explain why verification matters.');
  assert.match(payload.messages[0].content,/cannot authorize any tools/);
  assert.equal(result.text,'A draft for the operator.');
  assert.equal(result.receipt.schema,DRAFT_SCHEMA);
  assert.equal(result.receipt.model_alias,MODEL);
  assert.equal(result.receipt.status,'LOCAL_TEXT_RETURNED_UNVERIFIED');
  assert.equal(result.receipt.evidence_class,'OPERATOR_PROCESS_SELF_REPORTED');
  assert.equal(result.receipt.operator_authority_granted,false);
  assert.equal(result.receipt.tool_execution_authorized,false);
  assert.equal(result.receipt.route_approved,false);
  assert.equal(result.receipt.memory_accessed,false);
  assert.equal(result.receipt.attestation,'NOT_INDEPENDENTLY_VERIFIED');
  assert.equal(result.receipt.response_sha256.length,64);
  const receiptString=JSON.stringify(result.receipt);
  assert.doesNotMatch(receiptString,/Explain why verification matters|A draft for the operator|test-private-PhiServe-operator-secret/);
  assert.doesNotMatch(receiptString,/private-token.txt/);
}));

test('P06 never silently aliases or downloads missing weights', async () => withToken(async ({file}) => {
  const mock = mockPhi({aliases:['other-model']});
  await assert.rejects(runPhiServeDraft({
    model:MODEL,prompt:'test',tokenFile:file,approved:true,
    fetchImpl:mock.fetchImpl,
  }),error=>error.code==='MODEL_NOT_REGISTERED');
  assert.deepEqual(mock.calls.map(x=>x.url),[PHISERVE_ORIGIN+'/api/tags']);
}));

test('P07 no partial, wrong-model, fake-tool, or empty output gets a success receipt', async () => withToken(async ({file}) => {
  const badBodies=[
    {done:false,model:MODEL,message:{role:'assistant',content:'partial'}},
    {done:true,model:'another-model',message:{role:'assistant',content:'wrong model'}},
    {done:true,model:MODEL,message:{role:'tool',content:'execute'}},
    {done:true,model:MODEL,message:{role:'assistant',content:''}},
    {done:true,model:MODEL,message:{role:'assistant',content:'X'.repeat(110000)}},
    {done:true,model:MODEL,error:'upstream',message:{role:'assistant',content:'fake'}},
  ];
  for (const body of badBodies) {
    const mock=mockPhi({body});
    await assert.rejects(runPhiServeDraft({
      model:MODEL,prompt:'test',tokenFile:file,approved:true,fetchImpl:mock.fetchImpl,
    }), error=>error.code==='LOCAL_DRAFT_NOT_COMPLETED');
    assert.equal(mock.calls.length,2);
  }
}));

test('P08 auth refusal, model busy, transitioning, and rate-limit never fall back or leak upstream body', async () => withToken(async ({file}) => {
  for(const status of [401,403,409,429,503]){
    const mock=mockPhi({status});
    await assert.rejects(runPhiServeDraft({
      model:MODEL,prompt:'private prompt',tokenFile:file,approved:true,
      fetchImpl:mock.fetchImpl,
    }), error=>{
      assert.equal(error.code,'LOCAL_PHI_HTTP_'+status);
      assert.doesNotMatch(String(error),/PRIVATE|SECRET|private prompt/);
      return true;
    });
    assert.equal(mock.calls.length,2);
  }
}));

test('P09 hard caps on prompt, predicted tokens, and native response JSON size', async () => withToken(async ({file}) => {
  for(const prompt of ['', 'X'.repeat(17000)]){
    const mock=mockPhi();
    await assert.rejects(runPhiServeDraft({
      model:MODEL,prompt,tokenFile:file,approved:true,
      fetchImpl:mock.fetchImpl,
    }),error=>error.code==='PROMPT_INVALID_OR_OVERSIZED');
    assert.equal(mock.calls.length,0);
  }
  const mock=mockPhi();
  await assert.rejects(runPhiServeDraft({
    model:MODEL,prompt:'test',tokenFile:file,approved:true,tokens:513,
    fetchImpl:mock.fetchImpl,
  }),error=>error.code==='TOKEN_CAP_OUT_OF_RANGE');
  assert.equal(mock.calls.length,0);
  const bad=mockPhi();
  const fn=async(url,init)=>{
    if(url.endsWith('/api/tags'))return bad.fetchImpl(url,init);
    return new Response(JSON.stringify({padding:'X'.repeat(270000)}), {
      headers:{'content-type':'application/json'},
    });
  };
  await assert.rejects(runPhiServeDraft({
    model:MODEL,prompt:'test',tokenFile:file,approved:true,fetchImpl:fn,
  }),error=>error.code==='LOCAL_RESPONSE_OVERSIZED');
}));

test('P10 network errors are classified with no fallback and no private file paths', async () => withToken(async ({file}) => {
  await assert.rejects(runPhiServeDraft({
    model:MODEL,prompt:'review',tokenFile:file,approved:true,
    fetchImpl:async()=>{throw new Error('SECRET_NETWORK_PATH_AND_TOKEN');},
  }),error=>{
    assert.equal(error.code,'LOCAL_PHI_UNREACHABLE');
    assert.doesNotMatch(String(error),/SECRET|vessie-phi-draft/);
    return true;
  });
}));

test('P11 malformed, invalid content-type, or too many model catalog entries refuse discovery', async () => withToken(async ({file}) => {
  const fixtures=[
    new Response('<html>not JSON</html>',{headers:{'content-type':'text/html'}}),
    json({ models: [{name:MODEL},{name:MODEL}] }),
    json({ models: Array.from({length:201},(_,i)=>({name:'m'+i})) }),
    json({ models: [{name:'line\ninjection'}] }),
  ];
  const codes=['LOCAL_RESPONSE_TYPE_INVALID','LOCAL_MODEL_CATALOG_DUPLICATE',
    'LOCAL_MODEL_CATALOG_INVALID','LOCAL_MODEL_CATALOG_INVALID'];
  for(let i=0;i<fixtures.length;i++){
    await assert.rejects(listPhiServeAliases({
      tokenFile:file,fetchImpl:async()=>fixtures[i],
    }),error=>error.code===codes[i]);
  }
}));

test('P12 invoking draft CLI without --approve-local-inference fails before reading any files', () => {
  const program=fileURLToPath(new URL('../cli.mjs',import.meta.url));
  const child=spawnSync(process.execPath,[program,'draft',
    '--model',MODEL,'--prompt-file','missing','--output-text','draft.txt',
    '--output-receipt','receipt.json'],{encoding:'utf8'});
  assert.equal(child.status,2);
  assert.match(child.stderr,/OPERATOR_APPROVAL_REQUIRED/);
  assert.doesNotMatch(child.stdout,/LOCAL_TEXT_RETURNED/);
});
