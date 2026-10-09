import {makeHumanReview} from './review-evidence.mjs';
import {MAX_BENCH_ENTRIES,addBenchEvidence,buildBenchSummary} from './evidence-bench.mjs';
import {BUNDLE_SCHEMA,MAX_BUNDLE_BYTES,exportPortableBench,importPortableBench} from './portable-bench.mjs';
import {TRIAL_PROTOCOLS,getTrialProtocol,exactProtocolMatch} from './trial-protocols.mjs';
import {buildProtocolCohorts} from './protocol-cohorts.mjs';
import {guideForCompletedTrial} from './human-review-guides.mjs';

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
const trialProtocol = document.getElementById('trial-protocol');
const trialProtocolLoad = document.getElementById('trial-protocol-load');
const trialProtocolInfo = document.getElementById('trial-protocol-info');
let loadedProtocolId=null;
for(const protocol of TRIAL_PROTOCOLS){
  const opt=document.createElement('option');
  opt.value=protocol.id;
  opt.textContent=protocol.title+' · '+protocol.max_output_tokens+' tokens';
  trialProtocol.append(opt);
}
trialProtocolLoad.addEventListener('click',()=>{
  const protocol=getTrialProtocol(trialProtocol.value);
  if(!protocol){
    loadedProtocolId=null;
    trialProtocolInfo.textContent='Select a public protocol first. Custom prompts remain available.';
    return;
  }
  loadedProtocolId=protocol.id;
  trialPrompt.value=protocol.prompt;
  trialLimit.value=String(protocol.max_output_tokens);
  trialApprove.checked=false;
  trialProtocolInfo.textContent=protocol.title+' · '+protocol.lane+
    ' · public fixed protocol version '+protocol.version+
    '. Loaded but NOT executed. Select a local model and approve each prompt separately.';
});
trialProtocol.addEventListener('change',()=>{
  loadedProtocolId=null;
  trialApprove.checked=false;
  trialProtocolInfo.textContent=trialProtocol.value
    ? 'Protocol selected, not loaded. Click Load to place its exact public prompt in the editor.'
    : 'Custom prompt mode. No fixed protocol label will be attached.';
});
const trialLimit = document.getElementById('trial-limit');
const trialApprove = document.getElementById('trial-approve');
const trialRun = document.getElementById('trial-run');
const trialExport = document.getElementById('trial-export');
const trialStatus = document.getElementById('trial-status');
const trialOutput = document.getElementById('trial-output');
const trialReceipt = document.getElementById('trial-receipt');
const trialTiming = document.getElementById('trial-timing');
const benchCount = document.getElementById('bench-count');
const benchRows = document.getElementById('bench-rows');
const benchStatus = document.getElementById('bench-status');
const benchFootnote = document.getElementById('bench-footnote');
const cohortFilter = document.getElementById('cohort-protocol-filter');
const cohortRows = document.getElementById('cohort-rows');
const cohortStatus = document.getElementById('cohort-status');
for(const p of TRIAL_PROTOCOLS){
  const option=document.createElement('option');
  option.value=p.id;
  option.textContent=p.title;
  cohortFilter.append(option);
}
const benchAddPerformance = document.getElementById('bench-add-performance');
const benchAddReview = document.getElementById('bench-add-review');
const benchImport = document.getElementById('bench-import');
const benchImportSelected = document.getElementById('bench-import-selected');
const benchExport = document.getElementById('bench-export');
const benchSavePortable = document.getElementById('bench-save-portable');
const benchClear = document.getElementById('bench-clear');
let benchEntries = [];
const reviewPanel = document.getElementById('human-review');
const protocolHumanReference = document.getElementById('protocol-human-reference');
const protocolHumanReveal = document.getElementById('protocol-human-reveal');
const protocolHumanContent = document.getElementById('protocol-human-reference-content');
const protocolHumanHeading = document.getElementById('protocol-human-heading');
const protocolHumanExpected = document.getElementById('protocol-human-expected');
const protocolHumanChecks = document.getElementById('protocol-human-checks');
const protocolHumanCaution = document.getElementById('protocol-human-caution');
let activeHumanGuide = null;
protocolHumanReveal.addEventListener('click',()=>{
  // Never compute a model grade or modify submitted human ratings.
  if(!activeHumanGuide || protocolHumanReference.hidden)return;
  protocolHumanHeading.textContent=activeHumanGuide.title;
  protocolHumanExpected.textContent=activeHumanGuide.expected_answer;
  protocolHumanCaution.textContent=activeHumanGuide.caution;
  protocolHumanChecks.replaceChildren();
  for(const check of activeHumanGuide.checks){
    const item=document.createElement('li');
    item.textContent=check;
    protocolHumanChecks.append(item);
  }
  protocolHumanContent.hidden=false;
  protocolHumanReveal.disabled=true;
  protocolHumanReveal.textContent='Reference revealed for this completed trial';
});
function resetProtocolHumanGuide(){
  activeHumanGuide=null;
  protocolHumanReference.hidden=true;
  protocolHumanContent.hidden=true;
  protocolHumanReveal.disabled=false;
  protocolHumanReveal.textContent='Reveal operator answer reference';
  protocolHumanHeading.textContent='';
  protocolHumanExpected.textContent='';
  protocolHumanCaution.textContent='';
  protocolHumanChecks.replaceChildren();
}
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
  resetProtocolHumanGuide();
  lastPerformanceReceipt = null;
  humanReviewReceipt = null;
  reviewPanel.hidden = true;
  reviewHelpfulness.value = '';
  reviewCompleteness.value = '';
  reviewVerification.value = '';
  reviewExport.disabled = true;
  reviewReceipt.textContent = 'No human review recorded.';
  reviewStatus.textContent = 'No assessment recorded.';
  syncBenchButtons();
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
  const max_output_tokens=Number(trialLimit.value);
  const payload={model,prompt,approve_once:true,max_output_tokens};
  if(trialProtocol.value){
    if(loadedProtocolId!==trialProtocol.value ||
       !exactProtocolMatch(trialProtocol.value,prompt,max_output_tokens))
      throw new Error('TRIAL_PROTOCOL_CHANGED');
    payload.protocol_id=trialProtocol.value;
  }
  return JSON.stringify(payload);
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
  // Fail before opening the confirmation dialog if a selected protocol
  // was not loaded or its fixed prompt/output limit was changed.
  if(trialProtocol.value &&
     (loadedProtocolId!==trialProtocol.value ||
      !exactProtocolMatch(trialProtocol.value,prompt,Number(trialLimit.value)))){
    trialStatus.textContent='Selected protocol is missing or edited. Load its exact prompt again, or select Custom.';
    trialApprove.checked=false;
    return;
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
    activeHumanGuide=guideForCompletedTrial(data.receipt);
    protocolHumanReference.hidden=activeHumanGuide===null;
    syncBenchButtons();
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

for(const field of [reviewHelpfulness,reviewCompleteness,reviewVerification]) {
  field.addEventListener('change',()=>{
    humanReviewReceipt=null;
    syncBenchButtons();
    reviewExport.disabled=true;
    reviewReceipt.textContent='No human review recorded for the current selections.';
    reviewStatus.textContent='Assessment changed. Click Record my assessment again before exporting.';
  });
}

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
    syncBenchButtons();
    reviewReceipt.textContent=JSON.stringify(review,null,2);
    reviewExport.disabled=false;
    reviewStatus.textContent='Your self-reported assessment is recorded in memory only. No model routing or execution permission changed.';
  } catch {
    humanReviewReceipt=null;
    syncBenchButtons();
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

function syncBenchButtons(){
  benchAddPerformance.disabled = !lastPerformanceReceipt || benchEntries.length>=MAX_BENCH_ENTRIES;
  benchAddReview.disabled = !humanReviewReceipt || benchEntries.length>=MAX_BENCH_ENTRIES;
}
function fmtMs(value){
  return Number.isSafeInteger(value)&&value>=0?(value/1000).toFixed(2)+' s':'Not reported';
}
function renderBench(){
  const summary=buildBenchSummary(benchEntries);
  benchCount.textContent=benchEntries.length+' of '+MAX_BENCH_ENTRIES+' entries in memory';
  benchExport.disabled=benchEntries.length===0;
  benchSavePortable.disabled=benchEntries.length===0;
  benchClear.disabled=benchEntries.length===0;
  syncBenchButtons();
  benchRows.replaceChildren();
  if(summary.rows.length===0){
    const tr=document.createElement('tr');
    const td=document.createElement('td');
    td.colSpan=10;
    td.textContent='No performance receipts yet. Human reviews without matching performance receipts remain unpaired.';
    tr.append(td);benchRows.append(tr);
  }
  for(const row of summary.rows){
    const tr=document.createElement('tr');
    const colValues=[
      row.model+' · '+row.observed_at.slice(0,16).replace('T',' ')+' UTC',
      row.protocol_id??'Unlabeled/custom',
      fmtMs(row.wall_ms),
      fmtMs(row.model_load_ms),
      fmtMs(row.prompt_eval_ms),
      fmtMs(row.generation_eval_ms),
      (row.generated_tokens??'Not reported')+' / '+
        (row.reported_generation_tokens_per_second===null?'N/A':
          row.reported_generation_tokens_per_second.toFixed(1)+' tok/s'),
      row.human_review_status==='OPERATOR_SELF_REPORT'?row.helpfulness+' / 5':'Not assessed',
      row.human_review_status==='OPERATOR_SELF_REPORT'?row.completeness:'No review',
      row.verification==='NOT_CHECKED'?'Not checked':row.verification
    ];
    for(const value of colValues){
      const cell=document.createElement('td');cell.textContent=String(value);tr.append(cell);
    }
    tr.title='Output SHA-256: '+row.output_sha256+
      ' · Human review evidence is a self-report, not independent verification.';
    benchRows.append(tr);
  }
  renderProtocolCohorts();
  benchFootnote.textContent=
    summary.performance_receipt_count+' performance receipts · '+
    summary.human_review_receipt_count+' human self-reports · '+
    summary.unpaired_human_reviews+' unpaired reviews. '+
    'Rows are not ranked. A shared model+output hash links a human review to an answer, not to verified hardware or route authority. Imported JSON is user-selected and unauthenticated.';
}
function fmtCohortMedianMs(value){
  return typeof value==='number'&&Number.isFinite(value)&&value>=0
    ?(value/1000).toFixed(2)+' s':'Not reported';
}
function renderProtocolCohorts(){
  const result=buildProtocolCohorts(benchEntries);
  const selected=cohortFilter.value;
  const shown=result.groups.filter(g=>selected==='ALL'||g.protocol_id===selected);
  cohortRows.replaceChildren();
  if(shown.length===0){
    const row=document.createElement('tr');
    const cell=document.createElement('td');
    cell.colSpan=8;
    cell.textContent='No qualifying public-protocol observations for this filter.';
    row.append(cell);cohortRows.append(row);
  }
  for(const cohort of shown){
    const row=document.createElement('tr');
    const gaps=cohort.evidence_gaps.length
      ? cohort.evidence_gaps.join(', ').replaceAll('_',' ').toLowerCase()
      : 'No listed reporting gaps; not a qualification';
    const values=[
      cohort.protocol_title,cohort.model,
      String(cohort.observation_count),
      cohort.human_reviewed_observation_count+' / '+cohort.observation_count+
        ' (rated: '+cohort.usefulness_rated_observation_count+
        ', fact checks reported: '+cohort.operator_reported_claims_checked_count+')',
      fmtCohortMedianMs(cohort.median_wall_ms),fmtCohortMedianMs(cohort.median_load_ms),
      cohort.median_generation_tokens_per_sec===null
        ? 'Not reported'
        : cohort.median_generation_tokens_per_sec.toFixed(1)+' tokens/s',
      gaps
    ];
    for(const value of values){
      const cell=document.createElement('td');
      cell.textContent=value;row.append(cell);
    }
    cohortRows.append(row);
  }
  cohortStatus.textContent=
    result.labeled_comparable_receipt_count+' eligible labeled receipt(s), '+
    result.cohort_count+' unranked model/protocol cohort(s), '+
    result.unlabeled_performance_receipt_count+' custom/unlabeled receipt(s), '+
    result.inconsistent_protocol_cap_receipt_count+' mismatched protocol/cap receipt(s) excluded. '+
    'Medians are descriptive. Review claims are operator self-reports. Neither imported files nor protocol IDs independently attest execution or correctness.';
}
cohortFilter.addEventListener('change',renderProtocolCohorts);

function benchError(){
  benchStatus.textContent='Evidence was not accepted: missing/invalid redacted fields, oversized file, or full bench. No information was uploaded or persisted.';
}
benchAddPerformance.addEventListener('click',()=>{
  try{
    if(!lastPerformanceReceipt)throw new Error('NO_TRIAL');
    const previous=benchEntries.length;
    benchEntries=addBenchEvidence(benchEntries,lastPerformanceReceipt);
    renderBench();
    benchStatus.textContent=benchEntries.length===previous?
      'This performance receipt was already in the bench.':
      'One redacted performance receipt added to browser memory, not disk.';
  }catch{benchError();}
});
benchAddReview.addEventListener('click',()=>{
  try{
    if(!humanReviewReceipt)throw new Error('NO_REVIEW');
    const previous=benchEntries.length;
    benchEntries=addBenchEvidence(benchEntries,humanReviewReceipt);
    renderBench();
    benchStatus.textContent=benchEntries.length===previous?
      'This human review was already in the bench.':
      'One human self-report added to browser memory. No automated grade or route permission.';
  }catch{benchError();}
});
benchImportSelected.addEventListener('click',async()=>{
  const files=Array.from(benchImport.files??[]);
  if(files.length===0){
    benchStatus.textContent='Choose redacted JSON files first. Nothing has been read.';
    return;
  }
  benchImportSelected.disabled=true;
  try{
    if(files.length>MAX_BENCH_ENTRIES)throw new Error('TOO_MANY_FILES');
    let next=benchEntries;
    for(const file of files){
      if(file.size>MAX_BUNDLE_BYTES||file.size===0)throw new Error('FILE_SIZE_DENIED');
      const parsed=JSON.parse(await file.text());
      if(parsed?.schema===BUNDLE_SCHEMA){
        next=importPortableBench(next,parsed);
      }else{
        if(file.size>16384)throw new Error('SINGLE_RECEIPT_SIZE_DENIED');
        next=addBenchEvidence(next,parsed);
      }
    }
    const imported=next.length-benchEntries.length;
    benchEntries=next;
    renderBench();
    benchStatus.textContent=imported+' redacted observation(s) accepted from explicitly selected local receipts/bundles. No upload, automatic persistence or model execution.';
  }catch{benchError();}
  finally{benchImportSelected.disabled=false;benchImport.value='';}
});
benchExport.addEventListener('click',()=>{
  if(benchEntries.length===0)return;
  const summary=buildBenchSummary(benchEntries);
  const blob=new Blob([JSON.stringify(summary,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='vessie-evidence-bench-redacted-summary.json';
  a.click();URL.revokeObjectURL(url);
  benchStatus.textContent='Redacted, descriptive comparison exported by your explicit action. No routing decisions made.';
});
benchSavePortable.addEventListener('click',()=>{
  if(benchEntries.length===0)return;
  try{
    const bundle=exportPortableBench(benchEntries);
    const serialized=JSON.stringify(bundle,null,2)+'\n';
    // Preserve the documented import limit for a round-trippable bundle.
    if(new Blob([serialized]).size>MAX_BUNDLE_BYTES)
      throw new Error('BUNDLE_TOO_LARGE_TO_REIMPORT');
    const blob=new Blob([serialized],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='vessie-local-evidence-bench-portable.json';
    a.click();URL.revokeObjectURL(url);
    benchStatus.textContent='Portable redacted bench saved on your device by explicit click. Re-import this file next session to restore evidence. No background persistence.';
  }catch{
    benchStatus.textContent='Portable bundle could not be exported. No data was stored or uploaded.';
  }
});
benchClear.addEventListener('click',()=>{
  if(!window.confirm('Clear all in-memory comparison evidence from this tab? Existing exported files are unchanged.'))return;
  benchEntries=[];
  renderBench();
  benchStatus.textContent='Browser-memory bench cleared. No files were deleted.';
});
renderBench();
