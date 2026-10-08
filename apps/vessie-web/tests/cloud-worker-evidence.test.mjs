import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  CLOUD_API, CLOUD_REPO, loadCloudObservation, makeBrainCShadowCandidate,
} from '../src/cloud-worker-evidence.mjs';

const NOW=Date.parse('2026-10-08T21:20:00Z');
const COMMIT='c'.repeat(40);
const PREFIX='8e81ffe';
const RUN='37844903712';
function fixture() {
  const status={
    schema:'fielddeck.cloud-observation.v1',
    receipt_kind:'observation_not_authorization',
    run_at:'2026-10-08T21:10:46+00:00',run_id:RUN,trigger:'push',
    sha:PREFIX,run_url:'https://github.com/'+CLOUD_REPO+'/actions/runs/'+RUN,
    overall:'ok',
    results:[
      {task:'heartbeat',kind:'observation',status:'ok',duration_s:0,output:{signal:'alive'}},
      {task:'repo_layout',kind:'observation',status:'ok',duration_s:0,output:{required_files:3,present_files:3}},
      {task:'github_repo_metrics',kind:'observation',status:'ok',duration_s:0.394,
       output:{repository:CLOUD_REPO,stars:0,open_issues_and_prs:0}}
    ]
  };
  const history=[{
    schema:'fielddeck.cloud-history.v1',run_id:RUN,run_at:status.run_at,
    overall:'ok',ok_count:3,error_count:0
  }];
  const run={
    id:Number(RUN),name:'FieldCloudWorker Observation Pilot',
    repository:{full_name:CLOUD_REPO},path:'.github/workflows/worker.yml',
    event:'push',head_branch:'main',head_sha:PREFIX+'0'.repeat(33),
    status:'completed',conclusion:'success',html_url:status.run_url,
    created_at:'2026-10-08T21:10:38Z',updated_at:'2026-10-08T21:16:19Z'
  };
  return {status,history,run};
}
function gitFile(path,data) {
  const bytes=Buffer.from(data);
  const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  return {type:'file',path,name:path.split('/').at(-1),size:bytes.length,
    encoding:'base64',sha,content:bytes.toString('base64')};
}
function getFake(sample=fixture(),opts={}) {
  const calls=[];
  const routes=new Map([
    [CLOUD_API+'/branches/main',{name:'main',commit:{sha:COMMIT}}],
    [CLOUD_API+'/contents/docs/status.json?ref='+COMMIT,gitFile('docs/status.json',JSON.stringify(sample.status))],
    [CLOUD_API+'/contents/docs/history.jsonl?ref='+COMMIT,
      gitFile('docs/history.jsonl',sample.history.map(x=>JSON.stringify(x)+'\n').join(''))],
    [CLOUD_API+'/actions/runs/'+RUN,sample.run],
  ]);
  if(opts.badStatusBlob) routes.get(CLOUD_API+'/contents/docs/status.json?ref='+COMMIT).sha='f'.repeat(40);
  if(opts.badSource) routes.get(CLOUD_API+'/contents/docs/history.jsonl?ref='+COMMIT).path='docs/sneaky.jsonl';
  const get=async(url,options)=>{
    calls.push({url,options});
    if(!routes.has(url)) throw Error('UNAPPROVED_FETCH');
    return {ok:true,text:async()=>JSON.stringify(routes.get(url))};
  };
  return {get,calls};
}

test('exact four read-only GitHub GETs and metadata-only output',async()=>{
 const f=getFake();
 const o=await loadCloudObservation(f.get,NOW);
 assert.equal(f.calls.length,4);
 assert.ok(f.calls.every(c=>c.options.method==='GET' && c.options.redirect==='error'));
 assert.equal(o.disposition,'UNVERIFIED_PUBLIC_OBSERVATION');
 assert.equal(o.tasks.length,3);
 assert.equal(o.github_run_metadata_correlated,true);
 assert.equal(o.authority_granted,false);
 assert.equal(o.memory_admitted,false);
 assert.equal(o.routing_influence,'NONE');
 assert.ok(!JSON.stringify(o).includes('stars'));
 assert.ok(!JSON.stringify(o).includes('alive'));
});
test('shadow candidate cannot promote model execution, prompts or memory',async()=>{
 const f=getFake();
 const o=await loadCloudObservation(f.get,NOW);
 const packet=makeBrainCShadowCandidate(o);
 assert.equal(packet.integration_status,'UNWIRED_REVIEW_CANDIDATE');
 assert.equal(packet.prompt_admitted,false);
 assert.equal(packet.memory_admitted,false);
 assert.equal(packet.routing_influence,'NONE');
 assert.equal(packet.authority_granted,false);
 assert.equal(packet.action_executed,false);
 assert.ok(!JSON.stringify(packet).includes('stars'));
});
test('wrong Git blob and forged resource identity fail closed',async()=>{
 await assert.rejects(()=>loadCloudObservation(getFake(fixture(),{badStatusBlob:true}).get,NOW),/GIT_BLOB_MISMATCH/);
 await assert.rejects(()=>loadCloudObservation(getFake(fixture(),{badSource:true}).get,NOW),/FILE_IDENTITY/);
});
test('injected output fields and unlisted tasks refuse',async()=>{
 const a=fixture(); a.status.results[0].output.secret='KEEP_PRIVATE';
 await assert.rejects(()=>loadCloudObservation(getFake(a).get,NOW),/HEARTBEAT/);
 const b=fixture(); b.status.results[1].task='system_command';
 await assert.rejects(()=>loadCloudObservation(getFake(b).get,NOW),/UNKNOWN_TASK/);
});
test('forged commit, repo, and workflow are rejected',async()=>{
 for(const change of [
   r=>r.run.head_sha='f'.repeat(40),
   r=>r.run.repository.full_name='someone/else',
   r=>r.run.path='.github/workflows/evil.yml'
 ]) {
   const f=fixture();change(f);
   await assert.rejects(()=>loadCloudObservation(getFake(f).get,NOW));
 }
});
test('stale observations never become current green',async()=>{
 const o=await loadCloudObservation(getFake().get,NOW+9*60*60*1000);
 assert.equal(o.disposition,'STALE_OBSERVATION');
});
test('a task failure is not hidden by other passing tasks',async()=>{
 const f=fixture();
 f.status.overall='error';
 f.status.results[0]={task:'heartbeat',kind:'observation',status:'error',duration_s:0.1,error_code:'RuntimeError'};
 f.history[0].overall='error';f.history[0].ok_count=2;f.history[0].error_count=1;
 f.run.conclusion='failure';
 const o=await loadCloudObservation(getFake(f).get,NOW);
 assert.equal(o.disposition,'TASK_FAILURE_OBSERVED');
 assert.equal(o.tasks.find(x=>x.task==='heartbeat').status,'error');
});
test('contradictory status/history and claimed run outcome are rejected',async()=>{
 const a=fixture();a.history[0].ok_count=1;
 await assert.rejects(()=>loadCloudObservation(getFake(a).get,NOW),/HISTORY_COUNTS/);
 const b=fixture();b.run.conclusion='failure';
 await assert.rejects(()=>loadCloudObservation(getFake(b).get,NOW),/RUN_CONCLUSION/);
});
test('future dated run and absent branch identity are rejected',async()=>{
 await assert.rejects(()=>loadCloudObservation(getFake().get,NOW-60*60*1000),/OBSERVATION_TIME/);
 const f=getFake(); const orig=f.get;
 const fake=async(url,options)=>{
   if(url===CLOUD_API+'/branches/main')return {ok:true,text:async()=>JSON.stringify({name:'other',commit:{sha:COMMIT}})};
   return orig(url,options);
 };
 await assert.rejects(()=>loadCloudObservation(fake,NOW),/BRANCH_SHA/);
});
test('untrusted arbitrary input cannot create shadow packets',()=>{
 assert.throws(()=>makeBrainCShadowCandidate({authority_granted:true}),/BRAINC_INPUT/);
});
