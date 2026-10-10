import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LOCAL_THINKTANK_UI,LOCAL_THINKTANK_BRIDGE,makeThinkTankLocalHandoffUrl,
 buildThinkTankLocalDraft,inspectOperatorDirective,parseLocalBridgeHealth,
 checkThinkTankLocalBridge
} from '../src/thinktank-local-handoff.mjs';
test('encodes exact bounded draft only in localhost fragment; never a provider invocation',()=>{
 const x=makeThinkTankLocalHandoffUrl('Investigate the release discrepancy and challenge optimistic conclusions.','audit');
 const u=new URL(x);
 assert.equal(u.origin,'http://127.0.0.1:5173');
 assert.equal(u.pathname,'/');
 assert.equal(u.search,'');
 assert.ok(u.hash.startsWith('#spv-draft='));
 const raw=u.hash.slice('#spv-draft='.length).replace(/-/g,'+').replace(/_/g,'/');
 const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw),c=>c.charCodeAt(0))));
 assert.equal(data.schema,'spv-thinktank-draft.v0.1');
 assert.equal(data.kind,'operator-directive-draft');
 assert.equal(data.source,'vessie-human-composed');
 assert.equal(data.suggestedMode,'audit');
 assert.equal(data.runRequested,false);
 assert.equal(data.executionAuthorityGranted,false);
 assert.equal(data.providerKeysTransferred,false);
 assert.equal(data.directive,'Investigate the release discrepancy and challenge optimistic conclusions.');
 assert.equal(x.includes('/providers/invoke'),false);
});
test('Unicode survives local fragment without leaking query string or model keys',()=>{
 const text='Investigate nested bubbles and Φ, 日本語, and naïve alternatives.';
 const x=makeThinkTankLocalHandoffUrl(text,'council');
 const raw=x.split('#spv-draft=')[1].replace(/-/g,'+').replace(/_/g,'/');
 assert.equal(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw),c=>c.charCodeAt(0)))).directive,text);
 assert.equal(x.includes('?'),false);
 assert.equal(LOCAL_THINKTANK_UI,'http://127.0.0.1:5173/');
});
test('rejected risky or absent text, unsupported modes and obvious tokens',()=>{
 for(const text of ['x','   ','x'.repeat(1201),'Hello\u0000bad',
  'Copy this github_pat_abcdefghijklmnopqrstuvwxyz1234567890 into ThinkTank',
  'Send key sk-abcdefghijklmnopqrstuvwxyz0123456789 to the council']){
  assert.throws(()=>inspectOperatorDirective(text),/THINKTANK_LOCAL_(DIRECTIVE|SECRET_PATTERN)/);
 }
 assert.throws(()=>makeThinkTankLocalHandoffUrl('Research this','autorun'),/THINKTANK_LOCAL_MODE/);
 assert.equal(buildThinkTankLocalDraft(' Research this ','trio').directive,'Research this');
});
test('read-only health calls only exactly one loopback GET and no secret-bearing options',async()=>{
 let called=0;
 const output=await checkThinkTankLocalBridge(async(url,opts)=>{
  called++;assert.equal(url,LOCAL_THINKTANK_BRIDGE+'/health');
  assert.equal(opts.method,'GET');assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
  assert.equal(opts.mode,'cors');
  return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({
   ok:true,service:'phi-think-tank-provider-bridge',version:'0.15.0'
  })};
 });
 assert.equal(called,1);
 assert.equal(output.version,'0.15.0');
 assert.equal(output.sessionStarted,false);
 assert.equal(output.authorityGranted,false);
});
test('wrong service, invalid response, HTTP refusal, cancellation, oversized headers fail closed',async()=>{
 assert.throws(()=>parseLocalBridgeHealth({ok:true,service:'other',version:'0.15.0'}),/SERVICE/);
 assert.throws(()=>parseLocalBridgeHealth({ok:true,service:'phi-think-tank-provider-bridge',version:'evil'}),/SERVICE/);
 await assert.rejects(checkThinkTankLocalBridge(async()=>({ok:false,status:403})),/HTTP_403/);
 await assert.rejects(checkThinkTankLocalBridge(async()=>({ok:true,headers:{get:()=>4096}})),/SIZE/);
 const ctl=new AbortController();ctl.abort();
 await assert.rejects(checkThinkTankLocalBridge(async(_url,init)=>{
  assert.equal(init.signal.aborted,true);
  const error=new Error('Aborted');error.name='AbortError';throw error
 },ctl.signal),/TIMEOUT_OR_ABORT/);
});
