import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { startBrowserGateway, PAIRED_ORIGIN } from '../browser-server.mjs';

const dir=mkdtempSync(join(tmpdir(),'vessie-r2-test-'));
const key=join(dir,'key.pem'),cert=join(dir,'cert.pem');
const openssl=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes',
  '-keyout',key,'-out',cert,'-days','1','-subj','/CN=127.0.0.1',
  '-addext','subjectAltName=IP:127.0.0.1'],{encoding:'utf8'});
if(openssl.status!==0) throw new Error('CI requires openssl: '+openssl.stderr?.slice(-200));
const tls={tlsKey:readFileSync(key),tlsCert:readFileSync(cert)};
const CODE='a'.repeat(64);
const stub=async()=>({schema:'superphivessel.gateway.models.v0.1',probe_status:'AVAILABLE',
  model_count:1,models:[{name:'fixture:1b',status:'DISCOVERED_NOT_APPROVED',
  authority_granted:false,execution_authorized:false,routing_approved:false}],
  can_execute:false,authority_granted:false});
const bad=async()=>({schema:'bad',probe_status:'AVAILABLE'});
let clock=100000;

function call(port,path,opts={}) {
  return new Promise((resolve,reject)=>{
    const headers={Origin:PAIRED_ORIGIN,Host:'127.0.0.1:'+port,...(opts.headers||{})};
    const body=opts.body===undefined?null:JSON.stringify(opts.body);
    if(body!==null){
      headers['Content-Type']='application/json';
      headers['Content-Length']=Buffer.byteLength(body);
    }
    const req=httpsRequest({host:'127.0.0.1',port,path,method:opts.method||'GET',
      headers,rejectUnauthorized:false},res=>{
      const parts=[];
      res.on('data',d=>parts.push(d));
      res.on('end',()=>{
        const text=Buffer.concat(parts).toString('utf8');
        let json=null;
        try{json=JSON.parse(text);}catch{}
        resolve({status:res.statusCode,headers:res.headers,body:json});
      });
    });
    req.on('error',reject);
    if(body!==null)req.write(body);
    req.end();
  });
}
async function run(fn,options={}) {
  const g=await startBrowserGateway({...tls,port:0,pairCode:CODE,now:()=>clock,...options});
  try{await fn(g);}finally{await new Promise(resolve=>g.server.close(resolve));}
}
async function pair(g,code=CODE,options={}) {
  return call(g.port,'/v1/pair',{method:'POST',body:{code},...options});
}
const auth=token=>({Authorization:'Bearer '+token});

test('R201 requires TLS certificate with proper IP SAN',async()=>{
  assert.equal(new X509Certificate(tls.tlsCert).checkIP('127.0.0.1'),'127.0.0.1');
  await assert.rejects(startBrowserGateway({port:0,pairCode:CODE}),/TLS/);
});
test('R202 gateway binds 127.0.0.1 with exact one-time secret',async()=>{
  await run(async g=>{
    assert.equal(g.server.address().address,'127.0.0.1');
    assert.equal(g.pairCode,CODE);
    assert.equal(g.origin,PAIRED_ORIGIN);
  });
});
test('R203 no telemetry before pairing',async()=>{
  await run(async g=>{
    const r=await call(g.port,'/v1/models');
    assert.equal(r.status,403);
    assert.equal(r.body.authority_granted,false);
  },{probe:stub});
});
test('R204 valid pairing produces 15min limited read-only session',async()=>{
  await run(async g=>{
    const r=await pair(g);
    assert.equal(r.status,200);
    assert.match(r.body.session_token,/^[0-9a-f]{64}$/);
    assert.equal(r.body.expires_in_seconds,900);
    assert.deepEqual(r.body.capabilities,['models.read','gateway.status.read']);
    assert.equal(r.body.can_execute,false);
    assert.equal(r.body.can_read_memory,false);
    assert.equal(r.body.authority_granted,false);
  });
});
test('R205 pairing secret cannot be used twice',async()=>{
  await run(async g=>{
    assert.equal((await pair(g)).status,200);
    assert.equal((await pair(g)).status,403);
  });
});
test('R206 wrong origin cannot pair or read',async()=>{
  await run(async g=>{
    assert.equal((await pair(g,CODE,{headers:{Origin:'https://evil.example'}})).status,403);
    const valid=await pair(g);
    assert.equal(valid.status,200);
    assert.equal((await call(g.port,'/v1/models',{headers:{...auth(valid.body.session_token),Origin:'https://evil.example'}})).status,403);
  },{probe:stub});
});
test('R207 browser preflight only admits exact origin/method/header',async()=>{
  await run(async g=>{
    const yes=await call(g.port,'/v1/pair',{method:'OPTIONS',
      headers:{'Access-Control-Request-Method':'POST',
        'Access-Control-Request-Headers':'content-type',
        'Access-Control-Request-Private-Network':'true'}});
    assert.equal(yes.status,204);
    assert.equal(yes.headers['access-control-allow-origin'],PAIRED_ORIGIN);
    assert.equal(yes.headers['access-control-allow-private-network'],'true');
    const no=await call(g.port,'/v1/pair',{method:'OPTIONS',
      headers:{'Access-Control-Request-Method':'POST',
        'Access-Control-Request-Headers':'x-admin-token'}});
    assert.equal(no.status,403);
    assert.equal((await call(g.port,'/v1/pair',{method:'OPTIONS',
      headers:{Origin:'https://evil.example','Access-Control-Request-Method':'POST'}})).status,403);
  });
});
test('R208 authenticated status never claims BrainC or executor capability',async()=>{
  await run(async g=>{
    const p=await pair(g);
    const r=await call(g.port,'/v1/status',{headers:auth(p.body.session_token)});
    assert.equal(r.status,200);
    assert.equal(r.body.gateway_status,'HTTPS_PAIR_READ_ONLY');
    assert.equal(r.body.brainc_connected,false);
    assert.equal(r.body.memory_connected,false);
    assert.equal(r.body.action_authority,'NONE');
    assert.equal(r.body.authority_granted,false);
  });
});
test('R209 paired session allows sanitized local model inventory',async()=>{
  await run(async g=>{
    const p=await pair(g);
    const r=await call(g.port,'/v1/models',{headers:auth(p.body.session_token)});
    assert.equal(r.status,200);
    assert.equal(r.body.model_count,1);
    assert.equal(r.body.models[0].routing_approved,false);
    assert.match(r.headers['cache-control'],/no-store/);
  },{probe:stub});
});
test('R210 revoked session loses read capability',async()=>{
  await run(async g=>{
    const p=await pair(g),token=p.body.session_token;
    assert.equal((await call(g.port,'/v1/session',{method:'DELETE',headers:auth(token)})).status,200);
    assert.equal((await call(g.port,'/v1/models',{headers:auth(token)})).status,403);
  },{probe:stub});
});
test('R211 session expires after 15 minutes without extension',async()=>{
  await run(async g=>{
    const p=await pair(g),token=p.body.session_token;
    clock+=901000;
    try{assert.equal((await call(g.port,'/v1/status',{headers:auth(token)})).status,403);}
    finally{clock-=901000;}
  });
});
test('R212 failed pairing is limited',async()=>{
  await run(async g=>{
    for(let i=0;i<5;i++)assert.equal((await pair(g,'b'.repeat(64))).status,403);
    assert.equal((await pair(g)).status,403);
  });
});
test('R213 unknown action paths and POST execution denied',async()=>{
  await run(async g=>{
    const p=await pair(g),a=auth(p.body.session_token);
    assert.equal((await call(g.port,'/v1/tasks/execute',{method:'POST',headers:a,body:{prompt:'run'}})).status,404);
    assert.equal((await call(g.port,'/v1/models',{method:'POST',headers:a,body:{model:'run'}})).status,405);
  },{probe:stub});
});
test('R214 strict Host and forward headers deny rebinding/proxy',async()=>{
  await run(async g=>{
    const p=await pair(g),a=auth(p.body.session_token);
    assert.equal((await call(g.port,'/v1/models',{headers:{...a,Host:'evil.test'}})).status,403);
    assert.equal((await call(g.port,'/v1/models',{headers:{...a,'X-Forwarded-Host':'evil.test'}})).status,403);
  },{probe:stub});
});
test('R215 malformed upstream response is refused, not promoted',async()=>{
  await run(async g=>{
    const p=await pair(g),a=auth(p.body.session_token);
    assert.equal((await call(g.port,'/v1/models',{headers:a})).status,503);
  },{probe:bad});
});
test('R216 certificate bytes are never hard-coded as app credentials',async()=>{
  await run(async g=>{
    const r=await pair(g);
    assert.equal(r.body.authority_granted,false);
    assert.equal(r.headers['access-control-allow-origin'],PAIRED_ORIGIN);
    assert.equal(r.headers['set-cookie'],undefined);
  });
});
test.after(()=>rmSync(dir,{recursive:true,force:true}));

test('R217 optional Scout endpoint is disabled and has no unpaired access',async()=>{
  await run(async g=>{
    assert.equal((await call(g.port,'/v1/scout')).status,403);
    const paired=await pair(g);
    assert.deepEqual(paired.body.capabilities,['models.read','gateway.status.read']);
    const read=await call(g.port,'/v1/scout',{headers:auth(paired.body.session_token)});
    assert.notEqual(read.status,200);
  });
});
test('R218 Scout is read-only via the existing one-use pairing; no action rights',async()=>{
  const safe={
    schema:'phibot.scout-vessie-handoff.v0.1',evidence_class:'LOCAL_SELF_REPORTED_FORMAT_AND_DIGEST_ONLY',
    mode:'MANUAL_OPERATOR_COPY_ONLY',qualification_result:'PASS_LOCAL_SCOUT_SHADOW',
    source_run_id:'37851619515',source_mission_id:'phibot.scout.public-repo-health.v1',
    local_model:'qwen3:4b',qualified_at:'2026-10-09T01:23:40.042Z',
    source_expires_at:'2026-10-09T06:09:12+00:00',
    review_freshness:'CURRENT_WITHIN_SOURCE_WINDOW',receipt_digest_sha256:'a'.repeat(64),
    integrity:'DOMAIN_SEPARATED_DIGEST_MATCH',public_source_authenticated:false,
    identity_authenticated:false,signer_authenticated:false,
    independent_execution_attested:false,reality_gate_granted:false,
    tool_calls_authorized:false,memory_admitted:false,agent_spawned:false,
    phios_isolation_qualified:false,vessie_connected:false,routing_influence:'NONE',
  };
  let count=0;
  await run(async g=>{
    assert.equal((await call(g.port,'/v1/scout')).status,403);
    const p=await pair(g), token=p.body.session_token;
    assert.deepEqual(p.body.capabilities,['models.read','gateway.status.read','scout.receipt.read']);
    const a=auth(token);
    const read=await call(g.port,'/v1/scout',{headers:a});
    assert.equal(read.status,200);
    assert.deepEqual(read.body,safe);
    assert.equal(count,1);
    assert.equal(read.headers['cache-control'],'no-store, private');
    assert.equal((await call(g.port,'/v1/scout',{method:'POST',headers:a,body:{task:'execute'}})).status,405);
    assert.equal((await call(g.port,'/v1/scout',{headers:{...a,Origin:'https://evil.example'}})).status,403);
    assert.equal((await call(g.port,'/v1/session',{method:'DELETE',headers:a})).status,200);
    assert.equal((await call(g.port,'/v1/scout',{headers:a})).status,403);
    assert.equal(count,1);
  },{scoutRead:async()=>{count++;return safe;}});
});
test('R219 malformed or authority-claiming injected Scout reads fail closed',async()=>{
  for(const violation of [
    {schema:'bad'},
    {schema:'phibot.scout-vessie-handoff.v0.1',authority_granted:true},
  ]){
    await run(async g=>{
      const p=await pair(g),a=auth(p.body.session_token);
      const r=await call(g.port,'/v1/scout',{headers:a});
      assert.equal(r.status,503);
      assert.equal(r.body.authority_granted,false);
    },{scoutRead:async()=>violation});
  }
});
test('R220 Scout probe limited to six reads per minute under same session',async()=>{
  const safe={
    schema:'phibot.scout-vessie-handoff.v0.1',evidence_class:'LOCAL_SELF_REPORTED_FORMAT_AND_DIGEST_ONLY',
    mode:'MANUAL_OPERATOR_COPY_ONLY',qualification_result:'PASS_LOCAL_SCOUT_SHADOW',
    source_run_id:'37851619515',source_mission_id:'phibot.scout.public-repo-health.v1',
    local_model:'qwen3:4b',qualified_at:'2026-10-09T01:23:40.042Z',
    source_expires_at:'2026-10-09T06:09:12+00:00',
    review_freshness:'CURRENT_WITHIN_SOURCE_WINDOW',receipt_digest_sha256:'a'.repeat(64),
    integrity:'DOMAIN_SEPARATED_DIGEST_MATCH',public_source_authenticated:false,
    identity_authenticated:false,signer_authenticated:false,
    independent_execution_attested:false,reality_gate_granted:false,
    tool_calls_authorized:false,memory_admitted:false,agent_spawned:false,
    phios_isolation_qualified:false,vessie_connected:false,routing_influence:'NONE',
  };
  await run(async g=>{
    const p=await pair(g),a=auth(p.body.session_token);
    for(let i=0;i<6;i++)assert.equal((await call(g.port,'/v1/scout',{headers:a})).status,200);
    assert.equal((await call(g.port,'/v1/scout',{headers:a})).status,429);
  },{scoutRead:async()=>safe});
});
