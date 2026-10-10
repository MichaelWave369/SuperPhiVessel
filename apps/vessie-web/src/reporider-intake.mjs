/* SPV-COMPANY-03: manual, offline intake of RepoRider's MOCK typed ride receipt.
 * Source bytes are untrusted; this is not a receipt signature or GitHub API.
 * Never transfer any claimed approval, verification, completion or authority.
 */
import {inspectCompanyPlan,addCompanyNode} from './company-mode.mjs';
export const REPORIDER_INTAKE_SOURCE='reporider.ride-receipt.v1';
const fail=(ok,code)=>{if(!ok)throw Error('REPORIDER_INTAKE_'+code)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max&&!/[\u0000-\u001f\u007f]/.test(s);
function safeTitle(value){
 fail(text(value,180),'ISSUE_TITLE');
 fail(!/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|\bnpm_[A-Za-z0-9]{20,}\b)/i.test(value),'SENSITIVE_TITLE');
 return value.trim()
}
export function previewRepoRiderIntake(raw){
 fail(typeof raw==='string'&&new TextEncoder().encode(raw).length<=262144,'SIZE');
 let input;try{input=JSON.parse(raw)}catch{throw Error('REPORIDER_INTAKE_JSON')}
 fail(object(input)&&input.format===REPORIDER_INTAKE_SOURCE,'FORMAT');
 fail(object(input.boundary)&&input.boundary.mode==='mock','MOCK_BOUNDARY');
 fail(object(input.ride)&&input.ride.mode==='mock','MOCK_RIDE');
 fail(object(input.safetyPolicy)&&input.safetyPolicy.blockerCount===0&&
  ['pass','needs-review'].includes(input.safetyPolicy.status),'SAFETY');
 fail(Array.isArray(input.queuedIssues)&&input.queuedIssues.length>=1&&input.queuedIssues.length<=12,'ISSUES');
 fail(Array.isArray(input.queuedFiles)&&input.queuedFiles.length<=24,'FILES');
 for(const f of input.queuedFiles)fail(object(f)&&text(f.path,160),'FILE_PATH');
 fail(text(input.ride.repositoryUrl,300)&&
  /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/.test(input.ride.repositoryUrl),'REPOSITORY_URL');
 const titles=[],seen=new Set();
 for(const issue of input.queuedIssues){
  fail(object(issue)&&Object.keys(issue).length===1&&Object.hasOwn(issue,'title'),'ISSUE_SHAPE');
  const title=safeTitle(issue.title);
  fail(!seen.has(title.toLowerCase()),'DUPLICATE_ISSUE');
  seen.add(title.toLowerCase());titles.push(title);
 }
 return {
  source:REPORIDER_INTAKE_SOURCE,
  repositoryUrl:input.ride.repositoryUrl,
  titles,
  queuedFileCount:input.queuedFiles.length,
  safetyStatus:input.safetyPolicy.status,
  sourceProvenance:'SELF_REPORTED_MOCK_EXPORT',
  authenticated:false,signatureVerified:false,repositoryCreated:false,
  actionAuthorized:false,approvalsTransferred:false,evidenceTransferred:false,
 };
}
export function applyRepoRiderIntake(plan,preview){
 inspectCompanyPlan(plan);
 fail(object(preview)&&Object.keys(preview).sort().join('|')===
  ['source','repositoryUrl','titles','queuedFileCount','safetyStatus','sourceProvenance',
   'authenticated','signatureVerified','repositoryCreated','actionAuthorized',
   'approvalsTransferred','evidenceTransferred'].sort().join('|'),'PREVIEW_SHAPE');
 fail(preview.source===REPORIDER_INTAKE_SOURCE&&preview.sourceProvenance==='SELF_REPORTED_MOCK_EXPORT','PREVIEW_SOURCE');
 fail(preview.authenticated===false&&preview.signatureVerified===false&&
  preview.repositoryCreated===false&&preview.actionAuthorized===false&&
  preview.approvalsTransferred===false&&preview.evidenceTransferred===false,'PREVIEW_AUTHORITY');
 fail(text(preview.repositoryUrl,300)&&
  /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/.test(preview.repositoryUrl),'PREVIEW_URL');
 fail(['pass','needs-review'].includes(preview.safetyStatus)&&
  Number.isInteger(preview.queuedFileCount)&&preview.queuedFileCount>=0&&preview.queuedFileCount<=24,'PREVIEW_META');
 fail(Array.isArray(preview.titles)&&preview.titles.length>0&&preview.titles.length<=12,'PREVIEW_ISSUES');
 const seen=new Set();
 for(const title of preview.titles){
  safeTitle(title);fail(!seen.has(title.toLowerCase()),'PREVIEW_DUPLICATE');seen.add(title.toLowerCase());
 }
 fail(plan.nodes.length+preview.titles.length<=12,'CAPACITY');
 let updated=plan,index=1;
 for(const title of preview.titles){
  let id;
  do{id='rr'+index++;}while(updated.nodes.some(n=>n.id===id));
  updated=addCompanyNode(updated,{
   id,function:'RepoRider proposed task',output:title,
   check:'Inspect an implementation artifact and a passing test or manual smoke-test record',
   dependsOn:[],risk:'REPO_WRITE'
  });
 }
 return updated;
}
