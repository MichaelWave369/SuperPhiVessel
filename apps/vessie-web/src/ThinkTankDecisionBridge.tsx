import {useRef,useState} from 'react';
import {COMPANY_RISKS} from './company-mode.mjs';
import type {CompanyPlan,CompanyRisk} from './company-mode.mjs';
import {inspectThinkTankPackage,addThinkTankTaskProposal} from './thinktank-decision-bridge.mjs';
import type {ThinkTankDecisionPreview} from './thinktank-decision-bridge.mjs';

export default function ThinkTankDecisionBridge({plan,onAdd}:{plan:CompanyPlan|null;onAdd:(next:CompanyPlan)=>void}){
 const [source,setSource]=useState(''),[preview,setPreview]=useState<ThinkTankDecisionPreview|null>(null);
 const [error,setError]=useState(''),[info,setInfo]=useState('');
 const [focus,setFocus]=useState('operatorPrompt');
 const [id,setId]=useState(''),[fn,setFn]=useState(''),[output,setOutput]=useState('');
 const [check,setCheck]=useState(''),[risk,setRisk]=useState<CompanyRisk>('NONE');
 const [reviewed,setReviewed]=useState(false);
 const sequence=useRef(0);
 const sourceRevision=useRef(0);
 const planRef=useRef(plan);
 planRef.current=plan;
 const loadedForPlan=useRef<CompanyPlan|null>(null);
 function clearPreview(){
  sequence.current++;sourceRevision.current++;setPreview(null);
  setFocus('operatorPrompt');setReviewed(false);setInfo('');setError('');
 }
 async function readFile(file:File|undefined){
  const ticket=++sequence.current;
  clearPreview();
  if(!file){setSource('');return}
  if(file.size>2097152){setSource('');setError('THINKTANK_BRIDGE_SIZE');return}
  try{
   const json=await file.text();
   if(ticket+1!==sequence.current)return;
   setSource(json);
  }catch{if(ticket+1===sequence.current)setError('THINKTANK_BRIDGE_FILE_READ')}
 }
 function inspect(){
  setPreview(null);setReviewed(false);setInfo('');setError('');
  try{
   const result=inspectThinkTankPackage(source);
   setPreview(result);loadedForPlan.current=planRef.current;
   setInfo('Dossier checksum recalculated against the exported decision basis. No signature, live-provider response or external evidence was independently verified.');
  }catch(e){setError(e instanceof Error?e.message:'THINKTANK_BRIDGE_IMPORT_REFUSED')}
 }
 function add(){
  if(!preview||!planRef.current||!plan||loadedForPlan.current!==planRef.current){
   setError('THINKTANK_BRIDGE_PLAN_CHANGED');return
  }
  try{
   const current=planRef.current;
   const next=addThinkTankTaskProposal(current,preview,focus,{
    id,function:fn,output,check,risk,reviewAcknowledged:reviewed as true
   });
   onAdd(next);
   // Keep source inspection visible but invalidate the old acceptance.
   // Re-review before adding another independent task.
   loadedForPlan.current=next;
   setReviewed(false);setId('');setFn('');setOutput('');setCheck('');
   setError('');setInfo('New Company proposal added with fresh null action review/evidence. ThinkTank DID NOT authorize or complete it.');
  }catch(e){setError(e instanceof Error?e.message:'THINKTANK_BRIDGE_TASK_REFUSED')}
 }
 return <section className="antiMCard antiMForm" aria-label="ThinkTank decision dossier proposal bridge">
  <div className="antiMCardTitle"><h3>Φ ThinkTank Decision Bridge</h3>
    <span>HUMAN-REVIEWED · FILE IMPORT ONLY · NO AUTO-GRANTS</span></div>
  <p className="smallNote">Import the exact <strong>TEAR / EXPORT DOSSIER</strong> JSON from the Φ Think Tank control room. See its source claims, outcome, objections and provenance before writing a Company proposal. No AI output gets copied into the task automatically.</p>
  <p className="smallNote">ThinkTank's FNV decision-basis fingerprint is recomputable by anyone. This inspection detects inconsistency, NOT file authorship, a verified Ed25519 seal, independently retrieved evidence, or authorization. Imported seals, timestamps and release metadata are displayed as <em>unverified attachments</em>.</p>
  <label>CHOOSE THINKTANK DOSSIER JSON · MAX 2 MB
   <input type="file" accept=".json,application/json" onChange={e=>{void readFile(e.target.files?.[0])}} />
  </label>
  <label>OR PASTE EXPORTED DOSSIER JSON
   <textarea value={source} rows={4} onChange={e=>{clearPreview();setSource(e.target.value)}}
    placeholder="Paste ThinkTank's full decision-dossier export, not just a score or summary" />
  </label>
  <button type="button" className="secondaryButton" disabled={!source.trim()}
   onClick={inspect}>INSPECT DECISION BASIS (NO IMPORT TO PLAN) →</button>
  {preview&&<div className="antiMReadiness">
   <strong>{preview.dossier.id} · {preview.dossier.mode.toUpperCase()} · {preview.dossier.outcome.toUpperCase()}</strong>
   <p>Execution source: <strong>{preview.dossier.executionSource}</strong> · exported outcome label: {preview.dossier.outputLabel}</p>
   <p>Local fingerprint recomputed: <code>{preview.dossier.basisFingerprint}</code> (FNV-1a, not cryptographic integrity)</p>
   <p>Reality Gate: {preview.dossier.gateScore.toFixed(2)} / {preview.dossier.gateThreshold.toFixed(2)} · Claim policy: {preview.dossier.claimPolicyPassed?'PASS':'BLOCK'} · Argument policy: {preview.dossier.argumentPolicyPassed?'PASS':'BLOCK'}</p>
   <p>{preview.dossier.counts.claims} claims · {preview.dossier.counts.evidence} evidence refs · {preview.dossier.counts.contradictions} contradictory bindings · {preview.dossier.counts.claimReviews} claim reviews · {preview.dossier.counts.draftArguments} draft arguments</p>
   <p><strong>Original operator prompt:</strong> {preview.dossier.operatorPrompt||'(empty at original session)'}</p>
   <p><strong>Governance reason:</strong> {preview.dossier.governanceReason||'(no detail in export)'}</p>
   {preview.notes.length>0&&<div><strong>Important caveats</strong>
    <ul>{preview.notes.map((note,i)=><li key={i}>{note}</li>)}</ul></div>}
   <p>Attached provenance record categories in the file (not cryptographically verified here): {preview.provenanceArtifactsPresent.join(', ')||'none'}.</p>
   <p>Any ThinkTank \`actionAllowed\` or human override is historical to ThinkTank only. It does not create Vessie execution rights, validated CI evidence, a signed approval, or Anti-M DONE.</p>
   <div className="antiMCardTitle"><h4>Human-reviewed Company task proposal</h4><span>NO SOURCE CONTENT AUTOFILL</span></div>
   {plan?<p>Company: {plan.company.name} · remaining task slots: {12-plan.nodes.length}</p>
    :<p>Create or manually import a founder-owned Company plan first; previewing ThinkTank exports does not create one.</p>}
   <label>WHICH SOURCE CLAIM OR QUESTION INFORMED YOUR PROPOSAL?
    <select value={focus} onChange={e=>{setFocus(e.target.value);setReviewed(false)}}>
     <option value="operatorPrompt">Original operator question</option>
     {preview.claims.map(claim=><option key={claim.id} value={claim.id}>{claim.id} · {claim.text.slice(0,100)}</option>)}
    </select>
   </label>
   {focus!=='operatorPrompt'&&<p className="smallNote">Selected claim (unverified): {preview.claims.find(x=>x.id===focus)?.text}</p>}
   <label>NEW COMPANY NODE ID<input value={id} maxLength={64} onChange={e=>setId(e.target.value)} placeholder="think-1"/></label>
   <label>YOUR FUNCTION / TASK<input value={fn} maxLength={100} onChange={e=>setFn(e.target.value)} placeholder="Investigate production failure root cause"/></label>
   <label>YOUR EXPECTED OUTPUT<input value={output} maxLength={240} onChange={e=>setOutput(e.target.value)} placeholder="An actionable diagnosis and repro steps"/></label>
   <label>YOUR ACCEPTANCE CHECK<input value={check} maxLength={240} onChange={e=>setCheck(e.target.value)}
    placeholder={'Verify independently; note '+preview.dossier.id+' in your criteria if relevant'}/></label>
   <label>CONSEQUENTIAL ACTION CLASS
    <select value={risk} onChange={e=>setRisk(e.target.value as CompanyRisk)}>
     {COMPANY_RISKS.map(item=><option value={item} key={item}>{item}</option>)}
    </select>
   </label>
   <label className="antiMCheck">
    <input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)} />
    I manually reviewed this dossier and wrote the proposed task myself; this is not a transfer of ThinkTank or Anti-M approval or evidence.
   </label>
   <button type="button" className="primaryButton"
    disabled={!plan||plan.nodes.length>=12||!reviewed||!id.trim()||!fn.trim()||!output.trim()||!check.trim()}
    onClick={add}>ADD HUMAN-REVIEWED PROPOSAL TO COMPANY →</button>
  </div>}
  {info&&<p role="status" className="smallNote">{info}</p>}
  {error&&<p role="alert" className="error">ThinkTank Bridge refused: {error}. Company permissions and evidence were not changed.</p>}
 </section>;
}
