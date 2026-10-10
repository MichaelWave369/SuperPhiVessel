/* SPV-COMPANY-05: public repository health snapshot. Browser GETs only.
 * Not CI verification, not deployment verification, not GitHub write authority.
 * Only the most recent sampled default-branch run PER workflow is selectable.
 */
import {parsePublicRepo} from './github-public-issues.mjs';
import {inspectCompanyPlan,addCompanyNode} from './company-mode.mjs';
export const HEALTH_SCHEMA='superphivessel.public-repo-health.v0.1';
const MAX_BYTES=2097152;
const PROVENANCE='UNAUTHENTICATED_PUBLIC_GITHUB_SNAPSHOT';
const flagKeys=['authenticated','signatureVerified','ciIndependentlyVerified','approvalGranted','executionAuthorityGranted','evidenceTransferred'];
const fail=(ok,why)=>{if(!ok)throw Error('REPO_HEALTH_'+why)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>fail(obj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),'FIELDS');
const safe=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x);
const token=/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|\bnpm_[A-Za-z0-9]{20,}\b/i;
const validBranch=x=>safe(x,100)&&/^[a-zA-Z0-9._/-]+$/.test(x)&&!x.startsWith('/')&&!x.endsWith('/')&&!x.includes('..')&&!x.includes('//');
const finiteId=x=>Number.isSafeInteger(x)&&x>0;
const ts=x=>safe(x,40)&&Number.isFinite(Date.parse(x));
const attention=x=>x==='failure'||x==='timed_out';
function decode(json,max=MAX_BYTES){
 fail(typeof json==='string'&&new TextEncoder().encode(json).length<=max,'SIZE');
 try{return JSON.parse(json)}catch{throw Error('REPO_HEALTH_JSON')}
}
export function publicRepositoryUrl(repo){
 return 'https://api.github.com/repos/'+parsePublicRepo(repo);
}
export function publicActionsUrl(repo,branch){
 fail(validBranch(branch),'BRANCH');
 return publicRepositoryUrl(repo)+'/actions/runs?branch='+encodeURIComponent(branch)+'&per_page=20&page=1';
}
export function parseRepositoryMetadata(json,requested){
 const repo=parsePublicRepo(requested),meta=decode(json);
 fail(obj(meta)&&meta.full_name?.toLowerCase()===repo,'METADATA_REPO');
 fail(meta.private===false&&!meta.archived,'PUBLIC_ONLY');
 fail(validBranch(meta.default_branch),'BRANCH');
 return {repository:repo,defaultBranch:meta.default_branch};
}
function mapRun(x,repo,branch){
 fail(obj(x)&&finiteId(x.id)&&finiteId(x.workflow_id)&&finiteId(x.run_attempt)&&
  safe(x.name,100)&&!token.test(x.name),'RUN');
 fail(x.head_branch===branch&&ts(x.created_at),'RUN_BRANCH');
 fail(['queued','in_progress','completed','waiting','requested','pending'].includes(x.status),'RUN_STATUS');
 fail(x.conclusion===null||['success','failure','timed_out','cancelled','action_required',
   'skipped','neutral','stale','startup_failure'].includes(x.conclusion),'RUN_CONCLUSION');
 fail(x.status!=='completed'||x.conclusion!==null,'RUN_CONCLUSION');
 const url='https://github.com/'+repo+'/actions/runs/'+x.id;
 fail(typeof x.html_url==='string'&&x.html_url.toLowerCase()===url,'RUN_URL');
 return {id:x.id,workflowId:x.workflow_id,name:x.name,attempt:x.run_attempt,
  status:x.status,conclusion:x.conclusion,createdAt:x.created_at,url};
}
export function previewHealthRuns(json,metadata){
 fail(obj(metadata)&&typeof metadata.repository==='string','METADATA');
 const repo=parsePublicRepo(metadata.repository),branch=metadata.defaultBranch;
 fail(validBranch(branch),'BRANCH');
 const data=decode(json);
 fail(obj(data)&&Number.isSafeInteger(data.total_count)&&data.total_count>=0&&
  Array.isArray(data.workflow_runs)&&data.workflow_runs.length<=20,'RUN_LIST');
 const seen=new Set(),sampled=[];
 for(const run of data.workflow_runs){
  // Query is restricted to the default branch; still enforce branch on each row.
  const item=mapRun(run,repo,branch);
  fail(!seen.has(item.id),'DUPLICATE_RUN');seen.add(item.id);
  sampled.push(item)
 }
 sampled.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||
  b.id-a.id||b.attempt-a.attempt);
 const workflows=[],workflowIds=new Set();
 for(const run of sampled)if(!workflowIds.has(run.workflowId)){
  workflowIds.add(run.workflowId);workflows.push(run);
 }
 const preview={schema:HEALTH_SCHEMA,repository:repo,defaultBranch:branch,
  totalRunsReported:data.total_count,sampledRuns:sampled.length,
  workflows,provenance:PROVENANCE,
  authenticated:false,signatureVerified:false,ciIndependentlyVerified:false,
  approvalGranted:false,executionAuthorityGranted:false,evidenceTransferred:false};
 return validateHealthPreview(preview);
}
export function validateHealthPreview(p){
 exact(p,['schema','repository','defaultBranch','totalRunsReported','sampledRuns',
  'workflows','provenance',...flagKeys]);
 fail(p.schema===HEALTH_SCHEMA&&p.provenance===PROVENANCE,'PROVENANCE');
 for(const key of flagKeys)fail(p[key]===false,'AUTHORITY');
 const repo=parsePublicRepo(p.repository);
 fail(repo===p.repository&&validBranch(p.defaultBranch),'SOURCE');
 fail(Number.isSafeInteger(p.totalRunsReported)&&p.totalRunsReported>=0&&
  Number.isSafeInteger(p.sampledRuns)&&p.sampledRuns>=0&&p.sampledRuns<=20&&
  Array.isArray(p.workflows)&&p.workflows.length<=p.sampledRuns,'COUNTS');
 const workflows=new Set(),runIds=new Set();
 for(const run of p.workflows){
  exact(run,['id','workflowId','name','attempt','status','conclusion','createdAt','url']);
  fail(finiteId(run.id)&&finiteId(run.workflowId)&&finiteId(run.attempt),'IDENTIFIER');
  fail(safe(run.name,100)&&!token.test(run.name)&&ts(run.createdAt),'RUN');
  fail(['queued','in_progress','completed','waiting','requested','pending'].includes(run.status),'RUN_STATUS');
  fail(run.conclusion===null||['success','failure','timed_out','cancelled','action_required',
   'skipped','neutral','stale','startup_failure'].includes(run.conclusion),'RUN_CONCLUSION');
  fail(run.status!=='completed'||run.conclusion!==null,'RUN_CONCLUSION');
  fail(run.url==='https://github.com/'+repo+'/actions/runs/'+run.id,'RUN_URL');
  fail(!workflows.has(run.workflowId)&&!runIds.has(run.id),'DUPLICATE_WORKFLOW');
  workflows.add(run.workflowId);runIds.add(run.id)
 }
 return p
}
async function getText(requester,url){
 const response=await requester(url,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',
  cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
 fail(obj(response)&&typeof response.ok==='boolean','HTTP_RESPONSE');
 if(!response.ok)throw Error('REPO_HEALTH_HTTP_'+String(response.status));
 const lengthHeader=response.headers?.get?.('content-length');
 const length=lengthHeader==null?null:Number(lengthHeader);
 fail(length===null||(Number.isSafeInteger(length)&&length>=0&&length<=MAX_BYTES),'SIZE');
 return response.text()
}
export async function readPublicRepositoryHealth(repo,requester=fetch){
 const requested=parsePublicRepo(repo);
 const metadata=parseRepositoryMetadata(await getText(requester,publicRepositoryUrl(requested)),requested);
 return previewHealthRuns(await getText(requester,publicActionsUrl(requested,metadata.defaultBranch)),metadata)
}
export function importHealthInvestigations(plan,preview,ids){
 inspectCompanyPlan(plan);validateHealthPreview(preview);
 fail(Array.isArray(ids)&&ids.length>0&&ids.length<=12,'SELECTION');
 const wanted=new Set();
 for(const id of ids){fail(finiteId(id)&&!wanted.has(id),'SELECTION_ID');wanted.add(id)}
 const selected=preview.workflows.filter(w=>wanted.has(w.id)&&w.status==='completed'&&attention(w.conclusion));
 fail(selected.length===wanted.size,'SELECTION_NOT_FAILED');
 fail(plan.nodes.length+selected.length<=12,'CAPACITY');
 for(const run of selected){
  fail(!plan.nodes.some(n=>n.check.includes(run.url+' ')),'ALREADY_IMPORTED')
 }
 let out=plan,index=1;
 for(const run of selected){
  let id;do{id='ci'+index++}while(out.nodes.some(n=>n.id===id));
  out=addCompanyNode(out,{id,function:'Investigate CI workflow',
   output:'Investigate '+run.conclusion+' run: '+run.name,
   check:'Inspect '+run.url+' and collect NEW passing CI + manual QA evidence',
   dependsOn:[],risk:'REPO_WRITE'});
 }
 return out
}
