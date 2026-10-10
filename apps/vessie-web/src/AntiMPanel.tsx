import {useRef,useState} from 'react';
import {createBundle,appendEvent,inspectBundle,importBundle,closureReceipt} from './anti-m.mjs';
import type {AntiMBundle,AntiMState} from './anti-m.mjs';
import {validateAntiMProposal} from './company-anti-m-handoff.mjs';
import type {AntiMProposal} from './company-anti-m-handoff.mjs';

const ACTIONS=['REPO_WRITE','DEPLOY','EXTERNAL_POST','SPEND','CREDENTIAL_USE','OTHER_EFFECT'] as const;
const METHODS=['CI_RUN','HUMAN_TEST','ARTIFACT_HASH','OTHER'] as const;
function saveJSON(data:unknown,name:string){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name;
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function AntiMPanel({handoffProposal,onHandoffConsumed}:{
  handoffProposal:AntiMProposal|null;onHandoffConsumed:()=>void;
}){
  const [bundle,setBundle]=useState<AntiMBundle|null>(null);
  const [view,setView]=useState<AntiMState|null>(null);
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const [error,setError]=useState('');
  const [title,setTitle]=useState('');
  const [deliverable,setDeliverable]=useState('');
  const [criteria,setCriteria]=useState('');
  const [reviewer,setReviewer]=useState('');
  const [kind,setKind]=useState<(typeof ACTIONS)[number]>('REPO_WRITE');
  const [actionText,setActionText]=useState('');
  const [criterionId,setCriterionId]=useState('c1');
  const [method,setMethod]=useState<(typeof METHODS)[number]>('CI_RUN');
  const [result,setResult]=useState<'PASS'|'FAIL'>('PASS');
  const [reference,setReference]=useState('');
  const [summary,setSummary]=useState('');
  const [closeNote,setCloseNote]=useState('');
  const [importText,setImportText]=useState('');
  async function execute(fn:()=>Promise<AntiMBundle>){
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try{
      const next=await fn();
      const inspected=await inspectBundle(next);
      setBundle(next);setView(inspected);
    }catch(e){setError(e instanceof Error&&/^ANTIM_[A-Z_]+$/.test(e.message)?e.message:'ANTIM_REFUSED');}
    finally{lock.current=false;setBusy(false);}
  }
  function add(type:string,payload:Record<string,unknown>){
    if(!bundle)return;
    void execute(()=>appendEvent(bundle,type,payload));
  }
  function downloadReceipt(){
    if(!bundle||!view?.closed)return;
    // Recompute the hash chain before producing the claim.
    void (async()=>{
      try{saveJSON(await closureReceipt(bundle),'anti-m-'+view.contract.id+'-receipt.json');setError('');}
      catch{setError('ANTIM_RECEIPT_REFUSED');}
    })();
  }
  return <section className="antiM" aria-label="Anti-M completion console">
    <div className="antiMHeading">
      <div><p className="eyebrow">SPV-AM-01 / OPERATOR-OWNED FINISH MODE</p><h2>ANTI-M <span>5000</span></h2>
        <p>Executive closure without imaginary authority. One contract. Testable criteria. Explicit reviews. Actual receipts.</p></div>
      <div className="antiMStatus"><small>CLOSURE STATE</small><strong>{view?.status||'NO CONTRACT'}</strong>
        <span>NO EXECUTOR · NO AUTO-GRANTS</span></div>
    </div>
    <div className="notice"><strong>Local verification is not proof of external success</strong>
      <p>VERIFIED_DONE_LOCAL means the operator reviewed passing evidence and the journal replays with a valid local SHA-256 chain. URLs and CI outcomes are operator-entered, not fetched or authenticated here. No real deployment, credential access, spending, or agent execution happens from this tab.</p></div>
    {handoffProposal&&<div className="antiMCard antiMForm" aria-label="Pending Company Mode proposal">
      <div className="antiMCardTitle"><h3>Company Mode → Anti-M draft proposal</h3><span>NOT AN APPROVAL OR RECEIPT</span></div>
      <p className="antiMDeliverable">From {handoffProposal.source.company} / {handoffProposal.source.nodeId}: {handoffProposal.draft.title}</p>
      <p className="smallNote">Proposed deliverable: {handoffProposal.draft.deliverable}. Check: {handoffProposal.draft.criteria[0]}.</p>
      <p className="smallNote">Dependencies: {handoffProposal.source.dependencies.join(', ')||'none'} (NOT verified here).
        Consequential action: {handoffProposal.source.risk} (NOT approved here).
        No evidence, previous reviews, budget authority or permissions transfer.</p>
      {bundle&&<p className="smallNote">An Anti-M contract is already open. Export or close it and start another before using this proposal.</p>}
      <div className="antiMButtons">
        <button type="button" disabled={!!bundle||busy} onClick={()=>{
          try{
            const p=validateAntiMProposal(handoffProposal);
            setTitle(p.draft.title);setDeliverable(p.draft.deliverable);
            setCriteria(p.draft.criteria.join('\n'));
            if(p.source.risk!=='NONE'){
              setKind(p.source.risk);setActionText(p.draft.deliverable);
            }
            setError('');onHandoffConsumed();
          }catch{setError('ANTIM_HANDOFF_REJECTED');}
        }}>COPY DRAFT INTO EMPTY CONTRACT FORM →</button>
        <button type="button" onClick={onHandoffConsumed}>DISMISS PROPOSAL</button>
      </div>
      <p className="smallNote">Copies draft text only. After freezing a new Anti-M contract, declare any consequential action and independently enter and review fresh evidence. This is a manual step.</p>
    </div>}
    {!bundle?<form className="antiMCard antiMForm" onSubmit={e=>{
      e.preventDefault();
      const lines=criteria.split('\n').map(x=>x.trim()).filter(Boolean);
      void execute(()=>createBundle({title,deliverable,criteria:lines},'am-'+crypto.randomUUID().replaceAll('-','').slice(0,18)));
    }}>
      <div className="antiMCardTitle"><h3>01 / Open a completion contract</h3><span>Scope freezes after creation</span></div>
      <label>OBJECTIVE<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ship OpenBlue measurement v1" /></label>
      <label>DELIVERABLE<input required maxLength={300} value={deliverable} onChange={e=>setDeliverable(e.target.value)} placeholder="Public page, passing CI, browser smoke-test record" /></label>
      <label>ACCEPTANCE CRITERIA · ONE PER LINE · 1 TO 8<textarea required rows={4} value={criteria} onChange={e=>setCriteria(e.target.value)} placeholder={'Build passes\nMeasurement works on sample scene\nLive browser verified'}/></label>
      <button className="primaryButton" disabled={busy} type="submit">FREEZE CONTRACT →</button>
    </form>:<div className="antiMCard">
      <div className="antiMCardTitle"><h3>01 / {view?.contract.title}</h3><span>CONTRACT LOCKED · {view?.contract.id}</span></div>
      <p className="antiMDeliverable">{view?.contract.deliverable}</p>
      <div className="antiMCriteria">{view?.contract.criteria.map(c=>{
        const latest=view.evidence.filter(x=>x.criterionId===c.id).at(-1);
        const accepted=latest?.result==='PASS'&&latest.review?.decision==='ACCEPT';
        return <div key={c.id} className="antiMCriterion">
          <span className={accepted?'antiMCheck pass':'antiMCheck'}>{accepted?'✓':'○'}</span>
          <div><strong>{c.description}</strong><small>{latest?latest.result+' · '+(latest.review?.decision||'NEEDS REVIEW')+' · '+latest.method:'EVIDENCE REQUIRED'}</small>
            {latest&&<p>{latest.summary} · <code>{latest.reference}</code></p>}
            {latest&&!latest.review&&!view.closed&&<div className="antiMButtons">
              <button type="button" disabled={busy||latest.result!=='PASS'||!reviewer.trim()} onClick={()=>add('EVIDENCE_REVIEWED',{evidenceSequence:latest.sequence,reviewer,decision:'ACCEPT'})}>ACCEPT EVIDENCE</button>
              <button type="button" disabled={busy||!reviewer.trim()} onClick={()=>add('EVIDENCE_REVIEWED',{evidenceSequence:latest.sequence,reviewer,decision:'REJECT'})}>REJECT</button>
            </div>}</div>
        </div>;
      })}</div>
    </div>}
    {bundle&&view&&!view.closed&&<div className="antiMColumns">
      <div className="antiMCard antiMForm">
        <div className="antiMCardTitle"><h3>02 / Approval boundaries</h3><span>Review record, not a runtime grant</span></div>
        <p className="smallNote">Declare any planned repo write, deployment, external communication, payment, credential use, or other side effect. Undeclared real actions remain outside this console's authority.</p>
        <label>ACTION CLASS<select value={kind} onChange={e=>setKind(e.target.value as (typeof ACTIONS)[number])}>{ACTIONS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>PROPOSED ACTION<input value={actionText} maxLength={220} onChange={e=>setActionText(e.target.value)} placeholder="Deploy static preview" /></label>
        <button type="button" className="secondaryButton" disabled={busy||!actionText.trim()} onClick={()=>{
          add('ACTION_DECLARED',{id:'a'+crypto.randomUUID().replaceAll('-','').slice(0,12),kind,description:actionText});
          setActionText('');
        }}>DECLARE ACTION →</button>
        {view.actions.map(a=><div className="antiMAction" key={a.id}>
          <strong>{a.kind}</strong><p>{a.description}</p>
          {a.approval?<small>OPERATOR REVIEW: {a.approval.reviewer} · NO AUTHORITY GRANTED</small>:
          <button type="button" disabled={busy||!reviewer.trim()} onClick={()=>add('ACTION_APPROVED',{actionId:a.id,reviewer})}>RECORD OPERATOR REVIEW</button>}
        </div>)}
      </div>
      <div className="antiMCard antiMForm">
        <div className="antiMCardTitle"><h3>03 / Evidence ledger</h3><span>References are not authenticated</span></div>
        <label>CRITERION<select value={criterionId} onChange={e=>setCriterionId(e.target.value)}>{view.contract.criteria.map(c=><option key={c.id} value={c.id}>{c.id} / {c.description}</option>)}</select></label>
        <div className="antiMInline"><label>METHOD<select value={method} onChange={e=>setMethod(e.target.value as (typeof METHODS)[number])}>{METHODS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>RESULT<select value={result} onChange={e=>setResult(e.target.value as 'PASS'|'FAIL')}><option>PASS</option><option>FAIL</option></select></label></div>
        <label>PROOF REFERENCE · HTTPS OR sha256:<input value={reference} maxLength={300} onChange={e=>setReference(e.target.value)} placeholder="https://github.com/.../actions/runs/..." /></label>
        <label>OBSERVATION<input value={summary} maxLength={240} onChange={e=>setSummary(e.target.value)} placeholder="Tests passed on run 123" /></label>
        <button type="button" className="primaryButton" disabled={busy||!reference.trim()||!summary.trim()} onClick={()=>{
          add('EVIDENCE_RECORDED',{criterionId,method,result,reference,summary});
          setReference('');setSummary('');
        }}>APPEND EVIDENCE →</button>
      </div>
    </div>}
    {bundle&&view&&<div className="antiMCard">
      <div className="antiMCardTitle"><h3>04 / Close the loop</h3><span>{view.eventCount} append-only events</span></div>
      <label className="antiMReviewer">REVIEWER NAME (SELF-REPORTED)<input value={reviewer} maxLength={80} onChange={e=>setReviewer(e.target.value)} placeholder="Operator / Mikey" disabled={view.closed}/></label>
      <div className="antiMReadiness">{view.readiness.ready?<strong>All local review prerequisites are present.</strong>:
        <ul>{view.readiness.missing.map(m=><li key={m}>{m}</li>)}</ul>}</div>
      {!view.closed?<div className="antiMForm">
        <label>CLOSURE NOTE<input value={closeNote} maxLength={240} onChange={e=>setCloseNote(e.target.value)} placeholder="Reviewed test evidence and artifact references" /></label>
        <button type="button" className="primaryButton" disabled={busy||!view.readiness.ready||!reviewer.trim()||!closeNote.trim()}
          onClick={()=>add('CLOSED',{reviewer,note:closeNote})}>VERIFY LOCAL PREREQUISITES + CLOSE →</button>
      </div>:<div className="antiMDone"><strong>✓ VERIFIED_DONE_LOCAL</strong>
        <p>Operator-reviewed completion, NOT independently attested external execution. This contract is immutable in this session.</p>
        <button type="button" className="primaryButton" onClick={downloadReceipt}>DOWNLOAD CLOSURE RECEIPT</button>
      </div>}
      <div className="antiMFoot"><span>LEDGER TAIL · <code>{view.tailHash}</code></span><span>SHA-256 · UNSIGNED · SELF-REPORTED SOURCE</span></div>
      <div className="antiMButtons">
        <button type="button" className="secondaryButton" onClick={()=>saveJSON(bundle,'anti-m-'+view.contract.id+'-ledger.json')}>EXPORT REPLAYABLE LEDGER JSON</button>
        <button type="button" className="secondaryButton" onClick={()=>{if(window.confirm('Discard unsaved Anti-M session? Export the journal first.')){setBundle(null);setView(null);setError('');}}}>START ANOTHER CONTRACT</button>
      </div>
      <details className="antiMHistory"><summary>Inspect event trail</summary><ol>{bundle.events.map(e=><li key={e.seq}><strong>#{e.seq} {e.type}</strong> <span>{e.at}</span> <code>{e.hash.slice(0,16)}…</code></li>)}</ol></details>
    </div>}
    <div className="antiMCard antiMForm">
      <div className="antiMCardTitle"><h3>Resume from a saved ledger</h3><span>Explicit import only · max 128 KiB</span></div>
      <p className="smallNote">Journal is memory-only until exported. Reloading the page loses unsaved work. Imported data is locally replayed and checked; it never becomes a command to Vessie.</p>
      <label>PASTE EXPORTED JSON<textarea rows={3} spellCheck={false} value={importText} onChange={e=>setImportText(e.target.value)} placeholder='{"schema":"superphivessel.anti-m.bundle.v0.1","events":[...]}'/></label>
      <button type="button" className="secondaryButton" disabled={busy||!importText.trim()} onClick={()=>{
        if(bundle&&!window.confirm('Replace current session with imported ledger? Export first if needed.'))return;
        void execute(()=>importBundle(importText));
      }}>IMPORT + VALIDATE LEDGER →</button>
    </div>
    {error&&<div className="error" role="alert">Anti-M refused: {error}. No execution or permission was granted.</div>}
  </section>;
}
