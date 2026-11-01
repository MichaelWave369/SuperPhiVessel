import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  parseUniqueJSON,validateReceipt,makeEntry,validateEntry,summary,jsonLine,
} from '../ledger.mjs';
import {ingest,loadLedger} from '../cli.mjs';

const root=fileURLToPath(new URL('../../../ledger/phiserve-acceptance/',import.meta.url));
const evidence=readFileSync(join(root,'evidence/gha-41271827883/acceptance.json'));
const committed=JSON.parse(readFileSync(join(root,'entries/gha-41271827883.json'),'utf8'));
const META={runId:41271827883,artifactId:13070145738,runCreatedAt:'2026-11-01T04:07:24Z'};
const original=JSON.parse(evidence);
const clone=v=>JSON.parse(JSON.stringify(v));
function newRecord(run,changes={},artifactId=run+10){
  const input={...clone(original),...changes};
  const bytes=Buffer.from(jsonLine(input));
  return makeEntry(bytes,{runId:run,artifactId,runCreatedAt:'2026-11-01T04:07:24Z'});
}
const rejected=(next,part)=>assert.throws(next,new RegExp(part));

test('AL01 first committed entry is exact replay of actual redacted acceptance artifact',()=>{
  assert.equal(evidence.length,1378);
  assert.deepEqual(makeEntry(evidence,META),committed);
  assert.equal(validateEntry(committed,evidence),committed);
  assert.equal(committed.source.artifact_receipt_sha256,
    'ab3a9001d25e5fcb561c45f2fa2fbb01af5347ed1d214ceac016a0d4b88109c6');
  assert.equal(committed.observation.gguf_sha256,
    '2e8040ceae7815abe0dcb3540b9995eaa1fa0d2ca9e797d0a635ae4433c68c2d');
  assert.equal(committed.observation.response_sha256,
    '502c59159bc10ecfc35051f74c21c0e436fbc7438f1e71942849021119724b6d');
});
test('AL02 existing on-disk ledger verifies with no model, browser, network, token or keys',()=>{
  assert.deepEqual(loadLedger(root),[committed]);
});
test('AL03 JSON rejects duplicate keys at root, within nested check object, and trailing data',()=>{
  rejected(()=>parseUniqueJSON('{"a":true,"a":false}'),'DUPLICATE_FIELD');
  rejected(()=>parseUniqueJSON('{"checks":{"ok":true,"ok":false}}'),'DUPLICATE_FIELD');
  rejected(()=>parseUniqueJSON('{"x":1}{"x":2}'),'JSON_INVALID');
  rejected(()=>parseUniqueJSON('{"x":NaN}'),'JSON_INVALID');
});
test('AL04 unknown top-level fields, private prompts, or output text never enter immutable ledger',()=>{
  for(const k of ['raw_prompt','model_output','token','secret','source_path','proof']){
    rejected(()=>makeEntry(Buffer.from(JSON.stringify({...original,[k]:'sensitive'})),META),
      'UNKNOWN_OR_MISSING');
  }
});
test('AL05 every control is mandatory and must be boolean true',()=>{
  for(const key of Object.keys(original.checks)){
    const bad=clone(original);bad.checks[key]=false;
    rejected(()=>validateReceipt(bad),'TRANSPORT_CONTROL_NOT_PASSED');
    const missing=clone(original);delete missing.checks[key];
    rejected(()=>validateReceipt(missing),'CHECKS_UNKNOWN_OR_MISSING');
  }
});
test('AL06 every false privacy, provenance and authority flag must stay false',()=>{
  for(const key of [
    'raw_prompt_included','raw_response_included','bearer_token_included',
    'private_memory_accessed','model_routing_approved','agent_action_authorized',
    'user_pc_accessed','user_rtx_5070_tested','local_browser_gui_clicked',
    'independent_hardware_attestation',
  ]){
    const forged=clone(original);forged[key]=true;
    rejected(()=>validateReceipt(forged),'AUTHORITY_OR_PRIVACY_FLAG_INVALID');
  }
});
test('AL07 rejects invalid source scope, fake success and changed report schema',()=>{
  for(const [key,value] of [
    ['status','FAILED'],['execution_context','USER_RTX_5070_VERIFIED'],
    ['schema','FORGED_SUCCESS_V99'],['source_commit','unknown'],
  ]){
    const forged=clone(original);forged[key]=value;
    rejected(()=>validateReceipt(forged),'LEDGER_');
  }
});
test('AL08 invalid SHA-256 digests and sizes cannot be ledgered',()=>{
  for(const key of ['gguf_sha256','response_sha256','receipt_file_sha256']){
    const bad=clone(original);bad[key]='ffff';
    rejected(()=>validateReceipt(bad),'DIGEST_INVALID');
  }
  const big=clone(original);big.response_characters=100001;
  rejected(()=>validateReceipt(big),'RESPONSE_LENGTH_INVALID');
  const time=clone(original);time.elapsed_wall_ms=-1;
  rejected(()=>validateReceipt(time),'LATENCY_INVALID');
});
test('AL09 immutable derived record fields and authority cannot be rewritten',()=>{
  // A bare artifact ID is operator-provided metadata and cannot be
  // independently authenticated by offline receipt parsing.
  for(const mutate of [
    e=>e.source.repository='attacker/SuperPhiVessel',
    e=>e.source.artifact_receipt_sha256='0'.repeat(64),
    e=>e.classification.independently_attested=true,
    e=>e.classification.agent_authority_granted=true,
    e=>e.observation.response_sha256='a'.repeat(64),
    e=>e.observation.checks.missing_approval_denied=false,
  ]){
    const entry=clone(committed);mutate(entry);
    rejected(()=>validateEntry(entry,evidence),'LEDGER_');
  }
});
test('AL10 duplicate run ids and reused artifact ids are refused',()=>{
  rejected(()=>summary([committed,committed]),'DUPLICATE_RUN_OR_ARTIFACT');
  const other=newRecord(41271827884,{},committed.source.artifact_id);
  rejected(()=>summary([committed,other]),'DUPLICATE_RUN_OR_ARTIFACT');
});
test('AL11 different generated text hashes are variation, not failed repeatability',()=>{
  const other=newRecord(41271827884,{response_sha256:'f'.repeat(64)},13070145739);
  const report=summary([committed,other]);
  assert.equal(report.total_entries,2);
  assert.equal(report.tracks[0].runs,2);
  assert.equal(report.tracks[0].distinct_response_hashes,2);
  assert.equal(report.tracks[0].response_hash_variation_is_regression,false);
  assert.equal(report.tracks[0].repeatability,'MULTIPLE_HOSTED_OBSERVATIONS');
  assert.deepEqual(report.alerts,[]);
});
test('AL12 changed GGUF SHA-256 requires review and cannot inherit prior baseline',()=>{
  const other=newRecord(41271827884,{gguf_sha256:'f'.repeat(64)},13070145739);
  const report=summary([committed,other]);
  assert.equal(report.tracks.length,2);
  assert.deepEqual(report.alerts,[{
    record_id:'gha-41271827884',kind:'MODEL_HASH_CHANGED_REVIEW_REQUIRED',
  }]);
});
test('AL13 latency signal requires a repeated comparison group and remains advisory',()=>{
  const records=[
    committed,
    newRecord(41271827884,{elapsed_wall_ms:1100},13070145739),
    newRecord(41271827885,{elapsed_wall_ms:1200},13070145740),
    newRecord(41271827886,{elapsed_wall_ms:7000},13070145741),
  ];
  const report=summary(records);
  assert.deepEqual(report.alerts,[{
    record_id:'gha-41271827886',kind:'LATENCY_VARIATION_REVIEW_REQUIRED',
  }]);
  assert.equal(report.tracks[0].latency_comparison,'OBSERVATIONAL_ONLY_NOT_DETERMINISTIC_BENCHMARK');
  assert.equal(report.canonical_model_promotion_approved,false);
});
test('AL14 source commit changes cause a new comparison track, not model qualification',()=>{
  const other=newRecord(41271827884,{source_commit:'f'.repeat(40)},13070145739);
  const report=summary([committed,other]);
  assert.equal(report.tracks.length,2);
  assert.equal(report.user_rtx_5070_qualified,false);
  assert.equal(report.automatic_routing_granted,false);
});
test('AL15 new receipt is append-only, existing record cannot be overwritten',()=>{
  const dir=mkdtempSync(join(tmpdir(),'acceptance-ledger-'));
  try{
    const input=join(dir,'acceptance.json');
    writeFileSync(input,evidence);
    const parent=join(dir,'ledger');
    const first=ingest(parent,input,META);
    assert.deepEqual(first,committed);
    assert.deepEqual(loadLedger(parent),[committed]);
    rejected(()=>ingest(parent,input,META),'APPEND_ONLY_DUPLICATE_RUN');
    assert.deepEqual(loadLedger(parent),[committed]);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('AL16 orphaned evidence, missing artifact or tampered copied proof fail verification',()=>{
  const dir=mkdtempSync(join(tmpdir(),'acceptance-ledger-'));
  try{
    const input=join(dir,'test.json');writeFileSync(input,evidence);
    const root2=join(dir,'ledger');ingest(root2,input,META);
    mkdirSync(join(root2,'evidence','gha-999'),{recursive:true});
    rejected(()=>loadLedger(root2),'ORPHANED_OR_UNEXPECTED_EVIDENCE');
    rmSync(join(root2,'evidence','gha-999'),{recursive:true,force:true});
    const copied=join(root2,'evidence','gha-41271827883','acceptance.json');
    writeFileSync(copied,Buffer.from(JSON.stringify({...original,elapsed_wall_ms:800})));
    rejected(()=>loadLedger(root2),'DERIVED_FIELDS_MISMATCH');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('AL17 the ledger does not turn any observation into autonomous permission',()=>{
  const report=summary([committed]);
  assert.equal(report.total_entries,1);
  assert.equal(report.independent_hardware_attestation,false);
  assert.equal(report.user_rtx_5070_qualified,false);
  assert.equal(report.canonical_model_promotion_approved,false);
  assert.equal(report.automatic_routing_granted,false);
  assert.equal(committed.classification.machine_verified,false);
  assert.equal(committed.classification.human_quality_reviewed,false);
});

test('AL18 browser-only evidence importer never runs automatically or merges a PR',()=>{
  const wf=readFileSync(new URL('../../../.github/workflows/vessie-phiserve-ledger-manual-import.yml',import.meta.url),'utf8');
  assert.match(wf,/^\s*workflow_dispatch:\s*$/m);
  for(const trigger of [/^\s*pull_request:/m,/^\s*push:/m,/^\s*schedule:/m,/^\s*workflow_run:/m]){
    assert.doesNotMatch(wf,trigger);
  }
  assert.match(wf,/approve_create_evidence_pr:/);
  assert.match(wf,/default: false/);
  assert.match(wf,/if: inputs\.approve_create_evidence_pr == true/);
  assert.match(wf,/gh pr create /);
  assert.doesNotMatch(wf,/gh pr merge|git push origin main|--auto-merge/);
  assert.match(wf,/LEDGER_PR_OPENED_HUMAN_REVIEW_REQUIRED/);
});
test('AL19 browser importer validates real GitHub run fields and accepts only bounded redacted evidence',()=>{
  const wf=readFileSync(new URL('../../../.github/workflows/vessie-phiserve-ledger-manual-import.yml',import.meta.url),'utf8');
  assert.match(wf,/\.repository\.full_name == \$repo/);
  assert.match(wf,/\.event == "workflow_dispatch"/);
  assert.match(wf,/\.conclusion == "success"/);
  assert.match(wf,/\.path == "\.github\/workflows\/vessie-phiserve-hosted-cpu-acceptance\.yml"/);
  assert.match(wf,/\.head_branch == "main"/);
  assert.match(wf,/Vessie-PhiServe-Hosted-CPU-Acceptance/);
  assert.match(wf,/evidence\.source_commit!==metadata\.head_sha/);
  assert.match(wf,/node packages\/vessie-phiserve-ledger\/cli\.mjs ingest/);
  assert.match(wf,/test "\$\(git diff --cached --name-only \| wc -l\)" -eq 2/);
  assert.doesNotMatch(wf,/--llama-server|--approve-local-inference|cloud inference/i);
});
