import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE_GATE_CONTEXT_SCHEMA as SCHEMA,
  EVIDENCE_GATE_POLICY, evaluateEvidenceGate } from '../src/evidence-gate.mjs';

const report = {id:'report-1',kind:'REPORT',provenance:'REPORTED',
  statement:'A network switch has reportedly lost connectivity.',
  reference:null,riskLevel:null,observedConnectivity:null};
const impact = {id:'impact-1',kind:'IMPACT',provenance:'VERIFIED',
  statement:'Operator-trusted fixture reports affected critical services',
  reference:'sha256:'+'a'.repeat(64),riskLevel:'high',observedConnectivity:null};
const down = {id:'down-1',kind:'CONNECTIVITY',provenance:'VERIFIED',
  statement:'Operator-trusted fixture reports failed connectivity test',
  reference:'sha256:'+'b'.repeat(64),riskLevel:null,observedConnectivity:'DOWN'};
const up = {id:'up-1',kind:'CONNECTIVITY',provenance:'VERIFIED',
  statement:'Operator-trusted fixture reports successful connectivity test',
  reference:'sha256:'+'c'.repeat(64),riskLevel:null,observedConnectivity:'UP'};
const context = (...sources) => ({schema:SCHEMA,sources});
const proposal = (risk='undetermined',extras={})=>({
  status:'unknown',risk,confidence:'low',evidence:['report-1'],
  action:'Collect independent observations before diagnosing',...extras
});
const evaluate = (p,c=context(report))=>evaluateEvidenceGate(p,c);
const has=(r,code)=>assert.ok(r.violations.includes(code),JSON.stringify(r));

test('the seven original V2 controls are preserved without model authority',()=>{
  for (const risk of ['low','high','critical']) {
    const r=evaluate(proposal(risk));
    assert.equal(r.decision,'REJECT');has(r,'UNSUPPORTED_SEVERITY');
  }
  const unknown=evaluate(proposal());
  assert.equal(unknown.decision,'ALLOW_ASSESSMENT_ONLY');
  assert.equal(unknown.policyVersion,EVIDENCE_GATE_POLICY);
  const positive=evaluate(proposal('high',{evidence:['report-1','impact-1']}),context(report,impact));
  assert.equal(positive.decision,'ALLOW_ASSESSMENT_ONLY');
  assert.equal(positive.closureGranted,false);
  assert.equal(positive.executionAuthorityGranted,false);
  assert.equal(positive.persistentLedgerWritten,false);
  assert.throws(()=>evaluate(proposal('banana')),/EVIDENCE_GATE_RISK/);
  assert.throws(()=>evaluate(proposal('')),/EVIDENCE_GATE_RISK/);
});
test('both local-model failure fixtures are rejected without verified impact',()=>{
  const granite=evaluate(proposal('low',{status:'unknown'}));
  const qwen=evaluate(proposal('high',{status:'unknown'}));
  has(granite,'UNSUPPORTED_SEVERITY');has(qwen,'UNSUPPORTED_SEVERITY');
});
test('high risk cannot be smuggled through low-risk verified impact',()=>{
  const low={...impact,riskLevel:'low'};
  const r=evaluate(proposal('high',{evidence:['report-1','impact-1']}),context(report,low));
  has(r,'SEVERITY_MISMATCH');has(r,'IMPACT_NOT_CITED');
});
test('verified impact must be cited; an unrelated report is insufficient',()=>{
  const r=evaluate(proposal('high'),context(report,impact));
  has(r,'IMPACT_NOT_CITED');
});
test('unknown evidence source IDs do not silently become supporting evidence',()=>{
  const r=evaluate(proposal('undetermined',{evidence:['fictional-9']}));
  has(r,'UNKNOWN_EVIDENCE_ID');has(r,'REPORT_NOT_CITED');
});
test('reported incident cannot falsely become verified down or healthy',()=>{
  has(evaluate(proposal('undetermined',{status:'verified_down'})),'DOWN_NOT_VERIFIED');
  has(evaluate(proposal('undetermined',{status:'healthy'})),'HEALTH_NOT_VERIFIED');
});
test('verified connectivity fixtures only qualify corresponding statuses',()=>{
  assert.equal(evaluate(proposal('undetermined',{status:'verified_down',
    evidence:['report-1','down-1'],confidence:'medium'}),context(report,down)).decision,
    'ALLOW_ASSESSMENT_ONLY');
  assert.equal(evaluate(proposal('undetermined',{status:'healthy',
    evidence:['report-1','up-1'],confidence:'medium'}),context(report,up)).decision,
    'ALLOW_ASSESSMENT_ONLY');
  has(evaluate(proposal('undetermined',{status:'healthy',
    evidence:['report-1','down-1']}),context(report,down)),'HEALTH_NOT_VERIFIED');
});
test('diagnostic confidence cannot exceed low with no cited connectivity observation',()=>{
  has(evaluate(proposal('undetermined',{confidence:'high'})),'UNSUPPORTED_DIAGNOSTIC_CONFIDENCE');
});
test('conflicting trusted connectivity observations refuse to certify incident status',()=>{
  has(evaluate(proposal('undetermined',{evidence:['report-1','down-1','up-1']}),
    context(report,down,up)),'CONTRADICTORY_CONNECTIVITY');
});
test('contradictory impact records cannot silently choose a severity',()=>{
  const low={...impact,id:'impact-2',riskLevel:'low',reference:'sha256:'+'d'.repeat(64)};
  has(evaluate(proposal('high',{evidence:['report-1','impact-1','impact-2']}),
    context(report,impact,low)),'CONTRADICTORY_IMPACT');
});
test('fake VERIFIED provenance with no source reference fails closed',()=>{
  assert.throws(()=>evaluate(proposal(),context(report,{...impact,reference:null})),
    /EVIDENCE_GATE_IMPACT_SHAPE/);
});
test('duplicate IDs and malformed source records fail closed',()=>{
  assert.throws(()=>evaluate(proposal(),context(report,report)),/EVIDENCE_GATE_SOURCE_ID/);
  assert.throws(()=>evaluate(proposal(),context(report,{...impact,extra:true})),
    /EVIDENCE_GATE_FIELDS/);
});
test('duplicate proposal evidence and extra authority fields fail closed',()=>{
  assert.throws(()=>evaluate(proposal('undetermined',{evidence:['report-1','report-1']})),
    /EVIDENCE_GATE_EVIDENCE_IDS/);
  assert.throws(()=>evaluate({...proposal(),executionAuthorityGranted:true}),
    /EVIDENCE_GATE_FIELDS/);
});
test('no input mutation, no persistent writes or execution authorization',()=>{
  const p=proposal();const c=context(report);const original=JSON.stringify({p,c});
  const r=evaluate(p,c);r.proposal.evidence.push('tamper');
  assert.equal(JSON.stringify({p,c}),original);
  assert.equal(r.trustScope,'CALLER_SUPPLIED_SOURCES_NOT_INDEPENDENTLY_ATTESTED');
  assert.equal(r.persistentLedgerWritten,false);
});
