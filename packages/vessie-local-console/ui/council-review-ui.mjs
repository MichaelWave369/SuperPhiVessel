import {inspectVessieCouncilE1} from './council-review.mjs';

// Standalone file-only governance view, isolated from inference/model desk,
// memory, governance ledger, browser network, and the canonical Vessie runtime.
const picker=document.getElementById('council-e1-file');
const inspect=document.getElementById('council-e1-inspect');
const clear=document.getElementById('council-e1-clear');
const status=document.getElementById('council-e1-status');
const panel=document.getElementById('council-e1-preview');
const caseId=document.getElementById('council-e1-case');
const witness=document.getElementById('council-e1-witness');
const seats=document.getElementById('council-e1-seats');
const digest=document.getElementById('council-e1-hash');
const MAX_BYTES=65536;

function reset({clearFile=true}={}){
  if(clearFile)picker.value='';
  panel.hidden=true;
  caseId.textContent='';
  witness.textContent='';
  digest.textContent='';
  seats.replaceChildren();
  status.textContent='No imported Council receipt. No source or scientific evidence authenticated.';
}

inspect.addEventListener('click',async()=>{
  reset({clearFile:false});
  const file=picker.files?.[0];
  if(!file){
    status.textContent='Choose one public synthetic E1 JSON receipt before inspection.';
    return;
  }
  inspect.disabled=true;
  try{
    if(file.size<2||file.size>MAX_BYTES)throw new Error('SIZE_REFUSED');
    const data=await file.text();
    if(new TextEncoder().encode(data).length>MAX_BYTES)throw new Error('SIZE_REFUSED');
    const summary=await inspectVessieCouncilE1(JSON.parse(data));
    caseId.textContent=summary.caseId;
    witness.textContent=summary.keyholeContrastSuggested
      ?'K0 and K1 comparison suggested by synthetic action pair'
      :'No additional Keyhole contrast suggested by synthetic action pair';
    digest.textContent=summary.exchangeDigest.slice(0,16)+'… (self-consistency only)';
    for(const seat of summary.seats){
      const li=document.createElement('li');
      li.textContent=seat.participant+' · '+seat.role.replace(/_/g,' ')+
        ' · '+seat.action.replace(/_/g,' ')+
        ' · declared source '+seat.declaredSha.slice(0,12);
      seats.append(li);
    }
    panel.hidden=false;
    status.textContent='Well-formed synthetic receipt: HELD UNTRUSTED REVIEW ONLY. No approval granted.';
  }catch{
    // Untrusted file names, JSON strings and parser errors are never displayed.
    reset();
    status.textContent='REFUSED: malformed, altered, unsupported or over-limit Council E1 receipt.';
  }finally{
    picker.value='';
    inspect.disabled=false;
  }
});
clear.addEventListener('click',()=>reset());
