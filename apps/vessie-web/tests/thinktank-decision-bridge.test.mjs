import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,companyProjection} from '../src/company-mode.mjs';
import {thinkTankFingerprint,inspectThinkTankPackage,addThinkTankTaskProposal} from '../src/thinktank-decision-bridge.mjs';

const empty=()=>createCompanyPlan({name:'Founder Lab',founder:'Operator',product:'Tool',
 customer:'Users',weeklyGoal:'Ship test',budgetLimitUsd:0});
const packageFields=['seals','verifications','transparencyEntries','transparencyCheckpoints',
 'witnesses','witnessVerifications','rfc3161Timestamps','checkpointPublications',
 'provenanceAssurances','releaseManifests','releaseSeals','releaseSealVerifications',
 'releaseRfc3161Timestamps','releasePublications','releasePublicationAudits',
 'releaseAvailabilityAssurances','publisherOriginIdentities'];
const basis=()=>({
 sessionId:'session-test',seed:'seed-test',decisionSeq:42,mode:'council',
 executionSource:'live-provider',
 operatorPrompt:'Should Vessie adopt reviewed ThinkTank reasoning?',
 outcome:'completed',outputLabel:'READY',actionAllowed:true,
 gateScore:.83,gateThreshold:.75,
 gateBreakdown:{provenance:.2,roleCoverage:.1,seatDiversity:.1,challengeCoverage:.1,
  externalSupport:.4,rawScore:.9,finalScore:.83,cap:1,capReason:'',
  evidenceCount:1,verifiedEvidenceCount:0,attestedEvidenceCount:1},
 claimGovernance:{
  mode:'council',policy:'all-fresh',applicableClaimIds:['CL-01'],freshClaimIds:['CL-01'],
  missingReviewClaimIds:[],staleReviewClaimIds:[],coverageBlockedClaimIds:[],
  passed:true,reason:'Operator review satisfied'
 },
 argumentGovernance:{
  mode:'council',policy:'fresh-accepted-on-excerpts',applicableClaimIds:['CL-01'],
  freshAcceptedClaimIds:['CL-01'],missingAcceptedClaimIds:[],
  staleAcceptedClaimIds:[],draftOnlyClaimIds:[],passed:true,reason:'Maps reviewed'
 },
 objectionCount:1,faultCode:'',governanceReason:'Recorded synthetic council decision',
 assignments:[],claims:[{id:'CL-01',text:'The release should be investigated before publication'}],
 bindings:[{id:'B1',claimId:'CL-01',evidenceId:'EV1',relation:'contradicts',note:'Disagrees'}],
 evidence:[{id:'EV1',verification:'operator-attested',kind:'external-source',uri:'https://example.test',
  retrievalSha256:'',researchCandidateId:''}],
 excerpts:[],claimReviews:[{id:'RV1',claimId:'CL-01',basisFingerprint:'fnv1a32:11223344',coverageState:'contested'}],
 argumentReviews:[{id:'AR1',claimId:'CL-01',status:'accepted',basisFingerprint:'fnv1a32:a1b2c3d4',
  providerModel:'mock',providerRequestId:''}],providerTurns:[]
});
const exported=(mutate=()=>{})=>{
 const b=basis();mutate(b);
 const dossier={id:'DOS-'+String(b.decisionSeq).padStart(4,'0'),...b,
  basisFingerprint:thinkTankFingerprint(b)};
 return {dossier,override:null,...Object.fromEntries(packageFields.map(x=>[x,[]]))};
};
const valid=json=>inspectThinkTankPackage(JSON.stringify(json));
const task={id:'think1',function:'Investigate blocked deployment',output:'Browser smoke report',
 check:'Confirm deployed SHA and CI logs independently',risk:'REPO_WRITE',reviewAcknowledged:true};

test('matches actual ThinkTank TEAR / EXPORT DOSSIER fields and recomputes decision basis',()=>{
 const p=valid(exported());
 assert.equal(p.dossier.id,'DOS-0042');
 assert.match(p.dossier.basisFingerprint,/^fnv1a32:[a-f0-9]{8}$/);
 assert.equal(p.dossier.executionSource,'live-provider');
 assert.equal(p.dossier.claimPolicyPassed,true);
 assert.equal(p.dossier.counts.contradictions,1);
 assert.equal(p.claims[0].id,'CL-01');
 assert.deepEqual(p.provenanceArtifactsPresent,[]);
 assert.equal(p.evidenceVerifiedIndependently,false);
 assert.equal(p.cryptographicSealVerified,false);
 assert.equal(p.actionAuthorityTransferred,false);
 assert.equal(p.taskApproved,false);
 assert.equal(p.completionCertified,false);
});
test('add only independently typed task: no evidence, no action approval and no automatic DONE',()=>{
 const before=empty(),dossier=valid(exported());
 const after=addThinkTankTaskProposal(before,dossier,'CL-01',task);
 assert.equal(before.nodes.length,0);
 assert.equal(after.nodes.length,1);
 assert.equal(after.nodes[0].function,task.function);
 assert.equal(after.nodes[0].output,task.output);
 assert.equal(after.nodes[0].check,task.check);
 assert.equal(after.nodes[0].actionReview,null);
 assert.equal(after.nodes[0].evidence,null);
 assert.deepEqual(after.nodes[0].dependsOn,[]);
 assert.equal(companyProjection(after).nodes[0].status,'ACTION_REVIEW_HELD');
 assert.equal(companyProjection(after).externalExecutionAttested,false);
});
test('rejects altered basis and forged fingerprint without original data',()=>{
 const item=exported();
 item.dossier.claims[0].text='Fake amended conclusion';
 assert.throws(()=>valid(item),/BASIS_MISMATCH/);
 item.dossier.basisFingerprint='fnv1a32:abcdef12';
 assert.throws(()=>valid(item),/BASIS_MISMATCH/);
 item.dossier.basisFingerprint='verified:sha256';
 assert.throws(()=>valid(item),/FINGERPRINT/);
});
test('recomputable FNV does not authenticate a source or promote evidence',()=>{
 const file=exported();
 file.dossier.claims[0].text='Entirely rewritten claim by local attacker';
 const {id,basisFingerprint,...basisRewritten}=file.dossier;
 file.dossier.basisFingerprint=thinkTankFingerprint(basisRewritten);
 file.seals=[{id:'FORGED-SEAL',verified:true}];
 const preview=valid(file);
 assert.match(preview.claims[0].text,/rewritten/);
 assert.deepEqual(preview.provenanceArtifactsPresent,['seals']);
 assert.equal(preview.cryptographicSealVerified,false);
 assert.equal(preview.evidenceVerifiedIndependently,false);
});
test('a WITHHELD simulation and operator override remain warnings, never authority',()=>{
 const file=exported(d=>{
  d.executionSource='simulation-fixture';d.outcome='withheld';d.actionAllowed=false;
  d.outputLabel='WITHHELD';d.gateScore=.31;d.claimGovernance.passed=false;
 });
 file.override={dossierId:'DOS-0042',actionAllowed:true,reason:'Operator wants to proceed'};
 const preview=valid(file);
 assert.ok(preview.notes.some(x=>x.includes('SIMULATION')));
 assert.ok(preview.notes.some(x=>x.includes('WITHHELD')));
 assert.equal(preview.operatorOverrideRecorded,true);
 assert.equal(preview.dossier.actionAllowedWithinThinkTank,false);
 const after=addThinkTankTaskProposal(empty(),preview,'operatorPrompt',task);
 assert.equal(companyProjection(after).nodes[0].status,'ACTION_REVIEW_HELD');
});
test('override for wrong dossier or non-withheld normal outcome refused',()=>{
 const a=exported();a.override={dossierId:'DOS-9999',actionAllowed:true,reason:'override'};
 assert.throws(()=>valid(a),/OVERRIDE_SCOPE/);
 a.override.dossierId='DOS-0042';
 assert.throws(()=>valid(a),/OVERRIDE_SCOPE/);
});
test('requires human acknowledgment, valid focus and bounded new operator-entered fields',()=>{
 const p=valid(exported()),existing=empty();
 assert.throws(()=>addThinkTankTaskProposal(existing,p,'not-a-claim',task),/FOCUS/);
 assert.throws(()=>addThinkTankTaskProposal(existing,p,'CL-01',{...task,reviewAcknowledged:false}),/HUMAN_REVIEW/);
 assert.throws(()=>addThinkTankTaskProposal(existing,p,'CL-01',{...task,output:' \n '}),/COMPANY_TEXT|HUMAN_TASK_TEXT/);
 assert.throws(()=>addThinkTankTaskProposal(existing,p,'CL-01',{...task,risk:'AUTORUN'}),/RISK/);
 assert.throws(()=>addThinkTankTaskProposal(existing,p,'CL-01',{...task,executionAuthorityGranted:true}),/FIELDS/);
 assert.throws(()=>addThinkTankTaskProposal(existing,{...p,actionAuthorityTransferred:true},'CL-01',task),/PREVIEW/);
});
test('rejects forged export wrapper fields, invalid arrays and oversized files',()=>{
 const file=exported();
 delete file.seals;
 assert.throws(()=>valid(file),/FIELDS/);
 const other=exported();other.isTrusted=true;
 assert.throws(()=>valid(other),/FIELDS/);
 const invalid=exported();invalid.claims=[{id:'CL-01',text:'Hi'}];
 assert.throws(()=>valid(invalid),/FIELDS/);
 assert.throws(()=>inspectThinkTankPackage('x'.repeat(2097153)),/SIZE/);
 assert.throws(()=>inspectThinkTankPackage('{'),/JSON/);
 const many=exported();many.releaseSeals=Array.from({length:257},(_,i)=>({id:i}));
 assert.throws(()=>valid(many),/PACKAGE_ARRAY/);
});
test('capacity enforcement and duplicate id remain Company graph contract',()=>{
 const dossier=valid(exported());
 const plan=addThinkTankTaskProposal(empty(),dossier,'operatorPrompt',task);
 assert.throws(()=>addThinkTankTaskProposal(plan,dossier,'CL-01',task),/DUPLICATE_NODE/);
});
