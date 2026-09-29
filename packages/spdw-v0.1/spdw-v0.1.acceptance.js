'use strict';
const SPDW = require('./spdw-v0.1.js');

const base = {hasProvenance:true,claimExplicit:true,assumptionsDeclared:true};
const cases = [
  ['C01 symbolic-contained',{...base,sourceClass:'SYMBOLIC',targetState:'SYMBOLIC'},'ALLOW'],
  ['C02 symbolic-hypothesis',{...base,sourceClass:'SYMBOLIC',targetState:'HYPOTHESIS'},'WARN'],
  ['C03 hypothesis-no-provenance',{...base,hasProvenance:false,sourceClass:'SYMBOLIC',targetState:'HYPOTHESIS'},'BLOCK'],
  ['C04 symbolic-testable',{...base,sourceClass:'SYMBOLIC',targetState:'TESTABLE',hasTestContract:true,negativePredictionDefined:true},'WARN'],
  ['C05 symbolic-tested-block',{...base,sourceClass:'SYMBOLIC',targetState:'TESTED'},'BLOCK'],
  ['C06 axiomatic-hypothesis',{...base,sourceClass:'AXIOMATIC',targetState:'HYPOTHESIS'},'ALLOW'],
  ['C07 axiomatic-testable',{...base,sourceClass:'AXIOMATIC',targetState:'TESTABLE',hasTestContract:true,negativePredictionDefined:true},'ALLOW'],
  ['C08 axiomatic-observed-block',{...base,sourceClass:'AXIOMATIC',targetState:'OBSERVED',directObservation:false},'BLOCK'],
  ['C09 interpreted-hypothesis',{...base,sourceClass:'INTERPRETED',targetState:'HYPOTHESIS'},'WARN'],
  ['C10 interpreted-supported-block',{...base,sourceClass:'INTERPRETED',targetState:'SUPPORTED',independentConfirmations:3},'BLOCK'],
  ['C11 derived-hypothesis',{...base,sourceClass:'DERIVED',targetState:'HYPOTHESIS'},'ALLOW'],
  ['C12 derived-testable',{...base,sourceClass:'DERIVED',targetState:'TESTABLE',hasTestContract:true,negativePredictionDefined:true},'ALLOW'],
  ['C13 derived-tested-block',{...base,sourceClass:'DERIVED',targetState:'TESTED',testExecuted:true},'BLOCK'],
  ['C14 test-result-tested',{...base,sourceClass:'TEST_RESULT',targetState:'TESTED',testExecuted:true},'ALLOW'],
  ['C15 supported-needs-confirmation',{...base,sourceClass:'TEST_RESULT',targetState:'SUPPORTED',independentConfirmations:1},'REQUIRE_EVIDENCE'],
  ['C16 supported-two-confirmations',{...base,sourceClass:'TEST_RESULT',targetState:'SUPPORTED',independentConfirmations:2},'ALLOW'],
  ['C17 direct-observed',{...base,sourceClass:'OBSERVED',targetState:'OBSERVED',directObservation:true},'ALLOW'],
  ['C18 observed-not-direct-block',{...base,sourceClass:'OBSERVED',targetState:'OBSERVED',directObservation:false},'BLOCK'],
  ['C19 observed-actionable',{...base,sourceClass:'OBSERVED',targetState:'ACTIONABLE',acceptancePassed:true,realityGateStatus:'PASS',riskClass:'LOW'},'ALLOW'],
  ['C20 actionable-missing-acceptance',{...base,sourceClass:'OBSERVED',targetState:'ACTIONABLE',acceptancePassed:false,realityGateStatus:'PASS',riskClass:'LOW'},'REQUIRE_EVIDENCE'],
  ['C21 test-result-actionable',{...base,sourceClass:'TEST_RESULT',targetState:'ACTIONABLE',acceptancePassed:true,realityGateStatus:'PASS',riskClass:'LOW'},'ALLOW'],
  ['C22 authorized-no-human',{...base,sourceClass:'TEST_RESULT',targetState:'AUTHORIZED',currentState:'ACTIONABLE',acceptancePassed:true,realityGateStatus:'PASS',humanCommitment:false},'BLOCK'],
  ['C23 authorized-human',{...base,sourceClass:'TEST_RESULT',targetState:'AUTHORIZED',currentState:'ACTIONABLE',acceptancePassed:true,realityGateStatus:'PASS',humanCommitment:true},'ALLOW'],
  ['C24 unknown-source-fail-closed',{...base,sourceClass:'MYSTICAL',targetState:'HYPOTHESIS'},'BLOCK'],
  ['C25 authorized-gate-conditional',{...base,sourceClass:'OBSERVED',targetState:'AUTHORIZED',currentState:'ACTIONABLE',acceptancePassed:true,realityGateStatus:'CONDITIONAL',humanCommitment:true},'BLOCK'],
  ['C26 testable-missing-negative-prediction',{...base,sourceClass:'INTERPRETED',targetState:'TESTABLE',hasTestContract:true,negativePredictionDefined:false},'REQUIRE_EVIDENCE'],
  ['C27 observed-supported',{...base,sourceClass:'OBSERVED',targetState:'SUPPORTED',independentConfirmations:2},'ALLOW'],
  ['C28 observed-supported-no-confirmations',{...base,sourceClass:'OBSERVED',targetState:'SUPPORTED',independentConfirmations:0},'REQUIRE_EVIDENCE'],
  ['C29 test-result-not-direct-observed',{...base,sourceClass:'TEST_RESULT',targetState:'OBSERVED',directObservation:false},'BLOCK'],
  ['C30 unknown-target-fail-closed',{...base,sourceClass:'OBSERVED',targetState:'CERTAIN'},'BLOCK']
];

let pass = 0;
const results = cases.map(([id,input,expected]) => {
  const r = SPDW.evaluate({...input,claimId:id,sourceRef:'acceptance:'+id});
  const ok = r.disposition === expected && Number.isFinite(r.weight) && r.receiptHash && r.schema === SPDW.SCHEMA;
  if (ok) pass++;
  return {id,expected,actual:r.disposition,weight:r.weight,ruleId:r.ruleId,ok,hash:r.receiptHash};
});

const deterministicA = SPDW.evaluate({...base,sourceClass:'SYMBOLIC',targetState:'HYPOTHESIS',claimId:'det',sourceRef:'x'});
const deterministicB = SPDW.evaluate({...base,sourceClass:'SYMBOLIC',targetState:'HYPOTHESIS',claimId:'det',sourceRef:'x'});
const deterministic = deterministicA.receiptHash === deterministicB.receiptHash;

const total = cases.length + 1;
const passed = pass + (deterministic ? 1 : 0);
console.log('SPD-W v'+SPDW.VERSION+' acceptance');
for (const r of results) console.log(`${r.ok?'PASS':'FAIL'} ${r.id} expected=${r.expected} actual=${r.actual} w=${r.weight} rule=${r.ruleId} hash=${r.hash}`);
console.log(`${deterministic?'PASS':'FAIL'} C31 deterministic-receipt-hash`);
console.log(`SUMMARY ${passed}/${total} PASS`);
if (passed !== total) process.exit(1);
