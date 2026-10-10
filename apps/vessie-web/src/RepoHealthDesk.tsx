import {useRef,useState} from 'react';
import {readPublicRepositoryHealth} from './github-repo-health.mjs';
import type {GithubHealthPreview} from './github-repo-health.mjs';

export default function RepoHealthDesk({availableSlots,onImport}:{
 availableSlots:number;
 onImport:(preview:GithubHealthPreview,ids:number[])=>void;
}){
 const [repository,setRepository]=useState('MichaelWave369/reporider');
 const [preview,setPreview]=useState<GithubHealthPreview|null>(null);
 const [selection,setSelection]=useState<number[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [info,setInfo]=useState('');
 const sequence=useRef(0);
 const candidates=preview?.workflows.filter(w=>w.status==='completed'&&
   (w.conclusion==='failure'||w.conclusion==='timed_out'))||[];
 return <div className="antiMCard antiMForm" aria-label="Read-only GitHub workflow health desk">
   <div className="antiMCardTitle"><h3>Repository Health Desk</h3><span>PUBLIC GITHUB / READ-ONLY CI SNAPSHOT</span></div>
   <p className="smallNote">Inspect public repository metadata and the first 20 default-branch GitHub Actions runs, grouped to the newest sampled run per workflow. The source is live only when fetched and may omit older workflows. A failed CI run is not proof that deployment failed, or that its cause is known.</p>
   <label>PUBLIC REPOSITORY · owner/repo
    <input value={repository} maxLength={145} onChange={e=>{
     sequence.current++;setRepository(e.target.value);setPreview(null);
     setSelection([]);setBusy(false);setInfo('');setError('');
    }} placeholder="MichaelWave369/reporider" />
   </label>
   <button className="secondaryButton" type="button" disabled={busy||!repository.trim()} onClick={async()=>{
    const request=++sequence.current;
    setBusy(true);setPreview(null);setSelection([]);setError('');setInfo('');
    try{
     const next=await readPublicRepositoryHealth(repository);
     if(request!==sequence.current)return;
     setPreview(next);
     setInfo('Public GitHub API read completed. This is a snapshot, not an independently attested CI audit.');
    }catch(e){
     if(request!==sequence.current)return;
     setError(e instanceof Error?e.message:'REPO_HEALTH_FETCH_REFUSED');
    }finally{if(request===sequence.current)setBusy(false)}
   }}>{busy?'FETCHING PUBLIC WORKFLOW RUNS…':'FETCH WORKFLOW HEALTH (GET ONLY) →'}</button>
   {preview&&<div className="antiMReadiness">
     <strong>{preview.repository} · default branch: {preview.defaultBranch}</strong>
     <p>GitHub reports {preview.totalRunsReported} runs for the requested branch. This preview examined only the first {preview.sampledRuns} runs and shows {preview.workflows.length} distinct workflows. A later run or a failure outside this window may change the true health.</p>
     <p>Latest sampled workflow statuses:</p>
     <div className="githubIssueList">
      {preview.workflows.map(run=>{
       const actionable=run.status==='completed'&&
         (run.conclusion==='failure'||run.conclusion==='timed_out');
       return <div className="githubIssuePick" key={run.id}>
        <input type="checkbox" aria-label={'Select investigation for '+run.name}
         disabled={!actionable} checked={selection.includes(run.id)}
         onChange={e=>setSelection(items=>e.target.checked?[...items,run.id]:items.filter(id=>id!==run.id))} />
        <span><strong>{run.name}</strong>
         <small className="healthStatus">{run.status} · {run.conclusion||'not concluded'} · {run.createdAt}</small>
         <a href={run.url} target="_blank" rel="noopener noreferrer">Inspect GitHub run ↗</a>
         {!actionable&&<small className="healthStatus">Not eligible for failure investigation import</small>}
        </span>
       </div>
      })}
     </div>
     {preview.workflows.length===0&&<p>No workflows were present in this first-page snapshot. Do not infer that CI is configured or green.</p>}
     <p>Failed/timed-out latest sampled workflows: {candidates.length}. Selected: {selection.length}. Available Company graph slots: {availableSlots}.</p>
     <button type="button" className="primaryButton" disabled={selection.length===0||selection.length>availableSlots} onClick={()=>{
      try{
       onImport(preview,selection);
       setPreview(null);setSelection([]);
       setInfo('Investigation proposals added. Every node requires fresh authorization review and independent completion evidence.');setError('');
      }catch(e){setError(e instanceof Error?e.message:'REPO_HEALTH_IMPORT_REFUSED')}
     }}>ADD SELECTED CI INVESTIGATIONS →</button>
     <p className="smallNote">Selected failures become unapproved REPO_WRITE planning nodes. They do not transfer failing evidence, approve repairs, start builds, or close tickets. You may separately propose each node to Anti-M with the existing manual handoff.</p>
   </div>}
   {info&&<p className="smallNote" role="status">{info}</p>}
   {error&&<div className="error" role="alert">Repository Health refused: {error}. No task or action was executed.</div>}
 </div>;
}
