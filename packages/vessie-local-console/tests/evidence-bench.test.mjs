import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BENCH_ENTRIES,sanitizeBenchEvidence,addBenchEvidence,buildBenchSummary
} from '../ui/evidence-bench.mjs';

const digestA='a'.repeat(64),digestB='b'.repeat(64),digestC='c'.repeat(64);
const performance=(changes={})=>({
  schema:'superphivessel.local-console.trial.receipt.v0.1',
  observation:'LOCAL_OLLAMA_API_RESULT_UNATTESTED',
  timestamp:'2026-10-08T22:46:40.147Z',
  model:'qwen3:4b',route:'LOCAL_LOOPBACK_FIXED',
  max_output_tokens_requested:64,elapsed_wall_ms:36732,
  ollama_load_duration_ns:22125996200,
  ollama_prompt_eval_duration_ns:11800000000,
  ollama_generated_tokens:64,ollama_prompt_tokens:27,
  ollama_eval_duration_ns:1155987000,
  generated_text_sha256:digestA,
  output_token_cap_reached:true,ollama_done_reason:'length',
  private_prompt_included:false,generated_text_included:false,
  authority_granted:false,model_routing_approved:false,
  cloud_execution_approved:false,
  private_prompt:'DO_NOT_INCLUDE_SECRET_PROMPT',
  generated_answer:'DO_NOT_INCLUDE_SECRET_ANSWER',
  private_cookie:'DO_NOT_INCLUDE_SECRET_COOKIE',
  ...changes
});
const review=(changes={})=>({
  schema:'superphivessel.local-console.human-review.v0.1',
  review_kind:'OPERATOR_SELF_REPORT',
  evidence_level:'HUMAN_RATING_NOT_INDEPENDENTLY_VERIFIED',
  reviewed_at:'2026-10-08T23:01:00.000Z',
  model:'qwen3:4b',source_output_sha256:digestA,
  source_trial_receipt_schema:'superphivessel.local-console.trial.receipt.v0.1',
  helpfulness:'4',completeness:'POSSIBLY_CUT_OFF',verification:'NOT_CHECKED',
  prompt_included:false,generated_text_included:false,
  free_text_notes_included:false,inference_performed_by_review:false,
  cloud_execution_approved:false,model_routing_approved:false,
  quality_gate_approved:false,authority_granted:false,
  answer:'DO_NOT_INCLUDE_SECRET_ANSWER',
  private_notes:'DO_NOT_INCLUDE_SECRET_NOTES',
  ...changes
});
const add=(...receipts)=>receipts.reduce((list,receipt)=>addBenchEvidence(list,receipt),[]);

test('EB01 strip all prompt, answer, credentials, private notes and unexpected fields',()=>{
  const perf=sanitizeBenchEvidence(performance());
  const quality=sanitizeBenchEvidence(review());
  for(const evidence of [perf,quality]){
    assert.equal(evidence.authority_granted,false);
    assert.equal(evidence.prompt_included,false);
    assert.equal(evidence.generated_text_included,false);
    assert.ok(Object.isFrozen(evidence));
    for(const name of ['DO_NOT_INCLUDE_SECRET_PROMPT','DO_NOT_INCLUDE_SECRET_ANSWER',
      'DO_NOT_INCLUDE_SECRET_COOKIE','DO_NOT_INCLUDE_SECRET_NOTES']){
      assert.equal(JSON.stringify(evidence).includes(name),false);
    }
  }
});
test('EB02 compare two local model performance records without ranking',()=>{
  const bench=add(
    performance(),performance({
      model:'gemma3:1b',timestamp:'2026-10-08T22:47:00.000Z',
      generated_text_sha256:digestB,elapsed_wall_ms:6000,
      ollama_generated_tokens:12,ollama_eval_duration_ns:600000000
    }),review()
  );
  const summary=buildBenchSummary(bench);
  assert.equal(summary.rows.length,2);
  assert.equal(summary.performance_receipt_count,2);
  assert.equal(summary.human_review_receipt_count,1);
  assert.equal(summary.automatic_ranking_performed,false);
  assert.equal(summary.model_routing_approved,false);
  assert.equal(summary.quality_gate_approved,false);
  assert.equal(summary.authority_granted,false);
  assert.equal(summary.rows[0].model,'qwen3:4b');
  assert.equal(summary.rows[1].model,'gemma3:1b');
  assert.equal(summary.rows[0].wall_ms,36732);
  assert.equal(summary.rows[0].model_load_ms,22126);
  assert.equal(summary.rows[0].reported_generation_tokens_per_second,55.4);
  assert.equal(summary.rows[0].human_review_status,'OPERATOR_SELF_REPORT');
  assert.equal(summary.rows[0].helpfulness,'4');
  assert.equal(summary.rows[1].human_review_status,'NOT_ASSESSED');
  assert.equal(summary.rows[1].verification,'NOT_CHECKED');
  assert.ok(!JSON.stringify(summary).includes('DO_NOT_INCLUDE_SECRET'));
});
test('EB03 a review of another output hash or model never automatically matches',()=>{
  const entries=add(performance(),review({source_output_sha256:digestB}),
    review({model:'other:4b',source_output_sha256:digestA}));
  const summary=buildBenchSummary(entries);
  assert.equal(summary.unpaired_human_reviews,2);
  assert.equal(summary.rows[0].human_review_status,'NOT_ASSESSED');
  assert.equal(summary.rows[0].matched_reviews,0);
});
test('EB04 newest self-reported review for the same output wins descriptive display',()=>{
  const entries=add(performance(),review(),review({
    reviewed_at:'2026-10-08T23:02:00.000Z',
    helpfulness:'2',verification:'OPERATOR_CHECKED_CONTRADICTED'
  }));
  const row=buildBenchSummary(entries).rows[0];
  assert.equal(row.matched_reviews,2);
  assert.equal(row.helpfulness,'2');
  assert.equal(row.verification,'OPERATOR_CHECKED_CONTRADICTED');
  assert.equal(row.no_routing_approval,true);
});
test('EB05 identical import is idempotent and strict bounded capacity is enforced',()=>{
  let entries=add(performance());
  entries=addBenchEvidence(entries,performance());
  assert.equal(entries.length,1);
  for(let i=1;i<MAX_BENCH_ENTRIES;i++){
    entries=addBenchEvidence(entries,performance({
      timestamp:'2026-10-08T22:46:'+String(i).padStart(2,'0')+'.147Z',
      generated_text_sha256:digestC
    }));
  }
  assert.equal(entries.length,MAX_BENCH_ENTRIES);
  assert.throws(()=>addBenchEvidence(entries,performance({
    timestamp:'2026-10-08T22:48:00.000Z',
    generated_text_sha256:digestB
  })),/BENCH_FULL/);
});
test('EB06 incoming forged grants, missing privacy flags, huge or poisoned model names rejected',()=>{
  for(const input of [
    performance({authority_granted:true}),
    performance({model_routing_approved:true}),
    performance({cloud_execution_approved:true}),
    performance({private_prompt_included:true}),
    performance({generated_text_included:true}),
    performance({generated_text_sha256:'BAD'}),
    performance({route:'PAID_CLOUD'}),
    performance({model:'malicious\nmodel'}),
    performance({model:'x'.repeat(129)}),
    review({quality_gate_approved:true}),
    review({inference_performed_by_review:true}),
    review({verification:'AUTO_VERIFIED'}),
    review({helpfulness:'100'}),
    review({free_text_notes_included:true}),
    review({source_output_sha256:'f'.repeat(63)})
  ])assert.throws(()=>sanitizeBenchEvidence(input));
});
test('EB07 old v0.1 receipt lacks prompt evaluation and done reason: show unknown instead of zero',()=>{
  const old=performance();
  delete old.ollama_prompt_eval_duration_ns;
  delete old.ollama_done_reason;
  delete old.output_token_cap_reached;
  const row=buildBenchSummary(add(old)).rows[0];
  assert.equal(row.prompt_eval_ms,null);
  assert.equal(row.stop_reason,'UNREPORTED_OR_UNKNOWN');
  assert.equal(row.human_review_status,'NOT_ASSESSED');
  assert.equal(row.reported_generation_tokens_per_second,55.4);
});
test('EB08 invalid time, tokens, or numeric statistics do not create false numbers',()=>{
  for(const input of [
    performance({timestamp:'today'}),performance({max_output_tokens_requested:129}),
    performance({max_output_tokens_requested:0}),
    review({reviewed_at:'yesterday'})
  ])assert.throws(()=>sanitizeBenchEvidence(input));
  const data=performance({
    elapsed_wall_ms:'SECRET',ollama_load_duration_ns:-1,
    ollama_prompt_eval_duration_ns:Infinity,ollama_eval_duration_ns:0,
    ollama_generated_tokens:12.3
  });
  const row=buildBenchSummary(add(data)).rows[0];
  assert.equal(row.wall_ms,null);
  assert.equal(row.model_load_ms,null);
  assert.equal(row.prompt_eval_ms,null);
  assert.equal(row.reported_generation_tokens_per_second,null);
});
test('EB09 no background or inference side effect: evidence processing accepts only data',()=>{
  const entries=add(performance(),review());
  const summary=buildBenchSummary(entries);
  assert.equal(summary.scope,'EPHEMERAL_OPERATOR_REVIEW_ONLY');
  assert.equal(summary.source_trust,'IMPORTED_OR_LOCAL_OPERATOR_INPUT_UNATTESTED');
  assert.equal(summary.prompt_included,false);
  assert.equal(summary.generated_text_included,false);
  assert.equal(summary.automatic_ranking_performed,false);
  assert.equal(summary.cloud_execution_approved,false);
});
