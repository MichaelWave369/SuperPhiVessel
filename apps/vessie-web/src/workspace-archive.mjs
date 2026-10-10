/* SPV-COMPANY-09: Portable completion archive.
 * Voluntary local file export/import. No cloud upload, database or auto-save.
 * SHA-256 checks accidental edits; it is NOT a signature or origin attestation.
 * Every included Anti-M journal is replayed through the canonical inspector.
 */
import {inspectCompanyPlan} from './company-mode.mjs';
import {createPriorityReviewSet,validatePriorityReviewSet} from './mission-priority.mjs';
import {inspectAntiMForCompany} from './completion-dashboard.mjs';

export const WORKSPACE_ARCHIVE_SCHEMA='superphivessel.company-workspace-archive.v0.1';
const MAX_ARCHIVE_BYTES=1800000;
const MAX_JOURNALS=12;
const fail=(condition,code)=>{if(!condition)throw Error('WORKSPACE_ARCHIVE_'+code)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,fields)=>fail(object(x)&&Object.keys(x).sort().join('|')===fields.slice().sort().join('|'),'FIELDS');
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(object(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
async function digest(value){
 fail(typeof globalThis.crypto?.subtle?.digest==='function','CRYPTO_UNAVAILABLE');
 const bytes=new TextEncoder().encode('SPV_COMPANY_ARCHIVE_V0_1\n'+canonical(value));
 const result=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(result)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function validateParts(plan,priorities,sources){
 inspectCompanyPlan(plan);
 if(priorities===null)priorities=createPriorityReviewSet(plan);
 validatePriorityReviewSet(plan,priorities);
 fail(Array.isArray(sources)&&sources.length<=MAX_JOURNALS,'JOURNAL_LIMIT');
 const seen=new Set(),links=[],journals=[];
 for(const item of sources){
  exact(item,['nodeId','bundle']);
  fail(typeof item.nodeId==='string'&&!seen.has(item.nodeId),'DUPLICATE_NODE');
  seen.add(item.nodeId);
  const raw=JSON.stringify(item.bundle);
  fail(typeof raw==='string'&&new TextEncoder().encode(raw).length<=131072,'JOURNAL_SIZE');
  const link=await inspectAntiMForCompany(plan,item.nodeId,raw);
  journals.push({nodeId:item.nodeId,bundle:item.bundle});
  links.push(link);
 }
 return {plan,priorities,journals,links}
}
export async function createWorkspaceArchive(plan,priorities,journalSources,now=new Date().toISOString()){
 fail(typeof now==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(now)&&
  Number.isFinite(Date.parse(now)),'TIME');
 fail(Array.isArray(journalSources)&&journalSources.length<=MAX_JOURNALS,'JOURNAL_LIMIT');
 const sources=journalSources.map(item=>{
  exact(item,['nodeId','ledger']);
  fail(typeof item.ledger==='string'&&
   new TextEncoder().encode(item.ledger).length<=131072,'JOURNAL_SIZE');
  let bundle;try{bundle=JSON.parse(item.ledger)}catch{throw Error('WORKSPACE_ARCHIVE_JOURNAL_JSON')}
  return {nodeId:item.nodeId,bundle}
 });
 const checked=await validateParts(plan,priorities,sources);
 const payload={
  plan:checked.plan,priorityReviews:checked.priorities,
  antiMJournals:checked.journals
 };
 const archive={
  schema:WORKSPACE_ARCHIVE_SCHEMA,exportedAt:now,payload,
  integrity:{method:'SHA-256-LOCAL_CONSISTENCY_NOT_SIGNATURE',sha256:await digest(payload)},
  provenance:'OPERATOR_EXPORTED_EDITABLE_LOCAL_FILE',
  operatorIdentityAuthenticated:false,
  externalExecutionAttested:false,
  executionAuthorityGranted:false,
  completionPromoted:false,
  automaticSyncEnabled:false
 };
 fail(new TextEncoder().encode(JSON.stringify(archive)).length<=MAX_ARCHIVE_BYTES,'SIZE');
 return archive
}
export async function importWorkspaceArchive(raw){
 fail(typeof raw==='string'&&new TextEncoder().encode(raw).length<=MAX_ARCHIVE_BYTES,'SIZE');
 let archive;try{archive=JSON.parse(raw)}catch{throw Error('WORKSPACE_ARCHIVE_JSON')}
 exact(archive,['schema','exportedAt','payload','integrity','provenance',
  'operatorIdentityAuthenticated','externalExecutionAttested',
  'executionAuthorityGranted','completionPromoted','automaticSyncEnabled']);
 fail(archive.schema===WORKSPACE_ARCHIVE_SCHEMA&&
  archive.provenance==='OPERATOR_EXPORTED_EDITABLE_LOCAL_FILE','SCHEMA');
 fail(archive.operatorIdentityAuthenticated===false&&
  archive.externalExecutionAttested===false&&
  archive.executionAuthorityGranted===false&&
  archive.completionPromoted===false&&
  archive.automaticSyncEnabled===false,'AUTHORITY');
 fail(typeof archive.exportedAt==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(archive.exportedAt)&&
  Number.isFinite(Date.parse(archive.exportedAt)),'TIME');
 exact(archive.integrity,['method','sha256']);
 fail(archive.integrity.method==='SHA-256-LOCAL_CONSISTENCY_NOT_SIGNATURE'&&
  typeof archive.integrity.sha256==='string'&&
  /^[0-9a-f]{64}$/.test(archive.integrity.sha256),'INTEGRITY');
 exact(archive.payload,['plan','priorityReviews','antiMJournals']);
 fail(archive.integrity.sha256===await digest(archive.payload),'HASH_MISMATCH');
 const p=archive.payload;
 const checked=await validateParts(p.plan,p.priorityReviews,p.antiMJournals);
 return {
  ...checked,exportedAt:archive.exportedAt,
  archiveSha256:archive.integrity.sha256,
  provenance:'UNTRUSTED_LOCAL_ARCHIVE_REPLAYED',
  externallyAttested:false,authorityGranted:false
 }
}
