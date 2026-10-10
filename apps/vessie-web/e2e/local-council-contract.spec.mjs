import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('founder prepares actual local-only contract without touching models or authority',async({page,context})=>{
 const network=[];
 context.on('request',r=>{
  if(!['GET','HEAD','OPTIONS'].includes(r.method())||new URL(r.url()).port==='3691'){
   network.push({method:r.method(),url:r.url()});
  }
 });
 await page.goto('.');
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 const company=page.locator('section[aria-label="Company Mode"]');
 const desk=page.locator('section[aria-label="ThinkTank local governed council contract"]');
 await expect(desk).toBeVisible();
 const ready=desk.getByRole('button',{name:/PREPARE EXACT LOCAL COUNCIL CONTRACT/});
 await expect(ready).toBeDisabled();
 await desk.getByLabel('REVIEWED LOCAL COUNCIL DIRECTIVE').fill('Investigate external evidence before making a release claim, with Challenger objections.');
 await desk.getByLabel('LOCAL OLLAMA MODEL NAME').fill('gemma3:12b');
 await desk.getByLabel('THINKTANK MODE').selectOption('audit');
 await desk.getByLabel(/I wrote and reviewed this directive/).check();
 await expect(ready).toBeEnabled();
 await ready.click();
 const sha=await desk.locator('code.archiveHash').first().textContent();
 expect(sha).toMatch(/^[a-f0-9]{64}$/);
 expect(network).toEqual([]);
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  desk.getByRole('button',{name:/DOWNLOAD INERT COUNCIL CONTRACT JSON/}).click()
 ]);
 expect(download.suggestedFilename()).toBe('thinktank-local-council.json');
 const raw=await readFile(await download.path(),'utf8');
 expect(createHash('sha256').update(raw).digest('hex')).toBe(sha);
 const contract=JSON.parse(raw);
 expect(contract).toMatchObject({
  schema:'phi-thinktank-local-council.v0.1',mode:'audit',model:'gemma3:12b',
  maxRoleTurns:2,maxSessionSeconds:180,provider:'ollama-local-only',
  allowRemoteProviders:false,browserAutoRun:false,
  executionAuthorityGranted:false,externalDoneAttested:false
 });
 expect(Object.keys(contract)).toHaveLength(11);
 expect(network).toEqual([]);
 await expect(company.getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
});
test('editing a prepared contract invalidates fingerprint, consent and download',async({page})=>{
 await page.goto('.');
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 const desk=page.locator('section[aria-label="ThinkTank local governed council contract"]');
 await desk.getByLabel('REVIEWED LOCAL COUNCIL DIRECTIVE').fill('Review the deployment and document objections.');
 await desk.getByLabel('LOCAL OLLAMA MODEL NAME').fill('qwen3:4b');
 await desk.getByLabel(/I wrote and reviewed this directive/).check();
 await desk.getByRole('button',{name:/PREPARE EXACT LOCAL COUNCIL CONTRACT/}).click();
 await expect(desk.getByRole('button',{name:/DOWNLOAD INERT COUNCIL CONTRACT JSON/})).toBeVisible();
 await desk.getByLabel('THINKTANK MODE').selectOption('trio');
 await expect(desk.getByRole('button',{name:/PREPARE EXACT LOCAL COUNCIL CONTRACT/})).toBeDisabled();
 await expect(desk.getByRole('button',{name:/DOWNLOAD INERT COUNCIL CONTRACT JSON/})).toHaveCount(0);
 await expect(desk.locator('code.archiveHash')).toHaveCount(0);
});
