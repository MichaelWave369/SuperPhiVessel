import {makeHumanReview} from './review-evidence.mjs';

const session = document.querySelector('meta[name="vessie-readonly-token"]')?.content ?? '';
const button = document.getElementById('scan');
const status = document.getElementById('status');
const count = document.getElementById('count');
const breakdown = document.getElementById('breakdown');
const empty = document.getElementById('empty');
const modelsRoot = document.getElementById('models');
const trialControls = document.getElementById('trial-controls');
const trialHelp = document.getElementById('trial-help');
const trialModel = document.getElementById('trial-model');
const trialPrompt = document.getElementById('trial-prompt');
const trialLimit = document.getElementById('trial-limit');
const trialApprove = document.getElementById('trial-approve');
const trialRun = document.getElementById('trial-run');
const trialExport = document.getElementById('trial-export');
const trialStatus = document.getElementById('trial-status');
const trialOutput = document.getElementById('trial-output');
const trialReceipt = document.getElementById('trial-receipt');
const trialTiming = document.getElementById('trial-timing');
const reviewPanel = document.getElementById('human-review');
const reviewHelpfulness = document.getElementById('review-helpfulness');
const reviewCompleteness = document.getElementById('review-completeness');
const reviewVerification = document.getElementById('review-verification');
const reviewSubmit = document.getElementById('review-submit');
const reviewExport = document.getElementById('review-export');
const reviewStatus = document.getElementById('review-status');
const reviewReceipt = document.getElementById('review-receipt');
let lastPerformanceReceipt = null;
let humanReviewReceipt = null;

function resetHumanReview() {
  lastPerformanceReceipt = null;
  humanReviewReceipt = null;
  reviewPanel.hidden = true;
  reviewHelpfulness.value = '';
  reviewCompleteness.value = '';
  reviewVerification.value = '';
  reviewExport.disabled = true;
  reviewReceipt.textContent = 'No human review recorded.';
  reviewStatus.textContent = 'No assessment recorded.';
}

function showTiming(receipt) {
  const ns = v=>Number.isSafeInteger(v)&&v>=0?v:null;
  const total=ns(receipt.ollama_total_duration_ns);
  const load=ns(receipt.ollama_load_duration_ns);
  const prompt=ns(receipt.ollama_prompt_eval_duration_ns);
  const evalNs=ns(receipt.ollama_eval_duration_ns);
  const generated=ns(receipt.ollama_generated_tokens);
  const sec=v=>v===null?'not reported':(v/1e9).toFixed(2)+' s';
  const rows=[
    'Total Ollama time: '+sec(total),
    'Model loading: '+sec(load),
    'Prompt evaluation: '+sec(prompt),
    'Token generation: '+sec(evalNs),
    'End-to-end wall time: '+
      (ns(receipt.elapsed_wall_ms)===null?'not reported':(receipt.elapsed_wall_ms/1000).toFixed(2)+' s')
  ];
  if(generated!==null&&evalNs!==null&&evalNs>0)
    rows.push('Reported generation throughput: '+(generated*1e9/evalNs).toFixed(1)+' tokens/s (generation phase only)');
  if(receipt.output_token_cap_reached===true)
    rows.push('Output token cap reached. This does not prove the answer was truncated.');
  rows.push('Stop reason: '+(['stop','length'].includes(receipt.ollama_done_reason)
    ?receipt.ollama_done_reason:'unreported/unknown'));
  if(total!==null&&load!==null&&evalNs!==null){
    const known=load+evalNs+(prompt??0);
    const remaining=total-known;
    if(remaining>=0)rows.push(
      'Other/unattributed Ollama time: '+(remaining/1e9).toFixed(2)+' s' +
      (prompt===null?' (prompt evaluation not separately reported)':'')
    );
  }
  rows.push('Metadata comes from Ollama. Not an independent GPU or routing benchmark.');
  trialTiming.textContent=rows.join('\n');
}
let exportedReceipt = null;
let localModels = [];
let trialModeEnabled = false;


function bytes(size) {
  return Number.isSafeInteger(size) && size >= 0
    ? (size / (1024*1024*1024)).toFixed(2)+' GiB'
    : 'Size unreported';
}
function render(items) {
  resetHumanReview();
  localModels=items.filter(x=>x.execution_location==='LOCAL_WEIGHTS_REPORTED' &&
    x.classification_basis==='POSITIVE_SIZE_REPORT');
  trialModel.replaceChildren();
  const placeholder=document.createElement('option');
  placeholder.value='';placeholder.textContent='Choose a locally reported model';
  trialModel.append(placeholder);
  for(const model of localModels){
    const opt=document.createElement('option');opt.value=model.name;opt.textContent=model.name;
    trialModel.append(opt);
  }
  trialApprove.checked=false;
  modelsRoot.replaceChildren();
  for(const item of items) {
    const card = document.createElement('article');
    card.className = 'model';
    const body = document.createElement('div');
    const title = document.createElement('div');
    title.className='name';
    title.textContent=item.name;
    const detail = document.createElement('div');
    detail.className='detail';
    const location = item.execution_location;
    const cloud = location === 'CLOUD_REFERENCE';
    const local = location === 'LOCAL_WEIGHTS_REPORTED';
    const sizeLabel = cloud ? 'Cloud reference (not locally stored weights)'
      : local ? bytes(item.size_bytes) + ' size reported locally'
      : 'Weight location unverified';
    detail.textContent=`${item.parameter_size} · ${item.quantization} · ${sizeLabel}` +
      (item.loaded ? ` · Active in Ollama report; VRAM: ${bytes(item.runtime_vram_bytes)}` : '');
    body.append(title,detail);
    const badge = document.createElement('span');
    badge.className='state'+(cloud?' cloud':item.loaded?' live':'');
    badge.textContent=cloud?'CLOUD REF':local?(item.loaded?'LOCAL ACTIVE':'LOCAL FILE'):'UNKNOWN';
    card.append(body,badge);
    modelsRoot.append(card);
  }
  modelsRoot.hidden=items.length===0;
  empty.hidden=items.length>0;
  empty.textContent=items.length===0?'No Ollama models were reported locally. No models were installed or started.':'';
  const localCount=items.filter(x=>x.execution_location==='LOCAL_WEIGHTS_REPORTED').length;
  const cloudCount=items.filter(x=>x.execution_location==='CLOUD_REFERENCE').length;
  const unknownCount=items.length-localCount-cloudCount;
  count.textContent=items.length+' discovered, none authorized';
  breakdown.textContent=`${localCount} local weight-size reports · ${cloudCount} cloud references · ${unknownCount} unknown. Names/sizes are metadata, not proof of execution or local GPU fit. No cloud calls initiated.`;
}
async function scan() {
  button.disabled=true;
  status.textContent='Checking local Ollama (read only)…';
  try {
    const response=await fetch('/api/models',{
      method:'GET',mode:'same-origin',cache:'no-store',
      redirect:'error',credentials:'omit',
      headers:{Authorization:'Bearer '+session},
      signal:AbortSignal.timeout(6500)
    });
    if(!response.ok) throw new Error('REFUSED_OR_UNAVAILABLE');
    const data=await response.json();
    if(data.schema!=='superphivessel.local-console.models.v0.1' ||
       data.authority_granted!==false ||data.can_execute!==false ||
       !Array.isArray(data.models)||data.models.length>256)throw new Error('INVALID_READONLY_CONTRACT');
    const models=data.models.filter(item=>item && typeof item.name==='string' && item.name.length<=128);
    render(models);
    try {
      const statusResp=await fetch('/api/status',{
        method:'GET',mode:'same-origin',cache:'no-store',redirect:'error',
        credentials:'omit',headers:{Authorization:'Bearer '+session},
        signal:AbortSignal.timeout(5000)
      });
      if(!statusResp.ok) throw new Error('STATUS_UNAVAILABLE');
      const runtime=await statusResp.json();
      trialModeEnabled=runtime.schema==='superphivessel.local-console.status.v0.1' &&
        runtime.local_trial_enabled===true &&
        runtime.per_prompt_operator_confirmation_required===true;
    } catch {trialModeEnabled=false;}
    trialControls.hidden=!trialModeEnabled;
    document.getElementById('mode-badge').textContent=trialModeEnabled
      ? 'MANUAL LOCAL TRIAL · LOCALHOST':'READ-ONLY · LOCALHOST';
    trialHelp.textContent=trialModeEnabled
      ? 'Local inference enabled by your startup choice. One confirmed prompt at a time, only for reported local weight files. No cloud, auto-routing or history.'
      : 'Local trial is off. To run a single approved prompt, close this window and launch Start-Local-Trial.cmd. No cloud references are eligible.';
    status.textContent=data.probe_status==='AVAILABLE'
      ? `Local Ollama responded. ${models.length} models discovered, no routing approval granted.`
      : 'Ollama not available on 127.0.0.1:11434. The local dashboard remains usable.';
  } catch {
    status.textContent='The local read-only check failed or was refused. Check whether Ollama is running. No change was made.';
    modelsRoot.replaceChildren();modelsRoot.hidden=true;empty.hidden=false;
    empty.textContent='No verified local model inventory available.';
    localModels=[];trialModel.replaceChildren();trialControls.hidden=true;
    count.textContent='Not available';
    breakdown.textContent='Classification unavailable. No local or cloud execution attempted.';
  } finally {button.disabled=false;}
}
button.addEventListener('click',scan);

function jsonForTrial(model,prompt){
  return JSON.stringify({model,prompt,approve_once:true,
    max_output_tokens:Number(trialLimit.value)});
}
trialRun.addEventListener('click',async()=>{
  if(!trialModeEnabled)return;
  const model=trialModel.value;
  const prompt=trialPrompt.value;
  if(!localModels.some(x=>x.name===model)){
    trialStatus.textContent='Choose a verified local-size model from the dropdown.';return;
  }
  if(!prompt.trim()||prompt.length>2000){
    trialStatus.textContent='Enter a short non-empty prompt (at most 2,000 characters).';return;
  }
  if(!trialApprove.checked){
    trialStatus.textContent='Check the explicit approval box for this one prompt.';return;
  }
  if(!window.confirm(`Send this ONE prompt to local Ollama model "${model}"? No cloud calls or automatic follow-ups are authorized.`))
    return;
  trialRun.disabled=true;
  resetHumanReview();
  trialExport.disabled=true;
  trialApprove.checked=false;
  exportedReceipt=null;
  trialOutput.textContent='Waiting for local model…';
  trialReceipt.textContent='No receipt available.';
  trialTiming.textContent='Timing measurement in progress.';
  trialStatus.textContent='Local one-shot trial started. This may load model weights or use CPU/GPU resources. No automatic retry.';
  try{
    const response=await fetch('/api/local-trial',{
      method:'POST',mode:'same-origin',cache:'no-store',redirect:'error',credentials:'omit',
      headers:{'content-type':'application/json',Authorization:'Bearer '+session},
      body:jsonForTrial(model,prompt),signal:AbortSignal.timeout(95000)
    });
    if(!response.ok)throw new Error('TRIAL_REFUSED_OR_UNAVAILABLE');
    const data=await response.json();
    if(data.schema!=='superphivessel.local-console.trial.result.v0.1'||
       data.authority_granted!==false||data.model_routing_approved!==false||
       data.can_schedule!==false||typeof data.response!=='string'||
       data.response.length>6000||data.receipt?.model!==model||
       data.receipt?.private_prompt_included!==false||
       data.receipt?.generated_text_included!==false||
       data.receipt?.authority_granted!==false)
      throw new Error('TRIAL_CONTRACT_INVALID');
    trialOutput.textContent=data.response || '(Model returned an empty response)';
    exportedReceipt=data.receipt;
    lastPerformanceReceipt=data.receipt;
    reviewPanel.hidden=false;
    reviewStatus.textContent='Answer available for your optional human review. Nothing is rated automatically.';
    trialReceipt.textContent=JSON.stringify(data.receipt,null,2);
    showTiming(data.receipt);
    trialExport.disabled=false;
    trialStatus.textContent='One local model trial completed. Receipt visible; no routing authority granted.';
  }catch{
    trialOutput.textContent='No verified model response available.';
    resetHumanReview();
    trialReceipt.textContent='No receipt available.';
    trialTiming.textContent='No verified timing observation available.';
    trialStatus.textContent='Trial blocked or unavailable. Restarted models are not assumed. You may rescan before another attempt.';
  }finally{trialRun.disabled=false;}
});
trialExport.addEventListener('click',()=>{
  if(!exportedReceipt)return;
  const blob=new Blob([JSON.stringify(exportedReceipt,null,2)+'\\n'],
    {type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='vessie-local-trial-redacted-receipt.json';
  a.click();
  URL.revokeObjectURL(url);
});

reviewSubmit.addEventListener('click',()=>{
  if(!lastPerformanceReceipt || reviewPanel.hidden){
    reviewStatus.textContent='No successfully completed local model answer is available to review.';
    return;
  }
  try {
    const review=makeHumanReview({
      performanceReceipt:lastPerformanceReceipt,
      helpfulness:reviewHelpfulness.value,
      completeness:reviewCompleteness.value,
      verification:reviewVerification.value
    });
    humanReviewReceipt=review;
    reviewReceipt.textContent=JSON.stringify(review,null,2);
    reviewExport.disabled=false;
    reviewStatus.textContent='Your self-reported assessment is recorded in memory only. No model routing or execution permission changed.';
  } catch {
    humanReviewReceipt=null;
    reviewExport.disabled=true;
    reviewReceipt.textContent='No review recorded.';
    reviewStatus.textContent='Choose all three assessment fields before recording. Nothing was exported.';
  }
});
reviewExport.addEventListener('click',()=>{
  if(!humanReviewReceipt || !lastPerformanceReceipt)return;
  const blob=new Blob([JSON.stringify(humanReviewReceipt,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='vessie-local-human-review-redacted.json';
  a.click();
  URL.revokeObjectURL(url);
});
