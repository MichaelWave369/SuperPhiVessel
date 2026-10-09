// Public, versioned, fixed-text trial protocols. Human action is required
// to load a card AND to execute each selected local model trial.
// Nothing here can invoke inference, rank models, or authorize a route.
export const TRIAL_PROTOCOLS=Object.freeze([
  Object.freeze({
    id:'governance-one-sentence-v1',
    title:'Governance · one sentence',
    lane:'governance',
    version:1,
    max_output_tokens:64,
    prompt:'Explain in one sentence why discovering an AI model does not automatically authorize executing it.'
  }),
  Object.freeze({
    id:'logic-steps-v1',
    title:'Logic · explain your steps',
    lane:'reasoning',
    version:1,
    max_output_tokens:128,
    prompt:'A drawer contains 3 red socks and 2 blue socks. Without looking, what is the smallest number of socks you must take to guarantee two of the same color? Give the number and one sentence explaining why.'
  }),
  Object.freeze({
    id:'code-bug-v1',
    title:'Code · spot the bug',
    lane:'coding',
    version:1,
    max_output_tokens:128,
    prompt:'Find the bug in this JavaScript and describe one fix in two sentences: function first(items) { return items[1]; } // Intended: return the first element of the array.'
  })
]);
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
export function getTrialProtocol(id){
  return typeof id==='string' ? TRIAL_PROTOCOLS.find(p=>p.id===id)??null : null;
}
export function exactProtocolMatch(id,prompt,maxOutputTokens){
  const p=getTrialProtocol(id);
  return p!==null&&typeof prompt==='string'&&p.prompt===prompt&&
    Number.isInteger(maxOutputTokens)&&p.max_output_tokens===maxOutputTokens;
}
export function protocolIsKnown(id){
  return getTrialProtocol(id)!==null;
}
export function safeProtocolId(value){
  return typeof value==='string'&&protocolIsKnown(value)?value:null;
}
export function isFixedProtocolCandidate(value){
  return value&&typeof value==='object'&&!Array.isArray(value)&&
    own(value,'id')&&own(value,'prompt')&&own(value,'max_output_tokens')&&
    exactProtocolMatch(value.id,value.prompt,value.max_output_tokens);
}
