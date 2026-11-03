import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectVessieCouncilE1,SCHEMA} from '../ui/council-review.mjs';

// An independent local packet generator to exercise the public E1 format.
// Its output is ALWAYS unauthenticated synthetic fixture data.
function canon(value){
  if(Array.isArray(value))return '['+value.map(canon).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort()
    .map(k=>JSON.stringify(k)+':'+canon(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
const sha=value=>createHash('sha256').update(canon(value)).digest('hex');
const seatSpecs=[
  ['ThinkTank','MichaelWave369/think-tank','HYPOTHESIS_CHALLENGER','HYPOTHESIS_ONLY','CHALLENGE_AGGREGATE_EQUIVALENCE'],
  ['PocketBrain','MichaelWave369/PocketBrain','LOCAL_OBSERVER','DISPLAY_ONLY','DISPLAY_K0_K1_CONTRAST'],
  ['Vessie','MichaelWave369/SuperPhiVessel','GOVERNANCE_REVIEWER','REVIEW_ONLY','HOLD_FOR_OPERATOR_REVIEW']
];
function fixture({witness=true}={}){
  const parent=sha({kind:'fake-E0-source',caseId:'case-001'});
  const receipts=seatSpecs.map(([participant,repository,role,claimTier,action])=>{
    const rec={
      schema:SCHEMA,caseId:'case-001',participant,repository,sourceSha:'a'.repeat(40),
      sourceIdentity:'DECLARED_UNVERIFIED',role,claimTier,
      action:!witness&&participant==='ThinkTank'?'REVIEW_E0_RESULT':
        !witness&&participant==='PocketBrain'?'DISPLAY_E0_RESULT':action,
      parentE0Sha256:parent,origin:'SIMULATED',privacy:'PUBLIC_SYNTHETIC',
      authority:'NONE',modelExecuted:false,operatorApproved:false,
      evidenceAuthenticated:false,transportPerformed:false,
      interpretation:'Synthetic contract output; no scientific corroboration'
    };
    return {...rec,receiptSha256:sha(rec)};
  });
  const data={
    schema:SCHEMA,policyEpoch:1,caseId:'case-001',
    e0Schema:'nbg-pocketmesh.council-keyhole-e0.v0.1',
    e0ReceiptSha256:parent,origin:'SIMULATED',privacy:'PUBLIC_SYNTHETIC',
    authority:'NONE',state:'HELD_FOR_OPERATOR_REVIEW',
    sourceProvenance:'DECLARED_UNVERIFIED',independentEvidence:false,
    executionAuthorized:false,mergeAuthorized:false,sharingAuthorized:false,
    externalCalls:0,receipts
  };
  return {...data,exchangeSha256:sha(data)};
}
function resign(packet){
  for(const rec of packet.receipts){
    const {receiptSha256:_unused,...unsigned}=rec;
    rec.receiptSha256=sha(unsigned);
  }
  const {exchangeSha256:_unused,...unsigned}=packet;
  packet.exchangeSha256=sha(unsigned);
  return packet;
}
const denied=async(packet,re)=>assert.rejects(inspectVessieCouncilE1(packet),re);

test('E1-C01 accepts self-consistent synthetic packet only for held review',async()=>{
  const result=await inspectVessieCouncilE1(fixture());
  assert.equal(result.disposition,'HELD_UNTRUSTED_REVIEW_ONLY');
  assert.equal(result.keyholeContrastSuggested,true);
  assert.deepEqual(result.seats.map(x=>x.participant),['ThinkTank','PocketBrain','Vessie']);
  for(const key of ['councilApproval','scientificEvidence','sourceAuthenticated',
    'independentCorroboration','modelCalled','sharingAuthorized',
    'executionAuthorized','routingAuthorized','mergeAuthorized'])
    assert.equal(result[key],false,key);
});
test('E1-C02 non-witness is a descriptive HOLD, not a negative science result',async()=>{
  const result=await inspectVessieCouncilE1(fixture({witness:false}));
  assert.equal(result.keyholeContrastSuggested,false);
  assert.equal(result.disposition,'HELD_UNTRUSTED_REVIEW_ONLY');
});
test('E1-C03 detects inner and outer hash edits',async()=>{
  const inner=fixture();inner.receipts[0].sourceSha='b'.repeat(40);
  await denied(inner,/COUNCIL_E1_SEAT_HASH_REFUSED/);
  const outer=fixture();outer.exchangeSha256='f'.repeat(64);
  await denied(outer,/COUNCIL_E1_ENVELOPE_HASH_REFUSED/);
});
test('E1-C04 rejects forged execution and scientific promotion even when rehashed',async()=>{
  for(const [key,value] of [
    ['authority','ADMIN'],['executionAuthorized',true],['mergeAuthorized',true],
    ['sharingAuthorized',true],['independentEvidence',true],
    ['sourceProvenance','GITHUB_VERIFIED'],['origin','MEASURED'],
    ['privacy','PRIVATE'],['externalCalls',1],['state','APPROVED']
  ]){
    const p=fixture();p[key]=value;
    await denied(resign(p),/COUNCIL_E1_TRUST_REFUSED/);
  }
});
test('E1-C05 rejects per-seat forged authority or identity even when rehashed',async()=>{
  for(const [key,value] of [
    ['participant','GAIA'],['repository','MichaelWave369/NBGPocketMesh'],
    ['role','EXECUTOR'],['claimTier','MEASURED'],
    ['sourceIdentity','ATTESTED'],['modelExecuted',true],
    ['operatorApproved',true],['evidenceAuthenticated',true],
    ['transportPerformed',true],['origin','MEASURED'],['privacy','PRIVATE']
  ]){
    const p=fixture();p.receipts[1][key]=value;
    await denied(resign(p),/COUNCIL_E1_SEAT_TRUST_REFUSED/);
  }
});
test('E1-C06 refuses unknown roles, duplicates, reorder and extra seats',async()=>{
  const a=fixture();a.receipts.pop();
  await denied(resign(a),/COUNCIL_E1_SEATS_REFUSED/);
  const b=fixture();b.receipts.push(structuredClone(b.receipts[0]));
  await denied(resign(b),/COUNCIL_E1_SEATS_REFUSED/);
  const c=fixture();c.receipts.reverse();
  await denied(resign(c),/COUNCIL_E1_SEAT_TRUST_REFUSED/);
});
test('E1-C07 denies invalid SHA format and missing parent agreement',async()=>{
  const a=fixture();a.receipts[0].sourceSha='a'.repeat(12);
  await denied(resign(a),/COUNCIL_E1_SOURCE_SHA_REFUSED/);
  const b=fixture();b.receipts[0].parentE0Sha256='c'.repeat(64);
  await denied(resign(b),/COUNCIL_E1_SEAT_TRUST_REFUSED/);
});
test('E1-C08 rejects invalid categorical actions and witness pair drift',async()=>{
  const a=fixture();a.receipts[2].action='APPROVE_MISSION';
  await denied(resign(a),/COUNCIL_E1_ACTION_REFUSED/);
  const b=fixture();b.receipts[1].action='DISPLAY_E0_RESULT';
  await denied(resign(b),/COUNCIL_E1_ACTION_PAIR_REFUSED/);
});
test('E1-C09 rejects private raw notes, prompt, model output or extra keys',async()=>{
  const a=fixture();a.prompt='DO_NOT_LEAK';
  await denied(resign(a),/COUNCIL_E1_OUTER_SCHEMA_REFUSED/);
  const b=fixture();b.receipts[0].privateNotes='DO_NOT_LEAK';
  await denied(resign(b),/COUNCIL_E1_SEAT_SCHEMA_REFUSED/);
});
test('E1-C10 future epochs and unsupported schemas fail closed',async()=>{
  const a=fixture();a.policyEpoch=2;
  await denied(resign(a),/COUNCIL_E1_TRUST_REFUSED/);
  const b=fixture();b.schema='nbg-pocketmesh.council-evidence-exchange-e1.v0.2';
  await denied(resign(b),/COUNCIL_E1_TRUST_REFUSED/);
});
test('E1-C11 malformed null, array, case and hash refused',async()=>{
  await denied(null,/COUNCIL_E1_OUTER_SCHEMA_REFUSED/);
  await denied([],/COUNCIL_E1_OUTER_SCHEMA_REFUSED/);
  const a=fixture();a.caseId='../../../';
  await denied(resign(a),/COUNCIL_E1_CASE_REFUSED/);
  const b=fixture();b.e0ReceiptSha256='fake';
  await denied(resign(b),/COUNCIL_E1_E0_PARENT_REFUSED/);
});
test('E1-C12 a fully forged self-consistent packet remains UNVERIFIED',async()=>{
  const a=fixture();for(const r of a.receipts)r.sourceSha='b'.repeat(40);
  const result=await inspectVessieCouncilE1(resign(a));
  assert.equal(result.sourceAuthenticated,false);
  assert.equal(result.scientificEvidence,false);
  assert.equal(result.councilApproval,false);
});
test('E1-C13 result is redacted, categorical, and immutable',async()=>{
  const result=await inspectVessieCouncilE1(fixture());
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.seats));
  for(const s of result.seats)assert.ok(Object.isFrozen(s));
  assert.equal(JSON.stringify(result).includes('Synthetic contract output'),false);
  assert.equal(Object.hasOwn(result,'rawPrompt'),false);
});
test('E1-C14 console and portable packager expose exact new files',()=>{
  const here=new URL('../',import.meta.url);
  const html=readFileSync(new URL('ui/index.html',here),'utf8');
  const server=readFileSync(new URL('server.mjs',here),'utf8');
  const pack=readFileSync(new URL('../../../windows-local/build-portable.ps1',here),'utf8');
  const script=readFileSync(new URL('ui/council-review-ui.mjs',here),'utf8');
  assert.match(html,/id="council-e1-file"/);
  assert.match(html,/src="\/council-review-ui\.mjs"/);
  for(const name of ['council-review.mjs','council-review-ui.mjs']){
    assert.ok(server.includes("'/"+name+"'"));
    assert.ok(pack.includes("local-console/ui/"+name));
  }
  assert.doesNotMatch(script,/\bfetch\s*\(|\blocalStorage\b|\bindexedDB\b|\beval\s*\(/);
});
