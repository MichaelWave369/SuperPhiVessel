/* SPV-COMPANY-04: explicitly requested public GitHub issue discovery.
 * GET only, public data only, no auth, no approval transfer, no automatic writes.
 * Returned data remains untrusted planning context, not attested evidence.
 */
import {inspectCompanyPlan,addCompanyNode} from './company-mode.mjs';
export const GITHUB_ISSUES_PREVIEW='superphivessel.github-public-issues.v0.1';
const MAX_RESPONSE_BYTES=2097152;
const fail=(yes,code)=>{if(!yes)throw Error('GITHUB_ISSUES_'+code)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const token=/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|\bnpm_[A-Za-z0-9]{20,}\b/i;
function title(x){
 fail(typeof x==='string'&&x.trim().length>0&&x.length<=150&&!/[\u0000-\u001f\u007f]/.test(x),'TITLE');
 fail(!token.test(x),'SENSITIVE_TITLE');
 return x.trim()
}
export function parsePublicRepo(raw){
 fail(typeof raw==='string'&&raw.length>=3&&raw.length<=145,'REPOSITORY');
 const val=raw.trim();
 fail(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(val)&&
  !val.includes('..')&&!val.endsWith('.git'),'REPOSITORY');
 return val.toLowerCase()
}
export function publicIssueApiUrl(repo){
 return 'https://api.github.com/repos/'+parsePublicRepo(repo)+'/issues?state=open&per_page=20&page=1';
}
function itemFor(raw,repo){
 fail(object(raw)&&Number.isSafeInteger(raw.number)&&raw.number>=1&&raw.number<=2147483647,'NUMBER');
 fail(raw.state==='open','STATE');
 const issueUrl='https://github.com/'+repo+'/issues/'+raw.number;
 fail(typeof raw.html_url==='string'&&raw.html_url.toLowerCase()===issueUrl,'ISSUE_URL');
 return {number:raw.number,title:title(raw.title),url:issueUrl};
}
export function previewPublicIssues(raw,repo){
 const target=parsePublicRepo(repo);
 fail(typeof raw==='string'&&new TextEncoder().encode(raw).length<=MAX_RESPONSE_BYTES,'SIZE');
 let items;try{items=JSON.parse(raw)}catch{throw Error('GITHUB_ISSUES_JSON')}
 fail(Array.isArray(items)&&items.length<=20,'LIST');
 const output=[],seen=new Set();
 for(const entry of items){
  fail(object(entry),'ITEM');
  // GitHub's issues API includes pull requests. Exclude them, do not call these issues.
  if(Object.hasOwn(entry,'pull_request'))continue;
  const item=itemFor(entry,target);
  fail(!seen.has(item.number),'DUPLICATE_NUMBER');seen.add(item.number);
  output.push(item);
 }
 return {schema:GITHUB_ISSUES_PREVIEW,repository:target,issues:output,
  provenance:'UNAUTHENTICATED_PUBLIC_API_READ',
  authenticated:false,signatureVerified:false,sourceIdentityAuthenticated:false,
  approvalGranted:false,executionAuthorityGranted:false,evidenceTransferred:false};
}
export async function readPublicIssues(repo,requester=fetch){
 const url=publicIssueApiUrl(repo);
 const response=await requester(url,{
  method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
  headers:{Accept:'application/vnd.github+json'}
 });
 fail(response!==null&&typeof response==='object'&&typeof response.ok==='boolean','HTTP_RESPONSE');
 if(!response.ok)throw Error('GITHUB_ISSUES_HTTP_'+String(response.status));
 const headerLength=Number(response.headers?.get?.('content-length')||0);
 fail(!Number.isFinite(headerLength)||headerLength<=MAX_RESPONSE_BYTES,'SIZE');
 return previewPublicIssues(await response.text(),repo)
}
export function validatePublicIssuePreview(preview){
 fail(object(preview)&&Object.keys(preview).sort().join('|')===
  ['schema','repository','issues','provenance','authenticated','signatureVerified',
   'sourceIdentityAuthenticated','approvalGranted','executionAuthorityGranted','evidenceTransferred'].sort().join('|'),'PREVIEW_SHAPE');
 fail(preview.schema===GITHUB_ISSUES_PREVIEW&&preview.provenance==='UNAUTHENTICATED_PUBLIC_API_READ','PREVIEW_SOURCE');
 fail(preview.authenticated===false&&preview.signatureVerified===false&&
  preview.sourceIdentityAuthenticated===false&&preview.approvalGranted===false&&
  preview.executionAuthorityGranted===false&&preview.evidenceTransferred===false,'PREVIEW_AUTHORITY');
 const repo=parsePublicRepo(preview.repository);
 fail(repo===preview.repository&&Array.isArray(preview.issues)&&preview.issues.length<=20,'PREVIEW_ISSUES');
 const seen=new Set();
 for(const issue of preview.issues){
  fail(object(issue)&&Object.keys(issue).sort().join('|')==='number|title|url','PREVIEW_ITEM');
  fail(Number.isSafeInteger(issue.number)&&issue.number>=1&&issue.number<=2147483647,'NUMBER');
  const url='https://github.com/'+repo+'/issues/'+issue.number;
  fail(issue.url===url&&title(issue.title)===issue.title&&!seen.has(issue.number),'PREVIEW_ISSUE');
  seen.add(issue.number)
 }
 return preview
}
export function importPublicIssueTasks(plan,preview,numbers){
 inspectCompanyPlan(plan);validatePublicIssuePreview(preview);
 fail(Array.isArray(numbers)&&numbers.length>=1&&numbers.length<=12,'SELECTION');
 const wanted=new Set();
 for(const number of numbers){
  fail(Number.isSafeInteger(number)&&!wanted.has(number),'SELECTION_NUMBER');wanted.add(number);
 }
 const selected=preview.issues.filter(i=>wanted.has(i.number));
 fail(selected.length===wanted.size,'SELECTION_UNKNOWN');
 fail(plan.nodes.length+selected.length<=12,'CAPACITY');
 // Refuse duplicate visible issue links already in this plan.
 for(const issue of selected)fail(!plan.nodes.some(n=>n.check.includes(issue.url+' ')),'ALREADY_IMPORTED');
 let next=plan,index=1;
 for(const issue of selected){
  let id;
  do{id='gh'+index++}while(next.nodes.some(n=>n.id===id));
  next=addCompanyNode(next,{id,function:'GitHub issue follow-up',
   output:'#'+issue.number+' '+issue.title,
   check:'Verify '+issue.url+' with fresh passing CI or QA evidence',
   dependsOn:[],risk:'REPO_WRITE'});
 }
 return next
}
