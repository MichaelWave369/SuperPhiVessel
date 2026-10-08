import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHumanReview} from '../ui/review-evidence.mjs';

const reference=()=>({
  schema:'superphivessel.local-console.trial.receipt.v0.1',
  model:'qwen3:4b',
  generated_text_sha256:'a'.repeat(64),
  generated_text_included:false,
  private_prompt_included:false,
  authority_granted:false,
  response:'SECRET_RESPONSE_NEVER_EXPORT',
  prompt:'SECRET_PROMPT_NEVER_EXPORT',
  private_upstream_key:'SECRET_API_KEY_NEVER_EXPORT',
  ollama_total_duration_ns:36725868300,
  ollama_load_duration_ns:22125996200
});
const reviewedAt='2026-10-08T22:46:40.147Z';
const input=()=>({
  performanceReceipt:reference(),
  helpfulness:'4',
  completeness:'POSSIBLY_CUT_OFF',
  verification:'NOT_CHECKED',
  reviewedAt
});

test('HR01 operator self-report links to output hash without leaking prompt or answer',()=>{
  const result=makeHumanReview(input());
  assert.equal(result.schema,'superphivessel.local-console.human-review.v0.1');
  assert.equal(result.review_kind,'OPERATOR_SELF_REPORT');
  assert.equal(result.evidence_level,'HUMAN_RATING_NOT_INDEPENDENTLY_VERIFIED');
  assert.equal(result.model,'qwen3:4b');
  assert.equal(result.source_output_sha256,'a'.repeat(64));
  assert.equal(result.helpfulness,'4');
  assert.equal(result.completeness,'POSSIBLY_CUT_OFF');
  assert.equal(result.verification,'NOT_CHECKED');
  assert.equal(result.authority_granted,false);
  assert.equal(result.quality_gate_approved,false);
  assert.equal(result.model_routing_approved,false);
  assert.equal(result.inference_performed_by_review,false);
  assert.equal(result.prompt_included,false);
  assert.equal(result.generated_text_included,false);
  const json=JSON.stringify(result);
  for(const leak of ['SECRET_PROMPT','SECRET_RESPONSE','SECRET_API_KEY','36725868300']) {
    assert.equal(json.includes(leak),false);
  }
  assert.ok(Object.isFrozen(result));
});
test('HR02 only fixed categorical human ratings are accepted',()=>{
  for(const field of ['helpfulness','completeness','verification']){
    for(const value of ['',null,'<script>','EXPERT_VERIFIED',1]){
      const args=input();args[field]=value;
      assert.throws(()=>makeHumanReview(args));
    }
  }
  assert.equal(makeHumanReview({...input(),helpfulness:'NOT_ASSESSED'}).helpfulness,'NOT_ASSESSED');
  assert.equal(makeHumanReview({...input(),verification:'OPERATOR_CHECKED_CONTRADICTED'}).verification,
    'OPERATOR_CHECKED_CONTRADICTED');
});
test('HR03 rejects missing/forged/redaction-claiming source receipts',()=>{
  for(const source of [
    null,{},[],{...reference(),schema:'OTHER'},
    {...reference(),private_prompt_included:true},
    {...reference(),generated_text_included:true},
    {...reference(),authority_granted:true},
    {...reference(),generated_text_sha256:'invalid'},
    {...reference(),generated_text_sha256:'A'.repeat(64)},
    {...reference(),model:'bad\nmodel'},
    {...reference(),model:'x'.repeat(129)}
  ]){
    assert.throws(()=>makeHumanReview({...input(),performanceReceipt:source}));
  }
});
test('HR04 ignores injected upstream fields rather than serializing the original receipt',()=>{
  const source={
    ...reference(),execution_authorized:true,routing_approved:true,
    response_text:'NEVER_COPY_THIS',
    bearer_token:'LEAK_ME_NOT',
    optional_notes:'SENSITIVE_NOTES'
  };
  const result=makeHumanReview({...input(),performanceReceipt:source});
  const text=JSON.stringify(result);
  for(const term of ['NEVER_COPY_THIS','LEAK_ME_NOT','SENSITIVE_NOTES','execution_authorized']){
    assert.equal(text.includes(term),false);
  }
  assert.equal(result.model_routing_approved,false);
  assert.equal(result.quality_gate_approved,false);
});
test('HR05 old v0.1 receipt without new timing fields remains reviewable',()=>{
  const old={
    schema:'superphivessel.local-console.trial.receipt.v0.1',
    timestamp:'2026-10-08T22:46:40.147Z',
    model:'qwen3:4b',
    generated_text_sha256:'b'.repeat(64),
    generated_text_included:false,
    private_prompt_included:false,
    authority_granted:false
  };
  const result=makeHumanReview({...input(),performanceReceipt:old});
  assert.equal(result.source_output_sha256,'b'.repeat(64));
  assert.equal(result.helpfulness,'4');
});
test('HR06 operator review timestamp must be a bounded ISO string',()=>{
  for(const reviewedAt of ['tomorrow','',42,'2030-01-01','x'.repeat(100)]){
    assert.throws(()=>makeHumanReview({...input(),reviewedAt}));
  }
  assert.equal(makeHumanReview(input()).reviewed_at,reviewedAt);
});
test('HR07 review helper is pure: no network, storage, routing, inference hooks',()=>{
  const result=makeHumanReview(input());
  const keys=Object.keys(result);
  assert.ok(!keys.some(k=>/prompt_text|generated_response|provider_url|token|memory|router_plan/i.test(k)));
  assert.equal(result.cloud_execution_approved,false);
  assert.equal(result.inference_performed_by_review,false);
  assert.equal(result.quality_gate_approved,false);
});
