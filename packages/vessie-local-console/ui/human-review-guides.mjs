// Public, source-reviewed answer references for optional HUMAN evaluation.
// No model response is read here. This module must not grade, rank,
// auto-select models or attach approvals to any generated answer.
import {TRIAL_PROTOCOLS,safeProtocolId} from './trial-protocols.mjs';

const entries=[
  {
    protocol_id:'governance-one-sentence-v1',
    title:'Governance · human review reference',
    expected_answer:'Discovery reports that a capability may be present; it does not grant the operator permission to execute it.',
    checks:[
      'Distinguishes inventory or capability discovery from permission.',
      'Explains that an operator or governing policy must explicitly authorize execution.',
      'Does not claim that finding a model automatically permits it to run.'
    ],
    caution:'Other wording can be valid. Review whether the meaning is preserved, not exact words.'
  },
  {
    protocol_id:'logic-steps-v1',
    title:'Logic · human review reference',
    expected_answer:'3 socks. With only 2 socks you could have one red and one blue, but 3 guarantee a same-color pair because there are only two colors.',
    checks:[
      'Provides the minimum number: 3.',
      'Explains why 2 socks are insufficient to guarantee a pair.',
      'Explains why 3 socks guarantee a pair among only two colors.'
    ],
    caution:'The answer can be concise or use the pigeonhole principle. A guessed 3 without reasoning may be less useful for evaluating reasoning.'
  },
  {
    protocol_id:'code-bug-v1',
    title:'Coding · human review reference',
    expected_answer:'The function returns items[1], which is the second element. To return the first element, use items[0].',
    checks:[
      'Identifies the off-by-one indexing mistake.',
      'Explains that JavaScript array indices start at zero.',
      'Proposes items[0] as a suitable fix for the stated intent.'
    ],
    caution:'Extra discussion of empty arrays is optional. Check whether the actual code fix matches the intent, not how confident the model sounds.'
  }
];
const list=Object.freeze(entries.map(entry=>Object.freeze({
  ...entry,
  checks:Object.freeze([...entry.checks])
})));
if(list.length!==TRIAL_PROTOCOLS.length||
  list.some(item=>!TRIAL_PROTOCOLS.some(p=>p.id===item.protocol_id)))
  throw new Error('HUMAN_REFERENCE_PROTOCOL_SET_MISMATCH');
export const HUMAN_REVIEW_GUIDES=list;

export function getHumanReviewGuide(protocolId){
  const safeId=safeProtocolId(protocolId);
  if(safeId===null)return null;
  return list.find(item=>item.protocol_id===safeId)??null;
}

// The localhost server adds protocol_evidence only after validating an
// exact public protocol prompt+token cap. Imported JSON is still
// unauthenticated. This predicate controls the *display*, not scoring.
export function guideForCompletedTrial(receipt){
  if(receipt===null||typeof receipt!=='object'||Array.isArray(receipt)||
     receipt.schema!=='superphivessel.local-console.trial.receipt.v0.1'||
     receipt.authority_granted!==false||
     receipt.private_prompt_included!==false||
     receipt.generated_text_included!==false||
     receipt.protocol_evidence!=='PUBLIC_FIXED_PROMPT_ONLY_NOT_INDEPENDENT_BENCHMARK')
    return null;
  return getHumanReviewGuide(receipt.protocol_id);
}
