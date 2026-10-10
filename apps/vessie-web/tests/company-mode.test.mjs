import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,addCompanyNode,recordActionReview,recordCompanyEvidence,
 reviewCompanyEvidence,companyProjection,importCompanyPlan} from '../src/company-mode.mjs';
const company=()=>createCompanyPlan({name:'Φ Ventures',founder:'Founder',product:'Studio',
 customer:'Creators',weeklyGoal:'Deliver preview',budgetLimitUsd:0});
const node=(id,dependsOn=[],risk='NONE')=>({id,function:'QA',output:'Browser smoke report',check:'Check the live page',dependsOn,risk});
const receipt={result:'PASS',method:'HUMAN_TEST',reference:'https://github.com/example/repo/issues/1',summary:'Operator says check passed'};
test('starts as a bounded no-execution planning graph',()=>{
 const p=company(),v=companyProjection(p);
 assert.equal(v.complete,false);assert.equal(v.executionAuthorityGranted,false);
 assert.equal(v.externalExecutionAttested,false);assert.equal(v.integrityProtected,false);
});
test('dependencies block parallel successors until reviewed PASS',()=>{
 let p=addCompanyNode(company(),node('build'));
 p=addCompanyNode(p,node('publish',['build']));
 assert.deepEqual(companyProjection(p).ready,['build']);
 p=recordCompanyEvidence(p,'build',receipt);
 assert.equal(companyProjection(p).nodes[0].status,'EVIDENCE_REVIEW_REQUIRED');
 assert.equal(companyProjection(p).nodes[1].status,'DEPENDENCY_BLOCKED');
 p=reviewCompanyEvidence(p,'build','Operator','ACCEPT');
 assert.deepEqual(companyProjection(p).ready,['publish']);
});
test('consequential nodes hold before an operator review, which is not an execution grant',()=>{
 let p=addCompanyNode(company(),node('deploy',[],'DEPLOY'));
 assert.equal(companyProjection(p).nodes[0].status,'ACTION_REVIEW_HELD');
 p=recordActionReview(p,'deploy','Founder');
 assert.equal(companyProjection(p).nodes[0].status,'READY_FOR_MANUAL_WORK');
 assert.equal(companyProjection(p).executionAuthorityGranted,false);
});
test('failed, rejected and replaced evidence cannot count as completion',()=>{
 let p=addCompanyNode(company(),node('qa'));
 p=recordCompanyEvidence(p,'qa',{...receipt,result:'FAIL'});
 assert.equal(companyProjection(p).nodes[0].status,'CHECK_FAILED');
 assert.throws(()=>reviewCompanyEvidence(p,'qa','Founder','ACCEPT'),/ACCEPT_FAILED/);
 p=recordCompanyEvidence(p,'qa',receipt);
 p=reviewCompanyEvidence(p,'qa','Founder','REJECT');
 assert.equal(companyProjection(p).nodes[0].status,'CHECK_REJECTED');
 p=recordCompanyEvidence(p,'qa',receipt);
 assert.equal(companyProjection(p).complete,false);
 p=reviewCompanyEvidence(p,'qa','Founder','ACCEPT');
 assert.equal(companyProjection(p).complete,true);
});
test('rejects cycles, unknown deps, duplicates, undeclared risks and invalid references',()=>{
 let p=addCompanyNode(company(),node('a'));
 assert.throws(()=>addCompanyNode(p,node('a')),/DUPLICATE_NODE/);
 assert.throws(()=>addCompanyNode(p,node('b',['unknown'])),/DEPENDENCY_ORDER/);
 assert.throws(()=>addCompanyNode(p,node('b',['b'])),/DEPENDENCY_ORDER/);
 assert.throws(()=>addCompanyNode(p,node('b',[],'FULL_CONTROL')),/RISK/);
 assert.throws(()=>recordCompanyEvidence(p,'a',{...receipt,reference:'javascript:alert(1)'}),/REFERENCE/);
});
test('import is strict, bounded, and plainly not cryptographically protected',()=>{
 const p=addCompanyNode(company(),node('a'));
 assert.deepEqual(importCompanyPlan(JSON.stringify(p)),p);
 assert.throws(()=>importCompanyPlan(JSON.stringify({...p,complete:true})),/FIELDS/);
 assert.throws(()=>importCompanyPlan('x'.repeat(32769)),/SIZE/);
 assert.throws(()=>importCompanyPlan('{'),/JSON/);
 const bad=structuredClone(p);bad.nodes[0].dependsOn=['a'];
 assert.throws(()=>importCompanyPlan(JSON.stringify(bad)),/DEPENDENCY_ORDER/);
});
