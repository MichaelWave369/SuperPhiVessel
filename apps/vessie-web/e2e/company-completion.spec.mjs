import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const COMPANY='Browser Acceptance Lab';
const PRODUCT='Reviewable demo cockpit';
const FN='Browser integration';
const OUTPUT='Browser smoke report';
const CHECK='Observe stable browser state';
const PASSWORD='Browser-Only-Test-Passphrase-2026!';

const company=page=>page.locator('section[aria-label="Company Mode"]');
const priority=page=>page.locator('section[aria-label="Anti-M mission priority queue"]');
const completion=page=>page.locator('section[aria-label="Company completion dashboard"]');
const vault=page=>page.locator('section[aria-label="Opt-in encrypted browser-local workspace"]');
const anti=page=>page.locator('section[aria-label="Anti-M completion console"]');
const visitCompany=async page=>{
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 await expect(company(page)).toBeVisible();
};
async function createCompany(page){
 await visitCompany(page);
 const box=company(page);
 await box.getByLabel('COMPANY',{exact:true}).fill(COMPANY);
 await box.getByLabel('FOUNDER',{exact:true}).fill('Browser QA Operator');
 await box.getByLabel('PRODUCT',{exact:true}).fill(PRODUCT);
 await box.getByLabel('CUSTOMER',{exact:true}).fill('Internal pilot');
 await box.getByLabel('WEEKLY GOAL',{exact:true}).fill('Demonstrate review and recovery');
 await box.getByRole('button',{name:/CREATE PLAN/}).click();
 await expect(box.getByRole('heading',{name:'01 / '+COMPANY})).toBeVisible();
}
async function createNode(page){
 const box=company(page);
 await box.getByLabel('FUNCTION',{exact:true}).fill(FN);
 await box.getByLabel('ONE OUTPUT',{exact:true}).fill(OUTPUT);
 await box.getByLabel('ONE CHECK',{exact:true}).fill(CHECK);
 await box.getByLabel('CONSEQUENTIAL ACTION CLASS').selectOption('REPO_WRITE');
 await box.getByRole('button',{name:/ADD NODE/}).click();
 await expect(box.getByText('ACTION_REVIEW_HELD',{exact:false}).first()).toBeVisible();
}
async function saveEncrypted(page){
 const v=vault(page);
 await v.getByLabel('PASSPHRASE · 12–512 CHARACTERS').fill(PASSWORD);
 await v.getByLabel('CONFIRM PASSPHRASE (SAVE ONLY)').fill(PASSWORD);
 await v.getByRole('button',{name:/ENCRYPT \+ SAVE CURRENT WORKSPACE/}).click();
 await expect(v.getByText(/Encrypted workspace saved to IndexedDB/)).toBeVisible({timeout:30000});
}
async function readSealedBrowserSlot(page){
 return page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('superphivessel-company-local-encrypted-v1',1);
   req.onerror=()=>reject(req.error);
   req.onsuccess=()=>resolve(req.result);
  });
  try{
   return await new Promise((resolve,reject)=>{
    const req=db.transaction('encrypted-only','readonly').objectStore('encrypted-only').get('workspace');
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>resolve(req.result);
   });
  }finally{db.close()}
 })
}

test('founder flow: human triage -> Anti-M local journal -> encrypted save -> reload -> explicit restore',async({page})=>{
 const outside=[];
 page.on('request',request=>{
  const target=new URL(request.url());
  if(!['127.0.0.1','localhost'].includes(target.hostname))outside.push(request.url());
 });
 await page.goto('.');
 await createCompany(page);
 await createNode(page);
 const queue=priority(page);
 await queue.getByLabel('IMPACT · YOUR ASSESSMENT').selectOption('HIGH');
 await queue.getByLabel('URGENCY').selectOption('NOW');
 await queue.getByLabel('ESTIMATED EFFORT').selectOption('SMALL');
 await queue.getByLabel('REVIEWER (SELF-REPORTED)').fill('Browser QA Operator');
 await queue.getByLabel('WHY THIS PRIORITY?').fill('Operator chooses to verify the recovery workflow');
 await queue.getByRole('button',{name:/RECORD HUMAN TRIAGE/}).click();
 await expect(queue.getByText(/1 reviewed active/)).toBeVisible();
 await expect(completion(page).getByText(/ACTION REVIEW HELD/).first()).toBeVisible();
 // A human deliberately proposes the ranked item; it is not auto-accepted or executed.
 await queue.getByRole('button',{name:/PROPOSE TO ANTI-M \(DRAFT ONLY\)/}).click();
 const a=anti(page);
 await expect(a).toBeVisible();
 await expect(a.getByText('Company Mode → Anti-M draft proposal')).toBeVisible();
 await a.getByRole('button',{name:/COPY DRAFT INTO EMPTY CONTRACT FORM/}).click();
 await a.getByRole('button',{name:/FREEZE CONTRACT/}).click();
 await expect(a.getByText(/CONTRACT LOCKED/)).toBeVisible();
 // Reviewing an action inside Anti-M is an operator record, not a runtime permission.
 await a.getByRole('button',{name:/DECLARE ACTION/}).click();
 await a.locator('label.antiMReviewer input').fill('Browser QA Operator');
 await a.getByRole('button',{name:'RECORD OPERATOR REVIEW'}).click();
 await a.getByLabel('PROOF REFERENCE · HTTPS OR sha256:').fill('https://example.com/browser-integration-evidence');
 await a.getByLabel('OBSERVATION').fill('Operator-reported acceptance flow');
 await a.getByRole('button',{name:/APPEND EVIDENCE/}).click();
 await a.getByRole('button',{name:'ACCEPT EVIDENCE'}).click();
 await a.getByLabel('CLOSURE NOTE').fill('Local self-reported review completed');
 await a.getByRole('button',{name:/VERIFY LOCAL PREREQUISITES \+ CLOSE/}).click();
 await expect(a.getByText('VERIFIED_DONE_LOCAL',{exact:true}).first()).toBeVisible();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  a.getByRole('button',{name:/EXPORT REPLAYABLE LEDGER JSON/}).click()
 ]);
 const ledger=await readFile(await download.path(),'utf8');
 const parsed=JSON.parse(ledger);
 expect(parsed.schema).toBe('superphivessel.anti-m.bundle.v0.1');
 expect(parsed.events.at(-1).type).toBe('CLOSED');
 await visitCompany(page);
 const board=completion(page);
 await board.getByLabel('PASTE REPLAYABLE ANTI-M JSON').fill(ledger);
 await board.getByRole('button',{name:/REPLAY \+ ATTACH LOCAL STATUS/}).click();
 await expect(board.getByText('Anti-M: VERIFIED_DONE_LOCAL')).toBeVisible();
 // Anti-M local completion and Company approval are NOT interchangeable.
 await expect(board.getByText(/ACTION REVIEW HELD/).first()).toBeVisible();
 await saveEncrypted(page);
 const envelope=await readSealedBrowserSlot(page);
 expect(envelope.cipher).toBe('AES-256-GCM');
 const encoded=JSON.stringify(envelope);
 expect(encoded).not.toContain(COMPANY);
 expect(encoded).not.toContain(ledger);
 expect(encoded).not.toContain(PASSWORD);
 expect(outside).toEqual([]);
 await page.reload();
 await visitCompany(page);
 await expect(company(page).getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
 const v=vault(page);
 await expect(v.getByText(/Stored state: NOT CHECKED/)).toBeVisible();
 await v.getByRole('button',{name:/CHECK FOR LOCAL ENCRYPTED SLOT/}).click();
 await expect(v.getByText(/ENCRYPTED SLOT PRESENT/)).toBeVisible();
 await v.getByLabel('PASSPHRASE · 12–512 CHARACTERS').fill('Incorrect-Password-2026');
 await v.getByRole('button',{name:/UNLOCK \+ REPLAY SAVED WORKSPACE/}).click();
 await expect(v.getByText(/LOCAL_VAULT_DECRYPT_REFUSED/)).toBeVisible();
 await expect(company(page).getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
 await v.getByLabel('PASSPHRASE · 12–512 CHARACTERS').fill(PASSWORD);
 await v.getByRole('button',{name:/UNLOCK \+ REPLAY SAVED WORKSPACE/}).click();
 await expect(v.getByText('Decrypted restoration preview: '+COMPANY)).toBeVisible({timeout:30000});
 await expect(v.getByText(/Anti-M journals replayed: 1/)).toBeVisible();
 await expect(company(page).getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
 await v.getByRole('button',{name:/RESTORE DECRYPTED WORKSPACE/}).click();
 await expect(company(page).getByRole('heading',{name:'01 / '+COMPANY})).toBeVisible();
 await expect(priority(page).getByText(/1 reviewed active/)).toBeVisible();
 await expect(completion(page).getByText('Anti-M: VERIFIED_DONE_LOCAL')).toBeVisible();
 await expect(completion(page).getByText(/ACTION REVIEW HELD/).first()).toBeVisible();
 await expect(completion(page).getByText(/Externally|independent/i).first()).toBeVisible();
 expect(outside).toEqual([]);
});

test('tampered IndexedDB ciphertext fails closed and does not auto-recover workspace',async({page})=>{
 await page.goto('.');
 await createCompany(page);
 await createNode(page);
 await saveEncrypted(page);
 await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('superphivessel-company-local-encrypted-v1',1);
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>resolve(request.result);
  });
  try{
   const store=db.transaction('encrypted-only','readwrite').objectStore('encrypted-only');
   const slot=await new Promise((resolve,reject)=>{
    const request=store.get('workspace');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>resolve(request.result);
   });
   const changed={...slot,ciphertext:(slot.ciphertext[0]==='A'?'B':'A')+slot.ciphertext.slice(1)};
   await new Promise((resolve,reject)=>{
    const request=store.put(changed,'workspace');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>resolve();
   });
  }finally{db.close()}
 });
 await page.reload();await visitCompany(page);
 const v=vault(page);
 await v.getByLabel('PASSPHRASE · 12–512 CHARACTERS').fill(PASSWORD);
 await v.getByRole('button',{name:/UNLOCK \+ REPLAY SAVED WORKSPACE/}).click();
 await expect(v.getByText(/LOCAL_VAULT_DECRYPT_REFUSED/)).toBeVisible();
 await expect(company(page).getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
 await expect(v.getByText(/Decrypted restoration preview:/)).toHaveCount(0);
});
