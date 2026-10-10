import {test,expect} from '@playwright/test';

const SITE='https://michaelwave369.github.io/SuperPhiVessel/vessie/';
const EXPECTED=(process.env.EXPECTED_DEPLOY_SHA||'').trim();
const RUN_ID=(process.env.EXPECTED_PAGES_RUN_ID||'').trim();
const allowedHost='michaelwave369.github.io';

test('a published GitHub Pages revision is served for the successful deployment workflow',async({request})=>{
 // PR checks can inspect the current live site but cannot claim their PR code has
 // deployed. Only a post-deployment workflow_run supplies commit and workflow IDs.
 test.skip(!EXPECTED,'PR or manual smoke: live HTML only; no expected deployed revision supplied.');
 expect(EXPECTED).toMatch(/^[0-9a-f]{40}$/);
 expect(RUN_ID).toMatch(/^[0-9]+$/);
 const proofUrl=SITE+'deploy-provenance.json?expected-run='+encodeURIComponent(RUN_ID);
 let latest=null;
 await expect.poll(async()=>{
  const response=await request.get(proofUrl,{failOnStatusCode:false,headers:{'Cache-Control':'no-cache'}});
  if(response.status()!==200)return 'HTTP_'+response.status();
  try{
   const proof=await response.json();
   latest=proof;
   return proof.commitSha+'|'+proof.workflowRunId;
  }catch{return 'INVALID_JSON'}
 },{timeout:120000,intervals:[1000,2000,4000,6000]}).toBe(EXPECTED+'|'+RUN_ID);
 expect(latest).toEqual({
  schema:'superphivessel.pages-deploy-provenance.v0.1',
  repo:'MichaelWave369/SuperPhiVessel',
  commitSha:EXPECTED,workflowRunId:RUN_ID,
  cockpitPath:'/SuperPhiVessel/vessie/',
  provenance:'GITHUB_ACTIONS_REPORTED_BUILD_REVISION',
  deployedBrowserVerified:false,
  independentlyAttestedExternalDone:false
 });
});

test('public deployed cockpit loads and its Company/Anti-M panels remain read-only until explicitly acted on',async({page})=>{
 const unsafeRequests=[],outsideRequests=[],jsErrors=[];
 page.on('request',req=>{
  const url=new URL(req.url());
  if(!['GET','HEAD','OPTIONS'].includes(req.method()))unsafeRequests.push({method:req.method(),url:req.url()});
  if(![allowedHost,'fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)){
   outsideRequests.push(req.url());
  }
 });
 page.on('pageerror',error=>jsErrors.push(error.message));
 if(EXPECTED){
  await expect.poll(async()=>{
   await page.goto(SITE+'?revision-check='+encodeURIComponent(EXPECTED),
    {waitUntil:'domcontentloaded',timeout:45000});
   return page.locator('meta[name="spv-pages-build-sha"]').getAttribute('content');
  },{timeout:120000,intervals:[1000,2000,4000,6000]}).toBe(EXPECTED);
 }
 const response=await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:45000});
 expect(response,'GitHub Pages must return an HTML response').not.toBeNull();
 expect(response.status()).toBe(200);
 await expect(page).toHaveTitle(/Vessie/i);
 await expect(page.locator('.app')).toBeVisible();
 const userOrigin=await page.evaluate(()=>location.origin);
 expect(userOrigin).toBe('https://michaelwave369.github.io');
 expect(await page.evaluate(()=>location.pathname)).toBe('/SuperPhiVessel/vessie/');
 // No Company node, encrypted restore, action grant or external execution is
 // created just by reading the live site or opening these panels.
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 const company=page.locator('section[aria-label="Company Mode"]');
 await expect(company).toBeVisible();
 await expect(company.getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
 const vault=company.locator('section[aria-label="Opt-in encrypted browser-local workspace"]');
 const portable=company.locator('section[aria-label="Portable offline completion history archive"]');
 await expect(vault).toBeVisible();
 await expect(portable).toBeVisible();
 await expect(vault.getByText(/Stored state: NOT CHECKED/)).toBeVisible();
 await expect(vault.getByText(/OPTIONAL · DEVICE-LOCAL · NO AUTO-SAVE/)).toBeVisible();
 const dbs=await page.evaluate(async()=>{
  if(typeof indexedDB.databases!=='function')return [];
  return (await indexedDB.databases()).map(d=>d.name);
 });
 expect(dbs).not.toContain('superphivessel-company-local-encrypted-v1');
 await page.getByRole('button',{name:/ANTI-M \/ FINISH/}).click();
 const anti=page.locator('section[aria-label="Anti-M completion console"]');
 await expect(anti).toBeVisible();
 await expect(anti.getByRole('button',{name:/FREEZE CONTRACT/})).toBeVisible();
 expect(unsafeRequests).toEqual([]);
 expect(outsideRequests).toEqual([]);
 expect(jsErrors).toEqual([]);
});

test('deployed HTML references real immutable app assets under its own Pages base',async({request})=>{
 const response=await request.get(SITE,{failOnStatusCode:false});
 expect(response.status()).toBe(200);
 const contentType=response.headers()['content-type']||'';
 expect(contentType).toContain('text/html');
 const html=await response.text();
 expect(html).toMatch(/<div id="root"><\/div>/);
 if(EXPECTED){
  expect(html).toContain('<meta name="spv-pages-build-sha" content="'+EXPECTED+'">');
 }
 const js=[...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(m=>m[1]);
 const css=[...html.matchAll(/(?:src|href)="([^"]+\.css)"/g)].map(m=>m[1]);
 expect(js.length,'Bundled JavaScript asset required').toBeGreaterThan(0);
 expect(css.length,'Bundled stylesheet asset required').toBeGreaterThan(0);
 for(const asset of [...js,...css]){
  expect(asset).toMatch(/^\/SuperPhiVessel\/vessie\/assets\/[A-Za-z0-9_.-]+$/);
  const url=new URL(asset,SITE);
  expect(url.hostname).toBe(allowedHost);
  const hit=await request.get(url.toString(),{failOnStatusCode:false});
  expect(hit.status(),'Asset missing: '+asset).toBe(200);
  const body=await hit.body();
  expect(body.byteLength,'Empty asset: '+asset).toBeGreaterThan(150);
 }
});
