/* SPV-COMPANY-06: an opt-in public GitHub portfolio snapshot.
 * Pure selectors plus bounded, credential-free GETs. No grants, uploads or writes.
 */
import {parsePublicRepo,readPublicIssues,validatePublicIssuePreview,importPublicIssueTasks} from './github-public-issues.mjs';
import {readPublicRepositoryHealth,validateHealthPreview,importHealthInvestigations} from './github-repo-health.mjs';
import {inspectCompanyPlan} from './company-mode.mjs';
export const MISSION_SCHEMA='superphivessel.public-mission-control.v0.1';
const fail=(yes,why)=>{if(!yes)throw Error('MISSION_'+why)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>fail(obj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),'FIELDS');
const sourceFlags=['authenticated','executionAuthorityGranted','approvalTransferred','evidenceTransferred','externalExecutionAttested'];
const statusValues=['ok','unavailable'];
export function parseMissionRepositories(raw){
 fail(typeof raw==='string'&&raw.length<=800,'INPUT');
 const items=raw.split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
 fail(items.length>=1&&items.length<=5,'REPOSITORY_LIMIT');
 const repos=items.map(parsePublicRepo);
 fail(new Set(repos).size===repos.length,'DUPLICATE_REPOSITORY');
 return repos
}
export function validateMissionSnapshot(snapshot){
 exact(snapshot,['schema','repositories','provenance',...sourceFlags]);
 fail(snapshot.schema===MISSION_SCHEMA&&snapshot.provenance==='UNAUTHENTICATED_PUBLIC_GITHUB_SNAPSHOT','PROVENANCE');
 for(const field of sourceFlags)fail(snapshot[field]===false,'AUTHORITY');
 fail(Array.isArray(snapshot.repositories)&&snapshot.repositories.length>=1&&snapshot.repositories.length<=5,'REPOSITORIES');
 const seen=new Set();
 for(const entry of snapshot.repositories){
  exact(entry,['repository','issues','health','issueStatus','healthStatus']);
  const repository=parsePublicRepo(entry.repository);
  fail(repository===entry.repository&&!seen.has(repository),'REPOSITORY');seen.add(repository);
  fail(statusValues.includes(entry.issueStatus)&&statusValues.includes(entry.healthStatus),'STATUS');
  fail((entry.issueStatus==='ok')===(entry.issues!==null),'ISSUE_STATUS');
  fail((entry.healthStatus==='ok')===(entry.health!==null),'HEALTH_STATUS');
  if(entry.issues!==null){
   validatePublicIssuePreview(entry.issues);
   fail(entry.issues.repository===repository,'ISSUE_SOURCE');
  }
  if(entry.health!==null){
   validateHealthPreview(entry.health);
   fail(entry.health.repository===repository,'HEALTH_SOURCE');
  }
 }
 return snapshot
}
export async function scanMissionRepositories(repos,requester=fetch){
 fail(Array.isArray(repos)&&repos.length>=1&&repos.length<=5,'REPOSITORY_LIMIT');
 const normalized=repos.map(parsePublicRepo);
 fail(new Set(normalized).size===normalized.length,'DUPLICATE_REPOSITORY');
 const entries=new Array(normalized.length);
 // Two workers limit simultaneous traffic, keeping it user-triggered and budgeted.
 let next=0;
 async function worker(){
  while(next<normalized.length){
   const index=next++;
   const repository=normalized[index];
   const [issues,health]=await Promise.allSettled([
    readPublicIssues(repository,requester),
    readPublicRepositoryHealth(repository,requester)
   ]);
   entries[index]={
    repository,
    issues:issues.status==='fulfilled'?issues.value:null,
    health:health.status==='fulfilled'?health.value:null,
    issueStatus:issues.status==='fulfilled'?'ok':'unavailable',
    healthStatus:health.status==='fulfilled'?'ok':'unavailable'
   };
  }
 }
 await Promise.all([worker(),worker()]);
 return validateMissionSnapshot({
  schema:MISSION_SCHEMA,repositories:entries,
  provenance:'UNAUTHENTICATED_PUBLIC_GITHUB_SNAPSHOT',
  authenticated:false,executionAuthorityGranted:false,
  approvalTransferred:false,evidenceTransferred:false,externalExecutionAttested:false
 })
}
export function missionCandidates(snapshot){
 validateMissionSnapshot(snapshot);
 const records=[];
 for(const entry of snapshot.repositories){
  if(entry.health)for(const run of entry.health.workflows){
   if(run.status==='completed'&&(run.conclusion==='failure'||run.conclusion==='timed_out')){
    records.push({
     key:'ci:'+entry.repository+':'+run.id,
     repository:entry.repository,type:'CI_INVESTIGATION',
     number:run.id,title:run.name,sourceUrl:run.url,
     description:'Latest sampled '+run.conclusion+' workflow run; investigation only'
    });
   }
  }
  if(entry.issues)for(const issue of entry.issues.issues){
   records.push({
    key:'issue:'+entry.repository+':'+issue.number,
    repository:entry.repository,type:'OPEN_ISSUE',
    number:issue.number,title:issue.title,sourceUrl:issue.url,
    description:'Open issue observed in first public API page'
   });
  }
 }
 return records
}
export function missionSummary(snapshot){
 validateMissionSnapshot(snapshot);
 return snapshot.repositories.map(entry=>{
  const runs=entry.health?.workflows||[];
  return {repository:entry.repository,
   issueStatus:entry.issueStatus,healthStatus:entry.healthStatus,
   openIssuesSeen:entry.issues?.issues.length??null,
   workflowsSeen:entry.health?.workflows.length??null,
   latestFailedOrTimedOut:runs.filter(x=>x.status==='completed'&&(x.conclusion==='failure'||x.conclusion==='timed_out')).length,
   latestInProgress:runs.filter(x=>x.status!=='completed').length,
   latestSuccess:runs.filter(x=>x.status==='completed'&&x.conclusion==='success').length,
   coverage:'FIRST_PAGE_SNAPSHOT_NOT_EXHAUSTIVE',
  }
 })
}
export function importMissionCandidates(plan,snapshot,keys){
 inspectCompanyPlan(plan);validateMissionSnapshot(snapshot);
 fail(Array.isArray(keys)&&keys.length>=1&&keys.length<=12,'SELECTION');
 fail(keys.every(k=>typeof k==='string'&&k.length<=190)&&new Set(keys).size===keys.length,'SELECTION_DUPLICATE');
 const available=missionCandidates(snapshot),byKey=new Map(available.map(x=>[x.key,x]));
 fail(keys.every(k=>byKey.has(k)),'SELECTION_UNKNOWN');
 fail(plan.nodes.length+keys.length<=12,'CAPACITY');
 let result=plan;
 for(const entry of snapshot.repositories){
  const issueNumbers=[],ciRunIds=[];
  for(const key of keys){
   const item=byKey.get(key);
   if(item.repository!==entry.repository)continue;
   if(item.type==='OPEN_ISSUE')issueNumbers.push(item.number);
   else ciRunIds.push(item.number);
  }
  if(issueNumbers.length)result=importPublicIssueTasks(result,entry.issues,issueNumbers);
  if(ciRunIds.length)result=importHealthInvestigations(result,entry.health,ciRunIds);
 }
 return result
}
