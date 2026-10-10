import {test,expect} from '@playwright/test';
test('local draft requires an operator-authored prompt and acknowledgement; no network until GET health',async({page})=>{
 const calls=[];
 page.on('request',req=>{
  const url=new URL(req.url());
  if(url.hostname==='127.0.0.1'&&url.port==='3691')calls.push({method:req.method(),url:req.url()});
 });
 await page.goto('.');
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 const desk=page.locator('section[aria-label="ThinkTank local draft launch desk"]');
 await expect(desk).toBeVisible();
 await expect(desk.getByText(/no complete governed council API/i)).toHaveCount(0); // See separate docs.
 await expect(desk.getByText(/not a complete governed council API/)).toBeVisible();
 const prepare=desk.getByRole('button',{name:/PREPARE LOCAL THINKTANK DRAFT/});
 await expect(prepare).toBeDisabled();
 await desk.getByLabel(/YOUR DIRECTIVE FOR THINKTANK/).fill('Investigate unproven production completion claims with counterarguments');
 await expect(prepare).toBeDisabled();
 await desk.getByLabel(/I wrote and reviewed this directive/).check();
 await desk.getByLabel(/REQUESTED MODE/).selectOption('audit');
 await expect(prepare).toBeDisabled(); // Mode change deliberately invalidates prior consent.
 await desk.getByLabel(/I wrote and reviewed this directive/).check();
 await expect(prepare).toBeEnabled();
 await prepare.click();
 const link=desk.getByRole('link',{name:/OPEN DRAFT IN LOCAL THINKTANK/});
 await expect(link).toBeVisible();
 const url=await link.getAttribute('href');
 expect(url.startsWith('http://127.0.0.1:5173/#spv-draft=')).toBe(true);
 const u=new URL(url);
 expect(u.search).toBe('');
 const raw=u.hash.slice('#spv-draft='.length);
 const obj=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));
 expect(obj.suggestedMode).toBe('audit');
 expect(obj.runRequested).toBe(false);
 expect(obj.executionAuthorityGranted).toBe(false);
 expect(obj.directive).toContain('counterarguments');
 expect(calls).toEqual([]);
 await expect(page.locator('section[aria-label="Company Mode"]').getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
});
test('local provider-bridge health requires user click, GET only, not inferred permission',async({page})=>{
 const url='http://127.0.0.1:3691/health';
 let requests=0;
 await page.route(url,route=>{
  requests++;
  expect(route.request().method()).toBe('GET');
  return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},
   contentType:'application/json',
   body:JSON.stringify({ok:true,service:'phi-think-tank-provider-bridge',version:'0.15.0'})});
 });
 await page.goto('.');
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 const desk=page.locator('section[aria-label="ThinkTank local draft launch desk"]');
 expect(requests).toBe(0);
 await desk.getByRole('button',{name:/CHECK LOCAL THINKTANK BRIDGE/}).click();
 await expect(desk.getByText(/Read-only bridge detected:/)).toBeVisible();
 await expect(desk.getByText(/Provider readiness and council execution: NOT VERIFIED/)).toBeVisible();
 expect(requests).toBe(1);
 await expect(page.locator('section[aria-label="Company Mode"]').getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
});
