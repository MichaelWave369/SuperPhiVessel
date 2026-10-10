import {useState} from 'react';
import type {CompanyPlan} from './company-mode.mjs';
import {proposeAntiMFromCompany} from './company-anti-m-handoff.mjs';
import type {AntiMProposal} from './company-anti-m-handoff.mjs';
import {createPriorityReviewSet,recordPriorityReview,clearPriorityReview,
  importPriorityReviewSet,priorityProjection,IMPACT,URGENCY,EFFORT} from './mission-priority.mjs';
import type {PrioritySet,Impact,Urgency,Effort} from './mission-priority.mjs';

const exportJSON=(review:PrioritySet)=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(review,null,2)+'\n'],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='anti-m-priority-review.json';
 document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
};
export default function MissionPriorityQueue({plan,reviews,onChange,onPropose}:{
 plan:CompanyPlan;reviews:PrioritySet|null;
 onChange:(next:PrioritySet)=>void;
 onPropose:(proposal:AntiMProposal)=>void;
}){
 const set=reviews??createPriorityReviewSet(plan);
 const projection=priorityProjection(plan,set);
 const [selected,setSelected]=useState('');
 const [impact,setImpact]=useState<Impact>('MEDIUM');
 const [urgency,setUrgency]=useState<Urgency>('SOON');
 const [effort,setEffort]=useState<Effort>('MEDIUM');
 const [blocksRelease,setBlocksRelease]=useState(false);
 const [reviewer,setReviewer]=useState(''),[rationale,setRationale]=useState('');
 const [importText,setImportText]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const activeId=plan.nodes.some(n=>n.id===selected)?selected:plan.nodes[0]?.id||'';
 const current=set.reviews.find(r=>r.node.id===activeId);
 function chooseNode(id:string){
  setSelected(id);
  const existing=set.reviews.find(r=>r.node.id===id);
  setImpact(existing?.impact??'MEDIUM');
  setUrgency(existing?.urgency??'SOON');
  setEffort(existing?.effort??'MEDIUM');
  setBlocksRelease(existing?.blocksRelease??false);
  setReviewer(existing?.reviewer??'');
  setRationale(existing?.rationale??'');
  setError('');setNotice('');
 }
 function handleReview(){
  try{
   onChange(recordPriorityReview(plan,set,activeId,{
    impact,urgency,effort,blocksRelease,reviewer,rationale
   }));
   setError('');setNotice('Human triage recorded locally. No Company node status or authority changed.');
  }catch(e){setError(e instanceof Error?e.message:'PRIORITY_REVIEW_REFUSED')}
 }
 return <section className="antiMCard antiMForm" aria-label="Anti-M mission priority queue">
  <div className="antiMCardTitle"><h3>Anti-M / Mission Priority Queue</h3>
   <span>HUMAN SCORING · ADVISORY ONLY</span></div>
  <p className="smallNote">Choose which Company tasks deserve attention first. Unreviewed tasks are never auto-ranked. The score uses only your own ratings, not inferred business importance from GitHub status. This queue never changes work status, grants authority, executes tasks, or certifies completion.</p>
  {plan.nodes.length===0?<p>No tasks in the Company graph yet. Create or import a task before reviewing priorities.</p>:<>
   <div className="antiMReadiness">
    <strong>{projection.ranked.length} reviewed active · {projection.unranked.length} unranked · {projection.locallyAccepted} locally accepted (excluded)</strong>
    <p className="smallNote">Scoring: {projection.explanation}. HIGH=3, MEDIUM=2, LOW=1; NOW=3, SOON=2, LATER=1; SMALL=3, MEDIUM=2, LARGE=1. The release blocker flag is an operator assertion, not verified evidence. Equal scores preserve graph order.</p>
   </div>
   <div className="antiMInline">
    <label>TASK TO REVIEW
     <select value={activeId} onChange={e=>chooseNode(e.target.value)}>
      {plan.nodes.map(n=><option key={n.id} value={n.id}>{n.id} / {n.function}</option>)}
     </select>
    </label>
    <label>IMPACT · YOUR ASSESSMENT
     <select value={impact} onChange={e=>setImpact(e.target.value as Impact)}>
      {IMPACT.map(x=><option key={x}>{x}</option>)}
     </select>
    </label>
   </div>
   <div className="antiMInline">
    <label>URGENCY
     <select value={urgency} onChange={e=>setUrgency(e.target.value as Urgency)}>
      {URGENCY.map(x=><option key={x}>{x}</option>)}
     </select>
    </label>
    <label>ESTIMATED EFFORT
     <select value={effort} onChange={e=>setEffort(e.target.value as Effort)}>
      {EFFORT.map(x=><option key={x}>{x}</option>)}
     </select>
    </label>
   </div>
   <label className="priorityCheck"><input type="checkbox" checked={blocksRelease} onChange={e=>setBlocksRelease(e.target.checked)}/>
    <span>Release blocker (operator assessment, not verified by GitHub)</span></label>
   <label>REVIEWER (SELF-REPORTED)
    <input maxLength={80} value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder="Founder / reviewer" />
   </label>
   <label>WHY THIS PRIORITY?
    <input maxLength={240} value={rationale} onChange={e=>setRationale(e.target.value)} placeholder="Specific business objective or release concern" />
   </label>
   <div className="antiMButtons">
    <button type="button" className="primaryButton" disabled={!reviewer.trim()||!rationale.trim()} onClick={handleReview}>RECORD HUMAN TRIAGE →</button>
    <button type="button" className="secondaryButton" disabled={!current} onClick={()=>{
      try{onChange(clearPriorityReview(plan,set,activeId));setError('');setNotice('Removed the local review. Node returned to unranked.')}
      catch(e){setError(e instanceof Error?e.message:'PRIORITY_CLEAR_REFUSED')}
    }}>CLEAR NODE PRIORITY</button>
   </div>
   <div className="antiMCardTitle"><h3>Reviewed work, ordered by your priorities</h3>
     <span>{projection.ranked.length} SCORED · NO AUTOMATIC EXECUTION</span></div>
   <div className="priorityQueueList">
    {projection.ranked.map((item,i)=><div className="priorityQueueItem" key={item.id}>
     <div className="priorityQueueTop"><strong>#{i+1} · {item.output}</strong>
      <span className="priorityQueueScore">{item.score} pts</span></div>
     <small>{item.id} · {item.function} · {item.status} · {item.risk}</small>
     <p className="smallNote">Human-rated {item.review.impact} impact, {item.review.urgency} urgency, {item.review.effort} effort{item.review.blocksRelease?', release-blocker asserted':''}. Reviewer: {item.review.reviewer}.</p>
     <p className="smallNote">Rationale: {item.review.rationale}</p>
     <div className="antiMButtons">
      <button type="button" className="secondaryButton" disabled={item.status==='DEPENDENCY_BLOCKED'}
       onClick={()=>{
        try{onPropose(proposeAntiMFromCompany(plan,item.id));setError('')}
        catch(e){setError(e instanceof Error?e.message:'PRIORITY_HANDOFF_REFUSED')}
       }}>PROPOSE TO ANTI-M (DRAFT ONLY) →</button>
      {item.status==='DEPENDENCY_BLOCKED'&&<small className="smallNote">Resolve predecessor review first; no direct handoff from a blocked priority.</small>}
      <button type="button" onClick={()=>chooseNode(item.id)}>EDIT PRIORITY</button>
     </div>
    </div>)}
   </div>
   {projection.ranked.length===0&&<p className="smallNote">No active tasks have a human priority review. Nothing is recommended yet.</p>}
   {projection.unranked.length>0&&<details className="antiMHistory">
    <summary>Unranked active tasks ({projection.unranked.length})</summary>
    <ul>{projection.unranked.map(x=><li key={x.id}>{x.id} · {x.output} · {x.status}</li>)}</ul>
   </details>}
  </>}
  <div className="antiMCardTitle"><h3>Carry your triage across sessions</h3><span>EXPLICIT EXPORT / IMPORT · NOT AN AUTHORITY LEDGER</span></div>
  <p className="smallNote">Priority assessments live in memory and are not included in the Company graph JSON. Export this separate review file before refreshing. Import is accepted only for the matching company and unchanged task scope; no approvals or evidence can be imported through it.</p>
  <div className="antiMButtons">
   <button type="button" onClick={()=>exportJSON(set)}>EXPORT PRIORITIES JSON</button>
   <button type="button" onClick={()=>{
     if(!window.confirm('Clear every local human priority assessment? Export first if needed.'))return;
     onChange(createPriorityReviewSet(plan));setError('');setNotice('All human priorities cleared.');
   }}>RESET PRIORITIES</button>
  </div>
  <label>PASTE PRIORITIES JSON · MAX 32 KiB
   <textarea rows={3} value={importText} spellCheck={false} onChange={e=>setImportText(e.target.value)}/>
  </label>
  <button type="button" className="secondaryButton" disabled={!importText.trim()} onClick={()=>{
    if(set.reviews.length>0&&!window.confirm('Replace existing human priority reviews? Export first.'))return;
    try{onChange(importPriorityReviewSet(plan,importText));setImportText('');setError('');setNotice('Priority review set imported for the current unmodified task scope. No authority transferred.')}
    catch(e){setError(e instanceof Error?e.message:'PRIORITY_IMPORT_REFUSED')}
  }}>IMPORT + VALIDATE HUMAN REVIEWS →</button>
  {notice&&<p className="smallNote" role="status">{notice}</p>}
  {error&&<div className="error" role="alert">Priority Queue refused: {error}. No action was authorized.</div>}
 </section>;
}
