import test from 'node:test';
import assert from 'node:assert/strict';
import {ANTIM_SCHEMA,createBundle,appendEvent,inspectBundle,importBundle,closureReceipt} from '../src/anti-m.mjs';
const start=()=>createBundle({title:'Ship OpenBlue measure',deliverable:'Live page and review notes',criteria:['Build green','Browser smoke test']},'openblue-demo');
async function seed(){
 let b=await start();
 b=await appendEvent(b,'ACTION_DECLARED',{id:'a1',kind:'DEPLOY',description:'Deploy GitHub Pages'});
 b=await appendEvent(b,'ACTION_APPROVED',{actionId:'a1',reviewer:'Operator'});
 b=await appendEvent(b,'EVIDENCE_RECORDED',{criterionId:'c1',method:'CI_RUN',result:'PASS',reference:'https://github.com/example/repo/actions/runs/12345',summary:'Workflow reports pass'});
 b=await appendEvent(b,'EVIDENCE_REVIEWED',{evidenceSequence:4,reviewer:'Operator',decision:'ACCEPT'});
 return b;
}
test('starts as scoped, offline evidence pending; no runtime authority',async()=>{
 const b=await start(),s=await inspectBundle(b);
 assert.equal(b.schema,ANTIM_SCHEMA);assert.equal(s.status,'EVIDENCE_PENDING');
 assert.equal(s.externalExecutionAttested,false);assert.equal(s.authorityGranted,false);
 assert.equal(s.contract.criteria.length,2);
});
test('declared side effect holds the closeout until explicitly reviewed',async()=>{
 let b=await start();
 b=await appendEvent(b,'ACTION_DECLARED',{id:'deploy',kind:'DEPLOY',description:'Static Pages deployment'});
 const s=await inspectBundle(b);
 assert.equal(s.status,'APPROVAL_HELD');
 assert.ok(s.readiness.missing.some(x=>x.includes('deploy')));
 await assert.rejects(appendEvent(b,'CLOSED',{reviewer:'Operator',note:'Done'}),/NOT_READY/);
});
test('missing / negative / unreviewed evidence never closes',async()=>{
 let b=await seed();
 assert.equal((await inspectBundle(b)).status,'EVIDENCE_PENDING');
 await assert.rejects(appendEvent(b,'CLOSED',{reviewer:'Operator',note:'Done'}),/NOT_READY/);
 b=await appendEvent(b,'EVIDENCE_RECORDED',{criterionId:'c2',method:'HUMAN_TEST',result:'FAIL',reference:'https://github.com/example/repo/issues/1',summary:'Visual defect'});
 await assert.rejects(appendEvent(b,'EVIDENCE_REVIEWED',{evidenceSequence:6,reviewer:'Operator',decision:'ACCEPT'}),/ACCEPT_FAILED/);
 await assert.rejects(appendEvent(b,'CLOSED',{reviewer:'Operator',note:'Done'}),/NOT_READY/);
});
test('reviewed positive evidence can create locally qualified DONE and receipt',async()=>{
 let b=await seed();
 b=await appendEvent(b,'EVIDENCE_RECORDED',{criterionId:'c2',method:'HUMAN_TEST',result:'PASS',reference:'https://github.com/example/repo/issues/2',summary:'Operator reports visual pass'});
 b=await appendEvent(b,'EVIDENCE_REVIEWED',{evidenceSequence:6,reviewer:'Operator',decision:'ACCEPT'});
 assert.equal((await inspectBundle(b)).status,'READY_TO_CLOSE');
 b=await appendEvent(b,'CLOSED',{reviewer:'Operator',note:'Accepted evidence for both checks'});
 const s=await inspectBundle(b),r=await closureReceipt(b);
 assert.equal(s.status,'VERIFIED_DONE_LOCAL');assert.equal(r.ledger_events,8);
 assert.equal(r.external_execution_independently_attested,false);
 assert.equal(r.operator_identity_authenticated,false);
 assert.equal(r.execution_authority_granted,false);
 await assert.rejects(appendEvent(b,'ACTION_DECLARED',{id:'later',kind:'SPEND',description:'New spend'}),/CLOSED_OR_MISSING/);
});
test('latest passing evidence must be operator accepted, stale earlier pass insufficient',async()=>{
 let b=await seed();
 b=await appendEvent(b,'EVIDENCE_RECORDED',{criterionId:'c1',method:'CI_RUN',result:'FAIL',reference:'https://github.com/example/repo/actions/runs/99',summary:'Regression'});
 assert.equal((await inspectBundle(b)).readiness.ready,false);
});
test('tampering with any event, even a proof reference, breaks hash chain',async()=>{
 const b=await seed();const changed=structuredClone(b);
 changed.events[3].payload.reference='https://example.com/forged';
 await assert.rejects(inspectBundle(changed),/HASH_MISMATCH/);
 const removed=structuredClone(b);removed.events.splice(2,1);
 await assert.rejects(inspectBundle(removed),/SEQUENCE|HASH_LINK/);
});
test('import requires exact fields and replay, not a copied DONE flag',async()=>{
 const b=await seed();
 assert.equal((await inspectBundle(await importBundle(JSON.stringify(b)))).status,'EVIDENCE_PENDING');
 await assert.rejects(importBundle(JSON.stringify({...b,status:'VERIFIED_DONE_LOCAL'})),/FIELDS/);
 const altered=structuredClone(b);altered.events[0].payload.contract.criteria.push({id:'bonus',description:'Extra scope'});
 await assert.rejects(importBundle(JSON.stringify(altered)),/HASH_MISMATCH/);
});
test('unrecognized action type, arbitrary URLs and duplicate reviews are refused',async()=>{
 let b=await start();
 await assert.rejects(appendEvent(b,'ACTION_DECLARED',{id:'a1',kind:'UNRESTRICTED',description:'Anything'}),/ACTION_KIND/);
 await assert.rejects(appendEvent(b,'EVIDENCE_RECORDED',{criterionId:'c1',method:'CI_RUN',result:'PASS',reference:'javascript:alert(1)',summary:'Bad'}),/REFERENCE/);
 b=await appendEvent(b,'EVIDENCE_RECORDED',{criterionId:'c1',method:'CI_RUN',result:'PASS',reference:'sha256:'+'a'.repeat(64),summary:'Hash recorded'});
 b=await appendEvent(b,'EVIDENCE_REVIEWED',{evidenceSequence:2,reviewer:'Operator',decision:'ACCEPT'});
 await assert.rejects(appendEvent(b,'EVIDENCE_REVIEWED',{evidenceSequence:2,reviewer:'Other',decision:'ACCEPT'}),/REVIEW_ORDER/);
});
test('oversized import and malformed timestamps fail closed',async()=>{
 await assert.rejects(importBundle('x'.repeat(131073)),/SIZE/);
 const b=await start();const corrupted=structuredClone(b);corrupted.events[0].at='yesterday';
 await assert.rejects(inspectBundle(corrupted),/TIME/);
});
