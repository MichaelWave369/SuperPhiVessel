#!/usr/bin/env node
/**
 * Manually dispatched PUBLIC synthetic prompt acceptance on GitHub CPU runner.
 * Real GGUF -> PhiServe -> Vessie authenticated localhost -> SHA-256 review.
 * NOT a browser GUI run or an independent user-GPU qualification.
 */
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createLocalConsole} from '../server.mjs';
import {verifyPhiServeDraftPair,makePhiServeDeskReview} from '../ui/model-desk.mjs';

const ORIGIN='http://127.0.0.1:8791';
const ALIAS='cloud-smollm2-135m-q4';
const TEST_PROMPT='Write a short, friendly sentence about checking software carefully.';
const SESSION_META=/<meta name="vessie-readonly-token" content="([a-f0-9]{64})">/;
const encoder=new TextEncoder();

async function call(path,{method='GET',token,origin,body}={}){
  const headers={};
  if(token)headers.Authorization='Bearer '+token;
  if(origin)headers.Origin=origin;
  if(body)headers['Content-Type']='application/json';
  const response=await fetch(ORIGIN+path,{
    method,headers,redirect:'error',cache:'no-store',credentials:'omit',
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(150000),
  });
  const text=await response.text();
  let value;
  try{value=JSON.parse(text);}catch{value=null;}
  return {status:response.status,value};
}

async function checkReadOnly(){
  const instance=await createLocalConsole({port:0,phiServeEnabled:false,trialEnabled:false});
  try{
    const origin='http://127.0.0.1:'+instance.port;
    const page=await fetch(origin);
    const session=(await page.text()).match(SESSION_META)?.[1];
    assert.ok(session,'READ_ONLY_SESSION_MISSING');
    const no=await fetch(origin+'/api/phiserve-models',{
      headers:{Authorization:'Bearer '+session},
    });
    assert.equal(no.status,403,'READ_ONLY_MODE_MUST_REFUSE_PHI');
  }finally{
    await new Promise(resolve=>instance.server.close(resolve));
  }
}

async function main(){
  assert.equal(process.env.PHISERVE_HOSTED_ACCEPTANCE_APPROVED,'YES',
    'MANUAL_DISPATCH_REQUIRED');
  const reportPath=process.env.PHISERVE_HOSTED_ACCEPTANCE_REPORT;
  assert.ok(reportPath&&resolve(reportPath).startsWith(resolve(process.env.RUNNER_TEMP??'/tmp')+'/'),
    'REPORT_MUST_BE_EPHEMERAL');

  const page=await fetch(ORIGIN+'/',{redirect:'error',signal:AbortSignal.timeout(10000)});
  assert.equal(page.status,200);
  const session=(await page.text()).match(SESSION_META)?.[1];
  assert.ok(session,'VESSIE_LOCAL_SESSION_MISSING');

  const status=await call('/api/status',{token:session});
  assert.equal(status.status,200);
  assert.equal(status.value?.mode,'PHISERVE_OPERATOR_DRAFT_OPT_IN');
  assert.equal(status.value?.phiserve_gui_enabled,true);
  assert.equal(status.value?.model_routing_approved,false);
  assert.equal(status.value?.authority_granted,false);
  assert.equal((await call('/api/phiserve-models')).status,403);
  const catalog=await call('/api/phiserve-models',{token:session});
  assert.equal(catalog.status,200,'AUTHENTICATED_GGUF_CATALOG');
  assert.equal(catalog.value?.schema,'superphivessel.local-console.phiserve-catalog.v0.1');
  assert.equal(catalog.value?.authority_granted,false);
  assert.ok(catalog.value.models.includes(ALIAS),'REGISTERED_GGUF_NOT_FOUND');

  const payload={model:ALIAS,prompt:TEST_PROMPT,max_output_tokens:64,approve_once:true};
  const wrongOrigin=await call('/api/phiserve-draft',{
    method:'POST',token:session,origin:'https://untrusted.invalid',body:payload,
  });
  assert.equal(wrongOrigin.status,403,'CROSS_ORIGIN_MUST_REFUSE');
  const noApproval=await call('/api/phiserve-draft',{
    method:'POST',token:session,origin:ORIGIN,body:{...payload,approve_once:false},
  });
  assert.equal(noApproval.status,400,'MISSING_APPROVAL_MUST_REFUSE');

  const started=Date.now();
  const live=await call('/api/phiserve-draft',{
    method:'POST',token:session,origin:ORIGIN,body:payload,
  });
  assert.equal(live.status,200,'REAL_INFERENCE_HTTP_'+live.status);
  assert.equal(live.value?.schema,'superphivessel.local-console.phiserve-draft.v0.1');
  assert.equal(live.value?.authority_granted,false);
  assert.equal(live.value?.tool_execution_authorized,false);
  assert.equal(live.value?.model_routing_approved,false);
  assert.equal(live.value?.canonical_runtime_connected,false);
  const text=live.value?.draft_text;
  assert.equal(typeof text,'string');
  assert.ok(text.trim().length>0&&text.length<100000,'REAL_MODEL_TEXT_MISSING');

  const verified=await verifyPhiServeDraftPair({
    receiptBytes:encoder.encode(JSON.stringify(live.value.receipt)),
    draftBytes:encoder.encode(text),
    cryptoImpl:webcrypto,
  });
  assert.equal(verified.status,'LOCAL_FILE_CONSISTENCY_MATCH_ONLY');
  assert.equal(verified.operator_authority_granted,false);
  const review=makePhiServeDeskReview(verified,{
    usefulness:'NOT_ASSESSED',completeness:'UNSURE',
    verification:'NOT_CHECKED',
  });
  assert.equal(review.can_promote,false);
  assert.equal(review.may_deploy,false);
  assert.equal(review.generated_text_included,false);
  assert.equal(review.bearer_token_included,false);
  assert.ok(!JSON.stringify(review).includes(text));
  await checkReadOnly();

  const report={
    schema:'VESSIE_PHISERVE_HOSTED_CPU_ACCEPTANCE_V1',
    status:'HOSTED_CPU_PHI_VESSIE_ACCEPTANCE_PASSED',
    execution_context:'GITHUB_HOSTED_UBUNTU_CPU_RUNNER',
    model_alias:ALIAS,
    gguf_source:'bartowski/SmolLM2-135M-Instruct-GGUF',
    gguf_quantization:'Q4_K_M',
    gguf_sha256:process.env.PHISERVE_HOSTED_GGUF_SHA256??null,
    response_sha256:verified.response_sha256,
    receipt_file_sha256:verified.receipt_file_sha256,
    response_characters:text.length,
    elapsed_wall_ms:Date.now()-started,
    checks:{
      session_authentication_required:true,
      model_catalog_authenticated:true,
      cross_origin_request_denied:true,
      missing_approval_denied:true,
      real_model_inference_response:true,
      model_reply_sha256_matched:true,
      human_review_redacted:true,
      read_only_mode_denied:true,
    },
    raw_prompt_included:false,raw_response_included:false,
    bearer_token_included:false,private_memory_accessed:false,
    model_routing_approved:false,agent_action_authorized:false,
    user_pc_accessed:false,user_rtx_5070_tested:false,
    local_browser_gui_clicked:false,
    independent_hardware_attestation:false,
    source_commit:process.env.GITHUB_SHA??null,
  };
  mkdirSync(dirname(reportPath),{recursive:true});
  writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('HOSTED_PHISERVE_VESSIE_CPU_ACCEPTANCE_PASS');
  console.log('Synthetic public model output SHA-256: '+verified.response_sha256);
  console.log('No private prompt, generated text or token uploaded.');
}
main().catch(error=>{
  const reason=error?.code==='ERR_ASSERTION'
    ? String(error.message).replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').slice(0,180)
    : 'HOSTED_ACCEPTANCE_UNEXPECTED_ERROR';
  console.error('HOSTED_PHISERVE_VESSIE_CPU_ACCEPTANCE_FAIL '+reason);
  process.exitCode=1;
});
