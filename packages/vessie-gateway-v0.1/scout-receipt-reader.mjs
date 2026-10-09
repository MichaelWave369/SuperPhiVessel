/**
 * SPV-SCOUT-02: optional local PhiBot receipt reader for paired HTTPS gateway.
 * Operator selects exactly one already-qualified scout-* folder at startup.
 * No arbitrary path in HTTP, no discovery, execution, memory or filesystem writes.
 *
 * This checks format and domain-separated digest CONSISTENCY only. This is NOT
 * an operator signature, remote measurement attestation or PhiBot authorization.
 */
import {createHash,timingSafeEqual} from 'node:crypto';
import {lstat,readFile,readdir,realpath} from 'node:fs/promises';
import {basename,dirname,resolve,join} from 'node:path';

const DOMAIN='PHIBOT-SCOUT-LOCAL-QUALIFICATION-V1\0';
const EXPECTED=[
  'schema','result','qualified_at','execution_mode','source_mission_id',
  'source_run_id','source_commit','source_status_sha256','source_observed_at',
  'source_expires_at','source_disposition','model_provider','local_model',
  'local_reasoning_stages','local_runtime_stages','public_read_requests',
  'logical_model_calls','physical_model_attempts_not_independently_attested',
  'tools_executed','output_contains_model_prose','public_source_authenticated',
  'phibot_agent_identity_authenticated','phios_isolation_qualified',
  'operator_approval_or_capability_granted','nbg_memory_admitted',
  'remote_agent_deployed','evidence_class',
].sort().join('|');
const ZERO=[
  'output_contains_model_prose','public_source_authenticated',
  'phibot_agent_identity_authenticated','phios_isolation_qualified',
  'operator_approval_or_capability_granted','nbg_memory_admitted',
  'remote_agent_deployed',
];
const MODEL=/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,79}$/;
const RUN=/^[1-9][0-9]{0,18}$/;
function check(ok,code){if(!ok)throw Error('SCOUT_RECEIPT_'+code);}
function date(value) {
  check(typeof value==='string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value),'STAMP');
  const t=Date.parse(value);
  check(Number.isFinite(t),'STAMP');
  return t;
}
/** Only allow an explicitly chosen direct receipt child with two plain files. */
export async function readPairedScoutReceipt(folder,now=Date.now()){
  check(typeof folder==='string' && folder.length>0,'NOT_CONFIGURED');
  check(Number.isSafeInteger(now)&&now>0,'CLOCK');
  const root=resolve(folder),parent=dirname(root);
  check(/^scout-[a-zA-Z0-9_-]{4,40}$/.test(basename(root)),'FOLDER_NAME');
  const [rs,ps]=await Promise.all([lstat(root),lstat(parent)]);
  check(rs.isDirectory()&&!rs.isSymbolicLink() &&
    ps.isDirectory()&&!ps.isSymbolicLink(),'FOLDER_KIND');
  check(await realpath(root)===root && await realpath(parent)===parent,'FOLDER_LINK');
  check((await readdir(root)).sort().join('|')==='qualification.json|qualification.sha256','FILES');
  const receipt=join(root,'qualification.json'),proof=join(root,'qualification.sha256');
  const [s,d]=await Promise.all([lstat(receipt),lstat(proof)]);
  check(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=8192 &&
    d.isFile()&&!d.isSymbolicLink()&&d.size===85,'FILE_KIND');
  const [bytes,digestBytes]=await Promise.all([readFile(receipt),readFile(proof)]);
  check(bytes.length>0&&bytes.length<=8192&&digestBytes.length===85,'FILE_SIZE');
  const digestText=digestBytes.toString('utf8');
  check(/^[0-9a-f]{64}  qualification\.json\n$/.test(digestText),'DIGEST_SHAPE');
  const expected=Buffer.from(digestText.slice(0,64),'hex');
  const actual=createHash('sha256').update(DOMAIN).update(bytes).digest();
  check(timingSafeEqual(expected,actual),'DIGEST_MISMATCH');
  let r;
  try{r=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{throw Error('SCOUT_RECEIPT_JSON');}
  check(r&&typeof r==='object'&&!Array.isArray(r) &&
    Object.keys(r).sort().join('|')===EXPECTED,'FIELDS');
  check(Buffer.from(JSON.stringify(r,null,2)+'\n','utf8').equals(bytes),'CANONICAL');
  check(r.schema==='phibot.scout-local-qualification.v0.1' &&
    r.result==='PASS_LOCAL_SCOUT_SHADOW' &&
    r.execution_mode==='OPERATOR_EXPLICIT_LOCAL_ONLY' &&
    r.source_mission_id==='phibot.scout.public-repo-health.v1' &&
    r.source_disposition==='OBSERVED_OK_UNVERIFIED_PUBLIC' &&
    r.model_provider==='ollama' &&
    r.local_reasoning_stages===1 && r.local_runtime_stages===4 &&
    r.public_read_requests===4 && r.logical_model_calls===1 &&
    r.physical_model_attempts_not_independently_attested===true &&
    r.tools_executed===0 &&
    r.evidence_class==='OPERATOR_LOCAL_SELF_REPORTED_WITH_VALIDATED_FORMAT' &&
    ZERO.every(k=>r[k]===false),'SCOPE');
  check(typeof r.source_run_id==='string'&&RUN.test(r.source_run_id) &&
    Number.isSafeInteger(Number(r.source_run_id)) &&
    typeof r.local_model==='string'&&MODEL.test(r.local_model) &&
    typeof r.source_commit==='string'&&/^[0-9a-f]{40}$/.test(r.source_commit) &&
    typeof r.source_status_sha256==='string'&&/^[0-9a-f]{64}$/.test(r.source_status_sha256),
    'IDENTITY_FORMAT');
  const qualified=date(r.qualified_at),observed=date(r.source_observed_at),
        expires=date(r.source_expires_at);
  check(expires-observed===8*3600000 && qualified>=observed-300000 &&
    qualified<=expires && qualified<=now+300000,'TIMELINE');
  // Same wire schema as PHIBOT-15 manual handoff; the browser can reuse its
  // stricter import projector without inventing a second interpretation.
  return Object.freeze({
    schema:'phibot.scout-vessie-handoff.v0.1',
    evidence_class:'LOCAL_SELF_REPORTED_FORMAT_AND_DIGEST_ONLY',
    mode:'MANUAL_OPERATOR_COPY_ONLY', // phi receipt schema label, not transport
    qualification_result:'PASS_LOCAL_SCOUT_SHADOW',
    source_run_id:r.source_run_id,
    source_mission_id:'phibot.scout.public-repo-health.v1',
    local_model:r.local_model,
    qualified_at:r.qualified_at,
    source_expires_at:r.source_expires_at,
    review_freshness:now>=qualified&&now<=expires ?
      'CURRENT_WITHIN_SOURCE_WINDOW':'HISTORICAL_EXPIRED_OR_NOT_YET_CURRENT',
    receipt_digest_sha256:actual.toString('hex'),
    integrity:'DOMAIN_SEPARATED_DIGEST_MATCH',
    public_source_authenticated:false,
    identity_authenticated:false,
    signer_authenticated:false,
    independent_execution_attested:false,
    reality_gate_granted:false,
    tool_calls_authorized:false,
    memory_admitted:false,
    agent_spawned:false,
    phios_isolation_qualified:false,
    vessie_connected:false, // model/agent connection is still false
    routing_influence:'NONE',
  });
}
