import {test,expect} from '@playwright/test';
import {thinkTankFingerprint} from '../src/thinktank-decision-bridge.mjs';

const basis=()=>({
 sessionId:'test-session',seed:'test-seed',decisionSeq:42,mode:'council',
 executionSource:'simulation-fixture',operatorPrompt:'Should a release be investigated?',
 outcome:'withheld',outputLabel:'WITHHELD',actionAllowed:false,
 gateScore:.35,gateThreshold:.75,gateBreakdown:null,
 claimGovernance:{mode:'council',policy:'all-fresh',applicableClaimIds:['CL-01'],
  freshClaimIds:[],missingReviewClaimIds:['CL-01'],staleReviewClaimIds:[],
  coverageBlockedClaimIds:[],passed:false,reason:'Insufficient evidence'},
 argumentGovernance:{mode:'council',policy:'fresh-accepted-on-excerpts',
  applicableClaimIds:[],freshAcceptedClaimIds:[],missingAcceptedClaimIds:[],
  staleAcceptedClaimIds:[],draftOnlyClaimIds:[],passed:true,reason:'No eligible excerpts'},
 objectionCount:1,faultCode:'',governanceReason:'Insufficient evidence',
 assignments:[],claims:[{id:'CL-01',text:'Investigate failure before public shipment'}],
 bindings:[],evidence:[],excerpts:[],claimReviews:[],argumentReviews:[],providerTurns:[]
});
const payload=()=>{
 const b=basis();
 return JSON.stringify({
  dossier:{id:'DOS-0042',...b,basisFingerprint:thinkTankFingerprint(b)},
  override:null,seals:[],verifications:[],transparencyEntries:[],transparencyCheckpoints:[],
  witnesses:[],witnessVerifications:[],rfc3161Timestamps:[],checkpointPublications:[],
  provenanceAssurances:[],releaseManifests:[],releaseSeals:[],releaseSealVerifications:[],
  releaseRfc3161Timestamps:[],releasePublications:[],releasePublicationAudits:[],
  releaseAvailabilityAssurances:[],publisherOriginIdentities:[]
 });
};
async function openCompany(page){
 await page.goto('.');
 await page.getByRole('button',{name:/COMPANY MODE/}).click();
 const company=page.locator('section[aria-label="Company Mode"]');
 await expect(company).toBeVisible();
 return company;
}
const bridge=page=>page.locator('section[aria-label="ThinkTank decision dossier proposal bridge"]');
test('ThinkTank SIM dossier imports with warnings, then only human-authored task enters held state',async({page})=>{
 const company=await openCompany(page),b=bridge(page);
 await expect(b).toBeVisible();
 await b.getByLabel('OR PASTE EXPORTED DOSSIER JSON').fill(payload());
 await b.getByRole('button',{name:/INSPECT DECISION BASIS/}).click();
 await expect(b.getByText(/DOS-0042 · COUNCIL · WITHHELD/)).toBeVisible();
 await expect(b.getByText(/SIMULATION FIXTURE: no live provider evidence/)).toBeVisible();
 await expect(b.getByText(/Claim policy: BLOCK/)).toBeVisible();
 await expect(company.getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
 await company.getByLabel('COMPANY',{exact:true}).fill('ThinkTank Acceptance Lab');
 await company.getByLabel('FOUNDER',{exact:true}).fill('Browser Operator');
 await company.getByLabel('PRODUCT',{exact:true}).fill('Review bridge');
 await company.getByLabel('CUSTOMER',{exact:true}).fill('Test');
 await company.getByLabel('WEEKLY GOAL',{exact:true}).fill('Test manual intake');
 await company.getByRole('button',{name:/CREATE PLAN/}).click();
 // Founder created the Company graph *after* the dossier inspection.
 // Re-inspect to bind the manually selected proposal to the current plan.
 await b.getByRole('button',{name:/INSPECT DECISION BASIS/}).click();
 await b.getByLabel('WHICH SOURCE CLAIM OR QUESTION INFORMED YOUR PROPOSAL?').selectOption('CL-01');
 await b.getByLabel('NEW COMPANY NODE ID').fill('think1');
 await b.getByLabel('YOUR FUNCTION / TASK').fill('Investigate release regression');
 await b.getByLabel('YOUR EXPECTED OUTPUT').fill('Documented browser reproduction');
 await b.getByLabel('YOUR ACCEPTANCE CHECK').fill('Manually verify regression and DOS-0042 context');
 await b.getByLabel('CONSEQUENTIAL ACTION CLASS').selectOption('REPO_WRITE');
 const add=b.getByRole('button',{name:/ADD HUMAN-REVIEWED PROPOSAL TO COMPANY/});
 await expect(add).toBeDisabled();
 await b.getByLabel(/I manually reviewed this dossier/).check();
 await add.click();
 await expect(company.getByText('ACTION_REVIEW_HELD',{exact:false}).first()).toBeVisible();
 await expect(company.getByText('think1 / Investigate release regression',{exact:true}).first()).toBeVisible();
 await expect(b.getByText(/New Company proposal added with fresh null action review/)).toBeVisible();
});
test('tampered dossier basis fails closed and cannot generate a Company task',async({page})=>{
 const company=await openCompany(page),b=bridge(page);
 const obj=JSON.parse(payload());
 obj.dossier.claims[0].text='Modified without matching basis';
 await b.getByLabel('OR PASTE EXPORTED DOSSIER JSON').fill(JSON.stringify(obj));
 await b.getByRole('button',{name:/INSPECT DECISION BASIS/}).click();
 await expect(b.getByRole('alert')).toContainText('THINKTANK_BRIDGE_BASIS_MISMATCH');
 await expect(b.getByRole('button',{name:/ADD HUMAN-REVIEWED PROPOSAL TO COMPANY/})).toHaveCount(0);
 await expect(company.getByRole('button',{name:/CREATE PLAN/})).toBeVisible();
});
