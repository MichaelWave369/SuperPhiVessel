import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const wf=readFileSync(root+'.github/workflows/vessie-phiserve-hosted-cpu-acceptance.yml','utf8');
const script=readFileSync(new URL('./hosted-phiserve-field.mjs',import.meta.url),'utf8');
test('HC01 real inference workflow is manual and explicit opt in only',()=>{
  assert.match(wf,/^\s*workflow_dispatch:\s*$/m);
  assert.match(wf,/consent_external_model_download:/);
  assert.match(wf,/default: false/);
  assert.match(wf,/if: inputs\.consent_external_model_download == true/);
  for(const re of [/^\s*push:/m,/^\s*pull_request:/m,/^\s*schedule:/m]){
    assert.doesNotMatch(wf,re);
  }
});
test('HC02 cloud runner has read-only permissions and no application secrets',()=>{
  assert.match(wf,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(wf,/secrets\.|actions: write|contents: write/);
  assert.match(wf,/--gpu-layers 0/);
  assert.match(wf,/--enable-phiserve-desk/);
  assert.match(wf,/actions\/upload-artifact@v4/);
});
test('HC03 acceptance refuses privilege and does not export raw text',()=>{
  assert.match(script,/user_rtx_5070_tested:false/);
  assert.match(script,/local_browser_gui_clicked:false/);
  assert.match(script,/raw_prompt_included:false,raw_response_included:false/);
  assert.match(script,/agent_action_authorized:false/);
  assert.match(script,/await verifyPhiServeDraftPair/);
  assert.match(script,/await checkReadOnly/);
  assert.match(script,/MANUAL_DISPATCH_REQUIRED/);
});
