// Descriptive public-protocol cohorts only. Never execute, rank, select,
// qualify, promote or authorize a model. All inputs are operator-controlled,
// unauthenticated JSON and may be inaccurate or fabricated.
import {TRIAL_PROTOCOLS,getTrialProtocol} from './trial-protocols.mjs';
import {buildBenchSummary,MAX_BENCH_ENTRIES} from './evidence-bench.mjs';
import {sanitizePortableEntry} from './portable-bench.mjs';

export const COHORT_SCHEMA='superphivessel.local-console.protocol-cohorts.v0.1';
const requireValue=(condition,code)=>{if(!condition)throw new Error(code);};
const nonnegativeSafe=value=>Number.isSafeInteger(value)&&value>=0;
const fixed=(obj)=>Object.freeze(obj);
const meanIndependent=false;

function median(values){
  const valid=values.filter(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
  if(!valid.length)return null;
  const i=Math.floor(valid.length/2);
  return valid.length%2?valid[i-0]:(valid[i-1]+valid[i])/2;
}
function tenth(value){return value===null?null:Math.round(value*10)/10;}
function identity(record){
  return [record.kind,record.model,record.output_sha256,record.observed_at].join('|');
}
export function buildProtocolCohorts(rawEntries) {
  requireValue(Array.isArray(rawEntries)&&rawEntries.length<=MAX_BENCH_ENTRIES,
    'COHORT_INVALID_BENCH');
  const entries=rawEntries.map(sanitizePortableEntry);
  const seen=new Map();
  for(const record of entries){
    const key=identity(record);
    if(seen.has(key)){
      if(JSON.stringify(seen.get(key))!==JSON.stringify(record))
        throw new Error('COHORT_CONFLICTING_DUPLICATE');
      continue;
    }
    seen.set(key,record);
  }
  const distinct=[...seen.values()];
  const summary=buildBenchSummary(distinct);
  const eligible=[];
  let unlabeledTrials=0,invalidProtocolCap=0;
  for(const perf of distinct.filter(e=>e.kind==='PERFORMANCE_RECEIPT')){
    if(perf.protocol_id===null){unlabeledTrials++;continue;}
    const protocol=getTrialProtocol(perf.protocol_id);
    if(!protocol||perf.token_cap_requested!==protocol.max_output_tokens){
      invalidProtocolCap++;
      continue;
    }
    const row=summary.rows.find(r=>r.model===perf.model&&
      r.output_sha256===perf.output_sha256&&r.observed_at===perf.observed_at);
    if(row)eligible.push({perf,row,protocol});
  }
  const groups=[];
  for(const protocol of TRIAL_PROTOCOLS){
    const rowsForProtocol=eligible.filter(x=>x.protocol.id===protocol.id);
    const models=[...new Set(rowsForProtocol.map(x=>x.perf.model))].sort();
    for(const model of models){
      const observations=rowsForProtocol.filter(x=>x.perf.model===model);
      const observedTimes=observations.map(x=>x.perf.observed_at).sort();
      const reviewed=observations.filter(x=>x.row.human_review_status==='OPERATOR_SELF_REPORT').length;
      const rated=observations.filter(x=>x.row.human_review_status==='OPERATOR_SELF_REPORT'&&x.row.helpfulness!=='NOT_ASSESSED').length;
      const claimsChecked=observations.filter(x=>x.row.verification!=='NOT_CHECKED').length;
      const reportedWall=observations.map(x=>x.row.wall_ms).filter(nonnegativeSafe);
      const reportedLoad=observations.map(x=>x.row.model_load_ms).filter(nonnegativeSafe);
      const reportedRate=observations.map(x=>x.row.reported_generation_tokens_per_second).filter(
        v=>typeof v==='number'&&Number.isFinite(v)&&v>=0
      );
      // Throughput is already rounded to 1 decimal in existing summary.
      const medianRate=median(reportedRate);
      const count=observations.length;
      const gaps=[];
      if(count===1)gaps.push('SINGLE_OBSERVATION');
      if(reviewed<count)gaps.push('MISSING_HUMAN_REVIEW');
      if(rated===0)gaps.push('NO_USEFULNESS_RATING');
      if(reportedWall.length<count)gaps.push('MISSING_WALL_TIME');
      if(reportedRate.length<count)gaps.push('MISSING_GENERATION_RATE');
      if(observations.some(x=>x.perf.prompt_eval_ns===null))
        gaps.push('MISSING_PROMPT_EVAL_TIME');
      if(observations.some(x=>x.perf.token_cap_reached))
        gaps.push('OUTPUT_CAP_REACHED_ON_SOME_TRIALS');
      groups.push(fixed({
        protocol_id:protocol.id,
        protocol_title:protocol.title,
        lane:protocol.lane,
        fixed_output_cap:protocol.max_output_tokens,
        model,
        observation_count:count,
        first_observed_at:observedTimes[0],
        last_observed_at:observedTimes[observedTimes.length-1],
        human_reviewed_observation_count:reviewed,
        usefulness_rated_observation_count:rated,
        operator_reported_claims_checked_count:claimsChecked,
        median_wall_ms:tenth(median(reportedWall)),
        median_load_ms:tenth(median(reportedLoad)),
        median_generation_tokens_per_sec:tenth(medianRate),
        wall_time_reporting_count:reportedWall.length,
        generation_rate_reporting_count:reportedRate.length,
        token_cap_reached_observation_count:observations.filter(x=>x.perf.token_cap_reached).length,
        evidence_gaps:fixed(gaps),
        observed_model_comparison_only:true,
        model_qualified:false,
        routing_approved:false
      }));
    }
  }
  const matchedIds=new Set(eligible.map(x=>identity(x.perf)));
  const humanReviews=distinct.filter(x=>x.kind==='HUMAN_REVIEW');
  const unpaired=humanReviews.filter(x=>!distinct.some(e=>e.kind==='PERFORMANCE_RECEIPT'&&
    e.model===x.model&&e.output_sha256===x.output_sha256)).length;
  return fixed({
    schema:COHORT_SCHEMA,
    observation_basis:'OPERATOR_SELECTED_UNATTESTED',
    scope:'DESCRIPTIVE_PROTOCOL_GROUPING_ONLY',
    fixed_protocol_count:TRIAL_PROTOCOLS.length,
    cohort_count:groups.length,
    labeled_comparable_receipt_count:eligible.length,
    unlabeled_performance_receipt_count:unlabeledTrials,
    inconsistent_protocol_cap_receipt_count:invalidProtocolCap,
    unpaired_human_review_count:unpaired,
    median_is_descriptive_not_independence_proof:true,
    independent_trial_assumption:meanIndependent,
    groups:fixed(groups),
    prompt_included:false,
    generated_text_included:false,
    free_text_notes_included:false,
    automatic_ranking_performed:false,
    model_selection_performed:false,
    model_routing_approved:false,
    quality_gate_approved:false,
    cloud_execution_approved:false,
    authority_granted:false
  });
}
