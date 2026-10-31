import { verifyPhiServeDraftPair, makePhiServeDeskReview, MAX_RECEIPT_BYTES, MAX_TEXT_BYTES } from './model-desk.mjs';

// Input files are read with the browser File API only. Nothing goes to a server.
const root=document.getElementById('phiserve-model-desk');
if(root){
  const receiptInput=document.getElementById('desk-receipt-file');
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
      verified=pair;
      model.textContent=pair.model_alias;
      hash.textContent=pair.response_sha256;
      // Never use innerHTML for untrusted model text.
      content.textContent=pair.draft_text;
      panel.hidden=false;
      state.textContent='LOCAL SHA-256 MATCH. This establishes file consistency only. Model text remains untrusted; no execution, approval or model provenance is verified.';
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
    reset('Local Model Desk cleared. No server state or files were modified.');
  });
}
