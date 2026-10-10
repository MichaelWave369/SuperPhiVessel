/* SPV-COMPANY-02: proposal-only transfer into a fresh Anti-M draft.
 * No evidence, approvals, permissions, completion, or execution authority transfer.
 */
import {inspectCompanyPlan,COMPANY_RISKS} from './company-mode.mjs';
export const ANTIM_PROPOSAL_SCHEMA='superphivessel.company-to-anti-m.proposal.v0.1';
const reject=(ok,code)=>{if(!ok)throw new Error('HANDOFF_'+code)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,want)=>reject(obj(x)&&Object.keys(x).sort().join('|')===want.slice().sort().join('|'),'FIELDS');
const nonempty=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x);
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(x);
export function validateAntiMProposal(p){
 keys(p,['schema','source','draft','provenance','evidenceTransferred','approvalTransferred','executionAuthorityGranted']);
 reject(p.schema===ANTIM_PROPOSAL_SCHEMA,'SCHEMA');
 keys(p.source,['company','founder','nodeId','dependencies','risk']);
 reject(nonempty(p.source.company,120)&&nonempty(p.source.founder,120)&&id(p.source.nodeId),'SOURCE');
 reject(Array.isArray(p.source.dependencies)&&p.source.dependencies.length<=8,'DEPENDENCIES');
 const d=new Set();
 for(const dep of p.source.dependencies){reject(id(dep)&&dep!==p.source.nodeId&&!d.has(dep),'DEPENDENCY');d.add(dep)}
 reject(COMPANY_RISKS.includes(p.source.risk),'RISK');
 keys(p.draft,['title','deliverable','criteria']);
 reject(nonempty(p.draft.title,120)&&nonempty(p.draft.deliverable,300),'DRAFT');
 reject(Array.isArray(p.draft.criteria)&&p.draft.criteria.length===1&&nonempty(p.draft.criteria[0],220),'CRITERIA');
 reject(p.provenance==='OPERATOR_ENTERED_UNATTESTED'&&p.evidenceTransferred===false&&
  p.approvalTransferred===false&&p.executionAuthorityGranted===false,'TRUST_BOUNDARY');
 reject(new TextEncoder().encode(JSON.stringify(p)).length<=4096,'SIZE');
 return p;
}
export function proposeAntiMFromCompany(plan,nodeId){
 inspectCompanyPlan(plan);
 reject(id(nodeId),'ID');
 const n=plan.nodes.find(x=>x.id===nodeId);
 reject(!!n,'NODE_NOT_FOUND');
 // Deliberately omit operator entered evidence, decision, review, and budget.
 const p={
  schema:ANTIM_PROPOSAL_SCHEMA,
  source:{company:plan.company.name,founder:plan.company.founder,
   nodeId:n.id,dependencies:[...n.dependsOn],risk:n.risk},
  draft:{title:n.function.trim(),deliverable:n.output.trim(),criteria:[n.check.trim()]},
  provenance:'OPERATOR_ENTERED_UNATTESTED',
  evidenceTransferred:false,approvalTransferred:false,executionAuthorityGranted:false
 };
 return validateAntiMProposal(p);
}
