import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CUSTODY_SCHEMA, CUSTODY_RECEIPT_SCHEMA,adapterMessage,
 assessCustodiedProposal,createShadowReceipt,replayShadowReceipt
} from '../src/evidence-custody.mjs';
import {EVIDENCE_GATE_CONTEXT_SCHEMA} from '../src/evidence-gate.mjs';

const NOW='2026-10-17T19:00:00.000Z';
const PAST='2026-10-17T18:00:00.000Z';
const FUTURE='2026-10-17T19:01:00.000Z';
const report={id:'report-1',kind:'REPORT',provenance:'REPORTED',
 statement:'Operator reports a switch may be unreachable',
 reference:null,riskLevel:null,observedConnectivity:null};
const down={id:'down-1',kind:'CONNECTIVITY',provenance:'VERIFIED',
 statement:'Simulated gateway probe returned DOWN (test only)',
 reference:'sha256:'+'a'.repeat(64),riskLevel:null,observedConnectivity:'DOWN'};
const up={id:'up-1',kind:'CONNECTIVITY',provenance:'VERIFIED',
 statement:'Simulated gateway probe returned UP (test only)',
 reference:'sha256:'+'b'.repeat(64),riskLevel:null,observedConnectivity:'UP'};
const impact={id:'impact-1',kind:'IMPACT',provenance:'VERIFIED',
 statement:'Simulated independent impact assessment (test only)',
 reference:'sha256:'+'c'.repeat(64),riskLevel:'high',observedConnectivity:null};
const ctx=(...sources)=>({schema:EVIDENCE_GATE_CONTEXT_SCHEMA,sources});
const custody=(...records)=>({schema:CUSTODY_SCHEMA,records});
const reportRow={sourceId:'report-1',adapterId:'OPERATOR_REPORT',capturedAt:NOW,signature:null};
const props=(risk='undetermined',extra={})=>({
 status:'unknown',risk,confidence:'low',evidence:['report-1'],
 action:'Collect independent diagnostics',...extra
});
const inp=(proposal=props(),sources=[report],records=[reportRow])=>
 ({proposal,context:ctx(...sources),custody:custody(...records)});
const base=()=>inp();
const b64=data=>btoa(String.fromCharCode(...new Uint8Array(data)));
async function newKey(){
 const pair=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const raw=await crypto.subtle.exportKey('raw',pair.publicKey);
 return {pair,keyring:{PROBE_A:b64(raw)}};
}
async function signedRow(source,pair,capturedAt=NOW,adapterId='PROBE_A'){
 const message=adapterMessage(source,adapterId,capturedAt);
 const sig=await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(message));
 return {sourceId:source.id,adapterId,capturedAt,signature:b64(sig)};
}
function includes(result,code){assert.ok(result.custodyViolations.includes(code),JSON.stringify(result));}

test('operator report is allowed as reported evidence but grants no authority',async()=>{
 const res=await assessCustodiedProposal(base(),NOW);
 assert.equal(res.decision,'ALLOW_ASSESSMENT_ONLY');
 assert.equal(res.signatureConfirmsSourceTruth,false);
 assert.equal(res.closureGranted,false);
 assert.equal(res.executionAuthorityGranted,false);
});
test('original local model low/high guesses are rejected by policy',async()=>{
 for(const risk of ['low','high']){
  const res=await assessCustodiedProposal(inp(props(risk)),NOW);
  assert.equal(res.decision,'REJECT_POLICY');
  assert.ok(res.gateVerdict.violations.includes('UNSUPPORTED_SEVERITY'));
 }
});
test('operator-input cannot call itself verified without enrolled signed adapter',async()=>{
 const x=inp(props('undetermined',{status:'verified_down',evidence:['report-1','down-1']}),
   [report,down],[reportRow,{sourceId:'down-1',adapterId:'OPERATOR_REPORT',capturedAt:NOW,signature:null}]);
 includes(await assessCustodiedProposal(x,NOW),'UNSIGNED_VERIFIED_OBSERVATION');
});
test('unknown key ID cannot establish trusted custody',async()=>{
 const {pair}=await newKey();
 const x=inp(props('undetermined',{status:'verified_down',evidence:['report-1','down-1']}),
  [report,down],[reportRow,await signedRow(down,pair)]);
 includes(await assessCustodiedProposal(x,NOW),'UNTRUSTED_ADAPTER');
});
test('signed adapter observation can be checked, but is not a factual attestation',async()=>{
 const {pair,keyring}=await newKey();
 const x=inp(props('undetermined',{status:'verified_down',confidence:'medium',
   evidence:['report-1','down-1']}),[report,down],[reportRow,await signedRow(down,pair)]);
 const res=await assessCustodiedProposal(x,NOW,keyring);
 assert.equal(res.decision,'ALLOW_ASSESSMENT_ONLY');
 assert.equal(res.signatureConfirmsSourceTruth,false);
});
test('forged source value fails signature verification',async()=>{
 const {pair,keyring}=await newKey();
 const row=await signedRow(down,pair);
 const counterfeit={...down,observedConnectivity:'UP'};
 const x=inp(props(),[report,counterfeit],[reportRow,row]);
 includes(await assessCustodiedProposal(x,NOW,keyring),'INVALID_ADAPTER_SIGNATURE');
});
test('signature from an unknown signer cannot impersonate an enrolled adapter',async()=>{
 const {keyring}=await newKey(), {pair:impostor}=await newKey();
 const x=inp(props(),[report,down],[reportRow,await signedRow(down,impostor)]);
 includes(await assessCustodiedProposal(x,NOW,keyring),'INVALID_ADAPTER_SIGNATURE');
});
test('stale and future verified observations fail closed',async()=>{
 const {pair,keyring}=await newKey();
 const stale=await signedRow(down,pair,PAST);
 const future=await signedRow(down,pair,FUTURE);
 includes(await assessCustodiedProposal(inp(props(),[report,down],[reportRow,stale]),NOW,keyring),
  'STALE_VERIFIED_OBSERVATION');
 includes(await assessCustodiedProposal(inp(props(),[report,down],[reportRow,future]),NOW,keyring),
  'FUTURE_EVIDENCE');
});
test('old reports are explicitly stale too',async()=>{
 const old='2026-10-01T19:00:00.000Z';
 includes(await assessCustodiedProposal(inp(props(),[report],[{...reportRow,capturedAt:old}]),NOW),
  'STALE_REPORT');
});
test('missing custody and extra unbound custody records are rejected',async()=>{
 const {pair,keyring}=await newKey();
 includes(await assessCustodiedProposal(inp(props(),[report,down],[reportRow]),NOW,keyring),'MISSING_CUSTODY');
 includes(await assessCustodiedProposal(inp(props(),[report],[reportRow,await signedRow(down,pair)]),NOW,keyring),
  'UNMATCHED_CUSTODY');
});
test('contradictory, genuinely signed fixture observations still fail policy',async()=>{
 const {pair,keyring}=await newKey();
 const x=inp(props('undetermined',{evidence:['report-1','down-1','up-1']}),
  [report,down,up],[reportRow,await signedRow(down,pair),await signedRow(up,pair)]);
 const out=await assessCustodiedProposal(x,NOW,keyring);
 assert.equal(out.decision,'REJECT_POLICY');
 assert.ok(out.gateVerdict.violations.includes('CONTRADICTORY_CONNECTIVITY'));
});
test('verified impact supports only its exact cited severity',async()=>{
 const {pair,keyring}=await newKey();
 const row=await signedRow(impact,pair);
 const positive=inp(props('high',{evidence:['report-1','impact-1']}),
  [report,impact],[reportRow,row]);
 assert.equal((await assessCustodiedProposal(positive,NOW,keyring)).decision,'ALLOW_ASSESSMENT_ONLY');
 const bad=inp(props('critical',{evidence:['report-1','impact-1']}),
  [report,impact],[reportRow,row]);
 assert.equal((await assessCustodiedProposal(bad,NOW,keyring)).decision,'REJECT_POLICY');
});
test('report metadata cannot claim model-supplied privileged adapter',async()=>{
 includes(await assessCustodiedProposal(inp(props(),[report],[{...reportRow,adapterId:'PROBE_A'}]),NOW),
  'REPORT_CUSTODY_INVALID');
});
test('duplicate and injected metadata fields are rejected',async()=>{
 await assert.rejects(assessCustodiedProposal(inp(props(),[report],
  [reportRow,reportRow]),NOW),/CUSTODY_SOURCE_ID/);
 await assert.rejects(assessCustodiedProposal(inp(props(),[report],
  [{...reportRow,authorityGranted:true}]),NOW),/CUSTODY_FIELDS/);
});
test('receipt replays the exact historical result without a persistent ledger write',async()=>{
 const receipt=await createShadowReceipt(base(),NOW);
 assert.equal(receipt.schema,CUSTODY_RECEIPT_SCHEMA);
 const replay=await replayShadowReceipt(JSON.parse(JSON.stringify(receipt)));
 assert.equal(replay.hashVerified,true);
 assert.equal(replay.historical.decision,'ALLOW_ASSESSMENT_ONLY');
 assert.equal(replay.closureGranted,false);
 assert.equal(replay.executionAuthorityGranted,false);
 assert.equal(receipt.persistentLedgerWritten,false);
});
test('tampering with original proposal, verdict or source timestamp breaks receipt digest',async()=>{
 const receipt=await createShadowReceipt(base(),NOW);
 for(const change of [
  b=>{b.input.proposal.risk='critical';},
  b=>{b.result.decision='ALLOW_EXECUTE';},
  b=>{b.input.custody.records[0].capturedAt=PAST;}
 ]){
  const forged=structuredClone(receipt);change(forged);
  await assert.rejects(replayShadowReceipt(forged),/CUSTODY_HASH_MISMATCH/);
 }
});
test('receipt replay must revalidate signed adapter keys; not trust embedded labels',async()=>{
 const {pair,keyring}=await newKey();
 const example=inp(props('undetermined',{status:'verified_down',evidence:['report-1','down-1']}),
  [report,down],[reportRow,await signedRow(down,pair)]);
 const receipt=await createShadowReceipt(example,NOW,keyring);
 assert.equal(receipt.result.decision,'ALLOW_ASSESSMENT_ONLY');
 await assert.rejects(replayShadowReceipt(receipt),/CUSTODY_REPLAY_MISMATCH/);
 const original=await replayShadowReceipt(receipt,keyring);
 assert.equal(original.historical.decision,'ALLOW_ASSESSMENT_ONLY');
});
test('fresh at time of receipt may be stale when replayed later',async()=>{
 const {pair,keyring}=await newKey();
 const x=inp(props(),[report,down],[reportRow,await signedRow(down,pair)]);
 const receipt=await createShadowReceipt(x,NOW,keyring);
 const historical=await replayShadowReceipt(receipt,keyring,PAST);
 assert.equal(historical.historical.decision,'ALLOW_ASSESSMENT_ONLY');
 const replay=await replayShadowReceipt(receipt,keyring,'2026-10-17T20:00:00.000Z');
 assert.equal(replay.current.decision,'REJECT_CUSTODY');
 assert.ok(replay.current.custodyViolations.includes('STALE_VERIFIED_OBSERVATION'));
});
test('receipt rejects fake privileges, unrecognized keys and oversized content',async()=>{
 const receipt=await createShadowReceipt(base(),NOW);
 await assert.rejects(replayShadowReceipt({...receipt,closureGranted:true}),/CUSTODY_RECEIPT_AUTHORITY/);
 await assert.rejects(replayShadowReceipt({...receipt,extra:'YES'}),/CUSTODY_FIELDS/);
 await assert.rejects(createShadowReceipt(inp({...props(),action:'a'.repeat(66000)}),NOW),/CUSTODY_SIZE/);
});
test('caller objects remain unchanged even when receipt is modified',async()=>{
 const initial=base(), old=JSON.stringify(initial);
 const receipt=await createShadowReceipt(initial,NOW);
 receipt.input.proposal.evidence.push('new-id');
 assert.equal(JSON.stringify(initial),old);
});
