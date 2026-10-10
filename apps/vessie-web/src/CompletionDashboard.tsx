import {useRef,useState} from 'react';
import type {CompanyPlan} from './company-mode.mjs';
import type {PrioritySet} from './mission-priority.mjs';
import type {CompletionLink} from './completion-dashboard.mjs';
import {completionDashboard,inspectAntiMForCompany} from './completion-dashboard.mjs';
import {proposeAntiMFromCompany} from './company-anti-m-handoff.mjs';
import type {AntiMProposal} from './company-anti-m-handoff.mjs';

export default function CompletionDashboard({plan,priorities,links,onAttach,onClear,onPropose}:{
 plan:CompanyPlan;priorities:PrioritySet|null;links:CompletionLink[];
 onAttach:(link:CompletionLink)=>void;onClear:(id:string)=>void;
 onPropose:(proposal:AntiMProposal)=>void;
}){
 const dashboard=completionDashboard(plan,priorities,links);
 const [selected,setSelected]=useState('');
 const [ledgerText,setLedgerText]=useState('');
 const [importing,setImporting]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('');
 const importLock=useRef(false);
 const active=plan.nodes.some(n=>n.id===selected)?selected:plan.nodes[0]?.id||'';
 const linked=links.find(l=>l.node.id===active);
 async function inspectAndLink(){
  if(importLock.current||!active)return;
  importLock.current=true;setImporting(true);setError('');setInfo('');
  try{
   // The human explicitly chooses the Company node. A matching title alone is
   // never used to auto-assign contracts across tasks.
   const result=await inspectAntiMForCompany(plan,active,ledgerText);
   if(linked&&!window.confirm('Replace the previously inspected Anti-M journal for this task?'))return;
   onAttach(result);
   setLedgerText('');
   setInfo('Anti-M hash chain replayed locally and scope matched. No Company PASS evidence, action grant or external DONE was added.');
  }catch(e){setError(e instanceof Error?e.message:'COMPLETION_INSPECTION_REFUSED')}
  finally{importLock.current=false;setImporting(false)}
 }
 return <section className="antiMCard antiMForm" aria-label="Company completion dashboard">
  <div className="antiMCardTitle"><h3>Anti-M / Completion Dashboard</h3>
   <span>NO PROMOTED DONE · LOCAL REVIEW ONLY</span></div>
  <p className="smallNote">One view of the Company task lifecycle, human priority order, and separately imported Anti-M journals. This does not run tasks, poll GitHub, verify a deployment or grant permissions. All Company evidence and human reviews remain self-reported.</p>
  <div className="completionMetrics" aria-label="Operator-reported progress totals">
   <div><strong>{dashboard.graphTotal}</strong><small>Company tasks</small></div>
   <div><strong>{dashboard.prioritized}</strong><small>Human prioritized, active</small></div>
   <div><strong>{dashboard.withCompanyEvidence}</strong><small>Company checks recorded</small></div>
   <div><strong>{dashboard.locallyAccepted}</strong><small>Company locally accepted</small></div>
   <div><strong>{dashboard.antiMLocallyClosed}</strong><small>Anti-M locally closed</small></div>
  </div>
  <p className="smallNote">Local acceptance in Company Mode and VERIFIED_DONE_LOCAL in Anti-M are **separate** operator-reviewed claims. Neither is independent proof of a working release or completed external action. An Anti-M journal never changes the Company node status.</p>
  {dashboard.rows.length===0?<p>No Company tasks have been created. Add or import tasks to see the completion board.</p>:
  <div className="completionRows">
   {dashboard.rows.map((row,i)=><article key={row.id} className="completionRow">
    <div className="completionRowTop"><strong>{i+1}. {row.output}</strong>
     <span className="completionStage">{row.status.replaceAll('_',' ')}</span>
    </div>
    <p className="smallNote">Function: {row.function} · {row.id} · Risk: {row.risk}</p>
    <p className="smallNote">Priority: {row.priorityRank===null?'Unranked':('#'+row.priorityRank+' · '+row.priorityScore+' human points')}
      {' '}· Action review: {row.hasActionReview?'Recorded locally':'Not recorded'}
      {' '}· Dependencies: {row.dependsOn.join(', ')||'none'}</p>
    <p className="smallNote">Company check: {row.evidenceResult?row.evidenceResult+' · '+(row.evidenceReviewed||'not reviewed'):'No evidence recorded'}.</p>
    <p className="smallNote"><strong>Next manual step:</strong> {row.manualNextStep}</p>
    {row.antiMJournal?<div className="completionJournal">
      <strong>Anti-M: {row.antiMJournal.status}</strong>
      <small>Contract: {row.antiMJournal.contractId} · {row.antiMJournal.eventCount} hash-chain events replayed</small>
      <small>SHA-256 tail: <code>{row.antiMJournal.tailHash}</code></small>
      <small>Verified local journal structure only. External execution / identity: UNATTESTED.</small>
    </div>:<p className="smallNote">Anti-M journal: not attached. No independent completion journal is known for this task.</p>}
    <div className="antiMButtons">
     <button type="button" className="secondaryButton" disabled={row.status==='DEPENDENCY_BLOCKED'}
       onClick={()=>{
        try{onPropose(proposeAntiMFromCompany(plan,row.id));setError('')}
        catch(e){setError(e instanceof Error?e.message:'COMPLETION_HANDOFF_REFUSED')}
       }}>PROPOSE ANTI-M CONTRACT →</button>
     <button type="button" onClick={()=>{setSelected(row.id);setError('');setInfo('');}}>
      {active===row.id?'SELECTED FOR JOURNAL':'SELECT FOR JOURNAL'}
     </button>
    </div>
   </article>)}
  </div>}
  <div className="antiMCardTitle"><h3>Attach a separately replayed Anti-M journal</h3>
   <span>MANUAL PASTE · MAX 128 KiB</span></div>
  <p className="smallNote">Export the **full replayable ledger JSON** from Anti-M / FINISH. Select the matching Company task, paste the journal, and click replay. The inspector recomputes every SHA-256 event link and requires exact title, deliverable and one acceptance criterion to match the selected node. A closure receipt alone is refused.</p>
  {plan.nodes.length>0&&<>
   <label>COMPANY NODE TO MATCH
    <select value={active} onChange={e=>{setSelected(e.target.value);setError('');setInfo('')}}>
     {plan.nodes.map(n=><option key={n.id} value={n.id}>{n.id} / {n.function}</option>)}
    </select>
   </label>
   <label>PASTE REPLAYABLE ANTI-M JSON
    <textarea rows={4} spellCheck={false} value={ledgerText}
     placeholder='{"schema":"superphivessel.anti-m.bundle.v0.1","events":[...]}'
     onChange={e=>{setLedgerText(e.target.value);setError('');setInfo('')}}/>
   </label>
   <div className="antiMButtons">
    <button type="button" className="primaryButton" disabled={importing||!ledgerText.trim()}
     onClick={()=>{void inspectAndLink()}}>REPLAY + ATTACH LOCAL STATUS →</button>
    {linked&&<button type="button" className="secondaryButton" onClick={()=>{
      onClear(active);setInfo('Detached the in-memory journal status. No underlying Company state was changed.');setError('');
    }}>DETACH JOURNAL</button>}
   </div>
  </>}
  <p className="smallNote">Journal statuses are kept in memory only, with the full chain checked at import time; they are not exported with the Company plan or the separate Priority JSON. Reloading clears them. To revisit an inspection, reimport the original complete Anti-M ledger.</p>
  {info&&<p className="smallNote" role="status">{info}</p>}
  {error&&<p className="error" role="alert">Completion dashboard refused: {error}. No DONE or authority transferred.</p>}
 </section>;
}
