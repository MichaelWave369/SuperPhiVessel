import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeBenchEvidence,buildBenchSummary,MAX_BENCH_ENTRIES} from '../ui/evidence-bench.mjs';
import {
 BUNDLE_SCHEMA,MAX_BUNDLE_BYTES,exportPortableBench,importPortableBench,sanitizePortableEntry
} from '../ui/portable-bench.mjs';

const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64);
const createdAt='2026-10-08T23:58:01.000Z';
const rawPerformance=(overrides={})=>({
  schema:'superphivessel.local-console.trial.receipt.v0.1',
  timestamp:'2026-10-08T22:46:40.147Z',
  model:'qwen3:4b',
  route:'LOCAL_LOOPBACK_FIXED',
  max_output_tokens_requested:64,
  elapsed_wall_ms:36732,
  ollama_load_duration_ns:22125996200,
  ollama_prompt_eval_duration_ns:null,
  ollama_eval_duration_ns:1155987000,
  ollama_generated_tokens:64,
  ollama_prompt_tokens:27,
  generated_text_sha256:A,
  output_token_cap_reached:true,
  ollama_done_reason:'UNREPORTED_OR_UNKNOWN',
  private_prompt_included:false,
  generated_text_included:false,
  authority_granted:false,
  model_routing_approved:false,
  cloud_execution_approved:false,
  private_prompt:'TOP_SECRET_PROMPT_DO_NOT_EXPORT',
  response:'TOP_SECRET_RESPONSE_DO_NOT_EXPORT',
  ...overrides
});
const rawReview=(overrides={})=>({
  schema:'superphivessel.local-console.human-review.v0.1',
  model:'qwen3:4b',
  reviewed_at:'2026-10-08T23:00:00.000Z',
  source_trial_receipt_schema:'superphivessel.local-console.trial.receipt.v0.1',
  source_output_sha256:A,
  helpfulness:'4',
  completeness:'POSSIBLY_CUT_OFF',
  verification:'NOT_CHECKED',
  review_kind:'OPERATOR_SELF_REPORT',
  evidence_level:'HUMAN_RATING_NOT_INDEPENDENTLY_VERIFIED',
  prompt_included:false,
  generated_text_included:false,
  free_text_notes_included:false,
  inference_performed_by_review:false,
  cloud_execution_approved:false,
  model_routing_approved:false,
  quality_gate_approved:false,
  authority_granted:false,
  private_note:'TOP_SECRET_NOTES_DO_NOT_EXPORT',
  ...overrides
});
const fixture=()=>[sanitizeBenchEvidence(rawPerformance()),sanitizeBenchEvidence(rawReview())];
const bundle=(entries=fixture())=>exportPortableBench(entries,{createdAt});

test('PB01 bundle round-trip restores a prior redacted performance + matching human assessment',()=>{
  const data=bundle();
  assert.equal(data.schema,BUNDLE_SCHEMA);
  assert.equal(data.evidence_count,2);
  assert.equal(data.model_routing_approved,false);
  assert.equal(data.quality_gate_approved,false);
  assert.equal(data.authority_granted,false);
  const exported=JSON.stringify(data);
  for(const secret of ['TOP_SECRET_PROMPT','TOP_SECRET_RESPONSE','TOP_SECRET_NOTES']){
    assert.equal(exported.includes(secret),false);
  }
  const recovered=importPortableBench([],JSON.parse(exported));
  assert.deepEqual(recovered,fixture());
  const summary=buildBenchSummary(recovered);
  assert.equal(summary.performance_receipt_count,1);
  assert.equal(summary.human_review_receipt_count,1);
  assert.equal(summary.rows[0].reported_generation_tokens_per_second,55.4);
  assert.equal(summary.rows[0].helpfulness,'4');
  assert.equal(summary.rows[0].verification,'NOT_CHECKED');
});
test('PB02 repeated import is idempotent, and same output hash with another model stays separate',()=>{
  const first=bundle();
  const once=importPortableBench([],first);
  const twice=importPortableBench(once,first);
  assert.equal(twice.length,2);
  const another=sanitizeBenchEvidence(rawPerformance({
    model:'gemma3:1b',generated_text_sha256:B,
    timestamp:'2026-10-08T23:10:00.000Z'
  }));
  const add=importPortableBench(twice,bundle([another]));
  assert.equal(add.length,3);
  assert.deepEqual(buildBenchSummary(add).rows.map(x=>x.model),['qwen3:4b','gemma3:1b']);
});
test('PB03 imported comparison summary cannot masquerade as a restorable bundle',()=>{
  const summary=buildBenchSummary(fixture());
  assert.throws(()=>importPortableBench([],summary),/BUNDLE_SCHEMA_FIELDS_INVALID/);
});
test('PB04 extra top-level fields are rejected, not relayed',()=>{
  for(const modified of [
    {...bundle(),private_prompt:'LEAK'},
    {...bundle(),authorization_header:'Bearer SECRET'},
    {...bundle(),model_routing_approved:true},
    {...bundle(),quality_gate_approved:true},
    {...bundle(),automatic_ranking_performed:true},
    {...bundle(),prompt_included:true},
    {...bundle(),entries:'not an array'},
    {...bundle(),evidence_count:5},
    {...bundle(),schema:'another.bundle.version'}
  ])assert.throws(()=>importPortableBench([],modified));
});
test('PB05 extra/tainted record fields are rejected instead of forwarded',()=>{
  const perf=fixture()[0];
  const review=fixture()[1];
  for(const poisoned of [
    {...perf,private_prompt:'LEAK'},
    {...review,model_output:'DO_NOT_COPY'},
    {...perf,authority_granted:true},
    {...perf,prompt_included:true},
    {...review,generated_text_included:true},
    {...perf,output_sha256:'not-a-sha'},
    {...perf,model:'bad\nname'},
    {...review,helpfulness:'PROVEN_CORRECT'},
    {...review,verification:'AUTOMATED_VERIFIED'},
    {...perf,trial_elapsed_ms:Infinity},
    {...perf,model_load_ns:-1},
    {...perf,token_cap_requested:999},
    {...perf,stop_reason:'secret_reason'},
    {...review,provenance:'CERTIFIED_INDEPENDENT_AUDIT'},
  ]){
    assert.throws(()=>sanitizePortableEntry(poisoned));
  }
});
test('PB06 conflicting duplicate identity fails closed; existing evidence remains unmodified',()=>{
  const original=fixture();
  const conflicting={...original[0],trial_elapsed_ms:10};
  const data=bundle([conflicting]);
  assert.throws(()=>importPortableBench(original,data),/BUNDLE_CONFLICTING_DUPLICATE/);
  assert.equal(original[0].trial_elapsed_ms,36732);
});
test('PB07 oversized count and duplicate records are rejected atomically',()=>{
  const original=fixture();
  const repeated={...bundle(),entries:[original[0],original[0]],evidence_count:2};
  assert.throws(()=>importPortableBench([],repeated),/BUNDLE_DUPLICATES_INVALID/);
  const many=[];
  for(let i=0;i<MAX_BENCH_ENTRIES;i++){
    many.push(sanitizeBenchEvidence(rawPerformance({
      timestamp:'2026-10-08T22:45:'+String(i).padStart(2,'0')+'.147Z',
      generated_text_sha256:C
    })));
  }
  assert.equal(importPortableBench([],bundle(many)).length,MAX_BENCH_ENTRIES);
  assert.throws(()=>importPortableBench(original,bundle(many)),/BUNDLE_CAPACITY_EXCEEDED/);
});
test('PB08 legacy v0.1 performance receipt missing prompt processing time survives roundtrip',()=>{
  const legacy=rawPerformance();
  delete legacy.ollama_prompt_eval_duration_ns;
  delete legacy.ollama_done_reason;
  delete legacy.output_token_cap_reached;
  const first=sanitizeBenchEvidence(legacy);
  const restored=importPortableBench([],bundle([first]));
  assert.equal(restored[0].prompt_eval_ns,null);
  assert.equal(restored[0].stop_reason,'UNREPORTED_OR_UNKNOWN');
  assert.equal(restored[0].token_cap_reached,false);
  assert.equal(buildBenchSummary(restored).rows[0].human_review_status,'NOT_ASSESSED');
});
test('PB09 exporting an empty bench and invalid dates fails without side effects',()=>{
  assert.throws(()=>exportPortableBench([]),/BUNDLE_EXPORT_BOUNDS/);
  assert.throws(()=>exportPortableBench(fixture(),{createdAt:'tomorrow'}),/BUNDLE_EXPORT_DATE_INVALID/);
  assert.throws(()=>importPortableBench([],null));
  assert.throws(()=>importPortableBench('not an array',bundle()));
});
test('PB10 no network, persistence, automatic sorting winner, or non-redacted output in bundle',()=>{
  const data=bundle();
  const raw=JSON.stringify(data);
  assert.ok(Buffer.byteLength(raw,'utf8')<MAX_BUNDLE_BYTES);
  assert.equal(data.source_trust,'UNATTESTED_OPERATOR_SELECTED_JSON');
  assert.equal(data.scope,'OPERATOR_CHOSEN_PORTABLE_REDACTED');
  assert.equal(data.automatic_ranking_performed,false);
  assert.equal(data.cloud_execution_approved,false);
  assert.equal(data.generated_text_included,false);
  assert.equal(data.free_text_notes_included,false);
  assert.equal(typeof data.entries[0].response,'undefined');
  assert.ok(Object.isFrozen(data));
});


test('PB11 fixed protocol identity roundtrips; legacy bundles without protocol fields still import',()=>{
  const tagged=sanitizeBenchEvidence(rawPerformance({protocol_id:'governance-one-sentence-v1'}));
  assert.equal(tagged.protocol_id,'governance-one-sentence-v1');
  const b=bundle([tagged]);
  const restored=importPortableBench([],JSON.parse(JSON.stringify(b)));
  assert.equal(restored[0].protocol_id,'governance-one-sentence-v1');
  const legacy=JSON.parse(JSON.stringify(bundle([sanitizeBenchEvidence(rawPerformance())])));
  delete legacy.entries[0].protocol_id;
  const old=importPortableBench([],legacy);
  assert.equal(old[0].protocol_id,null);
  assert.equal(buildBenchSummary(old).rows[0].protocol_id,null);
  const poisoned=JSON.parse(JSON.stringify(b));
  poisoned.entries[0].protocol_id='PAID-CLOUD-OVERRIDE';
  assert.throws(()=>importPortableBench([],poisoned),/BUNDLE_PROTOCOL_INVALID/);
});
