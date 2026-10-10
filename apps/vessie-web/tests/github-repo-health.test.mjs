import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,addCompanyNode,companyProjection} from '../src/company-mode.mjs';
import {publicRepositoryUrl,publicActionsUrl,parseRepositoryMetadata,previewHealthRuns,
 validateHealthPreview,readPublicRepositoryHealth,importHealthInvestigations} from '../src/github-repo-health.mjs';
const name='MichaelWave369/reporider',repo='michaelwave369/reporider';
const plan=()=>createCompanyPlan({name:'Founder Co',founder:'Founder',product:'Apps',
 customer:'Users',weeklyGoal:'Repair CI',budgetLimitUsd:0});
const meta=()=>JSON.stringify({full_name:'MichaelWave369/reporider',private:false,archived:false,default_branch:'main'});
const run=(id,workflowId,name,status,conclusion,createdAt='2026-10-10T16:00:00Z')=>({
 id,workflow_id:workflowId,name,status,conclusion,head_branch:'main',
 html_url:'https://github.com/MichaelWave369/reporider/actions/runs/'+id,
 run_attempt:1,created_at:createdAt,event:'push'});
const payload=()=>JSON.stringify({total_count:55,workflow_runs:[
 run(3002,1,'Deploy','completed','success','2026-10-10T17:00:00Z'),
 run(3001,1,'Deploy','completed','failure','2026-10-10T16:00:00Z'),
 run(4402,2,'Build','completed','failure','2026-10-10T17:00:00Z'),
 run(4401,2,'Build','completed','success','2026-10-10T16:00:00Z'),
 run(6001,3,'Publish','in_progress',null,'2026-10-10T17:20:00Z'),
 run(7001,4,'Slow QA','completed','timed_out','2026-10-10T16:10:00Z')
]});
test('GET only metadata and workflow paths, no secrets or execution',async()=>{
 const seen=[];
 const preview=await readPublicRepositoryHealth(name,async (url,opts)=>{
  seen.push(url);
  assert.equal(opts.method,'GET');assert.equal(opts.credentials,'omit');
  assert.equal(opts.redirect,'error');
  return {ok:true,headers:{get:()=>null},text:async()=>url.endsWith('/reporider')?meta():payload()};
 });
 assert.deepEqual(seen,[publicRepositoryUrl(name),publicActionsUrl(name,'main')]);
 assert.equal(preview.provenance,'UNAUTHENTICATED_PUBLIC_GITHUB_SNAPSHOT');
 assert.equal(preview.authenticated,false);assert.equal(preview.evidenceTransferred,false);
 assert.equal(preview.workflows.length,4);
});
test('latest sampled workflow overrides stale failed history',()=>{
 const p=previewHealthRuns(payload(),parseRepositoryMetadata(meta(),name));
 assert.equal(p.workflows.find(w=>w.workflowId===1).conclusion,'success');
 assert.equal(p.workflows.find(w=>w.workflowId===2).conclusion,'failure');
 assert.equal(p.workflows.find(w=>w.workflowId===3).status,'in_progress');
 assert.throws(()=>importHealthInvestigations(plan(),p,[3001]),/SELECTION_NOT_FAILED/);
 assert.throws(()=>importHealthInvestigations(plan(),p,[6001]),/SELECTION_NOT_FAILED/);
 const out=importHealthInvestigations(plan(),p,[4402,7001]);
 assert.equal(out.nodes.length,2);
 assert.ok(out.nodes.every(n=>n.risk==='REPO_WRITE'&&!n.evidence&&!n.actionReview));
 assert.ok(out.nodes[0].check.includes('/actions/runs/4402 '));
 assert.ok(companyProjection(out).nodes.every(n=>n.status==='ACTION_REVIEW_HELD'));
 assert.equal(companyProjection(out).externalExecutionAttested,false);
 assert.throws(()=>importHealthInvestigations(out,p,[4402]),/ALREADY_IMPORTED/);
 assert.equal(JSON.stringify(out).includes('3001'),false);
});
test('strict repo and source shape reject arbitrary hosts or untrusted repo',()=>{
 for(const bad of ['https://evil.com/x','owner/repo/extra','owner/../other','owner/repo?token=abc']){
  assert.throws(()=>publicRepositoryUrl(bad),/REPOSITORY/);
 }
 assert.throws(()=>publicActionsUrl(name,'../secrets'),/BRANCH/);
 assert.throws(()=>parseRepositoryMetadata(JSON.stringify({...JSON.parse(meta()),private:true}),name),/PUBLIC_ONLY/);
 assert.throws(()=>parseRepositoryMetadata(JSON.stringify({...JSON.parse(meta()),full_name:'other/repo'}),name),/METADATA_REPO/);
 assert.throws(()=>parseRepositoryMetadata(JSON.stringify({...JSON.parse(meta()),default_branch:'main?x=secret'}),name),/BRANCH/);
});
test('API failures, oversized payload, falsified URL and invalid branch blocked',async()=>{
 await assert.rejects(readPublicRepositoryHealth(name,async()=>({ok:false,status:403,headers:{get:()=>null}})),/HTTP_403/);
 await assert.rejects(readPublicRepositoryHealth(name,async()=>({ok:true,headers:{get:()=>''+2097153}})),/SIZE/);
 const m=parseRepositoryMetadata(meta(),name),bad=JSON.parse(payload());
 bad.workflow_runs[0].html_url='https://evil.invalid/actions/runs/3002';
 assert.throws(()=>previewHealthRuns(JSON.stringify(bad),m),/RUN_URL/);
 bad.workflow_runs[0].html_url='https://github.com/'+repo+'/actions/runs/3002';
 bad.workflow_runs[0].head_branch='feature/sneaky';
 assert.throws(()=>previewHealthRuns(JSON.stringify(bad),m),/RUN_BRANCH/);
 assert.throws(()=>previewHealthRuns('{"workflow_runs":[]}',m),/RUN_LIST/);
});
test('cannot forge authority or swap imported link',()=>{
 const p=previewHealthRuns(payload(),parseRepositoryMetadata(meta(),name));
 assert.throws(()=>validateHealthPreview({...p,approvalGranted:true}),/AUTHORITY/);
 assert.throws(()=>validateHealthPreview({...p,extra:'yes'}),/FIELDS/);
 assert.throws(()=>validateHealthPreview({...p,workflows:[{...p.workflows[0],url:'https://evil.invalid'}]}),/RUN_URL/);
 assert.throws(()=>importHealthInvestigations(plan(),p,[4402,4402]),/SELECTION_ID/);
});
test('capacity overflow rejects atomically',()=>{
 let p=plan();
 for(let i=0;i<11;i++)p=addCompanyNode(p,{id:'n'+i,function:'work',output:'thing',check:'human check',dependsOn:[],risk:'NONE'});
 const before=JSON.stringify(p);
 const v=previewHealthRuns(payload(),parseRepositoryMetadata(meta(),name));
 assert.throws(()=>importHealthInvestigations(p,v,[4402,7001]),/CAPACITY/);
 assert.equal(JSON.stringify(p),before);
});
