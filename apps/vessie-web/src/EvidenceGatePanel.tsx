import {useState} from 'react';
import {EVIDENCE_GATE_CONTEXT_SCHEMA} from './evidence-gate.mjs';
import type {EvidenceContext,EvidenceProposal} from './evidence-gate.mjs';
import {CUSTODY_SCHEMA,createShadowReceipt,replayShadowReceipt} from './evidence-custody.mjs';
import type {ShadowReceipt,CustodyVerdict} from './evidence-custody.mjs';
import SmergeonShadowPanel from './SmergeonShadowPanel';

const reportedOnly:EvidenceContext = {
  schema:EVIDENCE_GATE_CONTEXT_SCHEMA,
  sources:[{
    id:'report-1',kind:'REPORT',provenance:'REPORTED',
    statement:'A network switch has reportedly lost connectivity.',
    reference:null,riskLevel:null,observedConnectivity:null
  }]
};
const example:EvidenceProposal = {
  status:'unknown',risk:'high',confidence:'low',
  evidence:['report-1'],
  action:'Inspect power, links and upstream dependencies; collect telemetry'
};
const MAX_TEXT=16_384;
const MAX_RECEIPT=65_536;
function downloadReceipt(data:ShadowReceipt){
  const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
  const href=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=href;
  link.download='anti-m-evidence-gate-shadow-receipt.json';
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(href),1000);
}

/* Operator-only, browser-memory demo. Empty trusted keyring is intentional:
 * no real adapter is connected, so signed VERIFIED evidence will not promote.
 * This bench DOES NOT modify Anti-M closure state, route models or call Ollama.
 */
export default function EvidenceGatePanel(){
  const [draft,setDraft]=useState(JSON.stringify(example,null,2));
  const [verdict,setVerdict]=useState<CustodyVerdict|null>(null);
  const [receipt,setReceipt]=useState<ShadowReceipt|null>(null);
  const [importText,setImportText]=useState('');
  const [replayResult,setReplayResult]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function evaluate(){
    if(busy)return;
    setBusy(true);setVerdict(null);setReceipt(null);setReplayResult('');setError('');
    try{
      if(new TextEncoder().encode(draft).length>MAX_TEXT)throw new Error('INPUT_TOO_LARGE');
      const input:unknown=JSON.parse(draft);
      const asOf=new Date().toISOString();
      const custody={schema:CUSTODY_SCHEMA,records:[{
        sourceId:'report-1',adapterId:'OPERATOR_REPORT',capturedAt:asOf,signature:null
      }]};
      const created=await createShadowReceipt(
        {proposal:input as EvidenceProposal,context:reportedOnly,custody},asOf);
      setReceipt(created);setVerdict(created.result);
    }catch(err){
      setError(err instanceof Error?err.message:'CUSTODY_REFUSED');
    }finally{setBusy(false);}
  }
  async function replay(){
    if(busy)return;
    setBusy(true);setError('');setReplayResult('');
    try{
      if(new TextEncoder().encode(importText).length>MAX_RECEIPT)throw new Error('RECEIPT_TOO_LARGE');
      const parsed:unknown=JSON.parse(importText);
      // No keyring from pasted JSON. Future signed adapters must be enrolled
      // outside this UI; a forged receipt cannot nominate its own trust root.
      const result=await replayShadowReceipt(parsed as ShadowReceipt,{},new Date().toISOString());
      setReplayResult(
        'HISTORICAL '+result.historical.decision+
        ' / CURRENT '+(result.current?.decision??'NOT_CHECKED')+
        ' / HASH RECOMPUTED / NO EXECUTION AUTHORITY');
    }catch(err){
      setError(err instanceof Error?err.message:'REPLAY_REFUSED');
    }finally{setBusy(false);}
  }
  function resetTo(proposal:EvidenceProposal){
    setDraft(JSON.stringify(proposal,null,2));
    setReceipt(null);setVerdict(null);setReplayResult('');setError('');
  }
  return <section className="antiMCard antiMForm" aria-label="Anti-M evidence gate shadow bench">
    <div className="antiMCardTitle">
      <h3>05 / Evidence Gate V3.1 · Shadow Bench</h3>
      <span>SOURCE CUSTODY · NO AUTHORITY</span>
    </div>
    <p className="smallNote">
      This browser-only bench uses a fixed operator-reported switch incident,
      with no verified telemetry or impact. Pasted proposals cannot add trusted sources.
      No live probe, signature trust key, Ollama call, automatic routing, Anti-M DONE,
      or permanent ledger write is connected.
    </p>
    <label>MODEL PROPOSAL JSON · MAX 16 KIB
      <textarea rows={10} spellCheck={false} maxLength={MAX_TEXT}
        value={draft} onChange={e=>{setDraft(e.target.value);setVerdict(null);setReceipt(null);setError('');setReplayResult('');}}/>
    </label>
    <div className="antiMButtons">
      <button type="button" className="primaryButton" disabled={busy} onClick={()=>void evaluate()}>
        EVALUATE PROPOSAL →
      </button>
      <button type="button" className="secondaryButton" disabled={busy}
        onClick={()=>resetTo({...example,risk:'undetermined'})}>LOAD CONSERVATIVE CONTROL</button>
    </div>
    {error&&<div className="error" role="alert">Evidence Gate refused: {error}. No authority was granted.</div>}
    {verdict&&<div className="antiMReadiness" role="status" aria-live="polite">
      <strong>Policy verdict: {verdict.decision}</strong>
      <p className="smallNote">Custody policy: {verdict.policyVersion} · {verdict.trustScope}.
        ALLOW means a narrow rule found no violation, not a verified diagnosis.</p>
      {verdict.custodyViolations.length>0&&
        <ul>{verdict.custodyViolations.map(code=><li key={code}>{code}</li>)}</ul>}
      {verdict.gateVerdict?.violations.length?
        <ul>{verdict.gateVerdict.violations.map(code=><li key={code}>{code}</li>)}</ul>:
        <p className="smallNote">No policy violations for this fixed reported-only fixture.</p>}
      <p className="smallNote">Closure: NO · Execution: NONE · Persistent ledger: NONE · Source truth authenticated: NO</p>
    </div>}
    {receipt&&<div className="antiMButtons">
      <button type="button" className="secondaryButton" disabled={busy}
        onClick={()=>downloadReceipt(receipt)}>DOWNLOAD UNSIGNED SHADOW RECEIPT</button>
    </div>}
    <div className="antiMCardTitle">
      <h3>06 / Replay saved shadow receipt</h3>
      <span>EXPLICIT PASTE · 64 KIB MAX</span>
    </div>
    <p className="smallNote">Paste a previously exported shadow receipt to recompute its
      SHA-256 digest and historical decision, and re-evaluate source freshness now.
      This detects changes relative to the receipt's own hash but is not an identity
      signature: someone could alter an unsigned file and recompute its hash.
      The original must be independently anchored for tamper claims.</p>
    <label>PASTE RECEIPT JSON
      <textarea rows={4} spellCheck={false} maxLength={MAX_RECEIPT}
        value={importText} onChange={e=>{setImportText(e.target.value);setReplayResult('');setError('');}}/>
    </label>
    <div className="antiMButtons">
      <button type="button" className="secondaryButton" disabled={busy||!importText.trim()}
        onClick={()=>void replay()}>REPLAY RECEIPT LOCALLY →</button>
      {receipt&&<button type="button" className="secondaryButton" disabled={busy}
        onClick={()=>setImportText(JSON.stringify(receipt))}>COPY CURRENT RECEIPT INTO REPLAY FORM</button>}
    </div>
    {replayResult&&<p className="smallNote" role="status">{replayResult}</p>}
    <SmergeonShadowPanel/>
  </section>;
}
