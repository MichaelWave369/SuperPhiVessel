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
function request(port,path='/',{method='GET',headers={}}={}){
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
    req.end();
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
