// E1-C Vessie review adapter: browser/Node Web Crypto only, no providers,
// network, local files, persistent storage, inference, or authority.
export const SCHEMA='nbg-pocketmesh.council-evidence-exchange-e1.v0.1';
const E0='nbg-pocketmesh.council-keyhole-e0.v0.1';
const INTERPRETATION='Synthetic contract output; no scientific corroboration';
const HASH=/^[a-f0-9]{64}$/;
const SHA=/^[a-f0-9]{40}$/;
const CASE=/^[a-zA-Z0-9._:-]{1,64}$/;
const FIELDS=[
  'schema','policyEpoch','caseId','e0Schema','e0ReceiptSha256','origin',
  'privacy','authority','state','sourceProvenance','independentEvidence',
  'executionAuthorized','mergeAuthorized','sharingAuthorized','externalCalls',
  'receipts','exchangeSha256'
];
const RECEIPT_FIELDS=[
  'schema','caseId','participant','repository','sourceSha','sourceIdentity',
  'role','claimTier','action','parentE0Sha256','origin','privacy',
  'authority','modelExecuted','operatorApproved','evidenceAuthenticated',
  'transportPerformed','interpretation','receiptSha256'
];
const SEATS=Object.freeze([
  Object.freeze({participant:'ThinkTank',repository:'MichaelWave369/think-tank',
    role:'HYPOTHESIS_CHALLENGER',claimTier:'HYPOTHESIS_ONLY',
    actions:Object.freeze(['CHALLENGE_AGGREGATE_EQUIVALENCE','REVIEW_E0_RESULT'])}),
  Object.freeze({participant:'PocketBrain',repository:'MichaelWave369/PocketBrain',
    role:'LOCAL_OBSERVER',claimTier:'DISPLAY_ONLY',
    actions:Object.freeze(['DISPLAY_K0_K1_CONTRAST','DISPLAY_E0_RESULT'])}),
  Object.freeze({participant:'Vessie',repository:'MichaelWave369/SuperPhiVessel',
    role:'GOVERNANCE_REVIEWER',claimTier:'REVIEW_ONLY',
    actions:Object.freeze(['HOLD_FOR_OPERATOR_REVIEW'])})
]);

const assert=(condition,code)=>{if(!condition)throw new Error(code);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.getPrototypeOf(value)===Object.prototype;
function exact(value,fields,code){
  assert(plain(value),code);
  assert(JSON.stringify(Object.keys(value).sort())===JSON.stringify([...fields].sort()),code);
}
function fixed(value,entries,code){
  for(const [key,expected] of Object.entries(entries))assert(value[key]===expected,code);
}
function canon(value){
  if(Array.isArray(value))return '['+value.map(canon).join(',')+']';
  if(value!==null&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canon(value[k])).join(',')+'}';
  }
  return JSON.stringify(value);
}
async function sha256(value){
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canon(value)));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
async function digestMatches(value,key,code){
  const claimed=value[key];
  assert(typeof claimed==='string'&&HASH.test(claimed),code);
  const without=Object.fromEntries(Object.entries(value).filter(([k])=>k!==key));
  assert(await sha256(without)===claimed,code);
}

// Only returns allowlisted categorical display fields. This does NOT
// authenticate a repo SHA or prove E0 executed: self-consistent forgeries pass.
export async function inspectVessieCouncilE1(bundle){
  exact(bundle,FIELDS,'COUNCIL_E1_OUTER_SCHEMA_REFUSED');
  fixed(bundle,{
    schema:SCHEMA,policyEpoch:1,e0Schema:E0,origin:'SIMULATED',
    privacy:'PUBLIC_SYNTHETIC',authority:'NONE',
    state:'HELD_FOR_OPERATOR_REVIEW',sourceProvenance:'DECLARED_UNVERIFIED',
    independentEvidence:false,executionAuthorized:false,
    mergeAuthorized:false,sharingAuthorized:false,externalCalls:0
  },'COUNCIL_E1_TRUST_REFUSED');
  assert(typeof bundle.caseId==='string'&&CASE.test(bundle.caseId),'COUNCIL_E1_CASE_REFUSED');
  assert(typeof bundle.e0ReceiptSha256==='string'&&HASH.test(bundle.e0ReceiptSha256),
    'COUNCIL_E1_E0_PARENT_REFUSED');
  assert(Array.isArray(bundle.receipts)&&bundle.receipts.length===SEATS.length,
    'COUNCIL_E1_SEATS_REFUSED');
  const actions=[];
  const display=[];
  for(let i=0;i<SEATS.length;i++){
    const seat=SEATS[i];
    const receipt=bundle.receipts[i];
    exact(receipt,RECEIPT_FIELDS,'COUNCIL_E1_SEAT_SCHEMA_REFUSED');
    fixed(receipt,{
      schema:SCHEMA,caseId:bundle.caseId,
      participant:seat.participant,repository:seat.repository,
      role:seat.role,claimTier:seat.claimTier,
      sourceIdentity:'DECLARED_UNVERIFIED',
      parentE0Sha256:bundle.e0ReceiptSha256,
      origin:'SIMULATED',privacy:'PUBLIC_SYNTHETIC',authority:'NONE',
      modelExecuted:false,operatorApproved:false,evidenceAuthenticated:false,
      transportPerformed:false,interpretation:INTERPRETATION
    },'COUNCIL_E1_SEAT_TRUST_REFUSED');
    assert(typeof receipt.sourceSha==='string'&&SHA.test(receipt.sourceSha),
      'COUNCIL_E1_SOURCE_SHA_REFUSED');
    assert(seat.actions.includes(receipt.action),'COUNCIL_E1_ACTION_REFUSED');
    await digestMatches(receipt,'receiptSha256','COUNCIL_E1_SEAT_HASH_REFUSED');
    actions.push(receipt.action);
    display.push(Object.freeze({
      participant:seat.participant,role:seat.role,
      action:receipt.action,declaredSha:receipt.sourceSha
    }));
  }
  const witness=actions[0]==='CHALLENGE_AGGREGATE_EQUIVALENCE';
  assert(actions[1]===(witness?'DISPLAY_K0_K1_CONTRAST':'DISPLAY_E0_RESULT'),
    'COUNCIL_E1_ACTION_PAIR_REFUSED');
  await digestMatches(bundle,'exchangeSha256','COUNCIL_E1_ENVELOPE_HASH_REFUSED');
  return Object.freeze({
    schema:'superphivessel.council-e1-review.v0.1',
    disposition:'HELD_UNTRUSTED_REVIEW_ONLY',
    caseId:bundle.caseId,
    parentDigest:bundle.e0ReceiptSha256,
    exchangeDigest:bundle.exchangeSha256,
    keyholeContrastSuggested:witness,
    seats:Object.freeze(display),
    councilApproval:false,
    scientificEvidence:false,
    sourceAuthenticated:false,
    independentCorroboration:false,
    modelCalled:false,
    sharingAuthorized:false,
    executionAuthorized:false,
    routingAuthorized:false,
    mergeAuthorized:false
  });
}
