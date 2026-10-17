import {test,expect} from '@playwright/test';

test('Evidence Gate V3.1: operator-only shadow receipt export, replay and tamper refusal',async({page})=>{
 await page.goto('.');
 await page.getByRole('button',{name:/ANTI-M \/ FINISH/}).click();
 const gate=page.locator('section[aria-label="Anti-M evidence gate shadow bench"]');
 await expect(gate).toBeVisible();

 // A reported outage without impact cannot justify high-severity classification.
 await gate.getByRole('button',{name:/EVALUATE PROPOSAL/}).click();
 await expect(gate.getByText('Policy verdict: REJECT_POLICY')).toBeVisible();
 await expect(gate.getByText('UNSUPPORTED_SEVERITY')).toBeVisible();
 await expect(gate.getByText(/Closure: NO · Execution: NONE/)).toBeVisible();

 // Replay verifies historical policy without trusting a copied decision.
 await gate.getByRole('button',{name:/COPY CURRENT RECEIPT INTO REPLAY FORM/}).click();
 await gate.getByRole('button',{name:/REPLAY RECEIPT LOCALLY/}).click();
 await expect(gate.getByText(/HISTORICAL REJECT_POLICY \/ CURRENT REJECT_POLICY/)).toBeVisible();

 // A copy with an edited proposal but original digest must be refused.
 const input=gate.getByLabel('PASTE RECEIPT JSON');
 const forged=JSON.parse(await input.inputValue());
 forged.input.proposal.risk='critical';
 await input.fill(JSON.stringify(forged));
 await gate.getByRole('button',{name:/REPLAY RECEIPT LOCALLY/}).click();
 await expect(gate.getByRole('alert')).toContainText('CUSTODY_HASH_MISMATCH');

 // The conservative control passes this narrow policy but grants nothing.
 await gate.getByRole('button',{name:/LOAD CONSERVATIVE CONTROL/}).click();
 await gate.getByRole('button',{name:/EVALUATE PROPOSAL/}).click();
 await expect(gate.getByText('Policy verdict: ALLOW_ASSESSMENT_ONLY')).toBeVisible();
 await expect(gate.getByText(/Closure: NO · Execution: NONE/)).toBeVisible();

 const downloadPending=page.waitForEvent('download');
 await gate.getByRole('button',{name:/DOWNLOAD UNSIGNED SHADOW RECEIPT/}).click();
 const download=await downloadPending;
 expect(download.suggestedFilename()).toBe('anti-m-evidence-gate-shadow-receipt.json');
});
