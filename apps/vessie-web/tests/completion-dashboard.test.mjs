import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,addCompanyNode,recordActionReview,recordCompanyEvidence,
 reviewCompanyEvidence,companyProjection} from '../src/company-mode.mjs';
import {createPriorityReviewSet,recordPriorityReview} from '../src/mission-priority.mjs';
import {createBundle,appendEvent,closureReceipt} from '../src/anti-m.mjs';
import {completionDashboard,inspectAntiMForCompany,validateCompletionLink} from '../src/completion-dashboard.mjs';

const p0=()=>createCompanyPlan({name:'Delivery Co',founder:'Operator',product:'Tools',customer:'Users',weeklyGoal:'Ship',budgetLimitUsd:0});
const add=(p,id,dependsOn=[],risk='NONE')=>addCompanyNode(p,{id,function:'QA '+id,
 output:'Report '+id,check:'Check '+id,dependsOn,risk});
const review={impact:'HIGH',urgency:'NOW',effort:'SMALL',blocksRelease:true,
 rationale:'User says this blocks their launch',reviewer:'Founder'};
const proof={result:'PASS',method:'HUMAN_TEST',reference:'https://github.com/example/repo/issues/1',summary:'Operator observed green'};
test('fresh dashboard has zero artificial DONE, no priority inferred',()=>{
 let p=add(p0(),'one');
 p=add(p,'two',['one'],'REPO_WRITE');
 const view=completionDashboard(p,null);
 assert.equal(view.graphTotal,2);
 assert.equal(view.prioritized,0);
 assert.equal(view.locallyAccepted,0);
 assert.equal(view.withCompanyEvidence,0);
 assert.equal(view.separatelyAttestedExternalDone,false);
 assert.equal(view.executionAuthorityGranted,false);
 assert.deepEqual(view.rows.map(x=>x.status),['READY_FOR_MANUAL_WORK','DEPENDENCY_BLOCKED']);
 assert.equal(view.rows[1].antiMJournal,null);
});
test('reviewed priority order is advisory and does not change hold states',()=>{
 let p=add(p0(),'one');p=add(p,'two',['one'],'REPO_WRITE');
 let s=createPriorityReviewSet(p);
 s=recordPriorityReview(p,s,'two',review);
 const view=completionDashboard(p,s);
 assert.equal(view.rows[0].id,'two');
 assert.equal(view.rows[0].status,'DEPENDENCY_BLOCKED');
 assert.equal(view.rows[0].priorityRank,1);
 assert.equal(view.counts.DEPENDENCY_BLOCKED,1);
 assert.equal(companyProjection(p).nodes[1].actionReview,null);
});
test('complete Anti-M journal matches exact function/output/check, never transfers success',async()=>{
 let p=add(p0(),'one');
 let b=await createBundle({title:p.nodes[0].function,deliverable:p.nodes[0].output,
  criteria:[p.nodes[0].check]},'am-one');
 b=await appendEvent(b,'EVIDENCE_RECORDED',{criterionId:'c1',result:'PASS',method:'CI_RUN',
  reference:'https://github.com/example/repo/actions/runs/1',summary:'Operator says check passed'});
 b=await appendEvent(b,'EVIDENCE_REVIEWED',{evidenceSequence:2,reviewer:'Founder',decision:'ACCEPT'});
 b=await appendEvent(b,'CLOSED',{reviewer:'Founder',note:'Local review only'});
 const link=await inspectAntiMForCompany(p,'one',JSON.stringify(b));
 assert.equal(link.antiMStatus,'VERIFIED_DONE_LOCAL');
 assert.equal(link.localHashChainInspected,true);
 assert.equal(link.externalExecutionAttested,false);
 assert.equal(link.authorityGranted,false);
 const result=completionDashboard(p,null,[link]);
 assert.equal(result.antiMLocallyClosed,1);
 assert.equal(result.locallyAccepted,0,'Anti-M local close cannot upgrade Company DONE');
 assert.equal(result.rows[0].status,'READY_FOR_MANUAL_WORK');
 assert.equal(result.rows[0].antiMJournal.checkedAtImport,true);
 assert.equal((await closureReceipt(b)).external_execution_independently_attested,false);
});
test('scope mismatch and forged positive flags reject while original plan stays unchanged',async()=>{
 const p=add(p0(),'one');
 const b=await createBundle({title:'Other title',deliverable:'Report one',criteria:['Check one']},'am-wrong');
 const before=JSON.stringify(p);
 await assert.rejects(inspectAntiMForCompany(p,'one',JSON.stringify(b)),/SCOPE_MISMATCH/);
 const proper=await createBundle({title:'QA one',deliverable:'Report one',criteria:['Check one']},'am-good');
 const link=await inspectAntiMForCompany(p,'one',JSON.stringify(proper));
 assert.throws(()=>validateCompletionLink(p,{...link,authorityGranted:true}),/AUTHORITY/);
 assert.throws(()=>validateCompletionLink(p,{...link,companyEvidenceTransferred:true}),/AUTHORITY/);
 assert.throws(()=>validateCompletionLink(p,{...link,extra:'yes'}),/FIELDS/);
 const changed=structuredClone(p);changed.nodes[0].check='New criterion';
 assert.throws(()=>completionDashboard(changed,null,[link]),/SCOPE_MISMATCH/);
 assert.equal(JSON.stringify(p),before);
});
test('replay rejects modified event journal, receipt-only payload, and oversized JSON',async()=>{
 const p=add(p0(),'one');
 const b=await createBundle({title:'QA one',deliverable:'Report one',criteria:['Check one']},'am-one');
 const bad=structuredClone(b);bad.events[0].payload.contract.title='Forged';
 await assert.rejects(inspectAntiMForCompany(p,'one',JSON.stringify(bad)),/HASH_MISMATCH/);
 await assert.rejects(inspectAntiMForCompany(p,'one',JSON.stringify({status:'VERIFIED_DONE_LOCAL'})),/FIELDS/);
 await assert.rejects(inspectAntiMForCompany(p,'one','x'.repeat(131073)),/SIZE/);
 await assert.rejects(inspectAntiMForCompany(p,'unknown',JSON.stringify(b)),/NODE_NOT_FOUND/);
});
test('separate Company local-acceptance remains self-reported, not independently attested',()=>{
 let p=add(p0(),'one',''.split(' ').filter(Boolean),'REPO_WRITE');
 p=recordActionReview(p,'one','Founder');
 p=recordCompanyEvidence(p,'one',proof);
 p=reviewCompanyEvidence(p,'one','Founder','ACCEPT');
 const view=completionDashboard(p,null);
 assert.equal(view.locallyAccepted,1);
 assert.equal(view.companyAllLocalReviewsAccepted,true);
 assert.equal(view.antiMLocallyClosed,0);
 assert.equal(view.separatelyAttestedExternalDone,false);
 assert.equal(view.rows[0].status,'LOCAL_REVIEW_ACCEPTED');
});
