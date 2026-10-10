import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,addCompanyNode,recordActionReview,recordCompanyEvidence,reviewCompanyEvidence} from '../src/company-mode.mjs';
import {createPriorityReviewSet,recordPriorityReview,clearPriorityReview,
 priorityProjection,importPriorityReviewSet,validatePriorityReviewSet} from '../src/mission-priority.mjs';
import {proposeAntiMFromCompany} from '../src/company-anti-m-handoff.mjs';
const plan=()=>{
 let p=createCompanyPlan({name:'Founder Ventures',founder:'Owner',product:'Builder',customer:'Humans',weeklyGoal:'Ship',budgetLimitUsd:0});
 p=addCompanyNode(p,{id:'build',function:'Build',output:'Deliverable',check:'Test build',dependsOn:[],risk:'REPO_WRITE'});
 p=addCompanyNode(p,{id:'qa',function:'QA',output:'QA report',check:'Review build output',dependsOn:['build'],risk:'NONE'});
 p=addCompanyNode(p,{id:'site',function:'Deploy',output:'Public page',check:'Check deployed site',dependsOn:[],risk:'DEPLOY'});
 return p;
};
const strong={impact:'HIGH',urgency:'NOW',effort:'SMALL',blocksRelease:true,rationale:'Operator asserts this blocks this week release',reviewer:'Founder'};
const weak={impact:'LOW',urgency:'LATER',effort:'LARGE',blocksRelease:false,rationale:'Human calls it low value for now',reviewer:'Founder'};
test('unreviewed nodes remain unranked and nothing becomes executable',()=>{
 const p=plan(),set=createPriorityReviewSet(p),v=priorityProjection(p,set);
 assert.equal(v.ranked.length,0);assert.equal(v.unranked.length,3);
 assert.equal(v.advisoryOnly,true);assert.equal(v.executionAuthorityGranted,false);
 assert.equal(v.externalCompletionAttested,false);
});
test('human judgments alone rank consistently and expose blocked work as blocked',()=>{
 let p=plan(),set=createPriorityReviewSet(p);
 set=recordPriorityReview(p,set,'qa',strong);
 set=recordPriorityReview(p,set,'site',weak);
 const v=priorityProjection(p,set);
 assert.deepEqual(v.ranked.map(x=>x.id),['qa','site']);
 assert.equal(v.ranked[0].status,'DEPENDENCY_BLOCKED');
 assert.equal(v.ranked[0].score,12+9+3+5);
 assert.equal(v.ranked[1].score,4+3+1);
 assert.equal(v.unranked.length,1);
 assert.equal(p.nodes[1].actionReview,null);
 assert.equal(p.nodes[1].evidence,null);
 const transfer=proposeAntiMFromCompany(p,v.ranked[0].id);
 assert.equal(transfer.evidenceTransferred,false);assert.equal(transfer.approvalTransferred,false);
 assert.equal(transfer.executionAuthorityGranted,false);
});
test('exact tie retains original plan order, not order reviews entered',()=>{
 const p=plan();
 let s=createPriorityReviewSet(p);
 s=recordPriorityReview(p,s,'site',strong);
 s=recordPriorityReview(p,s,'build',strong);
 assert.deepEqual(priorityProjection(p,s).ranked.map(x=>x.id),['build','site']);
});
test('rejects forged authority, extra fields, duplicate records, tampered scope and stale company',()=>{
 const p=plan(),s=recordPriorityReview(p,createPriorityReviewSet(p),'qa',strong);
 assert.throws(()=>validatePriorityReviewSet(p,{...s,actionAuthorityGranted:true}),/AUTHORITY/);
 assert.throws(()=>validatePriorityReviewSet(p,{...s,completionCertified:true}),/AUTHORITY/);
 assert.throws(()=>validatePriorityReviewSet(p,{...s,secret:'x'}),/FIELDS/);
 assert.throws(()=>validatePriorityReviewSet(p,{...s,reviews:[s.reviews[0],s.reviews[0]]}),/DUPLICATE_NODE/);
 assert.throws(()=>validatePriorityReviewSet(p,{...s,reviews:[{...s.reviews[0],node:{...s.reviews[0].node,check:'Changed'}}]}),/NODE_CHANGED/);
 const alt=structuredClone(p);alt.company.name='Other';
 assert.throws(()=>validatePriorityReviewSet(alt,s),/COMPANY_CHANGED/);
 const modified=structuredClone(p);modified.nodes[1].check='New check';
 assert.throws(()=>validatePriorityReviewSet(modified,s),/NODE_CHANGED/);
});
test('priority review never changes the lifecycle, and locally accepted work leaves active queue',()=>{
 let p=plan();
 const s=recordPriorityReview(p,createPriorityReviewSet(p),'qa',strong);
 let v=priorityProjection(p,s);
 assert.equal(v.ranked.length,1);
 assert.equal(v.ranked[0].status,'DEPENDENCY_BLOCKED');
 p=recordActionReview(p,'build','Founder');
 p=recordCompanyEvidence(p,'build',{result:'PASS',method:'HUMAN_TEST',
  reference:'https://github.com/example/project/issues/1',summary:'Self-reported build check'});
 p=reviewCompanyEvidence(p,'build','Founder','ACCEPT');
 p=recordCompanyEvidence(p,'qa',{result:'PASS',method:'HUMAN_TEST',
  reference:'https://github.com/example/project/issues/2',summary:'Self-reported QA run'});
 p=reviewCompanyEvidence(p,'qa','Founder','ACCEPT');
 v=priorityProjection(p,s);
 assert.equal(v.ranked.length,0,'locally accepted tasks should leave the active priority queue');
 assert.equal(v.locallyAccepted,2);
 assert.equal(v.unranked.length,1);
 assert.equal(v.externalCompletionAttested,false,'local acceptance does not attest external done');
});
test('validation round trip, explicit clear, no silent edits to original set',()=>{
 const p=plan(),empty=createPriorityReviewSet(p);
 const s=recordPriorityReview(p,empty,'build',strong);
 assert.equal(empty.reviews.length,0);
 assert.deepEqual(importPriorityReviewSet(p,JSON.stringify(s)),s);
 assert.equal(clearPriorityReview(p,s,'build').reviews.length,0);
 assert.equal(s.reviews.length,1);
 assert.throws(()=>recordPriorityReview(p,s,'missing',strong),/NODE_NOT_FOUND/);
 assert.throws(()=>recordPriorityReview(p,s,'build',{...strong,impact:'WORLD_ENDING'}),/ASSESSMENT/);
 assert.throws(()=>importPriorityReviewSet(p,'{'),/JSON/);
 assert.throws(()=>importPriorityReviewSet(p,'z'.repeat(32769)),/SIZE/);
 assert.throws(()=>recordPriorityReview(p,s,'build',{...strong,rationale:' '}),/TEXT/);
});
