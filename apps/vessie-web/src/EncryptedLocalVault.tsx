import {useRef,useState} from 'react';
import type {CompanyPlan} from './company-mode.mjs';
import type {PrioritySet} from './mission-priority.mjs';
import type {WorkspaceJournalSource,ValidatedWorkspace} from './workspace-archive.mjs';
import {createWorkspaceArchive,importWorkspaceArchive} from './workspace-archive.mjs';
import {sealLocalArchive,unsealLocalArchive} from './local-vault-crypto.mjs';
import {loadSealedWorkspace,saveSealedWorkspace,deleteSealedWorkspace} from './local-vault-storage.mjs';

export default function EncryptedLocalVault({plan,priorities,sources,onRestore}:{
 plan:CompanyPlan|null;
 priorities:PrioritySet|null;
 sources:WorkspaceJournalSource[];
 onRestore:(workspace:ValidatedWorkspace)=>void;
}){
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
 const [preview,setPreview]=useState<ValidatedWorkspace|null>(null);
 const [saved,setSaved]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const busyGuard=useRef(false);
 async function guarded(fn:()=>Promise<void>){
  if(busyGuard.current)return;
  busyGuard.current=true;setBusy(true);setError('');setNotice('');
  try{await fn()}catch(e){setError(e instanceof Error?e.message:'LOCAL_VAULT_REFUSED')}
  finally{
   // This only drops references held by React; memory wiping is NOT guaranteed.
   setPassword('');setConfirmation('');busyGuard.current=false;setBusy(false)
  }
 }
 function checkSlot(){
  void guarded(async()=>{
   const existing=await loadSealedWorkspace();
   setSaved(!!existing);
   setNotice(existing?'Encrypted slot found. Unlock to preview; no data was loaded into Company Mode.':'No encrypted slot stored in this browser profile.')
  })
 }
 function encryptSave(){
  void guarded(async()=>{
   if(!plan)throw Error('LOCAL_VAULT_NO_PLAN');
   if(password!==confirmation)throw Error('LOCAL_VAULT_PASSPHRASE_MISMATCH');
   const existing=await loadSealedWorkspace();
   if(existing&&!window.confirm('REPLACE existing encrypted local workspace? Export the old archive first if needed. This cannot be undone.'))return;
   const archive=await createWorkspaceArchive(plan,priorities,sources);
   const sealed=await sealLocalArchive(JSON.stringify(archive),password);
   await saveSealedWorkspace(sealed);
   setSaved(true);setPreview(null);
   setNotice('Encrypted workspace saved to IndexedDB in this browser profile. Export a separate portable backup too. No auto-save is enabled.');
  })
 }
 function unlockPreview(){
  void guarded(async()=>{
   setPreview(null);
   const existing=await loadSealedWorkspace();
   setSaved(!!existing);
   if(!existing)throw Error('LOCAL_VAULT_EMPTY');
   const plain=await unsealLocalArchive(existing,password);
   const validated=await importWorkspaceArchive(plain);
   setPreview(validated);
   setNotice('Decrypted locally and replayed all included Anti-M journals. Nothing restored yet. Review the preview before replacing your workspace.');
  })
 }
 function restore(){
  if(!preview||busyGuard.current)return;
  if(plan&&!window.confirm('Replace CURRENT Company plan, human priorities, and attached Anti-M journals with this locally decrypted archive? Export the current workspace first.'))return;
  try{
   onRestore(preview);
   setPreview(null);setNotice('Validated workspace restored in memory. No external execution or permission granted.');setError('');
  }catch(e){setError(e instanceof Error?e.message:'LOCAL_VAULT_RESTORE_REFUSED')}
 }
 function deleteSlot(){
  if(!window.confirm('Permanently delete the encrypted workspace slot from THIS browser profile? This cannot recover deleted copies or backups. Export your archive first.'))return;
  void guarded(async()=>{
   await deleteSealedWorkspace();
   setSaved(false);setPreview(null);
   setNotice('Encrypted slot deleted from this browser profile. Any exported files and browser backups are separate.');
  })
 }
 return <section className="antiMCard antiMForm" aria-label="Opt-in encrypted browser-local workspace">
  <div className="antiMCardTitle"><h3>Encrypted Local Workspace</h3>
   <span>OPTIONAL · DEVICE-LOCAL · NO AUTO-SAVE</span></div>
  <p className="smallNote">Save a replayable Company archive encrypted inside this browser profile using AES-256-GCM and a passphrase-derived key. You decide when to save and when to decrypt. No cloud uploads, automatic recovery, model execution or GitHub writes. This is not a substitute for a separately exported backup.</p>
  <p className="smallNote">Stored state: {saved===null?'NOT CHECKED':saved?'ENCRYPTED SLOT PRESENT':'NO SAVED SLOT'}. No workspace data is read automatically. Browser storage may be cleared by privacy settings, eviction, or profile changes.</p>
  <button type="button" className="secondaryButton" disabled={busy} onClick={checkSlot}>CHECK FOR LOCAL ENCRYPTED SLOT →</button>
  <label>PASSPHRASE · 12–512 CHARACTERS
   <input type="password" autoComplete="new-password" maxLength={512} value={password}
    onChange={e=>{setPassword(e.target.value);setPreview(null);setError('')}} placeholder="Use a long, unique passphrase" />
  </label>
  {plan&&<label>CONFIRM PASSPHRASE (SAVE ONLY)
   <input type="password" autoComplete="new-password" maxLength={512} value={confirmation}
    onChange={e=>setConfirmation(e.target.value)} placeholder="Repeat passphrase to encrypt this save" />
  </label>}
  <div className="antiMButtons">
   {plan&&<button type="button" className="primaryButton"
    disabled={busy||password.length<12||password!==confirmation}
    onClick={encryptSave}>ENCRYPT + SAVE CURRENT WORKSPACE →</button>}
   <button type="button" className="secondaryButton" disabled={busy||password.length<12}
    onClick={unlockPreview}>UNLOCK + REPLAY SAVED WORKSPACE →</button>
  </div>
  <p className="smallNote">The passphrase is required again each time you unlock or save. If you lose it, this encrypted slot cannot be recovered. Password managers and browser extensions may still observe inputs. Don't use this on a shared or untrusted device.</p>
  {preview&&<div className="antiMReadiness">
   <strong>Decrypted restoration preview: {preview.plan.company.name}</strong>
   <p>Company tasks: {preview.plan.nodes.length}; human priority reviews: {preview.priorities.reviews.length}; Anti-M journals replayed: {preview.journals.length}.</p>
   <p>Locally closed Anti-M journals: {preview.links.filter(x=>x.antiMStatus==='VERIFIED_DONE_LOCAL').length}. This is NOT attested external success.</p>
   <p>Export timestamp is self-reported: {preview.exportedAt}.</p>
   <button type="button" className="primaryButton" onClick={restore}>RESTORE DECRYPTED WORKSPACE (EXPLICIT) →</button>
  </div>}
  <div className="antiMButtons">
   <button type="button" className="secondaryButton" disabled={busy} onClick={deleteSlot}>DELETE THIS BROWSER'S ENCRYPTED SLOT</button>
  </div>
  <p className="smallNote">Security limits: this protects confidentiality of saved data at rest against casual file inspection, not against malicious scripts, compromised browsers, weak passphrases or anyone who can use your unlocked session. A correct password does not authenticate the original author or verify external DONE.</p>
  {notice&&<p role="status" className="smallNote">{notice}</p>}
  {error&&<p role="alert" className="error">Encrypted Local Workspace refused: {error}. No Company task, permission or DONE state was changed.</p>}
 </section>
}
