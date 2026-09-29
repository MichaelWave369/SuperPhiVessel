/*
 * Super PhiVessel — Source Provenance Differential Weighting (SPD-W) v0.1.0
 * Deterministic, fail-closed provenance/promotion gate.
 *
 * Design boundary:
 * - Analogy may generate a hypothesis.
 * - Analogy is not evidence.
 * - Novelty does not auto-promote epistemic state.
 * - Unknown source/target classes fail closed.
 * - AUTHORIZED always requires an explicit Human Commitment Write.
 */
(function(root, factory){
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SuperPhiSPDW = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const VERSION = '0.1.0';
  const SCHEMA = 'superphivessel.spdw.receipt.v0.1';

  const SOURCE_CLASSES = Object.freeze([
    'SYMBOLIC',
    'AXIOMATIC',
     'INTERPRETED',
    'DERIVED',
    'TEST_RESULT',
    'OBSERVED'
  ]);

  const TARGET_STATES = Object.freeze([
    'SYMBOLIC',
    'HYPOTHESIS',$
    'TESTABLE',
    'TESTED',
   'SUPPORTED',
    'OBSERVED',
    'ACTIONABLE',
    'AUTHORIZED'
  ]);

  const DISPOSITIONS = Object.freeze([
    'ALLOW',
    'WARN',
   'REQUIRE_EVIDENCE',
    'BLOCK'
  ]);

  // Differential distance. This is an epistemic-gap score, not probability.
  // Higher = larger unsupported jump between source type and requested target state.
  const BASE_WEIGHT = Object.freeze({
    SYMBOLIC: Object.freeze({SYMBOLIC:0,HYPOTHESIS:1,TESTABLE:4,TESTED:10,SUPPORTED:10,OBSERVED:10,ACTIONABLE:10,AUTHORIZED:10}),
    AXIOMATIC: Object.freeze({SYMBOLIC:0,HYPOTHESIS:1,TESTABLE:2,TESTED:7,SUPPORTED:8,OBSERVED:10,ACTIONABLE:8,AUTHORIZED:10}),
    INTERPRETED: Object.freeze({SYMBOLIC:0,HYPOTHESIS:1,TESTABLE:3,TESTED:9,SUPPORTED:9,OBSERVED:10,ACTIONABLE:9,AUTHORIZED:10}),
    DERIVED: Object.freeze({SYMBOLIC:0,HYPOTHESIS:1,TESTABLE:2,TESTED:6,SUPPORTED:6,OBSERVED:9,ACTIONABLE:6,AUTHORIZED:10}),
    TEST_RESULT: Object.freeze({SYMBOLIC:0,HYPOTHESIS:0,TESTABLE:0,TESTED:0,SUPPORTED:2,OBSERVED:8,ACTIONABLE:3,AUTHORIZED:8}),
    OBSERVED: Object.freeze({SYMBOLIC:0,HYPOTHESIS:0,TESTABLE:1,TESTED:6,SUPPORTED:2,OBSERVED:0,ACTIONABLE:3,AUTHORIZED:8})
  });

  function norm(v){ return String(v == null ? '' : v).trim().toUpperCase(); }
  function bool(v){ return v === true; }
  function int(v, fallback){ const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

  function stableStringify(value){
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k)+':'+stableStringify(value[k])).join(',') + '}';
  }

  // Deterministic identity hash only. Not a cryptographic integrity primitive.
  function fnv1a32(text){
    let h = 0x811c9dc5;
    const s = String(text);
    for (let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function evaluate(input){
    const i = input && typeof input === 'object' ? input : {};
    const sourceClass = norm(i.sourceClass);
    const targetState = norm(i.targetState);
    const reasons = [];
    const missing = [];
    let disposition = 'ALLOW';
    let ruleId = 'BASE';

    const sourceKnown = SOURCE_CLASSES.includes(sourceClass);
    const targetKnown = TARGET_STATES.includes(targetState);

    if (!sourceKnown || !targetKnown){
      const receipt = makeReceipt({
        input:i, sourceClass, targetState,
        weight:10,
        disposition:'BLOCK',
        ruleId:'FAIL_CLOSED_UNKNOWN_CLASS',
        reasons:[
          !sourceKnown ? 'UNKNOWN_SOURCE_CLASS' : null,
          !targetKnown ? 'UNKNOWN_TARGET_STATE' : null
        ].filter(Boolean),
        missing:[],
        epsilon:{provenance:1,ontology:1}
      });
      return receipt;
    }

    let weight = BASE_WEIGHT[sourceClass][targetState];

    // Custody is universal for any promotion beyond purely symbolic storage.
    if (targetState !== 'SYMBOLIC' && !bool(i.hasProvenance)){
      disposition = 'BLOCK';
      ruleId = 'PROVENANCE_REQUIRED';
      reasons.push('PROMOTION_REQUIRES_SOURCE_PROVENANCE');
      missing.push('PROVENANCE');
    }

    // SYMBOLIC is a containment state, never a truth claim.
    if (targetState === 'SYMBOLIC' && disposition !== 'BLOCK'){
      disposition = weight >= 4 ? 'WARN' : 'ALLOW';
      ruleId = 'SYMBOLIC_CONTAINMENT';
      reasons.push('SYMBOLIC_STATE_CARRIES_NO_EMPIRICAL_AUTHORITY');
    }

    // Hypothesis creation is intentionally cheap. Evidence is not required yet.
    // Explicit claim + assumptions prevent vague analogy from silently becoming a claim.
    if (targetState === 'HYPOTHESIS' && disposition !== 'BLOCK'){
      if (!bool(i.claimExplicit)) missing.push('EXPLICIT_CLAIM');
      if (!bool(i.assumptionsDeclared)) missing.push('DECLARED_ASSUMPTIONS');
      if (missing.length){
        disposition = 'REQUIRE_EVIDENCE';
        ruleId = 'HYPOTHESIS_FORMULATION_INCOMPLETE';
        reasons.push('HYPOTHESIS_REQUIRES_EXPLICIT_CLAIM_AND_ASSUMPTIONS');
      } else {
        disposition = sourceClass === 'SYMBOLIC' || sourceClass === 'INTERPRETED' ? 'WARN' : 'ALLOW';
        ruleId = 'HYPOTHESIS_FORMATION';
        reasons.push('ANALOGY_MAY_GENERATE_HYPOTHESIS_BUT_DOES_NOT_SUPPORT_IT');
      }
    }

    if (targetState === 'TESTABLE' && disposition !== 'BLOCK'){
      if (!bool(i.hasTestContract)) missing.push('TEST_CONTRACT');
      if (!bool(i.negativePredictionDefined)) missing.push('NEGATIVE_PREDICTION');
      if (missing.length){
        disposition = 'REQUIRE_EVIDENCE';
        ruleId = 'TESTABILITY_REQUIREMENTS';
        reasons.push('TESTABLE_REQUIRES_BOUNDED_CONTRACT_AND_FALSIFYING_OR_NEGATIVE_PREDICTION');
      } else {
        disposition = weight >= 4 ? 'WARN' : 'ALLOW';
        ruleId = 'TESTABILITY_SATISFIED';
        if (sourceClass === 'SYMBOLIC' || sourceClass === 'INTERPRETED') reasons.push('FORMALIZED_FROM_NON_EMPIRICAL_SOURCE');
      }
    }

    if (targetState === 'TESTED'){
      if (sourceClass !== 'TEST_RESULT' || !bool(i.testExecuted)){
        disposition = 'BLOCK';
        ruleId = 'TEST_RESULT_REQUIRED';
        reasons.push('TESTED_REQUIRES_EXECUTED_TEST_RESULT');
        if (sourceClass !== 'TEST_RESULT') missing.push('SOURCE_CLASS_TEST_RESULT');
        if (!bool(i.testExecuted)) missing.push('EXECUTED_TEST');
      } else if (disposition !== 'BLOCK'){
        disposition = 'ALLOW';
        ruleId = 'TEST_RESULT_PRESENT';
      }
    }

    if (targetState === 'SUPPORTED'){
      const evidenceClassOk = ['TEST_RESULT','OBSERVED'].includes(sourceClass);
      const confirmations = Math.max(0, int(i.independentConfirmations,0));
      if (!evidenceClassOk){
        disposition = 'BLOCK';
        ruleId = 'SUPPORT_EVIDENCE_CLASS_REQUIRED';
        reasons.push('SUPPORTED_REQUIRES_TEST_RESULT_OR_OBSERVED_EVIDENCE');
        missing.push('EMPIRICAL_OR_TEST_EVIDENCE');
      } else if (confirmations < 2){
        disposition = 'REQUIRE_EVIDENCE';
        ruleId = 'INDEPENDENT_CONFIRMATION_REQUIRED';
        reasons.push('SUPPORTED_REQUIRES_AT_LEAST_TWO_INDEPENDENT_CONFIRMATIONS');
        missing.push('INDEPENDENT_CONFIRMATIONS');
      } else if (disposition !== 'BLOCK'){
        disposition = 'ALLOW';
        ruleId = 'SUPPORTED_EVIDENCE_SATISFIED';
      }
    }

    if (targetState === 'OBSERVED'){
      if (sourceClass !== 'OBSERVED' || !bool(i.directObservation)){
        disposition = 'BLOCK';
        ruleId = 'DIRECT_OBSERVATION_REQUIRED';
        reasons.push('OBSERVED_REQUIRES_DIRECT_OBSERVATION_SOURCE');
        if (sourceClass !== 'OBSERVED') missing.push('SOURCE_CLASS_OBSERVED');
        if (!bool(i.directObservation)) missing.push('DIRECT_OBSERVATION_FLAG');
      } else if (disposition !== 'BLOCK'){
        disposition = 'ALLOW';
        ruleId = 'DIRECT_OBSERVATION_BOUND';
      }
    }

    if (targetState === 'ACTIONABLE'){
      const evidenceClassOk = ['TEST_RESULT','OBSERVED'].includes(sourceClass);
      if (!evidenceClassOk){
        disposition = 'BLOCK';
        ruleId = 'ACTIONABLE_EVIDENCE_CLASS_REQUIRED';
        reasons.push('ACTIONABLE_REQUIRES_TEST_RESULT_OR_OBSERVED_EVIDENCE');
        missing.push('TEST_RESULT_OR_OBSERVED_SOURCE');
      } else {
        if (!bool(i.acceptancePassed)) missing.push('ACCEPTANCE_PASS');
        if (norm(i.realityGateStatus) !== 'PASS') missing.push('REALITY_GATE_PASS');
        if (norm(i.riskClass || 'LOW') !== 'LOW') missing.push('LOW_RISK_SCOPE');
        if (missing.length){
          disposition = 'REQUIRE_EVIDENCE';
          ruleId = 'ACTIONABLE_GATES_INCOMPLETE';
          reasons.push('ACTIONABLE_REQUIRES_ACCEPTANCE_PASS_REALITY_GATE_PASS_AND_LOW_RISK_SCOPE');
        } else if (disposition !== 'BLOCK'){
          disposition = 'ALLOW';
          ruleId = 'ACTIONABLE_GATES_SATISFIED';
        }
      }
    }

    if (targetState === 'AUTHORIZED'){
      if (norm(i.currentState) !== 'ACTIONABLE') missing.push('CURRENT_STATE_ACTIONABLE');
      if (norm(i.realityGateStatus) !== 'PASS') missing.push('REALITY_GATE_PASS');
      if (!bool(i.humanCommitment)) missing.push('HUMAN_COMMITMENT_WRITE');
      if (!bool(i.acceptancePassed)) missing.push('ACCEPTANCE_PASS');
      if (missing.length){
        disposition = 'BLOCK';
        ruleId = 'HUMAN_AUTHORITY_REQUIRED';
        reasons.push('AUTHORIZED_REQUIRES_ACTIONABLE_STATE_GATE_PASS_ACCEPTANCE_PASS_AND_HUMAN_COMMITMENT');
      } else {
        disposition = 'ALLOW';
        ruleId = 'HUMAN_AUTHORITY_COMMITTED';
      }
    }

    if (disposition === 'ALLOW' && weight >= 7 && !['HUMAN_AUTHORITY_COMMITTED'].includes(ruleId)){
      disposition = 'WARN';
      reasons.push('HIGH_PROVENANCE_DIFFERENTIAL');
    }

    weight = clamp(weight,0,10);
    return makeReceipt({
      input:i, sourceClass, targetState, weight, disposition, ruleId, reasons, missing,
      epsilon:{
        provenance: Number((weight/10).toFixed(2)),
        ontology: 0
      }
    });
  }

  function makeReceipt(x){
    const core = {
      schema:SCHEMA,
      version:VERSION,
      sourceClass:x.sourceClass || '',
      targetState:x.targetState || '',
      weight:clamp(Number(x.weight)||0,0,10),
      disposition:x.disposition,
      ruleId:x.ruleId,
      reasons:Array.from(new Set(x.reasons || [])),
      missing:Array.from(new Set(x.missing || [])),
      epsilon:Object.assign({provenance:0,ontology:0},x.epsilon||{}),
      promotionAllowed:x.disposition === 'ALLOW' || x.disposition === 'WARN',
      failClosed:x.disposition === 'BLOCK'
    };
    const identityInput = {
      sourceClass:core.sourceClass,
      targetState:core.targetState,
      weight:core.weight,
      disposition:core.disposition,
      ruleId:core.ruleId,
      reasons:core.reasons,
      missing:core.missing,
      epsilon:core.epsilon,
      sourceRef:String((x.input||{}).sourceRef||''),
      claimId:String((x.input||{}).claimId||'')
    };
    core.receiptHash = fnv1a32(stableStringify(identityInput));
    core.hashAlgorithm = 'FNV1A32_IDENTITY_ONLY';
    return Object.freeze(core);
  }

  function receiptText(receipt){
    const r = receipt || {};
    return [
      'BEGIN_SPDW_RECEIPT',
      'SCHEMA='+String(r.schema||SCHEMA),
      'VERSION='+String(r.version||VERSION),
      'SOURCE_CLASS='+String(r.sourceClass||'UNKNOWN'),
      'TARGET_STATE='+String(r.targetState||'UNKNOWN'),
      'SPD_W='+String(r.weight),
      'DISPOSITION='+String(r.disposition||'BLOCK'),
      'RULE_ID='+String(r.ruleId||'UNKNOWN'),
      'PROMOTION_ALLOWED='+(r.promotionAllowed?'YES':'NO'),
      'FAIL_CLOSED='+(r.failClosed?'YES':'NO'),
      'EPSILON_PROVENANCE='+String(r.epsilon&&r.epsilon.provenance!=null?r.epsilon.provenance:1),
      'EPSILON_ONTOLOGY='+String(r.epsilon&&r.epsilon.ontology!=null?r.epsilon.ontology:0),
      'MISSING='+(r(r.missing||[]).join(',')||'NONE'),
      'REASONS='+((r.reasons||[]).join('|')||'NONE'),
      'RECEIPT_HASH='+String(r.receiptHash||'none'),
      'HASH_ALGORITHM='+String(r.hashAlgorithm||'FNV1A32_IDENTITY_ONLY'),
      'BOUNDARY=SPD-W measures provenance/promotion mismatch. It does not establish truth.',
      'END_SPDW_RECEIPT'
    ].join('\n');
  }

  return Object.freeze({
    VERSION,
    SCHEMA,
    SOURCE_CLASSES,
    TARGET_STATES,
    DISPOSITIONS,
    BASE_WEIGHT,
    evaluate,
    receiptText,
    stableStringify,
    fnv1a32
  });
});
