import {useEffect,useRef,useState} from 'react';
import {LOCAL_THINKTANK_UI,LOCAL_THINKTANK_BRIDGE,makeThinkTankLocalHandoffUrl,checkThinkTankLocalBridge} from './thinktank-local-handoff.mjs';
import type {LocalThinkTankMode,LocalThinkTankHealth} from './thinktank-local-handoff.mjs';

export default function ThinkTankLocalLaunchDesk(){
 const [directive,setDirective]=useState(''),[mode,setMode]=useState<LocalThinkTankMode>('council');
 const [ack,setAck]=useState(false),[prepared,setPrepared]=useState('');
 const [health,setHealth]=useState<LocalThinkTankHealth|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('');
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort()},[]);
 function invalidate(){
  setPrepared('');setAck(false);setInfo('');setError('');
 }
 function prepare(){
  setError('');setInfo('');setPrepared('');
  if(!ack){setError('THINKTANK_LOCAL_HUMAN_ACK_REQUIRED');return}
  try{
   setPrepared(makeThinkTankLocalHandoffUrl(directive,mode));
   setInfo('A review-only local link is prepared. Nothing was sent, started, saved or approved. Open it explicitly in your locally running ThinkTank.');
  }catch(e){setError(e instanceof Error?e.message:'THINKTANK_LOCAL_DRAFT_REFUSED')}
 }
 async function check(){
  request.current?.abort();
  const ctl=new AbortController();request.current=ctl;
  setBusy(true);setError('');setInfo('');setHealth(null);
  try{
   const result=await checkThinkTankLocalBridge(fetch,ctl.signal);
   if(request.current!==ctl)return;
   setHealth(result);
   setInfo('Loopback bridge health responded. This checks only a GET endpoint, not Vite UI availability, models, paid API readiness or a finished council.');
  }catch(e){
   if(request.current!==ctl)return;
   setError('LOCAL_BRIDGE_UNAVAILABLE: '+(e instanceof Error?e.message:'NO_RESPONSE')+
    '. If using hosted Vessie, check ThinkTank origin allowlisting, browser local-network permissions and HTTPS-to-loopback policies.');
  }finally{if(request.current===ctl){request.current=null;setBusy(false)}}
 }
 return <section className="antiMCard antiMForm" aria-label="ThinkTank local draft launch desk">
  <div className="antiMCardTitle"><h3>Φ ThinkTank Local Draft Launch</h3>
   <span>LOCAL LOOPBACK · OPT-IN · NO AUTO-RUN</span></div>
  <p className="smallNote">A safe human-to-human handoff between Vessie and the local ThinkTank UI. ThinkTank's existing provider bridge exposes individual model requests, <strong>not</strong> a complete governed council API. Vessie will not call that model endpoint or counterfeit ThinkTank's event ledger.</p>
  <p className="smallNote">ThinkTank UI: <code>{LOCAL_THINKTANK_UI}</code> · optional provider-bridge health: <code>{LOCAL_THINKTANK_BRIDGE}/health</code>. Run ThinkTank's Vite UI locally and use the companion ThinkTank PR #34 to accept the bounded incoming draft.</p>
  <button type="button" className="secondaryButton" disabled={busy} onClick={()=>{void check()}}>
   {busy?'CHECKING LOCAL BRIDGE…':'CHECK LOCAL THINKTANK BRIDGE (GET ONLY) →'}
  </button>
  {health&&<p className="smallNote" role="status">Read-only bridge detected: {health.service} v{health.version}. Provider readiness and council execution: NOT VERIFIED.</p>}
  <label>YOUR DIRECTIVE FOR THINKTANK · MAX 1,200 CHARACTERS
   <textarea rows={4} maxLength={1200} value={directive} onChange={e=>{setDirective(e.target.value);invalidate()}}
    placeholder="Ask the council to investigate a specific claim, identify counterevidence and deliver a governed decision dossier…" />
  </label>
  <label>REQUESTED MODE (SUGGESTION ONLY)
   <select value={mode} onChange={e=>{setMode(e.target.value as LocalThinkTankMode);invalidate()}}>
    <option value="council">COUNCIL</option>
    <option value="debate">DEBATE</option>
    <option value="audit">AUDIT</option>
    <option value="trio">TRIO</option>
    <option value="build">BUILD</option>
   </select>
  </label>
  <label className="antiMCheck">
   <input type="checkbox" checked={ack} onChange={e=>{setAck(e.target.checked);setPrepared('');setError('')}} />
   I wrote and reviewed this directive. I understand the local URL fragment is encoded, not encrypted, and may appear in browser history. I will not include API keys, passwords or private personal data.
  </label>
  <button type="button" className="primaryButton" disabled={!directive.trim()||!ack}
   onClick={prepare}>PREPARE LOCAL THINKTANK DRAFT (NO RUN) →</button>
  {prepared&&<div className="antiMReadiness">
   <strong>Explicit handoff ready · {mode.toUpperCase()} suggested</strong>
   <p>Opening the link sends no provider request from Vessie. The companion ThinkTank UI shows the incoming text as an untrusted preview and requires another click to put it in the operator input. LIVE provider execution remains a separate operator action.</p>
   <a target="_blank" rel="noopener noreferrer" href={prepared}>OPEN DRAFT IN LOCAL THINKTANK ↗</a>
   <button type="button" className="secondaryButton" onClick={async()=>{
    try{await navigator.clipboard.writeText(prepared);setInfo('Local ThinkTank draft link copied. The fragment is not encrypted; keep it private.')}
    catch{setError('THINKTANK_LOCAL_CLIPBOARD_UNAVAILABLE')}
   }}>COPY LOCAL HANDOFF LINK</button>
  </div>}
  <p className="smallNote">Run locally: start ThinkTank's separate bridge with <code>npm run bridge</code> and UI with <code>npm run dev -- --host 127.0.0.1 --port 5173</code>. ThinkTank must explicitly accept the draft before it reaches its ordinary prompt field. You separately select the model/mode and press RUN LIVE PROVIDERS in ThinkTank. Export its dossier afterward and import using the existing Decision Bridge.</p>
  {info&&<p role="status" className="smallNote">{info}</p>}
  {error&&<p role="alert" className="error">ThinkTank Local Launch: {error}. No request, action or completion was authorized.</p>}
 </section>
}
