/* Offline company graph planner. No runtime execution or permission grants. */
export const COMPANY_SCHEMA='superphivessel.company-graph.v0.1';
export const COMPANY_RISKS=['NONE','REPO_WRITE','DEPLOY','EXTERNAL_POST','SPEND','CREDENTIAL_USE','OTHER_EFFECT'];
export const COMPANY_METHODS=['CI_RUN','HUMAN_TEST','ARTIFACT_HASH','OTHER'];
const fail=(ok,code)=>{if(!ok)throw Error('COMPANY_'+code)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const shape=(x,keys)=>fail(object(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),'FIELDS');
const text=(x,n=240)=>fail(typeof x==='string'&&x.trim().length>0&&x.length<=n&&!/[\u0000-\u001f\u007f]/.test(x),'TEXT');
const id=x=>fail(typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(x),'ID');
export function inspectCompanyPlan(p){
 shape(p,['schema','company','nodes']);fail(p.schema===COMPANY_SCHEMA,'SCHEMA');
 shape(p.company,['name','founder','product','customer','weeklyGoal','budgetLimitUsd']);
 for(const k of ['name','founder','product','customer','weeklyGoal'])text(p.company[k],k==='weeklyGoal'?300:120);
 fail(Number.isSafeInteger(p.company.budgetLimitUsd)&&p.company.budgetLimitUsd>=0&&p.company.budgetLimitUsd<=1000000,'BUDGET');
 fail(Array.isArray(p.nodes)&&p.nodes.length<=12,'NODE_LIMIT');
 const seen=new Set();
 for(const n of p.nodes){
  shape(n,['id','function','output','check','dependsOn','risk','actionReview','evidence']);
  id(n.id);text(n.function,100);text(n.output);text(n.check);
  fail(!seen.has(n.id),'DUPLICATE_NODE');
  fail(Array.isArray(n.dependsOn)&&n.dependsOn.length<=8,'DEPENDENCIES');
  const deps=new Set();
  for(const d of n.dependsOn){id(d);fail(seen.has(d)&&!deps.has(d),'DEPENDENCY_ORDER');deps.add(d)}
  fail(COMPANY_RISKS.includes(n.risk),'RISK');
  if(n.actionReview!==null){fail(n.risk!=='NONE','UNNEEDED_ACTION_REVIEW');shape(n.actionReview,['reviewer']);text(n.actionReview.reviewer,80)}
  if(n.evidence!==null){
   shape(n.evidence,['result','method','reference','summary','review']);
   fail(['PASS','FAIL'].includes(n.evidence.result),'RESULT');
   fail(COMPANY_METHODS.includes(n.evidence.method),'METHOD');
   fail(typeof n.evidence.reference==='string'&&n.evidence.reference.length<=300&&/^(https:\/\/[^\s<>"'\u0000-\u001f]{4,292}|sha256:[0-9a-f]{64})$/.test(n.evidence.reference),'REFERENCE');
   text(n.evidence.summary);
   if(n.evidence.review!==null){
    shape(n.evidence.review,['reviewer','decision']);text(n.evidence.review.reviewer,80);
    fail(['ACCEPT','REJECT'].includes(n.evidence.review.decision),'DECISION');
    fail(n.evidence.result==='PASS'||n.evidence.review.decision==='REJECT','ACCEPT_FAILED')
   }
  }
  seen.add(n.id)
 }
 fail(new TextEncoder().encode(JSON.stringify(p)).length<=32768,'SIZE');
 return p
}
export function createCompanyPlan(company){return inspectCompanyPlan({schema:COMPANY_SCHEMA,company,nodes:[]})}
export function addCompanyNode(p,{id,function:fn,output,check,dependsOn=[],risk='NONE'}){
 inspectCompanyPlan(p);
 return inspectCompanyPlan({...p,nodes:[...p.nodes,{id,function:fn,output,check,dependsOn,risk,actionReview:null,evidence:null}]})
}
function edit(p,nodeId,transform){
 inspectCompanyPlan(p);id(nodeId);fail(p.nodes.some(n=>n.id===nodeId),'UNKNOWN_NODE');
 return inspectCompanyPlan({...p,nodes:p.nodes.map(n=>n.id===nodeId?transform(n):n)})
}
export function recordActionReview(p,nodeId,reviewer){
 text(reviewer,80);
 return edit(p,nodeId,n=>{fail(n.risk!=='NONE'&&n.actionReview===null,'ACTION_REVIEW_ORDER');return {...n,actionReview:{reviewer}}})
}
export function recordCompanyEvidence(p,nodeId,{result,method,reference,summary}){
 return edit(p,nodeId,n=>({...n,evidence:{result,method,reference,summary,review:null}}))
}
export function reviewCompanyEvidence(p,nodeId,reviewer,decision){
 text(reviewer,80);
 return edit(p,nodeId,n=>{fail(n.evidence!==null&&n.evidence.review===null,'EVIDENCE_REVIEW_ORDER');return {...n,evidence:{...n.evidence,review:{reviewer,decision}}}})
}
export function companyProjection(p){
 inspectCompanyPlan(p);
 const statuses=new Map();
 const nodes=p.nodes.map(n=>{
  let status;
  if(n.dependsOn.some(d=>statuses.get(d)!=='LOCAL_REVIEW_ACCEPTED'))status='DEPENDENCY_BLOCKED';
  else if(n.risk!=='NONE'&&!n.actionReview)status='ACTION_REVIEW_HELD';
  else if(!n.evidence)status='READY_FOR_MANUAL_WORK';
  else if(n.evidence.result==='FAIL')status='CHECK_FAILED';
  else if(!n.evidence.review)status='EVIDENCE_REVIEW_REQUIRED';
  else status=n.evidence.review.decision==='ACCEPT'?'LOCAL_REVIEW_ACCEPTED':'CHECK_REJECTED';
  statuses.set(n.id,status);return {...n,status}
 });
 return {nodes,complete:nodes.length>0&&nodes.every(n=>n.status==='LOCAL_REVIEW_ACCEPTED'),
  accepted:nodes.filter(n=>n.status==='LOCAL_REVIEW_ACCEPTED').length,
  ready:nodes.filter(n=>n.status==='READY_FOR_MANUAL_WORK').map(n=>n.id),
  provenance:'OPERATOR_ENTERED_UNATTESTED',executionAuthorityGranted:false,
  externalExecutionAttested:false,integrityProtected:false}
}
export function importCompanyPlan(json){
 fail(typeof json==='string'&&new TextEncoder().encode(json).length<=32768,'SIZE');
 let p;try{p=JSON.parse(json)}catch{throw Error('COMPANY_JSON')}
 return inspectCompanyPlan(p)
}
