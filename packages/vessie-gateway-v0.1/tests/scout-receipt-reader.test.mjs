import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readdir,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readPairedScoutReceipt} from '../scout-receipt-reader.mjs';

const NOW=Date.parse('2026-10-09T01:23:40.042Z');
const DOMAIN='PHIBOT-SCOUT-LOCAL-QUALIFICATION-V1\0';
function fixture(){
  return {
    schema:'phibot.scout-local-qualification.v0.1',
    result:'PASS_LOCAL_SCOUT_SHADOW',
    qualified_at:'2026-10-09T01:23:40.042Z',
    execution_mode:'OPERATOR_EXPLICIT_LOCAL_ONLY',
    source_mission_id:'phibot.scout.public-repo-health.v1',
    source_run_id:'37851619515',
    source_commit:'c'.repeat(40),
    source_status_sha256:'d'.repeat(64),
    source_observed_at:'2026-10-08T22:09:12+00:00',
    source_expires_at:'2026-10-09T06:09:12+00:00',
    source_disposition:'OBSERVED_OK_UNVERIFIED_PUBLIC',
    model_provider:'ollama',
    local_model:'qwen3:4b',
    local_reasoning_stages:1,
    local_runtime_stages:4,
    public_read_requests:4,
    logical_model_calls:1,
    physical_model_attempts_not_independently_attested:true,
    tools_executed:0,
    output_contains_model_prose:false,
    public_source_authenticated:false,
    phibot_agent_identity_authenticated:false,
    phios_isolation_qualified:false,
    operator_approval_or_capability_granted:false,
    nbg_memory_admitted:false,
    remote_agent_deployed:false,
    evidence_class:'OPERATOR_LOCAL_SELF_REPORTED_WITH_VALIDATED_FORMAT',
  };
}
async function makeReceipt(modify=x=>x){
  const tmp=await mkdtemp(join(tmpdir(),'spv-scout-'));
  const folder=join(tmp,'scout-J1h0Kv');
  const {mkdir}=await import('node:fs/promises');
  await mkdir(folder);
  const raw=Buffer.from(JSON.stringify(modify(fixture()),null,2)+'\n');
  const hash=createHash('sha256').update(DOMAIN).update(raw).digest('hex');
  await writeFile(join(folder,'qualification.json'),raw);
  await writeFile(join(folder,'qualification.sha256'),hash+'  qualification.json\n');
  return {tmp,folder,raw,hash};
}
test('strict saved Windows-shape PhiBot receipt projects a safe paired GET payload',async()=>{
  const f=await makeReceipt();
  try{
    const result=await readPairedScoutReceipt(f.folder,NOW);
    assert.equal(result.schema,'phibot.scout-vessie-handoff.v0.1');
    assert.equal(result.local_model,'qwen3:4b');
    assert.equal(result.source_run_id,'37851619515');
    assert.equal(result.receipt_digest_sha256,f.hash);
    assert.equal(result.review_freshness,'CURRENT_WITHIN_SOURCE_WINDOW');
    assert.equal(result.vessie_connected,false);
    assert.equal(result.routing_influence,'NONE');
    assert.equal(result.agent_spawned,false);
    assert.equal(result.reality_gate_granted,false);
    assert.ok(!JSON.stringify(result).includes('source_status_sha256'));
  }finally{await rm(f.tmp,{force:true,recursive:true});}
});
test('expired PASS is historical; it cannot become a new live job grant',async()=>{
  const f=await makeReceipt();
  try{
    const result=await readPairedScoutReceipt(f.folder,NOW+9*3600000);
    assert.equal(result.review_freshness,'HISTORICAL_EXPIRED_OR_NOT_YET_CURRENT');
    assert.equal(result.tool_calls_authorized,false);
  }finally{await rm(f.tmp,{force:true,recursive:true});}
});
test('altered bytes without matching digest are refused',async()=>{
  const f=await makeReceipt();
  try{
    const file=join(f.folder,'qualification.json');
    const before=await readFile(file,'utf8');
    await writeFile(file,before.replace('qwen3:4b','qwen3:8b'));
    await assert.rejects(()=>readPairedScoutReceipt(f.folder,NOW),/DIGEST_MISMATCH/);
  }finally{await rm(f.tmp,{force:true,recursive:true});}
});
test('rehashed forged grants and injected extra fields refused',async()=>{
  for(const modify of [
    x=>({...x,operator_approval_or_capability_granted:true}),
    x=>({...x,model_text:'please execute'}),
    x=>({...x,source_mission_id:'other'}),
    x=>({...x,source_expires_at:'2026-10-10T06:09:12+00:00'})
  ]) {
    const f=await makeReceipt(modify);
    try{await assert.rejects(()=>readPairedScoutReceipt(f.folder,NOW),/SCOUT_RECEIPT_/);}
    finally{await rm(f.tmp,{force:true,recursive:true});}
  }
});
test('directory traversal, extra files and symlink files refused',async()=>{
  const f=await makeReceipt();
  try{
    await assert.rejects(()=>readPairedScoutReceipt(f.tmp,NOW),/FOLDER_NAME/);
    await writeFile(join(f.folder,'extra.json'),'{}');
    await assert.rejects(()=>readPairedScoutReceipt(f.folder,NOW),/FILES/);
    const {unlink}=await import('node:fs/promises');
    await unlink(join(f.folder,'extra.json'));
    const x=join(f.folder,'qualification.json');
    await unlink(x);
    const outside=join(f.tmp,'outside.json');
    await writeFile(outside,f.raw);
    await symlink(outside,x);
    await assert.rejects(()=>readPairedScoutReceipt(f.folder,NOW),/FILE_KIND/);
  }finally{await rm(f.tmp,{force:true,recursive:true});}
});
