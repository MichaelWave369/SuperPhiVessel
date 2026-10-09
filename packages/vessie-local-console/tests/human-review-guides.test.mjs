import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUMAN_REVIEW_GUIDES,getHumanReviewGuide,guideForCompletedTrial
} from '../ui/human-review-guides.mjs';
import {TRIAL_PROTOCOLS} from '../ui/trial-protocols.mjs';

const receipt=(extra={})=>({
  schema:'superphivessel.local-console.trial.receipt.v0.1',
  model:'qwen3:4b',protocol_id:'logic-steps-v1',
  protocol_evidence:'PUBLIC_FIXED_PROMPT_ONLY_NOT_INDEPENDENT_BENCHMARK',
  private_prompt_included:false,generated_text_included:false,
  authority_granted:false,generated_text_sha256:'a'.repeat(64),
  ...extra
});
test('HG01 one operator-only answer reference exists for each public protocol',()=>{
  assert.equal(HUMAN_REVIEW_GUIDES.length,TRIAL_PROTOCOLS.length);
  assert.equal(new Set(HUMAN_REVIEW_GUIDES.map(x=>x.protocol_id)).size,3);
  for(const p of TRIAL_PROTOCOLS){
    const guide=getHumanReviewGuide(p.id);
    assert.ok(guide);
    assert.ok(Object.isFrozen(guide));
    assert.ok(Object.isFrozen(guide.checks));
    assert.equal(guide.checks.length,3);
    assert.ok(guide.expected_answer.length>25);
    assert.ok(guide.caution.length>20);
  }
});
test('HG02 logic guide correctly explains 3 socks and why 2 cannot guarantee a pair',()=>{
  const guide=getHumanReviewGuide('logic-steps-v1');
  assert.ok(guide.expected_answer.includes('3 socks'));
  assert.ok(guide.expected_answer.includes('one red and one blue'));
  assert.ok(guide.checks.some(x=>x.includes('2 socks')));
});
test('HG03 coding guide identifies first element items[0] instead of second items[1]',()=>{
  const guide=getHumanReviewGuide('code-bug-v1');
  assert.ok(guide.expected_answer.includes('items[1]'));
  assert.ok(guide.expected_answer.includes('items[0]'));
});
test('HG04 governance reference separates model discovery from operator permission',()=>{
  const guide=getHumanReviewGuide('governance-one-sentence-v1');
  assert.ok(guide.expected_answer.includes('permission'));
  assert.ok(guide.checks.some(x=>x.includes('authoriz')));
});
test('HG05 unknown or unlabeled trials never show a reference',()=>{
  for(const id of [undefined,null,'',false,'paid-model-secret']){
    assert.equal(getHumanReviewGuide(id),null);
    assert.equal(guideForCompletedTrial(receipt({protocol_id:id})),null);
  }
});
test('HG06 only a successful, privacy-preserving, server-labeled receipt can show reference',()=>{
  assert.equal(guideForCompletedTrial(receipt()).protocol_id,'logic-steps-v1');
  for(const r of [
    receipt({authority_granted:true}),
    receipt({private_prompt_included:true}),
    receipt({generated_text_included:true}),
    receipt({protocol_evidence:'UNVERIFIED'}),
    receipt({schema:'another.schema'}),
    null,[],{}
  ])assert.equal(guideForCompletedTrial(r),null);
});
test('HG07 reference module offers no model response processor, automatic grade or router',()=>{
  for(const guide of HUMAN_REVIEW_GUIDES){
    assert.equal(guide.assessment,undefined);
    assert.equal(guide.score,undefined);
    assert.equal(guide.model_routing_approved,undefined);
    assert.equal(guide.authority_granted,undefined);
  }
});
