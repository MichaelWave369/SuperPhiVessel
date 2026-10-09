import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIAL_PROTOCOLS,getTrialProtocol,exactProtocolMatch,
        safeProtocolId,isFixedProtocolCandidate} from '../ui/trial-protocols.mjs';

test('TP01 fixed cards have bounded unique names, prompts and allowed output caps',()=>{
  assert.equal(TRIAL_PROTOCOLS.length,3);
  assert.equal(new Set(TRIAL_PROTOCOLS.map(x=>x.id)).size,3);
  for(const card of TRIAL_PROTOCOLS){
    assert.ok(Object.isFrozen(card));
    assert.match(card.id,/^[a-z0-9-]+-v1$/);
    assert.ok(card.prompt.length>10&&card.prompt.length<=2000);
    assert.ok([64,128].includes(card.max_output_tokens));
    assert.equal(card.version,1);
    assert.equal(getTrialProtocol(card.id),card);
    assert.ok(exactProtocolMatch(card.id,card.prompt,card.max_output_tokens));
    assert.ok(isFixedProtocolCandidate(card));
  }
});
test('TP02 any prompt, cap or ID mutation fails closed without falling back to labeled experiment',()=>{
  for(const card of TRIAL_PROTOCOLS){
    assert.equal(exactProtocolMatch(card.id,card.prompt+' extra',card.max_output_tokens),false);
    assert.equal(exactProtocolMatch(card.id,card.prompt,card.max_output_tokens===64?128:64),false);
    assert.equal(exactProtocolMatch(card.id.toUpperCase(),card.prompt,card.max_output_tokens),false);
    assert.equal(exactProtocolMatch(card.id,card.prompt.trim().replace(/\.$/,'!'),card.max_output_tokens),false);
  }
  assert.equal(safeProtocolId('unknown-v1'),null);
  assert.equal(getTrialProtocol({id:'governance-one-sentence-v1'}),null);
  assert.equal(isFixedProtocolCandidate(null),false);
});
test('TP03 module is pure: selecting a public card grants no authority or execution',()=>{
  for(const p of TRIAL_PROTOCOLS){
    const s=JSON.stringify(p);
    assert.ok(!s.includes('api_key'));
    assert.ok(!s.includes('authorization'));
    assert.ok(!s.includes('endpoint'));
    assert.ok(!s.includes('model_routing_approved'));
  }
});
