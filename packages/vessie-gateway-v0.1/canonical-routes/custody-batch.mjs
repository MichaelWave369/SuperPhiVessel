import {createHash} from 'node:crypto';
import {verifyOperatorEnvelope} from './operator-envelope.mjs';

// R3-F detects duplicates and review flags WITHIN one already-redacted,
// operator-signed offline batch. No source attestation or replay registry.
export const BATCH_SCHEMA='superphivessel.gateway.r3f.custody-batch.v0.1';
const MAX_ENVELOPES=32;
const MAX_ENVELOPE_BYTES=131072;
const MAX_BATCH_BYTES=1048576;
const isObject=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const knownStatus=new Set([
  'FROZEN_RUN_ONLY','SELECTION_ONLY','AUTHORIZED_NOT_OBSERVED_EXECUTING',
  'DISPATCH_STARTED_NO_FINAL_OUTCOME','COMPLETION_RECORDED_UNVERIFIED',
  'FAILURE_RECORDED','EXECUTOR_DENIED','ROUTE_INFLUENCE_NOT_EXECUTED',
  'MIXED_TERMINAL_RECORDS_UNRESOLVED'
]);

export function auditOperatorCustodyBatch(envelopes,trustedPublicKeyPem){
  if(!Array.isArray(envelopes)||envelopes.length<1||envelopes.length>MAX_ENVELOPES)
    fail('BATCH_SIZE_INVALID');
  // The verifier rejects packets and unknown fields before any results are
  // returned; no unsigned or partially valid packet can enter an audit.
  let totalBytes=0;
  const seenPackets=new Map(),seenProjections=new Map();
  const issueCounts=Object.create(null);
  const issues=new Set();
  const outcomes=Object.create(null);
  let previousTimestamp=null,mixedCount=0;
  let keyFingerprint=null;
  const note=(issue)=>{issues.add(issue);issueCounts[issue]=(issueCounts[issue]||0)+1;};
  for(const envelope of envelopes){
    if(!isObject(envelope))fail('BATCH_ITEM_INVALID');
    const serialized=JSON.stringify(envelope);
    if(typeof serialized!=='string')fail('BATCH_ITEM_INVALID');
    const bytes=Buffer.byteLength(serialized,'utf8');
    totalBytes+=bytes;
    if(bytes>MAX_ENVELOPE_BYTES||totalBytes>MAX_BATCH_BYTES)fail('BATCH_BYTES_EXCEEDED');

    const verified=verifyOperatorEnvelope(envelope,trustedPublicKeyPem);
    if(verified.operator_signature_verified!==true||
       verified.runtime_origin_verified!==false||
       verified.authority_granted!==false||verified.can_execute!==false)
      fail('UNEXPECTED_VERIFICATION_BOUNDARY');
    if(keyFingerprint===null) keyFingerprint=verified.key_fingerprint_sha256;
    else if(keyFingerprint!==verified.key_fingerprint_sha256)fail('OPERATOR_KEY_CHANGED');

    // Same ID with two independently signed contents is different from
    // a byte-for-byte duplicate. Neither proves anything about source runs.
    const id=envelope.packet.packet_id,projection=verified.projection_hash;
    const wholeDigest=digest(envelope);
    if(seenPackets.has(id)){
      if(seenPackets.get(id)===wholeDigest)note('DUPLICATE_SIGNED_PACKET_IN_BATCH');
      else note('REUSED_PACKET_ID_DIFFERENT_SIGNED_CONTENT');
    } else seenPackets.set(id,wholeDigest);
    if(seenProjections.has(projection))
      note('REPEATED_REDACTED_PROJECTION_NOT_INDEPENDENT_SAMPLE');
    else seenProjections.set(projection,true);

    const ts=Date.parse(envelope.packet.created_at);
    if(previousTimestamp!==null && ts<previousTimestamp)
      note('OPERATOR_TIMESTAMP_REGRESSION_UNATTESTED');
    previousTimestamp=ts;

    const outcome=verified.execution_record_status;
    if(!knownStatus.has(outcome))fail('BATCH_OUTCOME_INVALID');
    outcomes[outcome]=(outcomes[outcome]||0)+1;
    if(verified.terminal_outcomes_conflict===true){
      mixedCount++;
      note('MIXED_TERMINAL_RECORD_REQUIRES_REVIEW');
    }
  }
  // Only report bounded, generic statuses: never expose packet IDs, input
  // paths, model identities, prompt text, signatures or operator usernames.
  const counts=Object.fromEntries([...knownStatus].sort().map(k=>[k,outcomes[k]||0]));
  const report={
    schema:BATCH_SCHEMA,
    source:'R3E_OPERATOR_SIGNED_REDACTED_ENVELOPES',
    audit_scope:'SINGLE_OFFLINE_BATCH_NO_PERSISTENT_REPLAY_REGISTRY',
    status:issues.size?'REVIEW_REQUIRED':'OPERATOR_SIGNATURES_VERIFIED_SOURCE_UNATTESTED',
    verified_operator_signature_count:envelopes.length,
    envelope_count:envelopes.length,
    distinct_signed_packet_ids:seenPackets.size,
    distinct_redacted_projection_hashes:seenProjections.size,
    mixed_terminal_record_count:mixedCount,
    claimed_execution_record_counts_unverified:counts,
    issues:[...issues].sort(),
    issue_counts:Object.fromEntries(Object.keys(issueCounts).sort().map(k=>[k,issueCounts[k]])),
    operator_public_key_fingerprint_sha256:keyFingerprint,
    verified_with_independently_supplied_key:true,
    cross_batch_replay_prevented:false,
    signed_data_runtime_origin_attested:false,
    independently_verified_execution:false,
    independently_verified_answer_quality:false,
    model_performance_suitable_for_learning:false,
    physically_qualified:false,
    live_trace_export_connected:false,
    may_update_model_weights:false,
    may_change_live_route:false,
    can_execute:false,
    authority_granted:false
  };
  return {...report,report_checksum_sha256:digest(report)};
}
