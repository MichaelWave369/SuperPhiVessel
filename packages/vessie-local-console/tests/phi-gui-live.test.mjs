import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {mkdtempSync,writeFileSync,chmodSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalConsole} from '../server.mjs';
import {verifyPhiServeDraftPair,makePhiServeDeskReview} from '../ui/model-desk.mjs';
import {
  PHI_GUI_SCHEMA,PHI_GUI_CATALOG_SCHEMA,PHI_GUI_RUNS_PER_HOUR,
  validatePhiGuiRequest,projectPhiGuiDraft,projectPhiGuiCatalog,
} from '../phi-gui-bridge.mjs';
import {DRAFT_SCHEMA,PHISERVE_ORIGIN} from '../../vessie-phiserve-draft-v0.1/adapter.mjs';

const MODEL='local-qwen-gguf';
const SECRET='test-private-phiserve-token-value-1234567890-abcdef';
function sha(s){return createHash('sha256').update(s).digest('hex');}
function token(html){return html.match(/<meta name="vessie-readonly-token" content="([a-f0-9]{64})">/)?.[1];}
function request(port,path='/',{method='GET',headers={},body}={}){
  return new Promise((resolve,reject)=>{
    const req=httpRequest({hostname:'127.0.0.1',port,path,method,
      headers:{Host:'127.0.0.1:'+port,...headers}},res=>{
      const data=[];res.on('data',x=>data.push(x));
      res.on('end',()=>resolve({code:res.statusCode,headers:res.headers,
        text:Buffer.concat(data).toString('utf8')}));
    });
    req.once('error',reject);req.end(body);
  });
}
function fakeBackend({onChat,chatStatus=200,aliases=[MODEL]}={}){
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,init});
    assert.ok([PHISERVE_ORIGIN+'/api/tags',PHISERVE_ORIGIN+'/api/chat'].includes(url));
    assert.equal(init.redirect,'error');
    assert.equal(init.credentials,'omit');
    assert.equal(init.headers.Authorization,'Bearer '+SECRET);
    if(url.endsWith('/api/tags')){
      assert.equal(init.method,'GET');
      return Response.json({models:aliases.map(name=>({name}))});
    }
    assert.equal(init.method,'POST');
    const body=JSON.parse(init.body);
    assert.equal(body.stream,false);
    assert.deepEqual(Object.keys(body).sort(),['messages','model','options','stream']);
    assert.equal(body.messages.length,2);
    assert.equal(body.messages[0].role,'system');
    assert.equal(body.messages[1].role,'user');
    assert.equal(body.model,MODEL);
    if(onChat)return onChat(body);
    if(chatStatus!==200)return Response.json({error:'UPSTREAM_PRIVATE_BODY'}, {status:chatStatus});
    return Response.json({done:true,model:MODEL,
      message:{role:'assistant',content:'An untrusted local proposal.'}});
  };
  return {fetchImpl,calls};
}
async function withServer(run,{enabled=true,backend=fakeBackend()}={}){
  const dir=mkdtempSync(join(tmpdir(),'vessie-phi-gui-'));
  const key=join(dir,'private-token.txt');
  writeFileSync(key,SECRET+'\n',{mode:0o600});chmodSync(key,0o600);
  let server;
  try{
    const started=await createLocalConsole({
      port:0,phiServeEnabled:enabled,phiServeTokenFile:key,
      phiServeFetch:backend.fetchImpl,
      probe:async()=>({schema:'superphivessel.gateway.models.v0.1',
        probe_status:'UNAVAILABLE',models:[],authority_granted:false,can_execute:false}),
    });
    server=started.server;
    return await run({...started,backend});
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}
const send=(port,session,more={},headers={})=>request(port,'/api/phiserve-draft',{
  method:'POST',
  headers:{
    Origin:'http://127.0.0.1:'+port,
    Authorization:'Bearer '+session,
    'Content-Type':'application/json',
    ...headers,
  },
  body:JSON.stringify({
    model:MODEL,prompt:'Write one short draft.',max_output_tokens:128,
    approve_once:true,...more,
  }),
});

test('PG01 default read-only mode rejects PhiServe catalog and draft without contacting model',async()=>{
  const backend=fakeBackend();
  await withServer(async({port})=>{
    const page=await request(port);
    const session=token(page.text);
    assert.equal((await request(port,'/api/phiserve-models',{
      headers:{Authorization:'Bearer '+session}})).code,403);
    assert.equal((await send(port,session)).code,403);
    assert.equal((await request(port,'/api/status',{
      headers:{Authorization:'Bearer '+session}})).code,200);
    assert.equal(JSON.parse((await request(port,'/api/status',{
      headers:{Authorization:'Bearer '+session}})).text).phiserve_gui_enabled,false);
  },{enabled:false,backend});
  assert.equal(backend.calls.length,0);
});

test('PG02 explicit mode fails startup without a private token file',async()=>{
  await assert.rejects(createLocalConsole({port:0,phiServeEnabled:true,phiServeTokenFile:''}),
    err=>err.code==='TOKEN_FILE_REQUIRED');
  await assert.rejects(createLocalConsole({port:0,phiServeEnabled:true,
    phiServeTokenFile:'/missing-private-token-file'}),
    err=>err.code==='TOKEN_FILE_UNAVAILABLE_OR_INSECURE');
  await assert.rejects(createLocalConsole({port:0,phiServeEnabled:true,trialEnabled:true}),
    /INVALID_INFERENCE_MODE/);
});

test('PG03 protected catalog is explicitly discovered with only registered aliases',async()=>{
  await withServer(async({port,backend})=>{
    const session=token((await request(port)).text);
    assert.equal((await request(port,'/api/phiserve-models')).code,403);
    const r=await request(port,'/api/phiserve-models',{headers:{Authorization:'Bearer '+session}});
    assert.equal(r.code,200);
    const catalog=JSON.parse(r.text);
    assert.equal(catalog.schema,PHI_GUI_CATALOG_SCHEMA);
    assert.deepEqual(catalog.models,[MODEL]);
    assert.equal(catalog.authority_granted,false);
    assert.equal(catalog.model_execution_approved,false);
    assert.deepEqual(backend.calls.map(x=>x.url),[PHISERVE_ORIGIN+'/api/tags']);
    const status=JSON.parse((await request(port,'/api/status',{
      headers:{Authorization:'Bearer '+session}})).text);
    assert.equal(status.phiserve_gui_enabled,true);
    assert.equal(status.local_trial_enabled,false);
    assert.equal(status.model_routing_approved,false);
  });
});

test('PG04 request Origin, localhost Host and same-session authentication are enforced',async()=>{
  const backend=fakeBackend();
  await withServer(async({port})=>{
    const session=token((await request(port)).text);
    assert.equal((await send(port,'bad-session')).code,403);
    assert.equal((await send(port,session,{}, {Origin:'https://evil.example'})).code,403);
    assert.equal((await send(port,session,{}, {Origin:''})).code,403);
    assert.equal((await send(port,session,{}, {Cookie:'tracking=1'})).code,403);
    assert.equal((await send(port,session,{}, {'X-Forwarded-Host':'evil.example'})).code,403);
    assert.equal((await request(port,'/api/phiserve-models',{
      headers:{Host:'evil.example',Authorization:'Bearer '+session}})).code,403);
  },{backend});
  assert.equal(backend.calls.length,0);
});

test('PG05 invalid request fields or missing one-shot approval cannot reach model',async()=>{
  const backend=fakeBackend();
  await withServer(async({port})=>{
    const session=token((await request(port)).text);
    for(const change of [
      {approve_once:false},{model:'remote-model'},
      {prompt:''},{prompt:'X'.repeat(2500)},
      {max_output_tokens:513},{max_output_tokens:0},
      {tools:[{name:'execute'}]},{model:'bad\nname'},
    ]){
      // MODEL_NOT_REGISTERED is a valid request but fails after local catalog lookup.
      const r=await send(port,session,change);
      assert.equal(r.code,change.model==='remote-model'?503:400,JSON.stringify(change).slice(0,90));
    }
  },{backend});
  assert.deepEqual(backend.calls.map(x=>x.url),[PHISERVE_ORIGIN+'/api/tags']);
});

test('PG06 one approved prompt calls PhiServe tags and chat, returns redacted hash receipt',async()=>{
  await withServer(async({port,backend})=>{
    const page=await request(port);
    assert.doesNotMatch(page.text,/test-private-phiserve-token-value/);
    const session=token(page.text);
    const r=await send(port,session);
    assert.equal(r.code,200,r.text.slice(0,200));
    const result=JSON.parse(r.text);
    assert.equal(result.schema,PHI_GUI_SCHEMA);
    assert.equal(result.status,'LOCAL_UNTRUSTED_DRAFT_FOR_HUMAN_REVIEW');
    assert.equal(result.authority_granted,false);
    assert.equal(result.canonical_runtime_connected,false);
    assert.equal(result.receipt.schema,DRAFT_SCHEMA);
    assert.equal(result.receipt.response_sha256,sha(result.draft_text));
    assert.equal(result.receipt.prompt_sha256,sha('Write one short draft.'));
    assert.equal(result.receipt.generated_text_included,undefined);
    assert.equal(result.receipt.response_text_included,false);
    assert.equal(result.receipt.operator_authority_granted,false);
    assert.deepEqual(backend.calls.map(x=>x.url),[
      PHISERVE_ORIGIN+'/api/tags',PHISERVE_ORIGIN+'/api/chat',
    ]);
    assert.doesNotMatch(r.text,/test-private-phiserve-token-value|UPSTREAM_PRIVATE_BODY/);
    // Same existing browser verification gate unlocks a review without
    // pretending that the locally generated model output is trusted.
    const verified=await verifyPhiServeDraftPair({
      receiptBytes:new TextEncoder().encode(JSON.stringify(result.receipt)),
      draftBytes:new TextEncoder().encode(result.draft_text),
      cryptoImpl:webcrypto,
    });
    const review=makePhiServeDeskReview(verified,{
      usefulness:'NOT_ASSESSED',completeness:'UNSURE',
      verification:'NOT_CHECKED',reviewedAt:'2026-10-31T20:00:00.000Z',
    });
    assert.equal(review.operator_authority_granted,false);
    assert.equal(review.can_promote,false);
    assert.doesNotMatch(JSON.stringify(review),/An untrusted local proposal/);
  });
});

test('PG07 unregistered alias stops before chat and never retries another provider',async()=>{
  const backend=fakeBackend();
  await withServer(async({port})=>{
    const session=token((await request(port)).text);
    const r=await send(port,session,{model:'unregistered-alias'});
    assert.equal(r.code,503);
    assert.equal(JSON.parse(r.text).error,'MODEL_NOT_REGISTERED');
  },{backend});
  assert.deepEqual(backend.calls.map(x=>x.url),[PHISERVE_ORIGIN+'/api/tags']);
});

test('PG08 401, 409, 503 from local PhiServe fail closed and redact upstream body',async()=>{
  for(const code of [401,409,503]){
    const backend=fakeBackend({chatStatus:code});
    await withServer(async({port})=>{
      const session=token((await request(port)).text);
      const r=await send(port,session);
      assert.equal(r.code,503);
      assert.equal(JSON.parse(r.text).error,'LOCAL_PHI_HTTP_'+code);
      assert.doesNotMatch(r.text,/UPSTREAM_PRIVATE_BODY|test-private-phiserve-token-value/);
    },{backend});
    assert.equal(backend.calls.length,2);
  }
});

test('PG09 incomplete, forged or wrong-model assistant responses never display',async()=>{
  for(const body of [
    {done:false,model:MODEL,message:{role:'assistant',content:'partial'}},
    {done:true,model:'wrong-model',message:{role:'assistant',content:'wrong'}},
    {done:true,model:MODEL,message:{role:'tool',content:'execute'}},
    {done:true,model:MODEL,message:{role:'assistant',content:''}},
  ]){
    const backend=fakeBackend({onChat:()=>Response.json(body)});
    await withServer(async({port})=>{
      const session=token((await request(port)).text);
      const r=await send(port,session);
      assert.equal(r.code,503);
      assert.equal(JSON.parse(r.text).error,'LOCAL_DRAFT_NOT_COMPLETED');
      assert.doesNotMatch(r.text,/partial|execute|wrong-model/);
    },{backend});
  }
});

test('PG10 the seventh approved attempted draft is refused without another backend call',async()=>{
  const backend=fakeBackend();
  await withServer(async({port})=>{
    const session=token((await request(port)).text);
    for(let i=0;i<PHI_GUI_RUNS_PER_HOUR;i++){
      const r=await send(port,session);
      assert.equal(r.code,200);
    }
    const extra=await send(port,session);
    assert.equal(extra.code,429);
    assert.equal(JSON.parse(extra.text).authority_granted,false);
  },{backend});
  assert.equal(backend.calls.length,PHI_GUI_RUNS_PER_HOUR*2);
});

test('PG11 concurrent draft requests are bounded and never double-execute',async()=>{
  let unblock;
  let notify;
  const entered=new Promise(resolve=>{notify=resolve});
  const pending=new Promise(resolve=>{unblock=resolve});
  const backend=fakeBackend({onChat:async()=>{
    notify();await pending;
    return Response.json({done:true,model:MODEL,
      message:{role:'assistant',content:'Serialized draft'}});
  }});
  await withServer(async({port})=>{
    const session=token((await request(port)).text);
    const first=send(port,session);
    await entered;
    const simultaneous=await send(port,session);
    assert.equal(simultaneous.code,429);
    unblock();
    assert.equal((await first).code,200);
  },{backend});
  assert.equal(backend.calls.length,2);
});

test('PG12 fixed endpoints and projections reject invented model catalog or authority flags',()=>{
  assert.equal(PHISERVE_ORIGIN,'http://127.0.0.1:11435');
  assert.throws(()=>projectPhiGuiCatalog([{name:MODEL}]));
  assert.throws(()=>projectPhiGuiCatalog([MODEL,MODEL]));
  assert.throws(()=>projectPhiGuiCatalog(['evil\nname']));
  assert.throws(()=>validatePhiGuiRequest({
    model:MODEL,prompt:'hi',max_output_tokens:128,approve_once:true,remote_url:'https://evil',
  }));
  assert.throws(()=>projectPhiGuiDraft({
    text:'Action approved',receipt:{schema:DRAFT_SCHEMA,operator_authority_granted:true},
  },{model:MODEL,prompt:'hi',tokens:128}));
});

test('PG13 frontend uses only same-origin authenticated console routes, no browser PhiServe key',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const ui=readFileSync(join(root,'ui/model-desk-ui.mjs'),'utf8');
  const server=readFileSync(join(root,'server.mjs'),'utf8');
  assert.match(ui,/fetch\(route/);
  assert.match(ui,/localCall\('\/api\/phiserve-models'\)/);
  assert.match(ui,/localCall\('\/api\/phiserve-draft'/);
  assert.match(ui,/meta\[name="vessie-readonly-token"\]/);
  assert.match(server,/readPrivatePhiServeToken\(phiServeTokenFile\)/);
  assert.match(server,/req\.headers\.origin!==/);
  assert.doesNotMatch(ui,/127\.0\.0\.1:11435|localStorage|sessionStorage|indexedDB/);
});

test('PG14 Windows portable packaging carries source-relative PhiServe modules and a separate launcher',()=>{
  const root=fileURLToPath(new URL('../../../',import.meta.url));
  const script=readFileSync(join(root,'windows-local/build-portable.ps1'),'utf8');
  const launcher=readFileSync(join(root,'windows-local/Start-PhiServe-Desk.cmd'),'utf8');
  assert.match(script,/vessie-phiserve-draft-v0\.1\/adapter\.mjs/);
  assert.match(script,/local-console\/phi-gui-bridge\.mjs/);
  assert.match(script,/local-console\/ui\/model-desk-ui\.mjs/);
  assert.match(script,/local-console\/ui\/model-desk\.mjs/);
  assert.match(launcher,/--enable-phiserve-desk/);
  assert.match(launcher,/Type ENABLE|Enter ENABLE/);
  assert.match(launcher,/PHISERVE_TOKEN_FILE/);
});
