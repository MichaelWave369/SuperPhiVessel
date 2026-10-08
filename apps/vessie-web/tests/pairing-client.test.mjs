import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCAL_GATEWAY,pairGateway,gatewayStatus,gatewayModels,revokeGateway}
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
