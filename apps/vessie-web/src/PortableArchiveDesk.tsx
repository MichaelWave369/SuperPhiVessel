import {useRef,useState} from 'react';
import type {CompanyPlan} from './company-mode.mjs';
import type {PrioritySet} from './mission-priority.mjs';
import type {WorkspaceJournalSource,ValidatedWorkspace} from './workspace-archive.mjs';
import {createWorkspaceArchive,importWorkspaceArchive} from './workspace-archive.mjs';

const MAX_FILE=1800000;
function downloadJson(source:string){
 const url=URL.createObjectURL(new Blob([source],{type:'application/json'}));
 const a=document.createElement('a');
 a.href=url;a.download='vessie-workspace-completion-archive.json';
 document.body.append(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function PortableArchiveDesk({plan,priorities,sources,onRestore}:{
 plan:CompanyPlan|null;
 priorities:PrioritySet|null;
 sources:WorkspaceJournalSource[];
 onRestore:(validated:ValidatedWorkspace)=>void;
}){
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState<ValidatedWorkspace|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const runId=useRef(0);
 async function exportArchive(){
  const seq=++runId.current;setBusy(true);setError('');setNotice('');
  try{
   if(!plan)throw Error('WORKSPACE_ARCHIVE_NO_PLAN');
   const archive=await createWorkspaceArchive(plan,priorities,sources);
   if(seq!==runId.current)return;
   downloadJson(JSON.stringify(archive,null,2)+'\n');
   setNotice('Portable archive generated locally. Keep your downloaded file secure. Check your browser downloads to confirm it was saved.');
  }catch(e){if(seq===runId.current)setError(e instanceof Error?e.message:'WORKSPACE_ARCHIVE_EXPORT_REFUSED')}
  finally{if(seq===runId.current)setBusy(false)}
 }
 async function previewImport(){
  const seq=++runId.current;setBusy(true);setPreview(null);setError('');setNotice('');
  try{
   if(!file||file.size>MAX_FILE)throw Error('WORKSPACE_ARCHIVE_SIZE');
   const validated=await importWorkspaceArchive(await file.text());
   if(seq!==runId.current)return;
   setPreview(validated);setNotice('Archive hash and all embedded Anti-M chains replayed locally. No Company state replaced yet.');
  }catch(e){if(seq===runId.current)setError(e instanceof Error?e.message:'WORKSPACE_ARCHIVE_IMPORT_REFUSED')}
  finally{if(seq===runId.current)setBusy(false)}
 }
 function restore(){
  if(!preview||busy)return;
  if(plan&&!window.confirm('Replace your CURRENT Company plan, priorities and journal snapshots with this validated archive? Export your current workspace first.'))return;
  try{
   onRestore(preview);setPreview(null);setFile(null);setError('');
   setNotice('Workspace restored locally. Anti-M journals replayed; no external DONE or authority was granted.');
  }catch(e){setError(e instanceof Error?e.message:'WORKSPACE_ARCHIVE_RESTORE_REFUSED')}
 }
 return <section className="antiMCard antiMForm" aria-label="Portable offline completion history archive">
  <div className="antiMCardTitle"><h3>Portable Completion History</h3>
   <span>LOCAL EXPORT / REPLAYABLE IMPORT</span></div>
  <p className="smallNote">Keep your Company plan, human priority reviews and complete manually attached Anti-M journals together across browser refreshes. Nothing auto-saves or uploads. Browser history and GitHub Pages are not safe substitutes for a backup.</p>
  <div className="antiMReadiness">
   <strong>{plan?'Current plan: '+plan.company.name:'No active Company plan'}</strong>
   <p>Priority reviews: {priorities?.reviews.length??0}. Full Anti-M journals available for backup: {sources.length}. Archive export replays every included journal again before producing your file.</p>
  </div>
  <button className="secondaryButton" type="button" disabled={!plan||busy}
   onClick={()=>{void exportArchive()}}>{busy?'VALIDATING…':'EXPORT REPLAYABLE WORKSPACE JSON →'}</button>
  <p className="smallNote">SHA-256 on the archive detects accidental modification. It is not a digital signature or proof of who created the file. Company reviews and priorities remain operator-entered; Anti-M event chains are checked for local consistency, not authenticated external execution.</p>
  <label>CHOOSE EXPORTED WORKSPACE JSON · MAX 1.8 MB
   <input type="file" accept=".json,application/json" onChange={e=>{
    runId.current++;setFile(e.target.files?.[0]??null);setPreview(null);
    setBusy(false);setError('');setNotice('');
   }}/>
  </label>
  <button type="button" className="secondaryButton" disabled={!file||busy}
   onClick={()=>{void previewImport()}}>{busy?'REPLAYING…':'VALIDATE + PREVIEW ARCHIVE →'}</button>
  {preview&&<div className="antiMReadiness" aria-label="Validated restoration preview">
   <strong>Restoration preview · {preview.plan.company.name}</strong>
   <p>Export timestamp (self-reported): {preview.exportedAt}. Company nodes: {preview.plan.nodes.length}. Human priority reviews: {preview.priorities.reviews.length}. Complete Anti-M journals replayed: {preview.journals.length}.</p>
   <p>Locally closed Anti-M journals: {preview.links.filter(link=>link.antiMStatus==='VERIFIED_DONE_LOCAL').length}. This does NOT mean the corresponding Company tasks are accepted or externally completed.</p>
   <p>Archive SHA-256: <code className="archiveHash">{preview.archiveSha256}</code></p>
   <p>No part of this file is a permission grant, signed attestation, or deployment proof. Restoring does not run any projects or models.</p>
   <button type="button" className="primaryButton" onClick={restore}>RESTORE VALIDATED WORKSPACE (EXPLICIT) →</button>
  </div>}
  {notice&&<p role="status" className="smallNote">{notice}</p>}
  {error&&<p role="alert" className="error">Portable archive refused: {error}. No data was replaced.</p>}
 </section>;
}
