import {useState} from 'react';
import {inspectScoutHandoff} from './scout-handoff.mjs';
import type {ScoutHandoffReview} from './scout-handoff.mjs';

export default function ScoutHandoffPanel(){
  const [input,setInput]=useState('');
  const [review,setReview]=useState<ScoutHandoffReview|null>(null);
  const [error,setError]=useState('');
  function inspect(){
    try{
      setReview(inspectScoutHandoff(input));
      setError('');
    } catch(e){
      setReview(null);
      // Never display arbitrary pasted data, error objects or nested values.
      const code=e instanceof Error&&/^SCOUT_HANDOFF_[A-Z_]+$/.test(e.message)?
        e.message:'SCOUT_HANDOFF_REFUSED';
      setError(code);
    }
  }
  return <section className="scoutPanel" aria-label="Manual local Scout handoff review">
    <div className="laneTop">
      <strong>PHIBOT · LOCAL SCOUT QUALIFICATION</strong>
      <span className="laneTag">MANUAL COPY / NO CONNECTION</span>
    </div>
    <p className="smallNote">Paste the redacted JSON returned by
      <code> npm.cmd run scout:handoff </code> on your own PC.
      This is a browser-local review of a self-reported qualification.
      The cockpit does not read your disk, contact Ollama, upload this JSON,
      verify a signature, or connect PhiBot to Vessie.</p>
    <label className="receiptLabel" htmlFor="scout-handoff-input">
      MANUAL PASTE · PHIBOT HANDOFF v0.1 · MAX 4 KiB
    </label>
    <textarea id="scout-handoff-input" className="receiptInput" spellCheck={false}
      value={input} placeholder='{"schema":"phibot.scout-vessie-handoff.v0.1", ...}'
      onChange={e=>{setInput(e.target.value);setReview(null);setError('');}}/>
    <div className="inspectActions">
      <button type="button" className="primaryButton" onClick={inspect}>REVIEW LOCALLY →</button>
      <button type="button" className="secondaryButton" onClick={()=>{setInput('');setReview(null);setError('');}}>CLEAR</button>
    </div>
    {error&&<div className="error" role="alert">Handoff refused: {error}. Nothing was connected or promoted.</div>}
    {review&&<div className="inspectResult" role="status">
      <div className="laneTop">
        <strong>LOCAL SHADOW PASS · SELF-REPORTED</strong>
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
      <p className="smallNote">The copied handoff claims that a local shadow run passed.
        This browser has <strong>not</strong> independently checked the underlying
        qualification.json, its SHA-256, the executing model, or the source publisher.
        Expired evidence stays historical. There is no authorization, memory admission,
        agent registration, tool execution, or live route influence.</p>
      <p className="smallNote">Vessie connection: <strong>NONE</strong> ·
        Routing influence: <strong>NONE</strong> ·
        Reality Gate grant: <strong>NONE</strong></p>
    </div>}
    <div className="notice">
      <strong>Proof is not permission</strong>
      <p>Even a correctly shaped pasted handoff only qualifies for human review.
        Vessie does not consume this as a prompt, route, training sample, reward,
        agent identity, signed operator grant, or automatic task instruction.</p>
    </div>
  </section>;
}
