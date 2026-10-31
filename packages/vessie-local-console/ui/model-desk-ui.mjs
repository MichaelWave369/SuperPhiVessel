import { verifyPhiServeDraftPair, makePhiServeDeskReview, MAX_RECEIPT_BYTES, MAX_TEXT_BYTES } from './model-desk.mjs';

// Manual file review is still offline; opt-in live drafts use only the
// local console's authenticated same-origin API, never direct browser PhiServe.
const META_TOKEN=document.querySelector('meta[name="vessie-readonly-token"]')?.content ?? '';
const LIVE_SCHEMA='superphivessel.local-console.phiserve-draft.v0.1';
const CATALOG_SCHEMA='superphivessel.local-console.phiserve-catalog.v0.1';
const encoder=new TextEncoder();
async function localCall(route,options={}){
  const response=await fetch(route,{
    method:options.body?'POST':'GET',
    credentials:'omit',redirect:'error',cache:'no-store',
    referrerPolicy:'no-referrer',
    headers:{
      Authorization:'Bearer '+META_TOKEN,
      ...(options.body?{'Content-Type':'application/json'}:{}),
    },
    ...(options.body?{body:JSON.stringify(options.body)}:{}),
  });
  if(!response.ok){
    let code='LOCAL_MODEL_DESK_UNAVAILABLE';
    try{
      const body=await response.json();
      if(typeof body?.error==='string' && /^[A-Z0-9_]{1,72}$/.test(body.error))
        code=body.error;
    }catch{/* Ignore upstream error details. */}
    throw new Error(code);
  }
  return response.json();
}
const root=document.getElementById('phiserve-model-desk');
if(root){
  const receiptInput=document.getElementById('desk-receipt-file');
  const liveDiscover=document.getElementById('desk-live-discover');
  const liveModel=document.getElementById('desk-live-model');
  const livePrompt=document.getElementById('desk-live-prompt');
  const liveLimit=document.getElementById('desk-live-limit');
  const liveApprove=document.getElementById('desk-live-approve');
  const liveRun=document.getElementById('desk-live-run');
  const liveStatus=document.getElementById('desk-live-status');
  const textInput=document.getElementById('desk-draft-file');
  const verify=document.getElementById('desk-verify');
  const clear=document.getElementById('desk-clear');
  const state=document.getElementById('desk-status');
  const content=document.getElementById('desk-draft-content');
  const panel=document.getElementById('desk-verified');
  const model=document.getElementById('desk-model');
  const hash=document.getElementById('desk-hash');
  const usefulness=document.getElementById('desk-usefulness');
  const completeness=document.getElementById('desk-completeness');
  const facts=document.getElementById('desk-facts');
  const assess=document.getElementById('desk-assess');
  const exportButton=document.getElementById('desk-export-review');
  const reviewState=document.getElementById('desk-review-status');
  let verified=null;
  let review=null;
  let busy=false;
  function reset(message='No local PhiServe draft imported.'){
    verified=null;review=null;
    panel.hidden=true;
    content.textContent='No draft verified.';
    model.textContent='—';hash.textContent='—';
    state.textContent=message;
    reviewState.textContent='No human review recorded.';
    exportButton.disabled=true;
    usefulness.value='';completeness.value='';facts.value='';
  }
  function displayVerified(pair, message){
    verified=pair;
    model.textContent=pair.model_alias;
    hash.textContent=pair.response_sha256;
    content.textContent=pair.draft_text; // Never innerHTML.
    panel.hidden=false;
    state.textContent=message;
  }
  function liveBusy(mode){
    busy=mode;
    verify.disabled=mode;
    liveDiscover.disabled=mode;
    liveRun.disabled=mode;
    liveModel.disabled=mode||liveModel.options.length<=1;
    livePrompt.disabled=mode;
    liveLimit.disabled=mode;
    liveApprove.disabled=mode;
    receiptInput.disabled=mode;
    textInput.disabled=mode;
  }
  // A changed draft input always invalidates the prior assessment.
  for(const field of [liveModel,livePrompt,liveLimit]){
    field.addEventListener('change',()=>{
      reset('Prompt or model changed. Previous review cleared.');
      liveApprove.checked=false;
    });
  }
  liveApprove.addEventListener('change',()=>{
    if(!liveApprove.checked)reset('One-shot approval revoked; prior review cleared.');
  });
  liveDiscover.addEventListener('click',async()=>{
    if(busy)return;
    liveBusy(true);reset('Discovering registered local model aliases...');
    liveModel.replaceChildren();
    liveModel.add(new Option('Discover models explicitly first',''));
    liveApprove.checked=false;
    try{
      const data=await localCall('/api/phiserve-models');
      if(data?.schema!==CATALOG_SCHEMA||data.authority_granted!==false||
         !Array.isArray(data.models)||data.models.length>200 ||
         !data.models.every(x=>typeof x==='string' && x.length>0 && x.length<=160)){
        throw new Error('INVALID_LOCAL_MODEL_CATALOG');
      }
      for(const alias of data.models)liveModel.add(new Option(alias,alias));
      liveStatus.textContent=data.models.length
        ?'Registered local GGUF aliases discovered. Select a model, enter a prompt and approve once.'
        :'PhiServe has no registered GGUF aliases. Nothing can run.';
    }catch(error){
      liveStatus.textContent='Local model discovery unavailable: '+
        (/^[A-Z0-9_]{1,72}$/.test(error?.message)?error.message:'CHECK_LOCAL_CONSOLE_AND_PHISERVE')+
        '. If disabled, restart the local console with --enable-phiserve-desk and a private token file.';
    }finally{liveBusy(false);}
  });
  liveRun.addEventListener('click',async()=>{
    if(busy)return;
    reset('Preparing explicit local PhiServe draft...');
    const selected=liveModel.value;
    const prompt=livePrompt.value;
    const tokens=Number(liveLimit.value);
    if(!liveApprove.checked||!selected||!prompt.trim()||
       prompt.length>2000||!Number.isSafeInteger(tokens)||tokens<1||tokens>256){
      liveStatus.textContent='Select a registered model, enter a short prompt and check the per-request approval box.';
      return;
    }
    liveBusy(true);
    liveStatus.textContent='Running one approved PhiServe draft. No other provider will be contacted.';
    try{
      const response=await localCall('/api/phiserve-draft',{
        body:{model:selected,prompt,max_output_tokens:tokens,approve_once:true},
      });
      if(response?.schema!==LIVE_SCHEMA||
         response.authority_granted!==false ||
         response.tool_execution_authorized!==false ||
         response.model_routing_approved!==false ||
         response.canonical_runtime_connected!==false ||
         typeof response.draft_text!=='string'||
         !response.receipt||response.receipt.model_alias!==selected){
        throw new Error('LOCAL_DRAFT_CONTRACT_INVALID');
      }
      // Reuse exactly the existing file-pair verifier and in-session
      // human-review gate even for a live server response.
      const pair=await verifyPhiServeDraftPair({
        receiptBytes:encoder.encode(JSON.stringify(response.receipt)),
        draftBytes:encoder.encode(response.draft_text),
      });
      displayVerified(pair,'Local PhiServe draft returned. SHA-256 consistent with its redacted receipt. Text remains untrusted; no Vessie action authorized.');
      liveStatus.textContent='One local draft completed. Review the untrusted text below. An explicit new approval is required for another prompt.';
    }catch(error){
      reset('Local inference did not produce a verifiable completed draft.');
      liveStatus.textContent='DRAFT REFUSED: '+
        (/^[A-Z0-9_]{1,72}$/.test(error?.message)?error.message:'INCOMPLETE_OR_UNVERIFIED')+
        '. No fallback, model routing, or tool execution.';
    }finally{
      liveApprove.checked=false;
      liveBusy(false);
    }
  });
  receiptInput.addEventListener('change',()=>reset('Files changed. Verify the pair explicitly.'));
  textInput.addEventListener('change',()=>reset('Files changed. Verify the pair explicitly.'));
  verify.addEventListener('click',async()=>{
    if(busy)return;
    busy=true;verify.disabled=true;
    reset('Verifying selected file bytes locally...');
    try{
      const receipt=receiptInput.files?.[0];
      const draft=textInput.files?.[0];
      if(!receipt||!draft||receipt.size<1||draft.size<1||
          receipt.size>MAX_RECEIPT_BYTES||draft.size>MAX_TEXT_BYTES) {
        throw new Error('FILE_SELECTION_MISSING_OR_OVERSIZED');
      }
      const pair=await verifyPhiServeDraftPair({
        receiptBytes:new Uint8Array(await receipt.arrayBuffer()),
        draftBytes:new Uint8Array(await draft.arrayBuffer()),
      });
      displayVerified(pair,'LOCAL SHA-256 MATCH. This establishes file consistency only. Model text remains untrusted; no execution, approval or model provenance is verified.');
    }catch(error){
      reset('VERIFICATION REFUSED: '+(
        typeof error?.code==='string' ? error.code : 'FILES_INVALID_OR_UNREADABLE'
      )+'. No draft or review was admitted.');
    }finally{
      busy=false;verify.disabled=false;
    }
  });
  assess.addEventListener('click',()=>{
    try{
      review=makePhiServeDeskReview(verified,{
        usefulness:usefulness.value,completeness:completeness.value,verification:facts.value,
      });
      reviewState.textContent='Operator assessment recorded in this browser session. Not an authorization or quality gate.';
      exportButton.disabled=false;
    }catch(error){
      review=null;exportButton.disabled=true;
      reviewState.textContent=error?.code==='REVIEW_RATINGS_INVALID'
        ? 'Select all three human review categories first.'
        : 'Review refused; verify a matching draft first.';
    }
  });
  exportButton.addEventListener('click',()=>{
    if(!review)return;
    const serialized=JSON.stringify(review,null,2)+'\n';
    const blob=new Blob([serialized],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    try{
      const link=document.createElement('a');
      link.href=url;link.download='vessie-phiserve-desk-human-review.json';
      link.click();
      reviewState.textContent='Redacted self-report downloaded by explicit action. Draft text and private tokens are not in the export.';
    }finally{URL.revokeObjectURL(url);}
  });
  clear.addEventListener('click',()=>{
    if(busy)return;
    receiptInput.value='';textInput.value='';
    liveModel.replaceChildren();liveModel.add(new Option('Discover models explicitly first',''));
    livePrompt.value='';liveApprove.checked=false;
    liveStatus.textContent='Model Desk cleared. No saved context or automatic inference.';
    reset('Local Model Desk cleared. No server state or files were modified.');
  });
}
