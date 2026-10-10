/* SPV-COMPANY-08: completion visibility without trust promotion.
 * Anti-M bundles are replayed locally on explicit import only.
 * Neither a Company review nor a validated Anti-M local journal attests deployment.
 */
import {inspectCompanyPlan,companyProjection} from './company-mode.mjs';
import {createPriorityReviewSet,priorityProjection} from './mission-priority.mjs';
import {importBundle,inspectBundle} from './anti-m.mjs';
export const COMPLETION_SCHEMA='superphivessel.company-completion-dashboard.v0.1';
const refuse=(ok,code)=>{if(!ok)throw Error('COMPLETION_'+code)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>refuse(obj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),'FIELDS');
const scope=node=>({id:node.id,function:node.function,output:node.output,check:node.check});
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const ADVICE={
 DEPENDENCY_BLOCKED:'Review predecessor tasks before advancing this work.',
 ACTION_REVIEW_HELD:'Record explicit human action review; this is not execution authorization.',
 READY_FOR_MANUAL_WORK:'Perform the work outside Vessie and capture a fresh observable check.',
 CHECK_FAILED:'Investigate the failed check and record new evidence; do not claim completion.',
 EVIDENCE_REVIEW_REQUIRED:'Have an operator explicitly accept or reject the recorded evidence.',
 CHECK_REJECTED:'Correct the result and record fresh evidence for another independent review.',
 LOCAL_REVIEW_ACCEPTED:'Locally accepted by the operator; verify external delivery separately.'
};
export async function inspectAntiMForCompany(plan,nodeId,json){
 inspectCompanyPlan(plan);
 const node=plan.nodes.find(x=>x.id===nodeId);
 refuse(!!node,'NODE_NOT_FOUND');
 refuse(typeof json==='string'&&new TextEncoder().encode(json).length<=131072,'SIZE');
 // Full Anti-M event journal is required. Closure receipt alone is NOT enough.
 const bundle=await importBundle(json);
 const state=await inspectBundle(bundle);
 refuse(state.contract!==null&&state.contract!==undefined,'CONTRACT');
 refuse(state.contract.title===node.function.trim()&&
  state.contract.deliverable===node.output.trim()&&
  state.contract.criteria.length===1&&
  state.contract.criteria[0].description===node.check.trim(),'SCOPE_MISMATCH');
 refuse(typeof state.tailHash==='string'&&/^[0-9a-f]{64}$/.test(state.tailHash),'HASH');
 return {
  schema:COMPLETION_SCHEMA,node:scope(node),contractId:state.contract.id,
  antiMStatus:state.status,ledgerTailSha256:state.tailHash,eventCount:state.eventCount,
  localHashChainInspected:true,
  provenance:'SELF_REPORTED_LOCAL_HASH_CHAIN',
  humanIdentityAuthenticated:false,externalExecutionAttested:false,
  authorityGranted:false,companyEvidenceTransferred:false
 };
}
export function validateCompletionLink(plan,link){
 inspectCompanyPlan(plan);
 exact(link,['schema','node','contractId','antiMStatus','ledgerTailSha256','eventCount',
  'localHashChainInspected','provenance','humanIdentityAuthenticated',
  'externalExecutionAttested','authorityGranted','companyEvidenceTransferred']);
 refuse(link.schema===COMPLETION_SCHEMA&&link.provenance==='SELF_REPORTED_LOCAL_HASH_CHAIN','SCHEMA');
 refuse(link.localHashChainInspected===true&&link.humanIdentityAuthenticated===false&&
  link.externalExecutionAttested===false&&link.authorityGranted===false&&
  link.companyEvidenceTransferred===false,'AUTHORITY');
 const node=plan.nodes.find(n=>n.id===link.node?.id);
 refuse(!!node&&same(link.node,scope(node)),'SCOPE_MISMATCH');
 exact(link.node,['id','function','output','check']);
 refuse(typeof link.contractId==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(link.contractId),'CONTRACT_ID');
 refuse(['EVIDENCE_PENDING','APPROVAL_HELD','READY_TO_CLOSE','VERIFIED_DONE_LOCAL'].includes(link.antiMStatus),'STATUS');
 refuse(typeof link.ledgerTailSha256==='string'&&/^[0-9a-f]{64}$/.test(link.ledgerTailSha256),'HASH');
 refuse(Number.isSafeInteger(link.eventCount)&&link.eventCount>=1&&link.eventCount<=110,'EVENT_COUNT');
 return link
}
export function completionDashboard(plan,prioritySet,links=[]){
 inspectCompanyPlan(plan);
 const priorities=priorityProjection(plan,prioritySet||createPriorityReviewSet(plan));
 refuse(Array.isArray(links)&&links.length<=12,'LINKS');
 const journalByNode=new Map();
 for(const link of links){
  validateCompletionLink(plan,link);
  refuse(!journalByNode.has(link.node.id),'DUPLICATE_LINK');
  journalByNode.set(link.node.id,link)
 }
 const statuses=companyProjection(plan);
 const rank=new Map(priorities.ranked.map((p,i)=>[p.id,{position:i+1,score:p.score}]));
 const rows=statuses.nodes.map((node,index)=>{
  const entry=rank.get(node.id),journal=journalByNode.get(node.id)||null;
  return {
   id:node.id,function:node.function,output:node.output,status:node.status,
   risk:node.risk,dependsOn:node.dependsOn,
   hasActionReview:node.actionReview!==null,
   evidenceResult:node.evidence?.result||null,
   evidenceReviewed:node.evidence?.review?.decision||null,
   evidenceReference:node.evidence?.reference||null,
   manualNextStep:ADVICE[node.status],
   priorityRank:entry?.position??null,priorityScore:entry?.score??null,
   triaged:priorities.reviewCount>0&&prioritySet?.reviews.some(r=>r.node.id===node.id)===true,
   antiMJournal:journal?{
    status:journal.antiMStatus,contractId:journal.contractId,
    tailHash:journal.ledgerTailSha256,eventCount:journal.eventCount,
    checkedAtImport:true,independentlyAttested:false
   }:null,
   index
  }
 }).sort((a,b)=>{
  const aClosed=a.status==='LOCAL_REVIEW_ACCEPTED',bClosed=b.status==='LOCAL_REVIEW_ACCEPTED';
  if(aClosed!==bClosed)return aClosed?1:-1;
  if(a.priorityRank!==null&&b.priorityRank!==null)return a.priorityRank-b.priorityRank;
  if(a.priorityRank!==null)return -1;
  if(b.priorityRank!==null)return 1;
  return a.index-b.index
 }).map(({index,...rest})=>rest);
 const counts=Object.fromEntries(Object.keys(ADVICE).map(k=>[k,statuses.nodes.filter(n=>n.status===k).length]));
 return {
  rows,counts,graphTotal:plan.nodes.length,locallyAccepted:statuses.accepted,
  withCompanyEvidence:plan.nodes.filter(n=>n.evidence!==null).length,
  antiMLedgersChecked:links.length,
  antiMLocallyClosed:links.filter(l=>l.antiMStatus==='VERIFIED_DONE_LOCAL').length,
  prioritized:priorities.ranked.length,unreviewedPriority:priorities.unranked.length,
  companyAllLocalReviewsAccepted:statuses.complete,
  separatelyAttestedExternalDone:false,
  executionAuthorityGranted:false,advisoryOnly:true,
  warning:'Company local review and Anti-M hash-chain closure are distinct self-reported operator states. Neither independently proves external execution.'
 }
}
