import {useState} from 'react';
import {createCompanyPlan,addCompanyNode,companyProjection,recordActionReview,recordCompanyEvidence,reviewCompanyEvidence,importCompanyPlan,COMPANY_RISKS,COMPANY_METHODS} from './company-mode.mjs';
import type {CompanyPlan,CompanyRisk,CompanyMethod} from './company-mode.mjs';
import {proposeAntiMFromCompany} from './company-anti-m-handoff.mjs';
import type {AntiMProposal} from './company-anti-m-handoff.mjs';

function saveJSON(plan:CompanyPlan){
 const url=URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)+'\n'],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='vessie-company-graph.json';
 document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function CompanyModePanel({onPropose}:{onPropose:(proposal:AntiMProposal)=>void}){
 const [plan,setPlan]=useState<CompanyPlan|null>(null),[error,setError]=useState('');
 const [name,setName]=useState(''),[founder,setFounder]=useState(''),[product,setProduct]=useState('');
 const [customer,setCustomer]=useState(''),[goal,setGoal]=useState(''),[budget,setBudget]=useState('0');
 const [fn,setFn]=useState(''),[output,setOutput]=useState(''),[check,setCheck]=useState('');
 const [deps,setDeps]=useState(''),[risk,setRisk]=useState<CompanyRisk>('NONE'),[reviewer,setReviewer]=useState('');
 const [selectedId,setSelectedId]=useState(''),[method,setMethod]=useState<CompanyMethod>('CI_RUN');
 const [result,setResult]=useState<'PASS'|'FAIL'>('PASS'),[reference,setReference]=useState(''),[summary,setSummary]=useState('');
 const [importText,setImportText]=useState('');
 const view=plan?companyProjection(plan):null;
 const activeId=selectedId||plan?.nodes[0]?.id||'';
 function apply(change:(p:CompanyPlan)=>CompanyPlan){
  if(!plan)return;
  try{setPlan(change(plan));setError('')}catch(e){setError(e instanceof Error?e.message:'COMPANY_REFUSED')}
 }
 return <section className="antiM" aria-label="Company Mode">
  <div className="antiMHeading"><div><p className="eyebrow">SPV-COMPANY-01 / FOUNDER-OWNED / OFFLINE</p>
   <h2>COMPANY <span>MODE</span></h2>
   <p>One founder. A graph of functions, expected outputs, observable checks, and approval boundaries.</p></div>
   <div className="antiMStatus"><small>COMPANY GRAPH</small>
    <strong>{view?.complete?'LOCAL REVIEW COMPLETE':plan?'IN PROGRESS':'NO PLAN'}</strong>
    <span>NO EXECUTOR · NO AUTO-GRANTS</span></div></div>
  <div className="notice"><strong>Local planning is not verified execution</strong>
   <p>Records and reviews are self-reported. No agents run, links are not checked, no money is spent, and no deployments or messages are sent. Exported JSON is editable and is not a signed ledger or an Anti-M receipt.</p></div>
  {!plan?<form className="antiMCard antiMForm" onSubmit={e=>{e.preventDefault();try{
    setPlan(createCompanyPlan({name,founder,product,customer,weeklyGoal:goal,budgetLimitUsd:Number(budget)}));setError('');
   }catch(err){setError(err instanceof Error?err.message:'COMPANY_REFUSED')}}}>
   <div className="antiMCardTitle"><h3>01 / Founder's mission</h3><span>CREATE ONE PLAN</span></div>
   <label>COMPANY<input required value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>
   <label>FOUNDER<input required value={founder} maxLength={120} onChange={e=>setFounder(e.target.value)}/></label>
   <label>PRODUCT<input required value={product} maxLength={120} onChange={e=>setProduct(e.target.value)}/></label>
   <label>CUSTOMER<input required value={customer} maxLength={120} onChange={e=>setCustomer(e.target.value)}/></label>
   <label>WEEKLY GOAL<input required value={goal} maxLength={300} onChange={e=>setGoal(e.target.value)}/></label>
   <label>DISPLAY-ONLY BUDGET CEILING (USD)<input required type="number" min="0" max="1000000" step="1" value={budget} onChange={e=>setBudget(e.target.value)}/></label>
   <button className="primaryButton" type="submit">CREATE PLAN →</button>
  </form>:<>
   <div className="antiMCard"><div className="antiMCardTitle"><h3>01 / {plan.company.name}</h3><span>FOUNDER: {plan.company.founder}</span></div>
    <p className="antiMDeliverable">{plan.company.product} for {plan.company.customer}. Goal: {plan.company.weeklyGoal}</p>
    <p className="smallNote">Budget ceiling: USD {plan.company.budgetLimitUsd.toLocaleString()} (display-only; not enforced).</p>
    <div className="antiMReadiness">Locally accepted: {view?.accepted} / {plan.nodes.length}. Ready for manual work: {view?.ready.join(', ')||'none'}.</div>
   </div>
   <form className="antiMCard antiMForm" onSubmit={e=>{e.preventDefault();
    const id='n'+(plan.nodes.length+1);
    try{setPlan(addCompanyNode(plan,{id,function:fn,output,check,
      dependsOn:deps.split(',').map(s=>s.trim()).filter(Boolean),risk}));
     setSelectedId(id);setFn('');setOutput('');setCheck('');setDeps('');setRisk('NONE');setError('');
    }catch(err){setError(err instanceof Error?err.message:'COMPANY_REFUSED')}
   }}>
    <div className="antiMCardTitle"><h3>02 / Add function node</h3><span>UP TO 12 · EARLIER DEPENDENCIES</span></div>
    <label>FUNCTION<input required maxLength={100} value={fn} onChange={e=>setFn(e.target.value)} placeholder="Research, Build, QA..."/></label>
    <label>ONE OUTPUT<input required maxLength={240} value={output} onChange={e=>setOutput(e.target.value)}/></label>
    <label>ONE CHECK<input required maxLength={240} value={check} onChange={e=>setCheck(e.target.value)}/></label>
    <label>DEPENDENCY IDS, COMMA-SEPARATED<input value={deps} onChange={e=>setDeps(e.target.value)} placeholder="n1,n2 or blank"/></label>
    <label>CONSEQUENTIAL ACTION CLASS<select value={risk} onChange={e=>setRisk(e.target.value as CompanyRisk)}>
     {COMPANY_RISKS.map(x=><option value={x} key={x}>{x}</option>)}</select></label>
    <button type="submit" className="secondaryButton" disabled={plan.nodes.length>=12}>ADD NODE →</button>
   </form>
   <div className="antiMCard"><div className="antiMCardTitle"><h3>03 / Dependency graph</h3><span>{plan.nodes.length} NODES · ZERO AUTO EXECUTIONS</span></div>
    <label className="antiMReviewer">REVIEWER (SELF-REPORTED)<input maxLength={80} value={reviewer} onChange={e=>setReviewer(e.target.value)}/></label>
    <div className="antiMCriteria">{view?.nodes.map(n=><div className="antiMCriterion" key={n.id}>
     <span className={n.status==='LOCAL_REVIEW_ACCEPTED'?'antiMCheck pass':'antiMCheck'}>{n.status==='LOCAL_REVIEW_ACCEPTED'?'✓':'○'}</span>
     <div><strong>{n.id} / {n.function}</strong><small>{n.status} · ACTION: {n.risk}</small>
      <p>Output: {n.output} · Check: {n.check}</p>
      <p>Dependencies: {n.dependsOn.join(', ')||'none'} · Action reviewed by: {n.actionReview?.reviewer||'nobody'}</p>
      {n.evidence&&<p>Operator-entered {n.evidence.result}: {n.evidence.summary} · <code>{n.evidence.reference}</code> · Review: {n.evidence.review?.decision||'pending'}</p>}
      <div className="antiMButtons">
       <button type="button" onClick={()=>{
        try{onPropose(proposeAntiMFromCompany(plan,n.id));setError('')}
        catch(err){setError(err instanceof Error?err.message:'HANDOFF_REFUSED')}
       }}>PROPOSE NEW ANTI-M CONTRACT →</button>
       {n.risk!=='NONE'&&!n.actionReview&&<button type="button" disabled={!reviewer.trim()} onClick={()=>apply(p=>recordActionReview(p,n.id,reviewer))}>RECORD ACTION REVIEW (NOT GRANT)</button>}
       {n.evidence&&!n.evidence.review&&<>
        <button type="button" disabled={!reviewer.trim()||n.evidence.result!=='PASS'} onClick={()=>apply(p=>reviewCompanyEvidence(p,n.id,reviewer,'ACCEPT'))}>ACCEPT CHECK</button>
        <button type="button" disabled={!reviewer.trim()} onClick={()=>apply(p=>reviewCompanyEvidence(p,n.id,reviewer,'REJECT'))}>REJECT</button>
       </>}
      </div></div></div>)}</div>
   </div>
   {plan.nodes.length>0&&<form className="antiMCard antiMForm" onSubmit={e=>{e.preventDefault();
     apply(p=>recordCompanyEvidence(p,activeId,{result,method,reference,summary}));
   }}>
    <div className="antiMCardTitle"><h3>04 / Record observable check</h3><span>OPERATOR-ENTERED, NOT ATTESTED</span></div>
    <label>NODE<select value={activeId} onChange={e=>setSelectedId(e.target.value)}>
      {plan.nodes.map(n=><option key={n.id} value={n.id}>{n.id} / {n.function}</option>)}</select></label>
    <div className="antiMInline">
     <label>RESULT<select value={result} onChange={e=>setResult(e.target.value as 'PASS'|'FAIL')}><option>PASS</option><option>FAIL</option></select></label>
     <label>METHOD<select value={method} onChange={e=>setMethod(e.target.value as CompanyMethod)}>
       {COMPANY_METHODS.map(x=><option key={x}>{x}</option>)}</select></label>
    </div>
    <label>HTTPS OR SHA-256 REFERENCE<input required maxLength={300} value={reference} onChange={e=>setReference(e.target.value)}/></label>
    <label>OBSERVATION<input required maxLength={240} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
    <button className="primaryButton" type="submit">RECORD CHECK →</button>
    <p className="smallNote">Recording a new check replaces the prior value and clears its review. This is not an append-only audit history.</p>
   </form>}
   <p className="smallNote">Company → Anti-M proposes only the selected node's function, output and check. Dependencies and action type remain informational; previous evidence, reviews and approvals never transfer. Anti-M still requires a separate founder click to freeze the contract.</p>
   <div className="antiMCard"><div className="antiMCardTitle"><h3>05 / Manual handoff</h3><span>NO AUTOSAVE</span></div>
    <div className="antiMButtons">
     <button type="button" onClick={()=>saveJSON(plan)}>EXPORT PLAN JSON</button>
     <button type="button" onClick={()=>{if(window.confirm('Discard the plan? Export first.')){setPlan(null);setSelectedId('');setError('')}}}>NEW PLAN</button>
    </div></div>
  </>}
  <div className="antiMCard antiMForm"><div className="antiMCardTitle"><h3>Import existing company plan</h3><span>EXPLICIT · MAX 32 KiB</span></div>
   <label>PASTE JSON<textarea rows={4} value={importText} onChange={e=>setImportText(e.target.value)}/></label>
   <button type="button" className="secondaryButton" disabled={!importText.trim()} onClick={()=>{
    if(plan&&!window.confirm('Replace current plan? Export first.'))return;
    try{const p=importCompanyPlan(importText);setPlan(p);setSelectedId(p.nodes[0]?.id||'');setError('')}
    catch(e){setError(e instanceof Error?e.message:'COMPANY_REFUSED')}
   }}>IMPORT + VALIDATE →</button>
  </div>
  {error&&<div className="error" role="alert">Company Mode refused: {error}. No action or permission was granted.</div>}
 </section>
}
