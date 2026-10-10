/* SPV-COMPANY-07: deterministic, founder-reviewed PRIORITY ADVISORY.
 * Only human-entered assessments; no inferred business impact from API data.
 * Does not change Company node state, grant actions, or certify DONE.
 */
import {inspectCompanyPlan,companyProjection} from './company-mode.mjs';

export const PRIORITY_SCHEMA='superphivessel.company-priority-review.v0.1';
export const IMPACT=['HIGH','MEDIUM','LOW'];
export const URGENCY=['NOW','SOON','LATER'];
export const EFFORT=['SMALL','MEDIUM','LARGE'];
const fail=(ok,code)=>{if(!ok)throw Error('PRIORITY_'+code)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>fail(obj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),'FIELDS');
const text=(x,max)=>fail(typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x),'TEXT');
function companyContext(plan){
 const c=plan.company;
 return {name:c.name,founder:c.founder,product:c.product,customer:c.customer};
}
function nodeScope(node){
 return {id:node.id,function:node.function,output:node.output,
  check:node.check,dependsOn:[...node.dependsOn],risk:node.risk};
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createPriorityReviewSet(plan){
 inspectCompanyPlan(plan);
 return {schema:PRIORITY_SCHEMA,company:companyContext(plan),reviews:[],
  provenance:'OPERATOR_ENTERED_UNATTESTED',actionAuthorityGranted:false,
  evidenceTransferred:false,completionCertified:false};
}
export function validatePriorityReviewSet(plan,set){
 inspectCompanyPlan(plan);
 exact(set,['schema','company','reviews','provenance','actionAuthorityGranted',
  'evidenceTransferred','completionCertified']);
 fail(set.schema===PRIORITY_SCHEMA&&set.provenance==='OPERATOR_ENTERED_UNATTESTED','SCHEMA');
 fail(set.actionAuthorityGranted===false&&set.evidenceTransferred===false&&
  set.completionCertified===false,'AUTHORITY');
 exact(set.company,['name','founder','product','customer']);
 fail(equal(set.company,companyContext(plan)),'COMPANY_CHANGED');
 fail(Array.isArray(set.reviews)&&set.reviews.length<=12,'REVIEWS');
 const nodeMap=new Map(plan.nodes.map(n=>[n.id,n])),seen=new Set();
 for(const review of set.reviews){
  exact(review,['node','impact','urgency','effort','blocksRelease','rationale','reviewer']);
  exact(review.node,['id','function','output','check','dependsOn','risk']);
  const stored=nodeMap.get(review.node.id);
  fail(!!stored&&equal(review.node,nodeScope(stored)),'NODE_CHANGED');
  fail(!seen.has(review.node.id),'DUPLICATE_NODE');seen.add(review.node.id);
  fail(IMPACT.includes(review.impact)&&URGENCY.includes(review.urgency)&&
   EFFORT.includes(review.effort)&&typeof review.blocksRelease==='boolean','ASSESSMENT');
  text(review.reviewer,80);text(review.rationale,240)
 }
 fail(new TextEncoder().encode(JSON.stringify(set)).length<=32768,'SIZE');
 return set
}
export function recordPriorityReview(plan,set,nodeId,assessment){
 validatePriorityReviewSet(plan,set);
 const node=plan.nodes.find(n=>n.id===nodeId);
 fail(!!node,'NODE_NOT_FOUND');
 exact(assessment,['impact','urgency','effort','blocksRelease','rationale','reviewer']);
 const review={node:nodeScope(node),...assessment};
 const next={...set,reviews:[...set.reviews.filter(r=>r.node.id!==nodeId),review]};
 return validatePriorityReviewSet(plan,next)
}
export function clearPriorityReview(plan,set,nodeId){
 validatePriorityReviewSet(plan,set);
 fail(plan.nodes.some(n=>n.id===nodeId),'NODE_NOT_FOUND');
 return validatePriorityReviewSet(plan,{...set,reviews:set.reviews.filter(r=>r.node.id!==nodeId)})
}
export function importPriorityReviewSet(plan,json){
 fail(typeof json==='string'&&new TextEncoder().encode(json).length<=32768,'SIZE');
 let set;try{set=JSON.parse(json)}catch{throw Error('PRIORITY_JSON')}
 return validatePriorityReviewSet(plan,set)
}
const impactWeight={HIGH:3,MEDIUM:2,LOW:1};
const urgencyWeight={NOW:3,SOON:2,LATER:1};
const effortWeight={SMALL:3,MEDIUM:2,LARGE:1};
export function priorityScore(review){
 // score = impact*4 + urgency*3 + effort*1 + explicit blocks-release bonus 5
 return impactWeight[review.impact]*4+urgencyWeight[review.urgency]*3+
  effortWeight[review.effort]+(review.blocksRelease?5:0);
}
export function priorityProjection(plan,set){
 validatePriorityReviewSet(plan,set);
 const statusById=new Map(companyProjection(plan).nodes.map(n=>[n.id,n.status]));
 const indexed=plan.nodes.map((node,index)=>({node,index,
   review:set.reviews.find(r=>r.node.id===node.id)||null,
   status:statusById.get(node.id)}));
 const active=indexed.filter(x=>x.status!=='LOCAL_REVIEW_ACCEPTED');
 const ranked=active.filter(x=>x.review!==null).map(x=>({
   id:x.node.id,function:x.node.function,output:x.node.output,risk:x.node.risk,
   status:x.status,review:x.review,score:priorityScore(x.review),index:x.index
 })).sort((a,b)=>b.score-a.score||a.index-b.index);
 return {ranked:ranked.map(({index,...rest})=>rest),
  unranked:active.filter(x=>x.review===null).map(x=>({id:x.node.id,output:x.node.output,status:x.status})),
  locallyAccepted:indexed.filter(x=>x.status==='LOCAL_REVIEW_ACCEPTED').length,
  candidateCount:active.length,reviewCount:set.reviews.length,
  explanation:'impact×4 + urgency×3 + effort×1 + human-asserted release blocker×5',
  advisoryOnly:true,executionAuthorityGranted:false,externalCompletionAttested:false};
}
