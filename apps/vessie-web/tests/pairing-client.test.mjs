import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCAL_GATEWAY,pairGateway,gatewayStatus,gatewayModels,gatewayScoutHandoff,revokeGateway,confirmRevokedGateway}
  from '../src/pairing-client.mjs';

const session='f'.repeat(64);
function answer(json,status=200){return new Response(JSON.stringify(json),{
  status,headers:{'content-type':'application/json'}
});}
test('P01 browser pairing uses pinned HTTPS localhost and no credentials',async()=>{
  const code='a'.repeat(64);
  const token=await pairGateway(code,async(url,options)=>{
    assert.equal(url,LOCAL_GATEWAY+'/v1/pair');
    assert.equal(options.method,'POST');
    assert.equal(options.credentials,'omit');
    assert.equal(options.redirect,'error');
    assert.equal(options.cache,'no-store');
    assert.equal(options.referrerPolicy,'no-referrer');
    assert.equal(JSON.parse(options.body).code,code);
    return answer({schema:'superphivessel.gateway.browser-session.v0.1',
      session_token:session,authority_granted:false,can_execute:false,can_read_memory:false});
  });
  assert.equal(token,session);
});
test('P02 malformed pairing contract and short secret rejected',async()=>{
  await assert.rejects(pairGateway('wrong'),/64-character/);
  await assert.rejects(pairGateway('a'.repeat(64),async()=>answer({
    schema:'bad',session_token:session,authority_granted:false,can_execute:false,can_read_memory:false
  })),/contract/);
});
test('P03 live status cannot fabricate authority',async()=>{
  const result=await gatewayStatus(session,async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer '+session);
    assert.equal(url,LOCAL_GATEWAY+'/v1/status');
    return answer({schema:'superphivessel.gateway.status.v0.2',
      gateway_status:'HTTPS_PAIR_READ_ONLY',authority_granted:false});
  });
  assert.equal(result.gateway_status,'HTTPS_PAIR_READ_ONLY');
});
test('P04 unknown gateway model approval claims are stripped by client',async()=>{
  const result=await gatewayModels(session,async()=>answer({
    schema:'superphivessel.gateway.models.v0.1',
    probe_status:'AVAILABLE',
    authority_granted:false,can_execute:false,
    models:[{name:'fixture:3b',loaded:true,quantization:'Q4',size_bytes:5000000,
      runtime_vram_bytes:2000000,routing_approved:true,execution_authorized:true}]
  }));
  assert.equal(result.count,1);
  assert.equal(result.models[0].routing_approved,false);
  assert.equal(result.models[0].execution_authorized,false);
});
test('P05 gateway session can be locally revoked',async()=>{
  await revokeGateway(session,async(url,options)=>{
    assert.equal(url,LOCAL_GATEWAY+'/v1/session');
    assert.equal(options.method,'DELETE');
    assert.equal(options.headers.Authorization,'Bearer '+session);
    return answer({session_status:'REVOKED',authority_granted:false});
  });
});

test('P06 revoked bearer receives explicit 403 SESSION_DENIED after DELETE',async()=>{
 const observation=await confirmRevokedGateway(session,async(url,options)=>{
   assert.equal(url,LOCAL_GATEWAY+'/v1/status');
   assert.equal(options.method,'GET');
   assert.equal(options.headers.Authorization,'Bearer '+session);
   assert.equal(options.credentials,'omit');
   return answer({error:'SESSION_DENIED',authority_granted:false},403);
 });
 assert.equal(observation.confirmed,true);
 assert.equal(observation.source,'HTTP_403_SESSION_DENIED');
 assert.equal(observation.authority_granted,false);
});
test('P07 successful DELETE with wrong JSON is not a revocation confirmation',async()=>{
 await assert.rejects(revokeGateway(session,async()=>answer({
   session_status:'ACTIVE',authority_granted:false
 })),/did not confirm/);
 await assert.rejects(revokeGateway(session,async()=>answer({
   session_status:'REVOKED',authority_granted:true
 })),/did not confirm/);
});
test('P08 a successful status read after revoke MUST fail the denial check',async()=>{
 await assert.rejects(confirmRevokedGateway(session,async()=>answer({
   schema:'superphivessel.gateway.status.v0.2',authority_granted:false
 },200)),/not denied/);
});
test('P09 connection errors, 401 and unrelated 403 errors cannot imply revocation',async()=>{
 await assert.rejects(confirmRevokedGateway(session,async()=>{throw new Error('TLS_FAILURE');}),/TLS_FAILURE/);
 await assert.rejects(confirmRevokedGateway(session,async()=>answer({
   error:'ORIGIN_DENIED',authority_granted:false
 },403)),/contract mismatch/);
 await assert.rejects(confirmRevokedGateway(session,async()=>answer({
   error:'SESSION_DENIED',authority_granted:true
 },403)),/contract mismatch/);
 await assert.rejects(confirmRevokedGateway(session,async()=>answer({
   error:'SESSION_DENIED',authority_granted:false
 },401)),/not denied/);
});
test('P10 invalid or missing bearer cannot be treated as confirmed revoked',async()=>{
 await assert.rejects(confirmRevokedGateway('invalid',async()=>answer({
   error:'SESSION_DENIED',authority_granted:false
 },403)),/Invalid local session/);
 await assert.rejects(revokeGateway('',async()=>answer({
   session_status:'REVOKED',authority_granted:false
 })),/Invalid local session/);
});

test('P11 opt-in Scout fetch reuses same short-lived HTTPS bearer, no arbitrary file paths',async()=>{
  const output=await gatewayScoutHandoff(session,async(url,options)=>{
    assert.equal(url,LOCAL_GATEWAY+'/v1/scout');
    assert.equal(options.method,'GET');
    assert.equal(options.body,undefined);
    assert.equal(options.headers.Authorization,'Bearer '+session);
    assert.equal(options.credentials,'omit');
    assert.equal(options.redirect,'error');
    assert.equal(options.cache,'no-store');
    return answer({schema:'phibot.scout-vessie-handoff.v0.1',authority_granted:false});
  });
  assert.equal(output.schema,'phibot.scout-vessie-handoff.v0.1');
});
test('P12 Scout read cannot use invalid or revoked bearer',async()=>{
  await assert.rejects(gatewayScoutHandoff('wrong',async()=>answer({})),/Invalid local session/);
  await assert.rejects(gatewayScoutHandoff(session,async()=>answer({
    error:'SESSION_DENIED',authority_granted:false
  },403)),/refused/);
});
