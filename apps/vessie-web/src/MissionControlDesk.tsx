import {useRef,useState} from 'react';
import {parseMissionRepositories,scanMissionRepositories,missionCandidates,missionSummary} from './mission-control.mjs';
import type {MissionSnapshot} from './mission-control.mjs';

const STARTER=['MichaelWave369/SuperPhiVessel','MichaelWave369/reporider',
 'MichaelWave369/OpenBlueprintStudio','MichaelWave369/PhiOffice369','MichaelWave369/EVIE'].join('\n');

export default function MissionControlDesk({slots,onImport}:{
 slots:number;onImport:(snapshot:MissionSnapshot,keys:string[])=>void;
}){
 const [repositories,setRepositories]=useState(STARTER);
 const [snapshot,setSnapshot]=useState<MissionSnapshot|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const requestId=useRef(0);
 const candidates=snapshot?missionCandidates(snapshot):[];
 const summary=snapshot?missionSummary(snapshot):[];
 return <section className="antiMCard antiMForm" aria-label="Cross repository mission control">
   <div className="antiMCardTitle"><h3>Mission Control / Public Portfolio</h3>
     <span>FOUNDER-TRIGGERED · 5 PUBLIC REPOS MAX</span></div>
   <p className="smallNote">One read-only, on-demand snapshot of up to five public GitHub repositories. Includes first-page open issues and the latest sampled default-branch workflow runs. Results do not prove overall repository health or release readiness.</p>
   <label>REPOSITORIES · ONE OWNER/REPO PER LINE · 1–5
     <textarea rows={5} value={repositories} maxLength={800} spellCheck={false} onChange={e=>{
       requestId.current++;setRepositories(e.target.value);setSnapshot(null);
       setSelected([]);setBusy(false);setMessage('');setError('');
     }}/>
   </label>
   <p className="smallNote">This may make up to three unauthenticated public GitHub GET requests per repository (maximum 15 per scan). No OAuth, private repo access, credentials, background polling, GitHub writes, or automatic task import. GitHub rate limits and CORS can interrupt individual reads.</p>
   <button type="button" className="secondaryButton" disabled={busy||!repositories.trim()}
    onClick={async()=>{
      const id=++requestId.current;
      setBusy(true);setSnapshot(null);setSelected([]);setError('');setMessage('');
      try{
        const repos=parseMissionRepositories(repositories);
        const next=await scanMissionRepositories(repos);
        if(requestId.current!==id)return;
        setSnapshot(next);setMessage('Public portfolio snapshot received. No tasks were created.');
      }catch(e){
        if(requestId.current!==id)return;
        setError(e instanceof Error&&/^MISSION_|^GITHUB_ISSUES_/.test(e.message)?e.message:'MISSION_FETCH_REFUSED');
      }finally{if(requestId.current===id)setBusy(false)}
    }}>{busy?'SCANNING PUBLIC REPOSITORIES…':'SCAN PORTFOLIO (GET ONLY) →'}</button>
   {snapshot&&<div className="missionResults">
    <p className="smallNote">Coverage is limited to the first page from each API. **UNAVAILABLE** means a source failed to load, not that it is healthy or empty. Zero observed failures is not a green release gate.</p>
    <div className="missionSummaryList">
      {summary.map(row=><div key={row.repository} className="missionRepo">
        <strong>{row.repository}</strong>
        <div className="missionCounts">
         <span>Issues: {row.issueStatus==='ok'?row.openIssuesSeen:'UNAVAILABLE'}</span>
         <span>Workflows: {row.healthStatus==='ok'?row.workflowsSeen:'UNAVAILABLE'}</span>
         <span>Failed/timed out: {row.healthStatus==='ok'?row.latestFailedOrTimedOut:'UNKNOWN'}</span>
         <span>Running: {row.healthStatus==='ok'?row.latestInProgress:'UNKNOWN'}</span>
         <span>Passed: {row.healthStatus==='ok'?row.latestSuccess:'UNKNOWN'}</span>
        </div>
      </div>)}
    </div>
    <div className="antiMCardTitle"><h3>Review candidate work</h3>
      <span>{candidates.length} OBSERVED CANDIDATES · {selected.length} SELECTED</span></div>
    <p className="smallNote">Failed or timed-out latest sampled workflows appear before open issues within each repository. This is **not** a computed business priority ranking. Every selected item becomes a new, unapproved REPO_WRITE investigation or issue follow-up; none carries PASS evidence or prior approval.</p>
    <div className="githubIssueList missionCandidateList">
      {candidates.map(item=><label className="githubIssuePick" key={item.key}>
       <input type="checkbox" checked={selected.includes(item.key)}
        onChange={e=>setSelected(current=>e.target.checked?[...current,item.key]:current.filter(k=>k!==item.key))}/>
       <span><strong>{item.type==='CI_INVESTIGATION'?'CI investigation':'Open issue'} · {item.title}</strong>
         <small className="healthStatus">{item.repository} · {item.description}</small>
         <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>Inspect GitHub source ↗</a>
       </span>
      </label>)}
    </div>
    {candidates.length===0&&<p className="smallNote">No selectable candidates were observed in the sampled pages. This does not mean all projects are complete or healthy.</p>}
    <p className="smallNote">Selected: {selected.length}. Available Company graph slots: {slots}. Additions are atomic; oversize and duplicate imports are refused.</p>
    <button type="button" className="primaryButton"
     disabled={selected.length===0||selected.length>slots}
     onClick={()=>{
       try{
        onImport(snapshot,selected);
        setSnapshot(null);setSelected([]);setMessage('Selected proposals added to the Company graph with no action reviews or completion evidence.');setError('');
       }catch(e){setError(e instanceof Error?e.message:'MISSION_IMPORT_REFUSED')}
     }}>ADD SELECTED TO COMPANY GRAPH →</button>
   </div>}
   {message&&<p className="smallNote" role="status">{message}</p>}
   {error&&<div className="error" role="alert">Mission Control refused: {error}. No GitHub action or model execution occurred.</div>}
 </section>;
}
