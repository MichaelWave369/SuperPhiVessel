import { useEffect, useRef, useState } from 'react';
import {
  CLOUD_SITE, loadCloudObservation, makeBrainCShadowCandidate,
} from './cloud-worker-evidence.mjs';
import type { CloudEvidence } from './cloud-worker-evidence.mjs';

export default function CloudEvidencePanel() {
  const [record,setRecord]=useState<CloudEvidence|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [exported,setExported]=useState(false);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);

  async function inspect() {
    controller.current?.abort();
    const c=new AbortController();
    controller.current=c;
    setBusy(true);setError('');setRecord(null);setExported(false);
    try {
      const result=await loadCloudObservation((url,options)=>fetch(url,{...options,signal:c.signal}));
      if (!c.signal.aborted) setRecord(result);
    } catch(e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'CLOUD_EVIDENCE_UNAVAILABLE');
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }

  function exportShadow() {
    if(!record) return;
    try {
      const candidate=makeBrainCShadowCandidate(record);
      const blob=new Blob([JSON.stringify(candidate,null,2)+'\n'],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download='brainc-cloud-observation-shadow.json';
      document.body.appendChild(link);
      link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),0);
      setExported(true);
    } catch { setError('CLOUD_EVIDENCE_EXPORT_REFUSED'); }
  }

  return <section className="cloudPanel" aria-label="FieldCloudWorker evidence panel">
    <div className="laneTop"><strong>FIELDCLOUDWORKER · PUBLIC EVIDENCE</strong>
      <span className="laneTag">OPT-IN / UNVERIFIED</span></div>
    <p className="smallNote">One operator click performs four bounded public GitHub GETs. Both observation files are read from the same exact repository commit and correlated with the GitHub Actions run. No cloud secrets, local devices, BrainC models or memory are accessed.</p>
    <div className="inspectActions">
      <button type="button" className="primaryButton" onClick={inspect} disabled={busy}>
        {busy?'READING PUBLIC GITHUB…':'INSPECT CLOUD WORKER →'}</button>
      <a className="cloudLink" href={CLOUD_SITE} target="_blank" rel="noopener noreferrer">OPEN WORKER DASHBOARD ↗</a>
    </div>
    {busy&&<p className="smallNote" role="status">Fetching and checking an unverified public observation…</p>}
    {error&&<div className="error" role="alert">Observation unavailable or rejected: {error}. No downstream action is unlocked.</div>}
    {record&&<div className="cloudEvidenceResult" role="status">
      <div className="laneTop"><strong>{record.disposition.replaceAll('_',' ')}</strong>
        <span className="laneTag">RUN METADATA CORRELATED</span></div>
      <div className="cloudEvidenceFacts">
        <div><small>LAST OBSERVED</small><strong>{new Date(record.observed_at).toLocaleString()}</strong></div>
        <div><small>RUN ID</small><strong>{record.run_id}</strong></div>
        <div><small>SNAPSHOT COMMIT</small><strong>{record.branch_snapshot}</strong></div>
        <div><small>HISTORY ROWS</small><strong>{record.history_count}</strong></div>
      </div>
      <div className="cloudTaskList">{record.tasks.map(t=>
        <div key={t.task}><span>{t.task.replaceAll('_',' ')}</span>
          <strong className={t.status==='ok'?'cloudTaskOk':'cloudTaskError'}>{t.status.toUpperCase()}</strong>
        </div>)}</div>
      <p className="smallNote">Public GitHub metadata matched the claimed repository, commit, workflow and run result. That does <strong>not</strong> authenticate measurement content, operator identity or consent. Source data never enters Vessie's prompt, memory, or routing systems.</p>
      <div className="cloudActions">
        <a className="cloudLink" href={record.run_url} target="_blank" rel="noopener noreferrer">VIEW VERIFIED RUN METADATA ↗</a>
        <button type="button" className="secondaryButton" onClick={exportShadow}>EXPORT BRAINC SHADOW CANDIDATE</button>
      </div>
      {exported&&<p className="smallNote">Downloaded an offline, untrusted review candidate. BrainC has NOT consumed it. No model routing or execution was requested.</p>}
    </div>}
    <div className="notice"><strong>Trust boundary</strong>
      <p>Visibility ≠ authority. The BrainC export is an inert, review-only JSON envelope and is not connected to the BrainC runtime. This new React view does not modify the canonical Vessie HTML, the Netlify deployment or the PhiOS executor.</p>
    </div>
  </section>;
}
