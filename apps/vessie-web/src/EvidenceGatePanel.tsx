import {useState} from 'react';
import {evaluateEvidenceGate,EVIDENCE_GATE_CONTEXT_SCHEMA} from './evidence-gate.mjs';
import type {EvidenceContext,EvidenceProposal,EvidenceVerdict} from './evidence-gate.mjs';

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

/* Standalone local negative-control bench. Does NOT promote model output or
 * source claims into the Anti-M completion ledger or an executor.
 */
export default function EvidenceGatePanel(){
  const [draft,setDraft]=useState(JSON.stringify(example,null,2));
  const [verdict,setVerdict]=useState<EvidenceVerdict|null>(null);
  const [error,setError]=useState('');
  function evaluate(){
    setVerdict(null);setError('');
    try{
      if(new TextEncoder().encode(draft).length>MAX_TEXT) throw new Error('INPUT_TOO_LARGE');
      const input:unknown=JSON.parse(draft);
      const result=evaluateEvidenceGate(input as EvidenceProposal,reportedOnly);
      setVerdict(result);
    }catch(err){
      setError(err instanceof Error?err.message:'EVIDENCE_GATE_REFUSED');
    }
  }
  return <section className="antiMCard antiMForm" aria-label="Anti-M evidence gate shadow bench">
    <div className="antiMCardTitle">
      <h3>05 / Evidence Gate V3 · Shadow Bench</h3>
      <span>READ-ONLY · NO AUTHORITY</span>
    </div>
    <p className="smallNote">
      This local test uses a fixed, reported-only network-switch scenario. The report is
      <strong> not verified telemetry</strong>. Paste one model proposal in the contract below;
      the gate will evaluate its references and severity. Nothing is sent to a server,
      appended to the Anti-M completion ledger, or executed.
    </p>
    <label>MODEL PROPOSAL JSON · MAX 16 KIB
      <textarea rows={10} spellCheck={false} maxLength={MAX_TEXT}
        value={draft} onChange={e=>{setDraft(e.target.value);setVerdict(null);setError('');}}/>
    </label>
    <div className="antiMButtons">
      <button type="button" className="primaryButton" onClick={evaluate}>EVALUATE PROPOSAL →</button>
      <button type="button" className="secondaryButton" onClick={()=>{
        setDraft(JSON.stringify({...example,risk:'undetermined'},null,2));
        setVerdict(null);setError('');
      }}>LOAD CONSERVATIVE CONTROL</button>
    </div>
    {error&&<div className="error" role="alert">Evidence Gate refused input: {error}</div>}
    {verdict&&<div className="antiMReadiness" role="status" aria-live="polite">
      <strong>Policy verdict: {verdict.decision}</strong>
      <p className="smallNote">Policy: {verdict.policyVersion}. This verdict evaluates a narrow
        rule using caller-supplied report records. ALLOW does not mean approval, verified
        diagnosis, external attestation or Anti-M DONE.</p>
      {verdict.violations.length>0?<ul>{verdict.violations.map(code=><li key={code}>{code}</li>)}</ul>:
        <p className="smallNote">No policy violations in this fixture.</p>}
      <p className="smallNote">Closure granted: NO · Execution authority: NONE · Permanent ledger write: NONE</p>
    </div>}
  </section>;
}
