import {useState} from 'react';
import {
 LOCAL_COUNCIL_TURNS,makeLocalCouncilContract,localCouncilContractText,localCouncilSha256
} from './local-council-contract.mjs';
import type {LocalCouncilMode} from './local-council-contract.mjs';

export default function ThinkTankLocalCouncilContractDesk(){
 const [directive,setDirective]=useState(''),[mode,setMode]=useState<LocalCouncilMode>('council');
 const [model,setModel]=useState(''),[seconds,setSeconds]=useState(180);
 const [ack,setAck]=useState(false);
 const [prepared,setPrepared]=useState<{text:string;sha:string}|null>(null);
 const [error,setError]=useState(''),[info,setInfo]=useState('');
 function invalidate(){setAck(false);setPrepared(null);setError('');setInfo('')}
 async function prepare(){
  setPrepared(null);setError('');setInfo('');
  if(!ack){setError('SPV_LOCAL_COUNCIL_REVIEW_REQUIRED');return}
  try{
   const raw=localCouncilContractText(makeLocalCouncilContract({
    directive,model,mode,maxSessionSeconds:seconds
   }));
   const sha=await localCouncilSha256(raw);
   setPrepared({text:raw,sha});
   setInfo('Local-only contract prepared. No model started; the operator must separately inspect and approve these exact bytes in the ThinkTank terminal.');
  }catch(e){setError(e instanceof Error?e.message:'SPV_LOCAL_COUNCIL_INVALID')}
 }
 function download(){
  if(!prepared)return;
  const blob=new Blob([prepared.text],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  try{
   const link=document.createElement('a');
   link.href=url;link.download='thinktank-local-council.json';
   document.body.appendChild(link);link.click();link.remove();
   setInfo('Local JSON downloaded. No model has run. Inspect it in ThinkTank and explicitly approve the exact SHA in the terminal.');
  }finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000)}
 }
 return <section className="antiMCard antiMForm" aria-label="ThinkTank local governed council contract">
  <div className="antiMCardTitle"><h3>Φ Local Governed Council Contract</h3>
   <span>LOCAL OLLAMA · TERMINAL APPROVAL · NO BROWSER RUN</span></div>
  <p className="smallNote">Prepare an inert JSON contract for the companion <strong>ThinkTank PR #35</strong> governed terminal runner. It reuses ThinkTank's own Crane Fly / Challenger / Reality Gate / event ledger, using your local Ollama model only. Vessie does not call providers, spend API credits, or execute a session.</p>
  <p className="smallNote">The terminal approval is **consent to the exact contract file**, not cryptographic authentication, evidence validation, or a grant to perform external work. The run can generate a dossier, but not real-world DONE.</p>
  <label>REVIEWED LOCAL COUNCIL DIRECTIVE
   <textarea value={directive} rows={4} maxLength={1200}
    placeholder="Have the council evaluate X, challenge gaps, and record a decision dossier without external actions"
    onChange={e=>{setDirective(e.target.value);invalidate()}}/>
  </label>
  <label>LOCAL OLLAMA MODEL NAME
   <input value={model} maxLength={90}
    placeholder="e.g. gemma3:12b or your installed local model"
    onChange={e=>{setModel(e.target.value);invalidate()}}/>
  </label>
  <label>THINKTANK MODE
   <select value={mode} onChange={e=>{setMode(e.target.value as LocalCouncilMode);invalidate()}}>
    <option value="council">COUNCIL · 5 ROLE TURNS</option>
    <option value="trio">TRIO · 3 ROLE TURNS</option>
    <option value="audit">AUDIT · 2 ROLE TURNS</option>
   </select>
  </label>
  <label>MAX SESSION DEADLINE (SECONDS, 30–600)
   <input type="number" min={30} max={600} step={1} value={seconds}
    onChange={e=>{setSeconds(Number(e.target.value));invalidate()}}/>
  </label>
  <p className="smallNote">Planned roles: {LOCAL_COUNCIL_TURNS[mode]}. OpenAI/Kimi are disabled by canonical ThinkTank seat-status events. A timeout is best-effort; interrupting an HTTP request may not immediately stop inference already running inside Ollama.</p>
  <label className="antiMCheck">
   <input type="checkbox" checked={ack} onChange={e=>{setAck(e.target.checked);setPrepared(null);setError('')}}/>
   I wrote and reviewed this directive, chose the local model intentionally, and understand that preparing a contract does not start inference, authenticate a signer, or approve anything in Company Mode or Anti-M.
  </label>
  <button type="button" className="primaryButton"
   disabled={!ack||!directive.trim()||!model.trim()} onClick={()=>{void prepare()}}>
   PREPARE EXACT LOCAL COUNCIL CONTRACT (NO RUN) →
  </button>
  {prepared&&<div className="antiMReadiness">
   <strong>Reviewed local contract · {mode.toUpperCase()} · {LOCAL_COUNCIL_TURNS[mode]} turns</strong>
   <p>SHA-256 of exact downloadable bytes:</p>
   <code className="archiveHash">{prepared.sha}</code>
   <p>Local only. No remote provider, automatic execution, Vessie approval, imported evidence or external completion.</p>
   <button type="button" className="secondaryButton" onClick={download}>DOWNLOAD INERT COUNCIL CONTRACT JSON →</button>
   <p className="smallNote">In your ThinkTank checkout, run <code>npm run council:build</code>, then <code>npm run council:inspect -- /path/to/thinktank-local-council.json</code>. Confirm the SHA matches. Only when you want local inference, run:</p>
   <code className="archiveHash">npm run council:run -- /path/to/thinktank-local-council.json --approve-sha256={prepared.sha} --confirm-local-model-inference</code>
   <p className="smallNote">The CLI writes a local replay ledger and, if synthesis reaches a decision, an exportable dossier. Bring that dossier back to the existing Vessie ThinkTank Decision Bridge for independent human review.</p>
  </div>}
  {info&&<p role="status" className="smallNote">{info}</p>}
  {error&&<p role="alert" className="error">Local council contract refused: {error}. No provider invoked or authority transferred.</p>}
 </section>
}
