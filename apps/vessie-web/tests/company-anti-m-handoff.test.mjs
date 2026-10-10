import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,addCompanyNode,recordActionReview,recordCompanyEvidence,
 reviewCompanyEvidence} from '../src/company-mode.mjs';
import {ANTIM_PROPOSAL_SCHEMA,proposeAntiMFromCompany,validateAntiMProposal} from '../src/company-anti-m-handoff.mjs';
import {createBundle,inspectBundle} from '../src/anti-m.mjs';
const company=()=>createCompanyPlan({name:'Phi Test Co',founder:'Founder',product:'Portal',
 customer:'People',weeklyGoal:'Deliver demo',budgetLimitUsd:0});
const node=(id,dependencies=[],risk='NONE')=>({id,function:'QA smoke-test',output:'Browser report',
 check:'Fresh browser run confirms intended UX',dependsOn:dependencies,risk});
const evidence={result:'PASS',method:'HUMAN_TEST',reference:'https://github.com/example/repo/issues/1',summary:'Operator says pass'};
test('handoff is a fresh draft without carrying proof or authority',async()=>{
 let p=addCompanyNode(company(),node('qa',[],'DEPLOY'));
 p=recordActionReview(p,'qa','Founder');
 p=recordCompanyEvidence(p,'qa',evidence);
 p=reviewCompanyEvidence(p,'qa','Founder','ACCEPT');
 const proposal=proposeAntiMFromCompany(p,'qa');
 assert.equal(proposal.schema,ANTIM_PROPOSAL_SCHEMA);
 assert.deepEqual(Object.keys(proposal).sort(),[
  'approvalTransferred','draft','evidenceTransferred','executionAuthorityGranted','provenance','schema','source'].sort());
 assert.equal(JSON.stringify(proposal).includes(evidence.reference),false);
 assert.equal(JSON.stringify(proposal).includes('ACCEPT'),false);
 assert.equal(proposal.source.risk,'DEPLOY');
 assert.equal(proposal.approvalTransferred,false);
 assert.equal(proposal.executionAuthorityGranted,false);
 const b=await createBundle(proposal.draft,'handoff-test');
 const s=await inspectBundle(b);
 assert.equal(s.status,'EVIDENCE_PENDING');
 assert.deepEqual(s.actions,[]);
 assert.deepEqual(s.evidence,[]);
 assert.equal(s.authorityGranted,false);
 assert.equal(s.closed,false);
});
test('dependency identities are context, not transferred completion',()=>{
 let p=addCompanyNode(company(),node('build'));
 p=addCompanyNode(p,node('qa',['build']));
 const proposal=proposeAntiMFromCompany(p,'qa');
 assert.deepEqual(proposal.source.dependencies,['build']);
 assert.deepEqual(proposal.draft.criteria,['Fresh browser run confirms intended UX']);
});
test('strict validation refuses forged permissions or hidden evidence',()=>{
 const p=addCompanyNode(company(),node('qa'));
 const proposal=proposeAntiMFromCompany(p,'qa');
 for(const prop of ['approvalTransferred','evidenceTransferred','executionAuthorityGranted']){
  assert.throws(()=>validateAntiMProposal({...proposal,[prop]:true}),/TRUST_BOUNDARY/);
 }
 assert.throws(()=>validateAntiMProposal({...proposal,extra:'evidence'}),/FIELDS/);
 assert.throws(()=>validateAntiMProposal({...proposal,draft:{...proposal.draft,criteria:['ok'],actions:['DEPLOY']}}),/FIELDS/);
 assert.throws(()=>validateAntiMProposal({...proposal,source:{...proposal.source,risk:'UNLIMITED'}}),/RISK/);
});
test('oversized check must be edited explicitly; never silently truncates criteria',()=>{
 let p=addCompanyNode(company(),{...node('qa'),check:'c'.repeat(221)});
 assert.throws(()=>proposeAntiMFromCompany(p,'qa'),/CRITERIA/);
 assert.throws(()=>proposeAntiMFromCompany(p,'missing'),/NODE_NOT_FOUND/);
});
