/* SPV-COMPANY-14: ThinkTank decision dossier → operator-authored Company proposal.
 * Import verifies its exported deterministic FNV-1a basis fingerprint ONLY.
 * FNV is a public recomputable checksum, not a signature, independent seal check
 * or proof of truth/execution. No AI suggestion is permitted to grant authority.
 */
import {inspectCompanyPlan,addCompanyNode,COMPANY_RISKS} from './company-mode.mjs';
export const THINKTANK_BRIDGE_SCHEMA='superphivessel.thinktank-dossier-preview.v0.1';
const MAX_BYTES=2097152;
const PACKAGE_FIELDS=['dossier','override','seals','verifications','transparencyEntries',
 'transparencyCheckpoints','witnesses','witnessVerifications','rfc3161Timestamps',
 'checkpointPublications','provenanceAssurances','releaseManifests','releaseSeals',
 'releaseSealVerifications','releaseRfc3161Timestamps','releasePublications',
 'releasePublicationAudits','releaseAvailabilityAssurances','publisherOriginIdentities'];
const BASIS_FIELDS=['sessionId','seed','decisionSeq','mode','executionSource','operatorPrompt',
 'outcome','outputLabel','actionAllowed','gateScore','gateThreshold','gateBreakdown',
 'claimGovernance','argumentGovernance','objectionCount','faultCode','governanceReason',
 'assignments','claims','bindings','evidence','excerpts','claimReviews','argumentReviews',
 'providerTurns'];
const fail=(ok,code)=>{if(!ok)throw Error('THINKTANK_BRIDGE_'+code)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>fail(obj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|'),'FIELDS');
const safe=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x);
function stable(x){
 if(x===null||typeof x!=='object')return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
}
export function thinkTankFingerprint(basis){
 const value=stable(basis);
 let hash=0x811c9dc5;
 for(let i=0;i<value.length;i++){
  hash^=value.charCodeAt(i);
  hash=Math.imul(hash,0x01000193)>>>0;
 }
 return 'fnv1a32:'+hash.toString(16).padStart(8,'0');
}
function inspectDossier(doc){
 exact(doc,['id','basisFingerprint',...BASIS_FIELDS]);
 fail(Number.isSafeInteger(doc.decisionSeq)&&doc.decisionSeq>0&&doc.decisionSeq<=10000000,'SEQ');
 fail(doc.id==='DOS-'+String(doc.decisionSeq).padStart(4,'0'),'ID');
 fail(safe(doc.sessionId,128)&&safe(doc.seed,256)&&
  typeof doc.operatorPrompt==='string'&&doc.operatorPrompt.length<=8192&&
  typeof doc.faultCode==='string'&&doc.faultCode.length<=250&&
  typeof doc.governanceReason==='string'&&doc.governanceReason.length<=3000,'TEXT');
 fail(['solo','trio','council','debate','dream','build','audit'].includes(doc.mode),'MODE');
 fail(['live-provider','simulation-fixture','governed-system'].includes(doc.executionSource),'SOURCE');
 fail(['completed','withheld'].includes(doc.outcome),'OUTCOME');
 fail(['STANDARD','SPECULATIVE','DRAFT','READY','AUDIT','WITHHELD'].includes(doc.outputLabel),'LABEL');
 fail(typeof doc.actionAllowed==='boolean'&&
  Number.isFinite(doc.gateScore)&&doc.gateScore>=0&&doc.gateScore<=1&&
  Number.isFinite(doc.gateThreshold)&&doc.gateThreshold>=0&&doc.gateThreshold<=1&&
  Number.isSafeInteger(doc.objectionCount)&&doc.objectionCount>=0,'GATE');
 for(const kind of ['claimGovernance','argumentGovernance']){
  const report=doc[kind];
  fail(obj(report)&&typeof report.passed==='boolean'&&typeof report.reason==='string'&&
   report.reason.length<=3000&&report.mode===doc.mode,'GOVERNANCE');
 }
 fail(doc.gateBreakdown===null||obj(doc.gateBreakdown),'GATE_BREAKDOWN');
 for(const key of BASIS_FIELDS.filter(k=>['assignments','claims','bindings','evidence','excerpts','claimReviews','argumentReviews','providerTurns'].includes(k))){
  fail(Array.isArray(doc[key])&&doc[key].length<=256,'ARRAY_LIMIT');
 }
 const claimSeen=new Set();
 for(const claim of doc.claims){
  exact(claim,['id','text']);
  fail(safe(claim.id,128)&&safe(claim.text,2000)&&!claimSeen.has(claim.id),'CLAIM');
  claimSeen.add(claim.id);
 }
 for(const binding of doc.bindings){
  fail(obj(binding)&&['supports','contradicts','context'].includes(binding.relation),'BINDING');
 }
 for(const ev of doc.evidence){
  fail(obj(ev)&&['unverified','operator-attested','machine-verified'].includes(ev.verification),'EVIDENCE');
 }
 for(const review of doc.argumentReviews){
  fail(obj(review)&&['draft','accepted','dismissed'].includes(review.status),'ARGUMENT');
 }
 const basis={};
 for(const key of BASIS_FIELDS)basis[key]=doc[key];
 fail(typeof doc.basisFingerprint==='string'&&/^fnv1a32:[0-9a-f]{8}$/.test(doc.basisFingerprint),'FINGERPRINT');
 fail(thinkTankFingerprint(basis)===doc.basisFingerprint,'BASIS_MISMATCH');
 return doc;
}
export function inspectThinkTankPackage(json){
 fail(typeof json==='string'&&new TextEncoder().encode(json).length<=MAX_BYTES,'SIZE');
 let data;try{data=JSON.parse(json)}catch{throw Error('THINKTANK_BRIDGE_JSON')}
 exact(data,PACKAGE_FIELDS);
 const d=inspectDossier(data.dossier);
 fail(data.override===null||obj(data.override),'OVERRIDE');
 if(data.override!==null){
  fail(data.override.dossierId===d.id&&d.outcome==='withheld'&&
   data.override.actionAllowed===true&&safe(data.override.reason,3000),'OVERRIDE_SCOPE');
 }
 for(const key of PACKAGE_FIELDS.filter(k=>!['dossier','override'].includes(k))){
  fail(Array.isArray(data[key])&&data[key].length<=256,'PACKAGE_ARRAY');
 }
 const relevantReviews=d.claimReviews.length;
 const contradictory=d.bindings.filter(x=>x.relation==='contradicts').length;
 const draftArguments=d.argumentReviews.filter(x=>x.status==='draft').length;
 const caution=[];
 if(d.executionSource==='simulation-fixture')caution.push('SIMULATION FIXTURE: no live provider evidence');
 if(d.executionSource==='governed-system')caution.push('Governed system provenance, not live-provider deliberation');
 if(d.outcome==='withheld')caution.push('SYNTHESIS WITHHELD: no approval or normal execution authority');
 if(d.override!==null)caution.push('Historical operator override exists; does not transfer to Vessie');
 if(d.gateScore<d.gateThreshold)caution.push('Reality Gate score below exported threshold');
 if(!d.claimGovernance.passed)caution.push('Claim policy blocked at time of dossier');
 if(!d.argumentGovernance.passed)caution.push('Argument policy blocked at time of dossier');
 if(d.claims.length===0)caution.push('No registered claims in dossier; only operator prompt available for focus');
 return {
  schema:THINKTANK_BRIDGE_SCHEMA,
  source:'OPERATOR_SUPPLIED_THINKTANK_EXPORT',
  dossier:{
   id:d.id,sessionId:d.sessionId,decisionSeq:d.decisionSeq,
   executionSource:d.executionSource,mode:d.mode,outcome:d.outcome,outputLabel:d.outputLabel,
   actionAllowedWithinThinkTank:d.actionAllowed,
   basisFingerprint:d.basisFingerprint,
   fingerprintRecomputed:true,signatureVerified:false,
   operatorPrompt:d.operatorPrompt,governanceReason:d.governanceReason,
   gateScore:d.gateScore,gateThreshold:d.gateThreshold,
   claimPolicyPassed:d.claimGovernance.passed,
   argumentPolicyPassed:d.argumentGovernance.passed,
   counts:{claims:d.claims.length,evidence:d.evidence.length,contradictions:contradictory,
    claimReviews:relevantReviews,draftArguments}
  },
  claims:d.claims.map(x=>({id:x.id,text:x.text})),
  notes:caution,
  operatorOverrideRecorded:data.override!==null,
  provenanceArtifactsPresent:PACKAGE_FIELDS.filter(k=>!['dossier','override'].includes(k)&&data[k].length>0),
  evidenceVerifiedIndependently:false,cryptographicSealVerified:false,
  actionAuthorityTransferred:false,taskApproved:false,completionCertified:false
 };
}
export function addThinkTankTaskProposal(plan,preview,sourceFocus,operatorTask){
 inspectCompanyPlan(plan);
 fail(obj(preview)&&preview.schema===THINKTANK_BRIDGE_SCHEMA&&
  preview.source==='OPERATOR_SUPPLIED_THINKTANK_EXPORT'&&
  preview.actionAuthorityTransferred===false&&preview.taskApproved===false&&
  preview.completionCertified===false&&preview.evidenceVerifiedIndependently===false&&
  preview.cryptographicSealVerified===false,'PREVIEW');
 fail(obj(preview.dossier)&&safe(preview.dossier.id,80)&&
  /^fnv1a32:[a-f0-9]{8}$/.test(preview.dossier.basisFingerprint),'SCOPE');
 fail(sourceFocus==='operatorPrompt'||(
  Array.isArray(preview.claims)&&preview.claims.some(c=>c.id===sourceFocus)),'FOCUS');
 exact(operatorTask,['id','function','output','check','risk','reviewAcknowledged']);
 fail(operatorTask.reviewAcknowledged===true,'HUMAN_REVIEW');
 for(const field of ['id','function','output','check'])fail(safe(operatorTask[field],
   field==='id'?64:field==='function'?100:240),'HUMAN_TASK_TEXT');
 fail(COMPANY_RISKS.includes(operatorTask.risk),'RISK');
 // Do not populate work from AI strings or use the ThinkTank dossier as evidence.
 // The existing graph enforces new nodes with null evidence + action review.
 return addCompanyNode(plan,{id:operatorTask.id,function:operatorTask.function,
  output:operatorTask.output,check:operatorTask.check,risk:operatorTask.risk,
  dependsOn:[]});
}
