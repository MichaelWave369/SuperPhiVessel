import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,addCompanyNode,recordActionReview,recordCompanyEvidence,
 reviewCompanyEvidence,companyProjection} from '../src/company-mode.mjs';
import {createPriorityReviewSet,recordPriorityReview} from '../src/mission-priority.mjs';
import {createBundle,appendEvent} from '../src/anti-m.mjs';
import {createWorkspaceArchive,importWorkspaceArchive} from '../src/workspace-archive.mjs';
const plan=()=>{
 let p=createCompanyPlan({name:'Founder Lab',founder:'Operator',product:'Tooling',
  customer:'Builders',weeklyGoal:'Finish',budgetLimitUsd:0});
 p=addCompanyNode(p,{id:'first',function:'Build UI',output:'Working UI',
  check:'Test the UI',risk:'REPO_WRITE'});
 p=addCompanyNode(p,{id:'second',function:'Verify UI',output:'QA receipt',
  check:'Check the browser',dependsOn:['first'],risk:'NONE'});
 return p
};
async function journal(p){
 let b=await createBundle({title:p.nodes[0].function,deliverable:p.nodes[0].output,
  criteria:[p.nodes[0].check]},'am-demo');
 b=await appendEvent(b,'EVIDENCE_RECORDED',{criterionId:'c1',result:'PASS',
  method:'CI_RUN',reference:'https://github.com/example/repo/actions/runs/22',
  summary:'Operator states CI passed'});
 b=await appendEvent(b,'EVIDENCE_REVIEWED',{evidenceSequence:2,reviewer:'Founder',decision:'ACCEPT'});
 return await appendEvent(b,'CLOSED',{reviewer:'Founder',note:'Locally reviewed, no external attestation'})
}
const priority={impact:'HIGH',urgency:'NOW',effort:'SMALL',blocksRelease:true,
 rationale:'Operator asserts release blocked',reviewer:'Founder'};
test('archive exports plan, priority and full replayable Anti-M journal',async()=>{
 const p=plan(),s=recordPriorityReview(p,createPriorityReviewSet(p),'first',priority);
 const b=await journal(p);
 const source=[{nodeId:'first',ledger:JSON.stringify(b)}];
 const archive=await createWorkspaceArchive(p,s,source,'2026-10-10T00:00:00.000Z');
 assert.equal(archive.operatorIdentityAuthenticated,false);
 assert.equal(archive.executionAuthorityGranted,false);
 assert.equal(archive.externalExecutionAttested,false);
 assert.equal(archive.completionPromoted,false);
 assert.equal(archive.automaticSyncEnabled,false);
 const recovered=await importWorkspaceArchive(JSON.stringify(archive));
 assert.deepEqual(recovered.plan,p);
 assert.deepEqual(recovered.priorities,s);
 assert.equal(recovered.journals.length,1);
 assert.deepEqual(recovered.journals[0].bundle,b);
 assert.equal(recovered.links[0].antiMStatus,'VERIFIED_DONE_LOCAL');
 assert.equal(recovered.links[0].externalExecutionAttested,false);
 assert.equal(companyProjection(recovered.plan).nodes[0].status,'ACTION_REVIEW_HELD',
  'Anti-M locally closed cannot promote Company state on recovery');
 assert.equal(recovered.externallyAttested,false);
});
test('no journal archive remains valid and does not invent DONE',async()=>{
 const p=plan();
 const archive=await createWorkspaceArchive(p,null,[]);
 const got=await importWorkspaceArchive(JSON.stringify(archive));
 assert.equal(got.journals.length,0);
 assert.equal(got.links.length,0);
 assert.equal(got.priorities.reviews.length,0);
 assert.equal(got.plan.nodes.length,2);
});
test('rejects edited company data, forged authority and corrupt hash',async()=>{
 const p=plan();
 const archive=await createWorkspaceArchive(p,null,[]);
 const modified=structuredClone(archive);
 modified.payload.plan.nodes[0].output='Pretend completed';
 await assert.rejects(importWorkspaceArchive(JSON.stringify(modified)),/HASH_MISMATCH/);
 const elevated={...archive,completionPromoted:true};
 await assert.rejects(importWorkspaceArchive(JSON.stringify(elevated)),/AUTHORITY/);
 const enriched={...archive,approvedByAI:true};
 await assert.rejects(importWorkspaceArchive(JSON.stringify(enriched)),/FIELDS/);
 const forged={...archive,integrity:{method:'SHA-256-CERTIFIED',sha256:archive.integrity.sha256}};
 await assert.rejects(importWorkspaceArchive(JSON.stringify(forged)),/INTEGRITY/);
});
test('a copied valid archive must fail after underlying Anti-M event tamper even if file hash is editable',async()=>{
 const p=plan(),b=await journal(p);
 const archive=await createWorkspaceArchive(p,null,[{nodeId:'first',ledger:JSON.stringify(b)}]);
 const modified=structuredClone(archive);
 modified.payload.antiMJournals[0].bundle.events[1].payload.reference='https://example.net/forged';
 // Hash of the outer archive will refuse here. A malicious writer could
 // recompute it, but canonical Anti-M SHA-256 replay remains independent.
 await assert.rejects(importWorkspaceArchive(JSON.stringify(modified)),/HASH_MISMATCH/);
 await assert.rejects(createWorkspaceArchive(p,null,[{nodeId:'first',ledger:JSON.stringify(modified.payload.antiMJournals[0].bundle)}]),/HASH_MISMATCH/);
});
test('rejects mismatch, duplicate node sources, forged priority scope and receipt-only JSON',async()=>{
 const p=plan(),b=await journal(p);
 const other=structuredClone(p);other.nodes[0].output='Changed artifact';
 await assert.rejects(createWorkspaceArchive(other,null,[{nodeId:'first',ledger:JSON.stringify(b)}]),/SCOPE_MISMATCH/);
 await assert.rejects(createWorkspaceArchive(p,null,[{nodeId:'first',ledger:JSON.stringify(b)},{nodeId:'first',ledger:JSON.stringify(b)}]),/DUPLICATE_NODE/);
 await assert.rejects(createWorkspaceArchive(p,null,[{nodeId:'first',ledger:JSON.stringify({status:'VERIFIED_DONE_LOCAL'})}]),/FIELDS/);
 const reviews=recordPriorityReview(p,createPriorityReviewSet(p),'first',priority);
 const stale=structuredClone(p);stale.nodes[0].function='Modified';
 await assert.rejects(createWorkspaceArchive(stale,reviews,[]),/NODE_CHANGED/);
});
test('rejects missing/extra data, bad JSON, and oversized file',async()=>{
 const p=plan();
 const valid=await createWorkspaceArchive(p,null,[]);
 const invalid=structuredClone(valid);invalid.payload.hidden=true;
 await assert.rejects(importWorkspaceArchive(JSON.stringify(invalid)),/HASH_MISMATCH/);
 await assert.rejects(importWorkspaceArchive('{'),/WORKSPACE_ARCHIVE_JSON/);
 await assert.rejects(importWorkspaceArchive('x'.repeat(1800001)),/SIZE/);
 await assert.rejects(createWorkspaceArchive(p,null,[{nodeId:'first',ledger:'{'}]),/JOURNAL_JSON/);
});
test('archive does not mutate existing plan, evidence, or priorities',async()=>{
 let p=plan();
 p=recordActionReview(p,'first','Founder');
 p=recordCompanyEvidence(p,'first',{result:'PASS',method:'HUMAN_TEST',
  reference:'https://github.com/example/repo/issues/1',summary:'Operator says pass'});
 p=reviewCompanyEvidence(p,'first','Founder','ACCEPT');
 const before=JSON.stringify(p);
 const doc=await createWorkspaceArchive(p,null,[]);
 const again=await importWorkspaceArchive(JSON.stringify(doc));
 assert.equal(JSON.stringify(p),before);
 assert.equal(companyProjection(again.plan).nodes[0].status,'LOCAL_REVIEW_ACCEPTED');
 assert.equal(again.externallyAttested,false);
});
