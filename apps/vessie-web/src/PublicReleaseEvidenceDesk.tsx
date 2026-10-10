import {useRef,useState} from 'react';
import {readPublicReleaseEvidence,releaseEvidenceSummary} from './public-release-evidence.mjs';
import type {ReleaseEvidenceSnapshot} from './public-release-evidence.mjs';

export default function PublicReleaseEvidenceDesk(){
 const [snapshot,setSnapshot]=useState<ReleaseEvidenceSnapshot|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('');
 const sequence=useRef(0);
 async function scan(){
  const ticket=++sequence.current;
  setBusy(true);setSnapshot(null);setError('');setInfo('');
  try{
   const result=await readPublicReleaseEvidence();
   if(ticket!==sequence.current)return;
   setSnapshot(result);
   setInfo('Read-only public source reconciliation finished. Snapshot can go stale; rerun deliberately to refresh.');
  }catch(e){
   if(ticket!==sequence.current)return;
   setError(e instanceof Error?e.message:'RELEASE_EVIDENCE_UNAVAILABLE');
  }finally{if(ticket===sequence.current)setBusy(false)}
 }
 async function copySummary(){
  if(!snapshot)return;
  try{
   await navigator.clipboard.writeText(releaseEvidenceSummary(snapshot));
   setInfo('Observation summary copied. Pasting a link into Anti-M is still self-reported until a separate source review; no permission or DONE was transferred.');
  }catch{setError('RELEASE_EVIDENCE_CLIPBOARD_UNAVAILABLE')}
 }
 return <section className="antiMCard antiMForm" aria-label="Public release evidence desk">
  <div className="antiMCardTitle"><h3>Public Release Evidence Desk</h3>
   <span>EXPLICIT SCAN · PUBLIC GET ONLY · NO GRANTS</span></div>
  <p className="smallNote">Compare the deployed Vessie revision with GitHub's public Pages workflow metadata and the latest matching browser-smoke result in the first 20 sampled smoke runs. These observations are not signatures, authenticated reviewer identities, or an Anti-M completion verdict.</p>
  <p className="smallNote">No background scans. Clicking scan makes only public GET requests to your GitHub Pages build receipt and GitHub Actions API, with no credentials or repository writes.</p>
  <button type="button" className="secondaryButton" disabled={busy} onClick={()=>{void scan()}}>
   {busy?'CHECKING PUBLIC RELEASE SOURCES…':'CHECK LIVE RELEASE EVIDENCE (GET ONLY) →'}
  </button>
  {snapshot&&<div className="antiMReadiness">
    <strong>Public observation: {snapshot.grade.replaceAll('_',' ')}</strong>
    <p>Deployed revision: <code className="archiveHash">{snapshot.revision}</code></p>
    <p>Pages workflow: <strong>{snapshot.pages.conclusion||'pending'}</strong> · <a href={snapshot.pages.url} target="_blank" rel="noopener noreferrer">View GitHub Pages run ↗</a></p>
    <p>Browser smoke: <strong>{snapshot.smoke?.conclusion||'not observed'}</strong>
     {snapshot.smoke&&<> · <a href={snapshot.smoke.url} target="_blank" rel="noopener noreferrer">View public Chromium run ↗</a></>}</p>
    <p>Sample: {snapshot.sampledSmokeRuns} recent smoke workflow runs examined. A result outside the sample is unknown, not a PASS.</p>
    <p>{snapshot.publicSourcesAligned
     ?'Public sources agree on this deployment revision and the sampled browser smoke passed. This is observed release health, NOT independently attested external execution or completion.'
     :'Public sources do NOT establish a matching successful browser smoke for this deployment. No green release-health claim is made.'}</p>
    <p>A matching commit and timestamp do not independently prove the exact GitHub workflow parent relationship. Source records can change after this scan.</p>
    <button type="button" className="secondaryButton" onClick={()=>{void copySummary()}}>COPY PUBLIC OBSERVATION SUMMARY (NOT PROOF) →</button>
  </div>}
  {info&&<p role="status" className="smallNote">{info}</p>}
  {error&&<p role="alert" className="error">Release Evidence Desk refused: {error}. No authority, review, evidence, or DONE was transferred.</p>}
 </section>
}
