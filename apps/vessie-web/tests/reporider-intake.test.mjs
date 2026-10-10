import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,companyProjection,addCompanyNode} from '../src/company-mode.mjs';
import {previewRepoRiderIntake,applyRepoRiderIntake} from '../src/reporider-intake.mjs';
const company=()=>createCompanyPlan({name:'Example',founder:'Founder',product:'Demo',customer:'Users',weeklyGoal:'Build',budgetLimitUsd:0});
const receipt=()=>({
 format:'reporider.ride-receipt.v1',
 boundary:{mode:'mock',notes:['No files were pushed']},
 ride:{mode:'mock',repositoryUrl:'https://github.com/example/draft-repo',completedAt:'unknown',defaultBranch:'main'},
 safetyPolicy:{status:'needs-review',blockerCount:0,warningCount:1,policyVersion:'local'},
 queuedFiles:[{path:'README.md'}],
 queuedIssues:[{title:'Add a usable MVP'}, {title:'Verify basic browser interactions'}],
 approvalSummary:{approvedIssueCount:2},artifactFingerprints:{rideArtifact:'ride-abc'},
 receipts:[{status:'completed',action:'pretend delivery'}],
});
test('imports issue titles only, never receipts, approvals, DONE or a repo write',()=>{
 const input=receipt(),p=previewRepoRiderIntake(JSON.stringify(input));
 assert.equal(p.repositoryCreated,false);assert.equal(p.authenticated,false);
 assert.equal(p.approvalsTransferred,false);assert.equal(p.evidenceTransferred,false);
 const out=applyRepoRiderIntake(company(),p),v=companyProjection(out);
 assert.equal(out.nodes.length,2);
 assert.deepEqual(out.nodes.map(x=>x.output),['Add a usable MVP','Verify basic browser interactions']);
 assert.equal(v.complete,false);assert.equal(v.accepted,0);
 assert.ok(out.nodes.every(x=>x.risk==='REPO_WRITE'&&x.actionReview===null&&x.evidence===null));
 assert.ok(v.nodes.every(x=>x.status==='ACTION_REVIEW_HELD'));
 assert.equal(JSON.stringify(out).includes('ride-abc'),false);
 assert.equal(JSON.stringify(out).includes('pretend delivery'),false);
});
test('refuses non-mock, unsafe, malformed, duplicate and secret-bearing exports',()=>{
 const bad=receipt();bad.boundary.mode='live';
 assert.throws(()=>previewRepoRiderIntake(JSON.stringify(bad)),/MOCK_BOUNDARY/);
 bad.boundary.mode='mock';bad.safetyPolicy.blockerCount=1;
 assert.throws(()=>previewRepoRiderIntake(JSON.stringify(bad)),/SAFETY/);
 bad.safetyPolicy.blockerCount=0;bad.queuedIssues=[{title:'x'},{title:'X'}];
 assert.throws(()=>previewRepoRiderIntake(JSON.stringify(bad)),/DUPLICATE_ISSUE/);
 bad.queuedIssues=[{title:'ghp_'+ 'a'.repeat(25)}];
 assert.throws(()=>previewRepoRiderIntake(JSON.stringify(bad)),/SENSITIVE_TITLE/);
 bad.queuedIssues=[{title:'Safe',approved:true}];
 assert.throws(()=>previewRepoRiderIntake(JSON.stringify(bad)),/ISSUE_SHAPE/);
 assert.throws(()=>previewRepoRiderIntake('{}'),/FORMAT/);
 assert.throws(()=>previewRepoRiderIntake('{'),/JSON/);
 assert.throws(()=>previewRepoRiderIntake('x'.repeat(262145)),/SIZE/);
});
test('refuses graph overflow without partially mutating plan',()=>{
 let plan=company();
 for(let i=1;i<=11;i++)plan=addCompanyNode(plan,{
  id:'n'+i,function:'work',output:'thing',check:'evidence',dependsOn:[],risk:'NONE'
 });
 const before=JSON.stringify(plan);
 assert.throws(()=>applyRepoRiderIntake(plan,previewRepoRiderIntake(JSON.stringify(receipt()))),/CAPACITY/);
 assert.equal(JSON.stringify(plan),before);
});
test('an edited preview cannot forge authority or add unvalidated tasks',()=>{
 const p=previewRepoRiderIntake(JSON.stringify(receipt()));
 assert.throws(()=>applyRepoRiderIntake(company(),{...p,actionAuthorized:true}),/PREVIEW_AUTHORITY/);
 assert.throws(()=>applyRepoRiderIntake(company(),{...p,titles:['legit','legit']}),/PREVIEW_DUPLICATE/);
 assert.throws(()=>applyRepoRiderIntake(company(),{...p,hiddenApproval:true}),/PREVIEW_SHAPE/);
});
