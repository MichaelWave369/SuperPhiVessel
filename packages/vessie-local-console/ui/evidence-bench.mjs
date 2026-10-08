// Pure browser/Node evidence comparison. No I/O, persistence, model
// invocation, routing, cloud service, ranking or quality automation.
export const MAX_BENCH_ENTRIES=24;
const PERF='superphivessel.local-console.trial.receipt.v0.1';
const REVIEW='superphivessel.local-console.human-review.v0.1';
const ratings=['1','2','3','4','5','NOT_ASSESSED'];
const completeness=['APPEARS_COMPLETE','POSSIBLY_CUT_OFF','UNSURE'];
const checks=['NOT_CHECKED','OPERATOR_CHECKED_SUPPORTED','OPERATOR_CHECKED_CONTRADICTED'];
const string=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&
  !/[\u0000-\u001f\u007f]/.test(value);
const iso=value=>typeof value==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
const safeInt=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
function required(condition,code){if(!condition)throw new Error(code);}
function frozen(value){return Object.freeze(value);}

export function sanitizeBenchEvidence(raw) {
  required(plain(raw),'BENCH_INVALID_OBJECT');
  required(string(raw.model,128),'BENCH_INVALID_MODEL');
  if(raw.schema===PERF){
    required(raw.authority_granted===false&&raw.model_routing_approved===false&&
      raw.cloud_execution_approved===false&&raw.private_prompt_included===false&&
      raw.generated_text_included===false,'BENCH_INVALID_AUTHORITY');
    required(raw.route==='LOCAL_LOOPBACK_FIXED'&&hash(raw.generated_text_sha256)&&
      iso(raw.timestamp),'BENCH_INVALID_PERFORMANCE_REFERENCE');
    required(Number.isInteger(raw.max_output_tokens_requested)&&
      raw.max_output_tokens_requested>=1&&raw.max_output_tokens_requested<=128,
      'BENCH_INVALID_OUTPUT_LIMIT');
    return frozen({
      kind:'PERFORMANCE_RECEIPT',
      model:raw.model,
      output_sha256:raw.generated_text_sha256,
      observed_at:raw.timestamp,
      trial_elapsed_ms:safeInt(raw.elapsed_wall_ms),
      model_load_ns:safeInt(raw.ollama_load_duration_ns),
      prompt_eval_ns:safeInt(raw.ollama_prompt_eval_duration_ns),
      generation_eval_ns:safeInt(raw.ollama_eval_duration_ns),
      generated_tokens:safeInt(raw.ollama_generated_tokens),
      prompt_tokens:safeInt(raw.ollama_prompt_tokens),
      token_cap_requested:raw.max_output_tokens_requested,
      token_cap_reached:raw.output_token_cap_reached===true,
      stop_reason:['stop','length'].includes(raw.ollama_done_reason)
        ?raw.ollama_done_reason:'UNREPORTED_OR_UNKNOWN',
      provenance:'IMPORTED_OR_OPERATOR_CAPTURED_UNATTESTED',
      prompt_included:false,generated_text_included:false,authority_granted:false
    });
  }
  if(raw.schema===REVIEW){
    required(raw.review_kind==='OPERATOR_SELF_REPORT'&&
      raw.evidence_level==='HUMAN_RATING_NOT_INDEPENDENTLY_VERIFIED'&&
      raw.authority_granted===false&&raw.model_routing_approved===false&&
      raw.quality_gate_approved===false&&raw.cloud_execution_approved===false&&
      raw.inference_performed_by_review===false&&
      raw.prompt_included===false&&raw.generated_text_included===false&&
      raw.free_text_notes_included===false,'BENCH_INVALID_REVIEW_AUTHORITY');
    required(hash(raw.source_output_sha256)&&iso(raw.reviewed_at)&&
      raw.source_trial_receipt_schema===PERF,'BENCH_INVALID_REVIEW_REFERENCE');
    required(ratings.includes(raw.helpfulness)&&
      completeness.includes(raw.completeness)&&checks.includes(raw.verification),
      'BENCH_INVALID_REVIEW_RATINGS');
    return frozen({
      kind:'HUMAN_REVIEW',
      model:raw.model,
      output_sha256:raw.source_output_sha256,
      observed_at:raw.reviewed_at,
      helpfulness:raw.helpfulness,
      completeness:raw.completeness,
      verification:raw.verification,
      provenance:'OPERATOR_SELF_REPORT_UNATTESTED',
      prompt_included:false,generated_text_included:false,authority_granted:false
    });
  }
  throw new Error('BENCH_UNSUPPORTED_SCHEMA');
}

const identity=e=>[e.kind,e.model,e.output_sha256,e.observed_at].join('|');
export function addBenchEvidence(previous,raw) {
  required(Array.isArray(previous)&&previous.length<=MAX_BENCH_ENTRIES,
    'BENCH_INVALID_STATE');
  const candidate=sanitizeBenchEvidence(raw);
  if(previous.some(e=>identity(e)===identity(candidate)))return frozen([...previous]);
  required(previous.length<MAX_BENCH_ENTRIES,'BENCH_FULL');
  return frozen([...previous,candidate]);
}
export function buildBenchSummary(entries) {
  required(Array.isArray(entries)&&entries.length<=MAX_BENCH_ENTRIES,
    'BENCH_INVALID_STATE');
  // Rows are trial observations, not a competition: no global score or
  // model choice. A review matches a generated output by model + hash,
  // not by timestamp, so do NOT claim it independently verifies a trial.
  const performances=entries.filter(e=>e.kind==='PERFORMANCE_RECEIPT');
  const reviews=entries.filter(e=>e.kind==='HUMAN_REVIEW');
  const rows=performances.map(entry=>{
    const reviewsForOutput=reviews.filter(review=>
      review.model===entry.model&&review.output_sha256===entry.output_sha256);
    const review=reviewsForOutput.slice().sort((a,b)=>
      b.observed_at.localeCompare(a.observed_at))[0];
    const generated=entry.generated_tokens;
    const genNs=entry.generation_eval_ns;
    const tps=generated!==null&&genNs!==null&&genNs>0
      ?Math.round(generated*1e10/genNs)/10:null;
    return frozen({
      model:entry.model,observed_at:entry.observed_at,
      output_sha256:entry.output_sha256,
      wall_ms:entry.trial_elapsed_ms,
      model_load_ms:entry.model_load_ns===null?null:Math.round(entry.model_load_ns/1e6),
      prompt_eval_ms:entry.prompt_eval_ns===null?null:Math.round(entry.prompt_eval_ns/1e6),
      generation_eval_ms:genNs===null?null:Math.round(genNs/1e6),
      generated_tokens:generated,reported_generation_tokens_per_second:tps,
      token_cap_reached:entry.token_cap_reached,
      stop_reason:entry.stop_reason,
      human_review_status:review?'OPERATOR_SELF_REPORT':'NOT_ASSESSED',
      helpfulness:review?review.helpfulness:'NOT_ASSESSED',
      completeness:review?review.completeness:'UNSURE',
      verification:review?review.verification:'NOT_CHECKED',
      matched_reviews:reviewsForOutput.length,
      no_routing_approval:true
    });
  }).sort((a,b)=>a.observed_at.localeCompare(b.observed_at)||
    a.model.localeCompare(b.model));
  const unmatched=reviews.filter(review=>!performances.some(perf=>
    perf.model===review.model&&perf.output_sha256===review.output_sha256));
  return frozen({
    schema:'superphivessel.local-console.evidence-bench.summary.v0.1',
    scope:'EPHEMERAL_OPERATOR_REVIEW_ONLY',
    source_trust:'IMPORTED_OR_LOCAL_OPERATOR_INPUT_UNATTESTED',
    interpretation:'DESCRIPTIVE_UNRANKED_NO_ROUTING',
    performance_receipt_count:performances.length,
    human_review_receipt_count:reviews.length,
    unpaired_human_reviews:unmatched.length,
    rows:frozen(rows),
    prompt_included:false,
    generated_text_included:false,
    free_text_notes_included:false,
    automatic_ranking_performed:false,
    model_routing_approved:false,
    quality_gate_approved:false,
    cloud_execution_approved:false,
    authority_granted:false
  });
}
