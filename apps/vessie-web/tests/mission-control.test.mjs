import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,addCompanyNode,companyProjection} from '../src/company-mode.mjs';
import {MISSION_SCHEMA,parseMissionRepositories,validateMissionSnapshot,
 scanMissionRepositories,missionCandidates,missionSummary,importMissionCandidates} from '../src/mission-control.mjs';
const one='michaelwave369/reporider',two='michaelwave369/superphivessel',three='michaelwave369/evie';
const createPlan=()=>createCompanyPlan({name:'Foundry',founder:'Operator',product:'Apps',customer:'Users',weeklyGoal:'Ship',budgetLimitUsd:0});
function issue(repo,id,title){
 return {number:id,title,state:'open',html_url:'https://github.com/'+repo+'/issues/'+id};
}
function run(repo,id,wid,name,conclusion,time){
 return {id,workflow_id:wid,name,status:'completed',conclusion,run_attempt:1,
  head_branch:'main',created_at:time,html_url:'https://github.com/'+repo+'/actions/runs/'+id};
}
const datasets={
 [one]:{issues:[issue(one,31,'Review OAuth readiness')],
  runs:[run(one,201,8,'CI','success','2026-10-10T18:00:00Z'),
        run(one,200,8,'CI','failure','2026-10-10T17:00:00Z')]},
 [two]:{issues:[issue(two,9,'Document release blockers')],
  runs:[run(two,401,40,'Core Integrity','failure','2026-10-10T18:10:00Z')]},
 [three]:{issues:[issue(three,4,'Improve EVIE browser smoke test')],
  runs:[run(three,601,60,'Pages','timed_out','2026-10-10T18:20:00Z')]}
};
async function fake(url,opts){
 assert.equal(opts.method,'GET');assert.equal(opts.credentials,'omit');
 assert.ok(url.startsWith('https://api.github.com/repos/'));
 const repo=Object.keys(datasets).find(n=>url.startsWith('https://api.github.com/repos/'+n));
 assert.ok(repo,'Unexpected API host or repository: '+url);
 const data=datasets[repo];
 let value;
 if(url.endsWith('/'+repo))value={full_name:repo,private:false,archived:false,default_branch:'main'};
 else if(url.includes('/issues?'))value=data.issues;
 else if(url.includes('/actions/runs?'))value={total_count:data.runs.length,workflow_runs:data.runs};
 else throw Error('unexpected endpoint');
 return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(value)};
}
test('normalizes at most five exact public owner/repo strings',()=>{
 assert.deepEqual(parseMissionRepositories('MichaelWave369/RepoRider,\n MichaelWave369/SuperPhiVessel'),[one,two]);
 assert.throws(()=>parseMissionRepositories(''),/REPOSITORY_LIMIT/);
 assert.throws(()=>parseMissionRepositories('MichaelWave369/RepoRider, michaelwave369/reporider'),/DUPLICATE_REPOSITORY/);
 assert.throws(()=>parseMissionRepositories('x/a,x/b,x/c,x/d,x/e,x/f'),/REPOSITORY_LIMIT/);
 assert.throws(()=>parseMissionRepositories('https://evil.com/path'),/REPOSITORY/);
});
test('cross repo scan reads only public endpoints and suppresses superseded failure',async()=>{
 const snapshot=await scanMissionRepositories([one,two,three],fake);
 assert.equal(snapshot.repositories.length,3);
 assert.equal(snapshot.authenticated,false);
 const summary=missionSummary(snapshot);
 assert.equal(summary[0].latestFailedOrTimedOut,0,'older failure superseded by success');
 assert.equal(summary[1].latestFailedOrTimedOut,1);
 assert.equal(summary[2].latestFailedOrTimedOut,1);
 const candidates=missionCandidates(snapshot);
 assert.equal(candidates.length,5,'2 CI investigations and 3 open issues');
 assert.equal(candidates.some(x=>x.key==='ci:'+one+':200'),false);
 const choices=['ci:'+two+':401','issue:'+three+':4'];
 const plan=importMissionCandidates(createPlan(),snapshot,choices);
 assert.equal(plan.nodes.length,2);
 assert.ok(plan.nodes.every(n=>n.risk==='REPO_WRITE'&&n.actionReview===null&&n.evidence===null));
 assert.ok(companyProjection(plan).nodes.every(n=>n.status==='ACTION_REVIEW_HELD'));
 assert.equal(companyProjection(plan).externalExecutionAttested,false);
 assert.equal(JSON.stringify(plan).includes('201'),false);
 assert.equal(JSON.stringify(plan).includes('200'),false);
});
test('partial network outage stays explicitly unavailable, not falsely healthy',async()=>{
 const partial=await scanMissionRepositories([one,two],async(url,opts)=>{
  if(url.includes(two)&&url.includes('/actions/runs?'))throw Error('simulated rate limit');
  return fake(url,opts);
 });
 const row=partial.repositories[1];
 assert.equal(row.issueStatus,'ok');assert.equal(row.healthStatus,'unavailable');
 assert.equal(row.health,null);
 assert.equal(missionSummary(partial)[1].workflowsSeen,null);
 assert.ok(missionCandidates(partial).some(x=>x.key==='issue:'+two+':9'));
 assert.ok(!missionCandidates(partial).some(x=>x.type==='CI_INVESTIGATION'&&x.repository===two));
});
test('selection cannot upgrade trust, use forged ids, or exceed capacity',async()=>{
 const snapshot=await scanMissionRepositories([one,two],fake);
 const keys=missionCandidates(snapshot).map(x=>x.key);
 assert.throws(()=>validateMissionSnapshot({...snapshot,executionAuthorityGranted:true}),/AUTHORITY/);
 assert.throws(()=>validateMissionSnapshot({...snapshot,shadow:true}),/FIELDS/);
 assert.throws(()=>validateMissionSnapshot({...snapshot,repositories:[
  {...snapshot.repositories[0],repository:'another/repo'},snapshot.repositories[1]]}),/ISSUE_SOURCE/);
 assert.throws(()=>importMissionCandidates(createPlan(),snapshot,['ci:'+one+':200']),/SELECTION_UNKNOWN/);
 assert.throws(()=>importMissionCandidates(createPlan(),snapshot,[keys[0],keys[0]]),/SELECTION_DUPLICATE/);
 let full=createPlan();
 for(let i=0;i<11;i++)full=addCompanyNode(full,{
  id:'n'+i,function:'task',output:'x',check:'y',dependsOn:[],risk:'NONE'
 });
 const before=JSON.stringify(full);
 assert.throws(()=>importMissionCandidates(full,snapshot,keys.slice(0,2)),/CAPACITY/);
 assert.equal(JSON.stringify(full),before);
});
test('repeat imports are rejected without partially changing stored plan',async()=>{
 const snapshot=await scanMissionRepositories([one,two],fake);
 const key='issue:'+one+':31';
 const plan=importMissionCandidates(createPlan(),snapshot,[key]);
 const before=JSON.stringify(plan);
 assert.throws(()=>importMissionCandidates(plan,snapshot,[key]),/ALREADY_IMPORTED/);
 assert.equal(JSON.stringify(plan),before);
});
