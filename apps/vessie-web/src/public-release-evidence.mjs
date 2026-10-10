/* SPV-COMPANY-13 Public Release Evidence Desk
 * Operator-triggered public GETs only. Reconciles public Pages build manifest
 * with GitHub Actions metadata; source observations are NOT signed attestation.
 * No auto-scan, grant, execution, status promotion or workspace mutation.
 */
export const RELEASE_SCHEMA='superphivessel.public-release-evidence.v0.1';
const REPO='MichaelWave369/SuperPhiVessel';
const PAGES='https://michaelwave369.github.io/SuperPhiVessel/vessie/';
const API='https://api.github.com/repos/'+REPO;
const LIMIT=1048576;
const fail=(yes,why)=>{if(!yes)throw Error('RELEASE_EVIDENCE_'+why)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>fail(obj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),'FIELDS');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const posInt=x=>Number.isSafeInteger(x)&&x>0;
const date=x=>typeof x==='string'&&x.length<=40&&Number.isFinite(Date.parse(x));
const isGitUrl=(id,url)=>url==='https://github.com/'+REPO+'/actions/runs/'+id;
const frozenFlags={
 provenance:'UNAUTHENTICATED_PUBLIC_PAGES_AND_GITHUB_GET',
 signatureVerified:false,
 independentlyAttestedExternalDone:false,
 approvalGranted:false,
 executionAuthorityGranted:false,
 evidenceTransferred:false
};
export const publicReleaseUrls={
 pages:PAGES+'deploy-provenance.json',
 smokeRuns:API+'/actions/workflows/vessie-deployed-site-smoke.yml/runs?per_page=20'
};
function parseText(s){
 fail(typeof s==='string'&&new TextEncoder().encode(s).length<=LIMIT,'SIZE');
 try{return JSON.parse(s)}catch{throw Error('RELEASE_EVIDENCE_JSON')}
}
export function parsePublicPagesReceipt(s){
 const value=parseText(s);
 exact(value,['schema','repo','commitSha','workflowRunId','cockpitPath','provenance',
  'deployedBrowserVerified','independentlyAttestedExternalDone']);
 fail(value.schema==='superphivessel.pages-deploy-provenance.v0.1'&&
  value.repo===REPO&&value.cockpitPath==='/SuperPhiVessel/vessie/'&&
  value.provenance==='GITHUB_ACTIONS_REPORTED_BUILD_REVISION','PAGES_SCHEMA');
 fail(value.deployedBrowserVerified===false&&value.independentlyAttestedExternalDone===false,'AUTHORITY');
 fail(sha(value.commitSha)&&typeof value.workflowRunId==='string'&&/^[1-9]\d{0,18}$/.test(value.workflowRunId),'REVISION');
 return {sha:value.commitSha,runId:Number(value.workflowRunId)};
}
function githubRun(json,expectName){
 fail(obj(json)&&posInt(json.id)&&json.name===expectName&&
  json.head_repository?.full_name===REPO&&sha(json.head_sha)&&
  json.head_branch==='main'&&['queued','in_progress','completed','waiting','requested','pending'].includes(json.status)&&
  (json.conclusion===null||['success','failure','cancelled','timed_out','skipped','neutral','action_required'].includes(json.conclusion))&&
  (json.status!=='completed'||json.conclusion!==null)&&
  date(json.created_at)&&date(json.updated_at)&&isGitUrl(json.id,json.html_url),
  'GITHUB_RUN');
 return {
  id:json.id,sha:json.head_sha,status:json.status,conclusion:json.conclusion,
  createdAt:json.created_at,updatedAt:json.updated_at,url:json.html_url,event:json.event
 };
}
export function parsePublicPagesRun(s,receipt){
 const raw=parseText(s),run=githubRun(raw,'github-pages');
 fail(run.id===receipt.runId&&run.sha===receipt.sha&&run.event==='push','DEPLOY_MISMATCH');
 return run;
}
export function parsePublicSmokeRuns(s,receipt,pagesRun){
 const data=parseText(s);
 fail(obj(data)&&Number.isSafeInteger(data.total_count)&&data.total_count>=0&&
  Array.isArray(data.workflow_runs)&&data.workflow_runs.length<=20,'RUN_LIST');
 const matches=[];
 const seen=new Set();
 for(const raw of data.workflow_runs){
  // Ignore unrelated workflow results; never cherry-pick an old success
  // over a more recent failure for this deployed source revision.
  if(!obj(raw)||raw.name!=='vessie-deployed-site-smoke'||raw.event!=='workflow_run'||
    raw.head_sha!==receipt.sha)continue;
  const run=githubRun(raw,'vessie-deployed-site-smoke');
  fail(!seen.has(run.id),'DUPLICATE_SMOKE');seen.add(run.id);
  fail(run.event==='workflow_run','SMOKE_EVENT');
  if(Date.parse(run.createdAt)>=Date.parse(pagesRun.updatedAt))matches.push(run);
 }
 matches.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id-a.id);
 return {sampledCount:data.workflow_runs.length,reportedCount:data.total_count,latest:matches[0]||null};
}
export function releaseEvidenceProjection(receipt,pagesRun,smokeSample){
 fail(obj(receipt)&&obj(pagesRun)&&obj(smokeSample),'OBSERVATION');
 fail(sha(receipt.sha)&&posInt(receipt.runId)&&pagesRun.id===receipt.runId&&
  pagesRun.sha===receipt.sha&&pagesRun.event==='push'&&
  posInt(smokeSample.sampledCount+1)&&smokeSample.sampledCount<=20,'MISMATCH');
 const smoke=smokeSample.latest;
 const pagesSuccess=pagesRun.conclusion==='success';
 const smokeSuccess=smoke!==null&&smoke.conclusion==='success'&&smoke.sha===receipt.sha;
 const grade=!pagesSuccess?'PAGES_NOT_SUCCESS':
  smoke===null?'NO_MATCHING_SMOKE_IN_SAMPLE':
  !smokeSuccess?'SMOKE_NOT_SUCCESS':'PUBLIC_RELEASE_OBSERVED';
 const result={
  schema:RELEASE_SCHEMA,repository:REPO,revision:receipt.sha,
  pages:{id:pagesRun.id,conclusion:pagesRun.conclusion,url:pagesRun.url},
  smoke:smoke?{id:smoke.id,conclusion:smoke.conclusion,url:smoke.url}:null,
  sampledSmokeRuns:smokeSample.sampledCount,
  grade,
  publicSourcesAligned:grade==='PUBLIC_RELEASE_OBSERVED',
  exactWorkflowParentIndependentlyProven:false,
  ...frozenFlags
 };
 return validateReleaseEvidence(result);
}
export function validateReleaseEvidence(r){
 exact(r,['schema','repository','revision','pages','smoke','sampledSmokeRuns','grade',
  'publicSourcesAligned','exactWorkflowParentIndependentlyProven',
  ...Object.keys(frozenFlags)]);
 fail(r.schema===RELEASE_SCHEMA&&r.repository===REPO&&sha(r.revision),'SCHEMA');
 for(const [k,v] of Object.entries(frozenFlags))fail(r[k]===v,'AUTHORITY');
 fail(r.exactWorkflowParentIndependentlyProven===false,'PARENT');
 exact(r.pages,['id','conclusion','url']);
 fail(posInt(r.pages.id)&&isGitUrl(r.pages.id,r.pages.url)&&
  (r.pages.conclusion===null||['success','failure','cancelled','timed_out','skipped','neutral','action_required'].includes(r.pages.conclusion)),'PAGES');
 if(r.smoke!==null){
  exact(r.smoke,['id','conclusion','url']);
  fail(posInt(r.smoke.id)&&isGitUrl(r.smoke.id,r.smoke.url)&&
   (r.smoke.conclusion===null||['success','failure','cancelled','timed_out','skipped','neutral','action_required'].includes(r.smoke.conclusion)),'SMOKE');
 }
 fail(Number.isSafeInteger(r.sampledSmokeRuns)&&r.sampledSmokeRuns>=0&&r.sampledSmokeRuns<=20,'COUNT');
 const expected=r.pages.conclusion!=='success'?'PAGES_NOT_SUCCESS':
  r.smoke===null?'NO_MATCHING_SMOKE_IN_SAMPLE':
  r.smoke.conclusion!=='success'?'SMOKE_NOT_SUCCESS':'PUBLIC_RELEASE_OBSERVED';
 fail(r.grade===expected&&r.publicSourcesAligned===(expected==='PUBLIC_RELEASE_OBSERVED'),'GRADE');
 return r
}
async function fetchPublic(url,requester){
 const response=await requester(url,{
  method:'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',
  headers:{Accept:'application/json'}
 });
 fail(obj(response)&&typeof response.ok==='boolean','HTTP_RESPONSE');
 if(!response.ok)throw Error('RELEASE_EVIDENCE_HTTP_'+String(response.status));
 const length=response.headers?.get?.('content-length');
 if(length!=null)fail(Number.isSafeInteger(Number(length))&&Number(length)>=0&&Number(length)<=LIMIT,'SIZE');
 return response.text()
}
export async function readPublicReleaseEvidence(requester=fetch){
 const receipt=parsePublicPagesReceipt(await fetchPublic(publicReleaseUrls.pages,requester));
 const pagesUrl=API+'/actions/runs/'+receipt.runId;
 const [pagesText,smokeText]=await Promise.all([
  fetchPublic(pagesUrl,requester),fetchPublic(publicReleaseUrls.smokeRuns,requester)
 ]);
 const pagesRun=parsePublicPagesRun(pagesText,receipt);
 const smokeSample=parsePublicSmokeRuns(smokeText,receipt,pagesRun);
 return releaseEvidenceProjection(receipt,pagesRun,smokeSample)
}
export function releaseEvidenceSummary(snapshot){
 validateReleaseEvidence(snapshot);
 const s=snapshot.smoke;
 return 'PUBLIC RELEASE OBSERVATION ONLY (NOT EXTERNAL DONE)\n'+
  'Repository: '+snapshot.repository+'\nRevision: '+snapshot.revision+'\n'+
  'GitHub Pages: '+snapshot.pages.conclusion+' '+snapshot.pages.url+'\n'+
  'Browser smoke: '+(s?s.conclusion+' '+s.url:'Not found in first '+snapshot.sampledSmokeRuns+' sampled results')+'\n'+
  'Status: '+snapshot.grade+'\n'+
  'Source: operator-triggered public GET; no verified signature, no write permission, no execution, no Anti-M approval or evidence transfer.\n'+
  'Matching commit/time is not cryptographic proof of the smoke workflow parent.'
}
