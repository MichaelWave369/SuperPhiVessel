import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProtocolCohorts,COHORT_SCHEMA} from '../ui/protocol-cohorts.mjs';
import {sanitizeBenchEvidence,MAX_BENCH_ENTRIES} from '../ui/evidence-bench.mjs';

const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64),D='d'.repeat(64);
const p=(overrides={})=>sanitizeBenchEvidence({
  schema:'superphivessel.local-console.trial.receipt.v0.1',
  observation:'LOCAL_OLLAMA_API_RESULT_UNATTESTED',
  timestamp:'2026-10-08T22:46:40.147Z',
  model:'qwen3:4b',route:'LOCAL_LOOPBACK_FIXED',
  protocol_id:'governance-one-sentence-v1',
  max_output_tokens_requested:64,
  elapsed_wall_ms:36732,ollama_load_duration_ns:22125996200,
  ollama_prompt_eval_duration_ns:11800000000,
  ollama_generated_tokens:64,ollama_prompt_tokens:27,
  ollama_eval_duration_ns:1155987000,
  output_token_cap_reached:true,ollama_done_reason:'length',
  generated_text_sha256:A,
  private_prompt_included:false,generated_text_included:false,
  cloud_execution_approved:false,model_routing_approved:false,authority_granted:false,
  original_private_prompt:'NEVER_LEAK_THIS_SECRET',
  ...overrides
});
const q=(overrides={})=>sanitizeBenchEvidence({
  schema:'superphivessel.local-console.human-review.v0.1',
  model:'qwen3:4b',reviewed_at:'2026-10-08T22:51:00.000Z',
  source_output_sha256:A,
  source_trial_receipt_schema:'superphivessel.local-console.trial.receipt.v0.1',
  review_kind:'OPERATOR_SELF_REPORT',
  evidence_level:'HUMAN_RATING_NOT_INDEPENDENTLY_VERIFIED',
  helpfulness:'4',completeness:'POSSIBLY_CUT_OFF',
  verification:'NOT_CHECKED',prompt_included:false,
  generated_text_included:false,free_text_notes_included:false,
  inference_performed_by_review:false,cloud_execution_approved:false,
  model_routing_approved:false,quality_gate_approved:false,authority_granted:false,
  raw_response:'NEVER_LEAK_THIS_SECRET',...overrides
});

test('PC01 one observed fixed-protocol model is a sample, never qualified',()=>{
  const result=buildProtocolCohorts([p()]);
  assert.equal(result.schema,COHORT_SCHEMA);
  assert.equal(result.cohort_count,1);
  assert.equal(result.labeled_comparable_receipt_count,1);
  assert.equal(result.automatic_ranking_performed,false);
  assert.equal(result.model_selection_performed,false);
  assert.equal(result.model_routing_approved,false);
  assert.equal(result.authority_granted,false);
  const row=result.groups[0];
  assert.equal(row.model,'qwen3:4b');
  assert.equal(row.protocol_id,'governance-one-sentence-v1');
  assert.equal(row.fixed_output_cap,64);
  assert.equal(row.observation_count,1);
  assert.equal(row.median_wall_ms,36732);
  assert.equal(row.median_generation_tokens_per_sec,55.4);
  assert.equal(row.model_qualified,false);
  assert.equal(row.routing_approved,false);
  assert.ok(row.evidence_gaps.includes('SINGLE_OBSERVATION'));
  assert.ok(row.evidence_gaps.includes('MISSING_HUMAN_REVIEW'));
  assert.ok(row.evidence_gaps.includes('OUTPUT_CAP_REACHED_ON_SOME_TRIALS'));
  assert.ok(!JSON.stringify(result).includes('NEVER_LEAK_THIS_SECRET'));
});
test('PC02 equal public protocol groups by model, not fastest-first',()=>{
  const fast=p({
    model:'zz-quick:1b',timestamp:'2026-10-08T22:47:01.000Z',
    generated_text_sha256:B,elapsed_wall_ms:900,
    ollama_generated_tokens:8,ollama_eval_duration_ns:200000000,
    output_token_cap_reached:false
  });
  const slow=p({
    model:'aa-slow:1b',timestamp:'2026-10-08T22:47:02.000Z',
    generated_text_sha256:C,elapsed_wall_ms:99000,
    ollama_generated_tokens:8,ollama_eval_duration_ns:500000000,
    output_token_cap_reached:false
  });
  const result=buildProtocolCohorts([fast,slow]);
  assert.deepEqual(result.groups.map(x=>x.model),['aa-slow:1b','zz-quick:1b']);
  assert.deepEqual(result.groups.map(x=>x.median_wall_ms),[99000,900]);
  assert.equal(result.model_selection_performed,false);
});
test('PC03 repeated same-protocol observations have numerical medians and distinct dates',()=>{
  const later=p({
    timestamp:'2026-10-08T22:47:00.000Z',
    generated_text_sha256:B,elapsed_wall_ms:30000,
    ollama_load_duration_ns:18000000000,
    ollama_eval_duration_ns:1000000000,
    ollama_generated_tokens:32,
    output_token_cap_reached:false
  });
  const result=buildProtocolCohorts([p(),later,q()]);
  assert.equal(result.cohort_count,1);
  const row=result.groups[0];
  assert.equal(row.observation_count,2);
  assert.equal(row.human_reviewed_observation_count,1);
  assert.equal(row.usefulness_rated_observation_count,1);
  assert.equal(row.operator_reported_claims_checked_count,0);
  assert.equal(row.median_wall_ms,33366);
  assert.equal(row.median_load_ms,20063);
  assert.equal(row.median_generation_tokens_per_sec,43.7);
  assert.ok(!row.evidence_gaps.includes('SINGLE_OBSERVATION'));
  assert.ok(row.evidence_gaps.includes('MISSING_HUMAN_REVIEW'));
  assert.equal(row.first_observed_at,'2026-10-08T22:46:40.147Z');
  assert.equal(row.last_observed_at,'2026-10-08T22:47:00.000Z');
});
test('PC04 custom older receipts stay visible in main bench but not protocol cohorts',()=>{
  const entries=[
    p({protocol_id:null}),
    p({protocol_id:null,generated_text_sha256:B,timestamp:'2026-10-08T22:47:00.000Z'})
  ];
  const result=buildProtocolCohorts(entries);
  assert.equal(result.cohort_count,0);
  assert.equal(result.unlabeled_performance_receipt_count,2);
  assert.equal(result.labeled_comparable_receipt_count,0);
});
test('PC05 public protocol label with wrong output cap is explicitly excluded',()=>{
  const mislabeled=p({protocol_id:'code-bug-v1',max_output_tokens_requested:64,
    generated_text_sha256:B,timestamp:'2026-10-08T22:47:00.000Z'});
  const result=buildProtocolCohorts([mislabeled,p()]);
  assert.equal(result.inconsistent_protocol_cap_receipt_count,1);
  assert.equal(result.labeled_comparable_receipt_count,1);
  assert.equal(result.groups[0].protocol_id,'governance-one-sentence-v1');
});
test('PC06 evidence from different protocols cannot share a comparison cohort',()=>{
  const code=p({
    protocol_id:'code-bug-v1',max_output_tokens_requested:128,
    model:'qwen3:4b',generated_text_sha256:C,
    timestamp:'2026-10-08T22:47:22.000Z'
  });
  const logic=p({
    protocol_id:'logic-steps-v1',max_output_tokens_requested:128,
    model:'qwen3:4b',generated_text_sha256:D,
    timestamp:'2026-10-08T22:47:25.000Z'
  });
  const result=buildProtocolCohorts([code,p(),logic]);
  assert.equal(result.cohort_count,3);
  assert.deepEqual(result.groups.map(g=>g.protocol_id),
    ['governance-one-sentence-v1','logic-steps-v1','code-bug-v1']);
  assert.ok(result.groups.every(g=>g.observation_count===1));
});
test('PC07 reported missing timing remains missing, never presented as zero',()=>{
  const missing=p({
    elapsed_wall_ms:'invalid',
    ollama_load_duration_ns:null,
    ollama_eval_duration_ns:null,
    ollama_prompt_eval_duration_ns:null,
    ollama_generated_tokens:null,
    output_token_cap_reached:false
  });
  const result=buildProtocolCohorts([missing]);
  const row=result.groups[0];
  assert.equal(row.median_wall_ms,null);
  assert.equal(row.median_load_ms,null);
  assert.equal(row.median_generation_tokens_per_sec,null);
  assert.equal(row.wall_time_reporting_count,0);
  assert.equal(row.generation_rate_reporting_count,0);
  assert.ok(row.evidence_gaps.includes('MISSING_WALL_TIME'));
  assert.ok(row.evidence_gaps.includes('MISSING_GENERATION_RATE'));
  assert.ok(row.evidence_gaps.includes('MISSING_PROMPT_EVAL_TIME'));
});
test('PC08 review counts are self-reports and never an independent fact-check',()=>{
  const review=q({verification:'OPERATOR_CHECKED_SUPPORTED'});
  const result=buildProtocolCohorts([p(),review]);
  const row=result.groups[0];
  assert.equal(row.human_reviewed_observation_count,1);
  assert.equal(row.operator_reported_claims_checked_count,1);
  assert.equal(row.model_qualified,false);
  assert.equal(result.independent_trial_assumption,false);
  assert.equal(result.quality_gate_approved,false);
  assert.equal(result.unpaired_human_review_count,0);
});
test('PC09 forged fields and malformed normalized imported evidence fail closed',()=>{
  const good=p();
  for(const bad of [
    {...good,prompt:'LEAK'},
    {...good,authority_granted:true},
    {...good,model_routing_approved:true},
    {...good,protocol_id:'NOT_REAL'},
    {...good,trial_elapsed_ms:Infinity},
    {...good,kind:'HUMAN_REVIEW'},
    {...good,generated_text_included:true}
  ]) assert.throws(()=>buildProtocolCohorts([bad]));
  assert.throws(()=>buildProtocolCohorts(null));
  assert.throws(()=>buildProtocolCohorts(Array(MAX_BENCH_ENTRIES+1).fill(good)));
});
test('PC10 duplicate imports are not new independent samples and conflicting duplicates refuse',()=>{
  const sample=p();
  const duplicates=buildProtocolCohorts([sample,sample]);
  assert.equal(duplicates.groups[0].observation_count,1);
  const changed={...sample,trial_elapsed_ms:100};
  assert.throws(()=>buildProtocolCohorts([sample,changed]),/COHORT_CONFLICTING_DUPLICATE/);
});
