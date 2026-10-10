import {test,expect} from '@playwright/test';

const sha='74263a13464358790a98815be68bd82a095e62c0';
const repo='MichaelWave369/SuperPhiVessel';
const pagesRunId=38078303780;
const base='https://api.github.com/repos/'+repo;
const receipt={
 schema:'superphivessel.pages-deploy-provenance.v0.1',repo,commitSha:sha,
 workflowRunId:String(pagesRunId),cockpitPath:'/SuperPhiVessel/vessie/',
 provenance:'GITHUB_ACTIONS_REPORTED_BUILD_REVISION',
 deployedBrowserVerified:false,independentlyAttestedExternalDone:false
};
const gh=(id,name,event,conclusion,createdAt,updatedAt)=>({
 id,name,event,status:'completed',conclusion,head_sha:sha,
 head_repository:{full_name:repo},head_branch:'main',
 created_at:createdAt,updated_at:updatedAt,
 html_url:'https://github.com/'+repo+'/actions/runs/'+id
});
const pages=gh(pagesRunId,'github-pages','push','success','2026-10-10T19:03:57Z','2026-10-10T19:05:09Z');
const smoke=gh(38078387755,'vessie-deployed-site-smoke','workflow_run','success','2026-10-10T19:05:11Z','2026-10-10T19:05:44Z');
test('explicit release scan checks only public GETs and never transfers authority',async({page})=>{
 const evidenceRequests=[];
 const pagesURL='https://michaelwave369.github.io/SuperPhiVessel/vessie/deploy-provenance.json';
 await page.route(url=>url.href===pagesURL,route=>{
  evidenceRequests.push(route.request().method()+' '+route.request().url());
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(receipt)});
 });
 await page.route(url=>url.href===base+'/actions/runs/'+pagesRunId,route=>{
  evidenceRequests.push(route.request().method()+' '+route.request().url());
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(pages)});
 });
 await page.route(url=>url.href===base+'/actions/workflows/vessie-deployed-site-smoke.yml/runs?per_page=20',route=>{
  evidenceRequests.push(route.request().method()+' '+route.request().url());
  return route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({total_count:1,workflow_runs:[smoke]})});
 });
 await page.goto('.');
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 const desk=page.locator('section[aria-label="Public release evidence desk"]');
 await expect(desk).toBeVisible();
 expect(evidenceRequests).toEqual([]); // no background public reads on mount
 await desk.getByRole('button',{name:/CHECK LIVE RELEASE EVIDENCE/}).click();
 await expect(desk.getByText('Public observation: PUBLIC RELEASE OBSERVED')).toBeVisible();
 await expect(desk.getByText(/Public sources agree on this deployment revision/)).toBeVisible();
 await expect(desk.getByText(/does not independently prove the exact GitHub workflow parent relationship/)).toBeVisible();
 expect(evidenceRequests).toHaveLength(3);
 expect(evidenceRequests.every(x=>x.startsWith('GET '))).toBe(true);
 await expect(page.locator('section[aria-label="Company Mode"]').getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
 const antiMRows=desk.locator('a');
 await expect(antiMRows).toHaveCount(2);
 await expect(antiMRows.first()).toHaveAttribute('href','https://github.com/'+repo+'/actions/runs/'+pagesRunId);
});
test('failed public Pages read cannot report green or modify the empty Company graph',async({page})=>{
 const pagesURL='https://michaelwave369.github.io/SuperPhiVessel/vessie/deploy-provenance.json';
 await page.route(url=>url.href===pagesURL,route=>route.fulfill({status:403,body:'not readable'}));
 await page.goto('.');
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 const desk=page.locator('section[aria-label="Public release evidence desk"]');
 await desk.getByRole('button',{name:/CHECK LIVE RELEASE EVIDENCE/}).click();
 await expect(desk.getByRole('alert')).toContainText('RELEASE_EVIDENCE_HTTP_403');
 await expect(desk.getByText(/Public observation:/)).toHaveCount(0);
 await expect(page.locator('section[aria-label="Company Mode"]').getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
});
