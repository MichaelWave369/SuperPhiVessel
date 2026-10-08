import { useState } from 'react';
import {
  gatewayModels, gatewayStatus, pairGateway, revokeGateway,
  type GatewayModel, LOCAL_GATEWAY
} from './pairing-client.mjs';

const formatBytes=(size:number|null)=>
  size===null?'Unreported':(size/1024/1024/1024).toFixed(2)+' GiB';

export default function PairingPanel() {
  const [code,setCode]=useState('');
  const [session,setSession]=useState<string|null>(null);
  const [models,setModels]=useState<GatewayModel[]|null>(null);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const pair=async()=>{
    setBusy(true);setError('');
    try{
      const key=await pairGateway(code.trim());
      setSession(key);setCode('');
      const info=await gatewayStatus(key);
      setStatus(info.gateway_status+' · '+info.session_expires_in_seconds+'s maximum session');
    }catch{
      setError('Pairing failed. Verify the local gateway, certificate trust, private-network permissions and pairing secret. No browser security settings should be disabled.');
    }finally{setBusy(false);}
  };
  const refresh=async()=>{
    if(!session)return;
    setBusy(true);setError('');
    try{
      const read=await gatewayModels(session);
      setModels(read.models);
      setStatus('Ollama probe: '+read.probe_status+' · '+read.count+' discovered models');
    }catch{
      setModels(null);setStatus('Connection unavailable');
      setError('Could not read live models. Session may have expired, Ollama may be unavailable, or private-network policy may block the request.');
    }finally{setBusy(false);}
  };
  const disconnect=async()=>{
    const current=session;
    setSession(null);setModels(null);setCode('');setStatus('Disconnected');setError('');
    if(current){try{await revokeGateway(current);}catch{setError('Local session cleared; if revocation did not reach the gateway, restart it to invalidate the old session.');}}
  };
  return <section className="pairSection">
    <div className="laneTop"><strong>LOCAL MODEL TELEMETRY</strong><span className="laneTag">R2 EXPERIMENTAL HTTPS</span></div>
    <p className="smallNote">Pair with an operator-run gateway on <code>{LOCAL_GATEWAY}</code> to inspect installed and running Ollama models. Local TLS trust and browser private-network policies must allow the connection. Sessions exist only in this tab's memory, expire after 15 minutes, and cannot run models or read memories.</p>
    {!session?<div className="pairControls">
      <label htmlFor="pair-secret">ONE-TIME PAIRING SECRET</label>
      <input id="pair-secret" type="password" value={code} onChange={e=>setCode(e.target.value)}
        autoComplete="off" spellCheck={false} placeholder="64 hex characters from local terminal"/>
      <button type="button" className="primaryButton" disabled={busy||!/^[a-f0-9]{64}$/i.test(code.trim())}
        onClick={pair}>{busy?'PAIRING…':'PAIR READ-ONLY →'}</button>
    </div>:<div className="pairActions">
      <span className="pairReady">READ-ONLY SESSION PAIRED</span>
      <button type="button" className="primaryButton" onClick={refresh} disabled={busy}>{busy?'PROBING…':'DISCOVER LOCAL MODELS'}</button>
      <button type="button" className="secondaryButton" onClick={disconnect}>DISCONNECT / REVOKE</button>
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
    <p className="smallNote">Certificate keys, credentials and authority never enter the static site. The short-lived session token is held only in React state, not localStorage or the repo. If browser security refuses the connection, keep using the R1 PowerShell probe.</p>
  </section>;
}
