import { useEffect, useState } from 'react';
import {
  gatewayModels, gatewayStatus, pairGateway, revokeGateway, confirmRevokedGateway,
  type GatewayModel, LOCAL_GATEWAY
} from './pairing-client.mjs';
import { makeR2BrowserReceipt } from './pilot-evidence.mjs';

type Check = 'PASS' | 'FAIL' | 'NOT_RUN';
type CheckKey = 'browser_https_pair' | 'browser_status_read' |
  'browser_model_inventory' | 'session_revocation_request' | 'revoked_session_denied';
const initialChecks: Record<CheckKey,Check> = {
  browser_https_pair: 'NOT_RUN',
  browser_status_read: 'NOT_RUN',
  browser_model_inventory: 'NOT_RUN',
  session_revocation_request: 'NOT_RUN',
  revoked_session_denied: 'NOT_RUN',
};
const formatBytes=(size:number|null)=>
  size===null?'Unreported':(size/1024/1024/1024).toFixed(2)+' GiB';

export default function PairingPanel({
  session,setSession,expiresAt,setExpiresAt
}:{
  session:string|null;
  setSession:(value:string|null)=>void;
  expiresAt:number|null;
  setExpiresAt:(value:number|null)=>void;
}) {
  const [code,setCode]=useState('');
  const [trialId,setTrialId]=useState('');
  const [models,setModels]=useState<GatewayModel[]|null>(null);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [checks,setChecks]=useState<Record<CheckKey,Check>>(initialChecks);
  const [observedModelCount,setObservedModelCount]=useState<number|null>(null);
  const mark=(key:CheckKey, result:Check)=>{
    setChecks(previous=>({...previous,[key]:result}));
  };
  useEffect(()=>{
    if(!session||expiresAt===null)return;
    const timeLeft=expiresAt-Date.now();
    if(timeLeft<=0){
      setSession(null);setExpiresAt(null);setModels(null);
      setStatus('Session expired. Restart the local gateway to obtain another pairing code.');
      return;
    }
    const timer=window.setTimeout(()=>{
      setSession(null);setExpiresAt(null);setModels(null);
      setStatus('Session expired. Restart the local gateway to re-pair.');
    },timeLeft);
    return ()=>window.clearTimeout(timer);
  },[session,expiresAt]);

  const pair=async()=>{
    if(!/^[a-f0-9]{32}$/.test(trialId)){
      setError('Enter a valid non-secret trial ID generated locally before pairing.');
      return;
    }
    setBusy(true);setError('');
    // A new pairing attempt must not inherit earlier trial PASS states.
    setChecks({...initialChecks});setObservedModelCount(null);
    let provisionalKey:string|null=null;
    try{
      const key=await pairGateway(code.trim());
      provisionalKey=key;
      mark('browser_https_pair','PASS');
      const info=await gatewayStatus(key);
      mark('browser_status_read','PASS');
      setSession(key);
      setExpiresAt(Date.now()+Math.min(900,Math.max(1,info.session_expires_in_seconds))*1000);
      setCode('');
      setStatus(info.gateway_status+' · '+info.session_expires_in_seconds+'s maximum session');
    }catch{
      mark('browser_https_pair',provisionalKey?'PASS':'FAIL');
      mark('browser_status_read',provisionalKey?'FAIL':'NOT_RUN');
      if(provisionalKey){try{await revokeGateway(provisionalKey);}catch{ /* Restart gateway to force expiry if revocation fails. */ }}
      setSession(null);setExpiresAt(null);setModels(null);setCode('');
      setError('Pairing failed. Check local TLS trust, Chrome private-network permission and the one-use secret. Do not disable security controls.');
    }finally{setBusy(false);}
  };

  const refresh=async()=>{
    if(!session)return;
    setBusy(true);setError('');
    try{
      const read=await gatewayModels(session);
      setModels(read.models);
      setObservedModelCount(read.count);
      mark('browser_model_inventory','PASS');
      setStatus('Ollama probe: '+read.probe_status+' · '+read.count+' discovered models');
    }catch{
      mark('browser_model_inventory','FAIL');
      setModels(null);setStatus('Connection unavailable');
      setError('Could not read live models. Session may have expired, Ollama may be unavailable or private-network policy may block access.');
    }finally{setBusy(false);}
  };

  const disconnect=async()=>{
    if(busy)return;
    setBusy(true);
    const current=session;
    setSession(null);setExpiresAt(null);setModels(null);setCode('');
    setStatus('Local session cleared');setError('');
    if(current){
      let deleteConfirmed=false;
      try{
        await revokeGateway(current);
        deleteConfirmed=true;
        mark('session_revocation_request','PASS');
        setStatus('Gateway acknowledged DELETE; checking old bearer refusal');
        const denied=await confirmRevokedGateway(current);
        if(!denied.confirmed)throw new Error('DENIAL_NOT_CONFIRMED');
        mark('revoked_session_denied','PASS');
        setStatus('Gateway revoked session and refused the old bearer');
      }catch{
        if(!deleteConfirmed)mark('session_revocation_request','FAIL');
        mark('revoked_session_denied','FAIL');
        setError('The browser discarded its session, but post-revocation denial was not confirmed. Restart the gateway to invalidate any remaining bearer.');
      }
    }
    setBusy(false);
  };

  const exportPilot=()=>{
    if(!/^[a-f0-9]{32}$/.test(trialId)){
      setError('A valid trial ID is required to export the R2 pilot report.');
      return;
    }
    const receipt=makeR2BrowserReceipt(checks,{modelCount:observedModelCount,trialId});
    const blob=new Blob([JSON.stringify(receipt,null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download='vessie-r2-browser-pilot.json';
    anchor.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  return <section className="pairSection">
    <div className="laneTop"><strong>LOCAL MODEL TELEMETRY</strong><span className="laneTag">R2 EXPERIMENTAL HTTPS</span></div>
    <p className="smallNote">Pair with an operator-run gateway on <code>{LOCAL_GATEWAY}</code> to inspect installed and running Ollama models. Local TLS trust and browser private-network policies must allow this connection. Sessions live only in this tab's memory, expire after 15 minutes, and cannot execute models or read private memory.</p>
    <div className="pairControls">
      <label htmlFor="r2-trial-id">R2 TRIAL ID · NON-SECRET · 32 LOWERCASE HEX CHARACTERS</label>
      <input id="r2-trial-id" type="text" value={trialId}
        onChange={e=>{setTrialId(e.target.value.trim());setChecks({...initialChecks});
          setObservedModelCount(null);setError('');}}
        placeholder="From node pilots/new-trial.mjs" spellCheck={false}
        autoComplete="off" disabled={Boolean(session)||busy}
        maxLength={32}/>
    </div>
    {!session?<div className="pairControls">
      <label htmlFor="pair-secret">ONE-TIME PAIRING SECRET</label>
      <input id="pair-secret" type="password" value={code} onChange={e=>setCode(e.target.value)}
        autoComplete="off" spellCheck={false} placeholder="64 hex characters from local terminal"/>
      <button type="button" className="primaryButton" disabled={busy||!/^[a-f0-9]{64}$/i.test(code.trim())||!/^[a-f0-9]{32}$/.test(trialId)}
        onClick={pair}>{busy?'PAIRING…':'PAIR READ-ONLY →'}</button>
    </div>:<div className="pairActions">
      <span className="pairReady">READ-ONLY SESSION PAIRED</span>
      <button type="button" className="primaryButton" onClick={refresh} disabled={busy}>{busy?'PROBING…':'DISCOVER LOCAL MODELS'}</button>
      <button type="button" className="secondaryButton" onClick={disconnect} disabled={busy}>DISCONNECT / REVOKE</button>
    </div>}
    {status&&<p className="smallNote" role="status">{status}</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {models&&<div className="modelTableWrap">
      <table className="modelTable"><thead><tr><th>Installed tag</th><th>Loaded</th><th>Quantization</th><th>Size</th><th>Reported VRAM</th><th>Routing approval</th></tr></thead>
      <tbody>{models.map(model=><tr key={model.name}>
        <td><strong>{model.name}</strong></td><td>{model.loaded?'YES':'NO'}</td>
        <td>{model.quantization}</td><td>{formatBytes(model.size_bytes)}</td>
        <td>{formatBytes(model.runtime_vram_bytes)}</td><td>NONE · DISCOVERY ONLY</td>
      </tr>)}</tbody></table>
    </div>}
    <div className="pilotPanel">
      <div className="laneTop"><strong>R2 WINDOWS/BROWSER PILOT</strong><span className="laneTag">UNATTESTED REPORT</span></div>
      <p className="smallNote">These checks record only what this page observed, never prove certificate provenance or authorize routing. The trial ID must match the separate Windows PowerShell receipt; it is an operator-supplied correlation label, not machine attestation. The revocation test requires the old bearer to receive HTTP 403 SESSION_DENIED after an acknowledged DELETE; failed network access is not counted as success. Export a redacted report alongside the separate PowerShell TLS trust report after testing on your own PC.</p>
      <dl className="pilotChecks">
        {Object.entries(checks).map(([name,result])=><div key={name}>
          <dt>{name.replaceAll('_',' ').toUpperCase()}</dt>
          <dd>{result}</dd>
        </div>)}
      </dl>
      <button type="button" className="secondaryButton" onClick={exportPilot} disabled={busy||!/^[a-f0-9]{32}$/.test(trialId)}>
        EXPORT REDACTED BROWSER REPORT
      </button>
      <p className="smallNote">Report excludes secrets, tokens, usernames, device identity and model names. Gateway restart is required to invalidate a stranded session when the browser closes without disconnecting.</p>
    </div>
    <p className="smallNote">Certificate keys, API keys and executor authority never enter the static site. If the browser blocks localhost access, do not disable security features. Use the R1 PowerShell probe until an approved topology works.</p>
  </section>;
}
