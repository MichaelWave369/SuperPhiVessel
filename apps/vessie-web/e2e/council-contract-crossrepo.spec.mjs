import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const OUTPUT=resolve(process.cwd(),'test-results','council-contract-crossrepo');
const DIRECTIVE='Investigate the public release evidence, challenge unsupported completion claims, and withhold external action until independent verification.';

test('real Vessie UI saves exact human-reviewed council bytes for pinned ThinkTank terminal',async({page,context})=>{
 const unwanted=[];
 context.on('request',request=>{
  const uri=new URL(request.url());
  if(!['GET','HEAD','OPTIONS'].includes(request.method())||uri.port==='3691'||
   uri.pathname.includes('/providers/invoke')){
   unwanted.push({method:request.method(),url:request.url()});
  }
 });
 // Prevent even an accidental live provider call if UI code regresses.
 await context.route(/127\.0\.0\.1:3691\//,route=>route.abort('blockedbyclient'));
 await page.goto('.');
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 const desk=page.locator('section[aria-label="ThinkTank local governed council contract"]');
 await expect(desk).toBeVisible();
 await desk.getByLabel('REVIEWED LOCAL COUNCIL DIRECTIVE').fill(DIRECTIVE);
 await desk.getByLabel('LOCAL OLLAMA MODEL NAME').fill('gemma3:12b');
 await desk.getByLabel('THINKTANK MODE').selectOption('council');
 await desk.getByLabel('MAX SESSION DEADLINE (SECONDS, 30–600)').fill('180');
 const prepare=desk.getByRole('button',{name:/PREPARE EXACT LOCAL COUNCIL CONTRACT/});
 await expect(prepare).toBeDisabled();
 await desk.getByLabel(/I wrote and reviewed this directive/).check();
 await prepare.click();
 const shownDigest=(await desk.locator('code.archiveHash').first().textContent())?.trim();
 expect(shownDigest).toMatch(/^[0-9a-f]{64}$/);
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  desk.getByRole('button',{name:/DOWNLOAD INERT COUNCIL CONTRACT JSON/}).click()
 ]);
 expect(download.suggestedFilename()).toBe('thinktank-local-council.json');
 await mkdir(OUTPUT,{recursive:true});
 const saved=resolve(OUTPUT,'contract.json');
 await download.saveAs(saved);
 const bytes=await readFile(saved);
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(shownDigest);
 const contract=JSON.parse(bytes.toString('utf8'));
 expect(contract).toEqual({
  schema:'phi-thinktank-local-council.v0.1',
  mode:'council',
  directive:DIRECTIVE,
  provider:'ollama-local-only',
  model:'gemma3:12b',
  maxRoleTurns:5,
  maxSessionSeconds:180,
  allowRemoteProviders:false,
  browserAutoRun:false,
  executionAuthorityGranted:false,
  externalDoneAttested:false
 });
 expect(unwanted).toEqual([]);
 await writeFile(resolve(OUTPUT,'ui-receipt.json'),JSON.stringify({
  schema:'spv-council-contract-ci-fixture.v0.1',
  source:'SYNTHETIC_TEST_BROWSER',
  sha256DisplayedByUI:shownDigest,
  model:contract.model,
  generatedWithoutProviderNetwork:true,
  noApprovalOrExecution:true
 })+'\n',{flag:'wx'});
 await expect(page.locator('section[aria-label="Company Mode"]').getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
});
