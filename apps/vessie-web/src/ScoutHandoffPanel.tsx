import {useState} from 'react';
import {inspectScoutHandoff} from './scout-handoff.mjs';
import {gatewayScoutHandoff} from './pairing-client.mjs';
import type {ScoutHandoffReview} from './scout-handoff.mjs';

export default function ScoutHandoffPanel({gatewaySession}:{gatewaySession:string|null}){
  const [input,setInput]=useState('');
  const [review,setReview]=useState<ScoutHandoffReview|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [source,setSource]=useState<'MANUAL'|'PAIRED'|null>(null);
  async function pairedRead(){
    if(!gatewaySession)return;
    setBusy(true);setReview(null);setError('');setSource(null);
    try{
      // Gateway returns only a bounded, self-reported PhiBot packet.
      // Run it through the same no-authority browser validator as manual JSON.
      const packet=await gatewayScoutHandoff(gatewaySession);
      const projected=inspectScoutHandoff(JSON.stringify(packet));
      setReview(projected);setSource('PAIRED');
    }catch{
      setError('SCOUT_PAIRED_READ_REFUSED');
    }finally{setBusy(false);}
  }
  function inspect(){
    try{
      setReview(inspectScoutHandoff(input));setSource('MANUAL');
      setError('');
    } catch(e){
      setReview(null);setSource(null);
      // Never display arbitrary pasted data, error objects or nested values.
      const code=e instanceof Error&&/^SCOUT_HANDOFF_[A-Z_]+$/.test(e.message)?
        e.message:'SCOUT_HANDOFF_REFUSED';
      setError(code);
    }
  }
  return <section className="scoutPanel" aria-label="Local Scout qualification review">
    <div className="laneTop">
      <strong>PHIBOT · LOCAL SCOUT QUALIFICATION</strong>
      <span className="laneTag">PASTED OR PAIRED · READ ONLY</span>
    </div>
    <p className="smallNote">Optional: first pair the existing local HTTPS gateway under
      <strong> MODEL FABRIC</strong>, with an explicitly configured Scout receipt folder.
      Then use the paired read below. It never asks PhiBot to run, only reviews a
      previously saved operator qualification. The gateway checks local receipt
      digest consistency; this browser does not independently attest the model.</p>
    <div className="inspectActions">
      <button type="button" className="primaryButton"
        disabled={!gatewaySession||busy} onClick={pairedRead}>
        {busy?'READING PAIRED SCOUT…':'READ PAIRED SCOUT RECEIPT →'}
      </button>
      <span className="smallNote">
        {gatewaySession?'PAIRED SESSION · OPTIONAL SCOUT ENDPOINT':
          'NOT PAIRED · PAIR UNDER MODEL FABRIC FIRST'}
      </span>
    </div>
    <p className="smallNote">Alternatively paste the redacted JSON returned by
      <code> npm.cmd run scout:handoff </code> on your own PC.
      This manual alternative remains fully browser-local. It does not access
      the file system, contact Ollama, upload a pasted JSON, verify a signature,
      or connect the PhiBot agent to Vessie's execution runtime.</p>
    <label className="receiptLabel" htmlFor="scout-handoff-input">
      MANUAL PASTE · PHIBOT HANDOFF v0.1 · MAX 4 KiB
    </label>
    <textarea id="scout-handoff-input" className="receiptInput" spellCheck={false}
      value={input} placeholder='{"schema":"phibot.scout-vessie-handoff.v0.1", ...}'
      onChange={e=>{setInput(e.target.value);setReview(null);setError('');setSource(null);}}/>
    <div className="inspectActions">
      <button type="button" className="primaryButton" onClick={inspect}>REVIEW LOCALLY →</button>
      <button type="button" className="secondaryButton" onClick={()=>{setInput('');setReview(null);setError('');setSource(null);}}>CLEAR</button>
    </div>
    {error&&<div className="error" role="alert">Handoff refused: {error}. Nothing was connected or promoted.</div>}
    {review&&<div className="inspectResult" role="status">
      <div className="laneTop">
        <strong>LOCAL SHADOW PASS · {source==='PAIRED'?'PAIRED FILE READ':'MANUAL IMPORT'} · SELF-REPORTED</strong>
        <span className="laneTag">NO AUTHORITY</span>
      </div>
      <div className="scoutFacts">
        <div><small>LOCAL MODEL</small><strong>{review.local_model}</strong></div>
        <div><small>SOURCE RUN</small><strong>{review.source_run_id}</strong></div>
        <div><small>QUALIFIED AT</small><strong>{new Date(review.qualified_at).toLocaleString()}</strong></div>
        <div><small>SOURCE EXPIRY</small><strong>{new Date(review.source_expires_at).toLocaleString()}</strong></div>
        <div><small>FRESHNESS NOW</small><strong>{review.source_freshness_at_review.replaceAll('_',' ')}</strong></div>
        <div><small>DIGEST PREFIX</small><strong>{review.receipt_digest_prefix}… (unverified)</strong></div>
      </div>
      <p className="smallNote">The handoff reports that a local shadow run passed.
        {source==='PAIRED'?' The paired HTTPS gateway checked the configured local receipt and digest consistency;':
          ' The supplied JSON is an operator paste and its digest is not checked in the browser;'}
        This browser has <strong>not independently attested</strong> the executing model, 
        operator identity, or source publisher.
        Expired evidence stays historical. There is no authorization, memory admission,
        agent registration, tool execution, or live route influence.</p>
      <p className="smallNote">PhiBot agent/executor connection: <strong>NONE</strong> ·
        Routing influence: <strong>NONE</strong> ·
        Reality Gate grant: <strong>NONE</strong></p>
    </div>}
    <div className="notice">
      <strong>Proof is not permission</strong>
      <p>Even a paired read of a digest-consistent handoff only qualifies for human review.
        Vessie does not consume this as a prompt, route, training sample, reward,
        agent identity, signed operator grant, or automatic task instruction.</p>
    </div>
  </section>;
}
