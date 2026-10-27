import {useState} from 'react';
import {inspectSmergeonReceipt} from './smergeon-shadow.mjs';
import type {SmergeonShadowResult} from './smergeon-shadow.mjs';

const MAX_BYTES=16_384;
const HEX64=/^[0-9a-f]{64}$/;

/* Independent from Anti-M's closure bundle and V3.1 incident custody.
 * This pane only validates one self-reported Smergeon surgical handoff.
 * No network, persistence, signing, ledger, trusted keyring or promotions.
 */
export default function SmergeonShadowPanel(){
  const [raw,setRaw]=useState('');
  const [pinned,setPinned]=useState('');
  const [result,setResult]=useState<SmergeonShadowResult|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  function clearResult(){setResult(null);setError('');}
  async function fromFile(file:File|undefined){
    clearResult();
    if(!file)return;
    if(file.size>MAX_BYTES){setRaw('');setError('SMERGEON_RECEIPT_TOO_LARGE');return;}
    try{
      const content=await file.text();
      if(new TextEncoder().encode(content).length>MAX_BYTES)
        throw Error('SMERGEON_RECEIPT_TOO_LARGE');
      setRaw(content);
    }catch{
      setRaw('');
      setError('SMERGEON_READ_REFUSED');
    }
  }
  async function inspect(){
    if(busy)return;
    setBusy(true);clearResult();
    try{
      if(new TextEncoder().encode(raw).length>MAX_BYTES)
        throw Error('SMERGEON_RECEIPT_TOO_LARGE');
      if(pinned && !HEX64.test(pinned))
        throw Error('EXPECTED_CHECKSUM_MUST_BE_64_LOWERCASE_HEX');
      const parsed:unknown=JSON.parse(raw);
      setResult(await inspectSmergeonReceipt(parsed,{
        expectedChecksum:pinned||null
      }));
    }catch(e){
      setError(e instanceof SyntaxError?'SMERGEON_INVALID_JSON':
        e instanceof Error?e.message:'SMERGEON_SHADOW_REFUSED');
    }finally{setBusy(false);}
  }
  return <div className="antiMCard antiMForm" aria-label="Smergeon surgical handoff shadow intake">
    <div className="antiMCardTitle">
      <h3>07 / Smergeon · Surgical Handoff</h3>
      <span>RECOVERY WARD · UNSIGNED · SHADOW ONLY</span>
    </div>
    <p className="smallNote">
      Paste or select a Smergeon v0.6 handoff JSON receipt. This browser-only check
      validates exact fields and its SHA-256 consistency checksum. It cannot authenticate
      the signer, verify CI, check whether a GitHub PR exists, import Anti-M evidence,
      run repairs or grant execution, merge or closure authority.
    </p>
    <label>SELECT RECEIPT FILE · MAX 16 KIB
      <input type="file" accept=".json,application/json"
        disabled={busy} onChange={e=>{void fromFile(e.currentTarget.files?.[0]);}}/>
    </label>
    <label>PASTE SMERGEON HANDOFF JSON
      <textarea rows={5} spellCheck={false} value={raw}
        maxLength={MAX_BYTES} placeholder='{"schema":"smergeon.surgical-handoff.v0.6", ...}'
        onChange={e=>{setRaw(e.target.value);clearResult();}}/>
    </label>
    <label>INDEPENDENTLY SAVED SHA-256 · OPTIONAL
      <input value={pinned} maxLength={64} spellCheck={false}
        placeholder="64 lowercase hex characters"
        onChange={e=>{setPinned(e.target.value.trim());clearResult();}}/>
    </label>
    <div className="antiMButtons">
      <button type="button" className="primaryButton" disabled={busy||!raw.trim()}
        onClick={()=>void inspect()}>INSPECT UNSIGNED HANDOFF →</button>
      <button type="button" className="secondaryButton" disabled={busy}
        onClick={()=>{setRaw('');setPinned('');clearResult();}}>CLEAR LOCAL INPUT</button>
    </div>
    {error&&<div className="error" role="alert">
      Intake refused: {error}. No evidence or authority was imported.
    </div>}
    {result&&<div className="antiMReadiness" role="status" aria-live="polite">
      <strong>Smergeon shadow verdict: {result.outcome}</strong>
      <p className="smallNote">Reason: {result.reason}. Trust:
        {' '}UNSIGNED_UNVERIFIED. Signed evidence: NO. Anti-M DONE: NO.</p>
      {result.outcome==='REVIEW_ONLY'&&<>
        <p className="smallNote">Source: {result.repository} · PR #{result.sourcePullRequest}
          {' '}· {result.event}. File: {result.filePath}.</p>
        <p className="smallNote">Source commit: <code>{result.headSha}</code></p>
        <p className="smallNote">Plan: <code>{result.planFingerprint}</code></p>
        <p className="smallNote">Operation: <code>{result.operationFingerprint}</code></p>
        {result.draftUrl&&<p className="smallNote">Reported draft:
          {' '}<a href={result.draftUrl} target="_blank" rel="noopener noreferrer">
            PR #{result.draftPullRequest} (not independently checked)
          </a>
        </p>}
        <p className="smallNote">
          {result.externallyPinned?'Independent checksum supplied and matched. ':
          'Only the receipt’s own checksum was checked. '}
          Neither establishes who created the receipt or whether a job ran.
        </p>
      </>}
      <p className="smallNote">
        Closure: NO · Execution: NONE · Merge: NONE · Persistent ledger: NONE
      </p>
    </div>}
  </div>;
}
