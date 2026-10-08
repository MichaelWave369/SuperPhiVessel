import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { projectCanonicalRoute } from './projector.mjs';

// R3-E establishes operator custody of a redacted, offline projection.
// A valid Ed25519 signature is NOT browser origin, runtime, model, quality,
// or execution attestation. Never admit this packet as an executor grant.
export const ENVELOPE_SCHEMA = 'superphivessel.gateway.r3e.operator-envelope.v0.1';
const R3C_SCHEMA = 'superphivessel.gateway.r3c.canonical-route-evidence.v0.1';
const SOURCE = 'VESSIE_CANONICAL_54_12_EXPORTED_RECORDS';
const DOMAIN = 'PV-VESSIE-R3E-OPERATOR-SIGNATURE-V1\n';
const ALLOWED = new Set([
  'schema','source','source_runtime','source_blob_sha1','evidence_level',
  'run_capsule_present','frozen_pool_count','routing_mode','brain_route_present',
  'brain_route_role','brain_model_configured','brain_model_selected',
  'selected_model_source','brain_recommendation_applied','budgetgenius_influence',
  'budgetgenius_execution_authorized','executor_authorization_status',
  'executor_provider','executor_model','executor_role','executor_authorized_observed',
  'dispatch_attempt_observed','dispatch_started_count','dispatch_completed_count',
  'dispatch_failed_count','terminal_outcomes_conflict','terminal_outcome_class',
  'last_recorded_latency_ms','execution_record_status','independent_execution_confirmation',
  'independently_verified_answer_quality','source_authenticity_attested',
  'cryptographic_signature_verified','exact_model_artifact_attested',
  'ga108_genius_identity_attested','browser_gateway_connected',
  'live_trace_export_connected','can_execute','may_change_live_route',
  'may_change_live_thresholds','authority_granted','projection_hash'
]);
const FALSE_FLAGS = [
  'budgetgenius_execution_authorized','independent_execution_confirmation',
  'independently_verified_answer_quality','source_authenticity_attested',
  'cryptographic_signature_verified','exact_model_artifact_attested',
  'ga108_genius_identity_attested','browser_gateway_connected',
  'live_trace_export_connected','can_execute','may_change_live_route',
  'may_change_live_thresholds','authority_granted'
];
const STATUSES = new Set([
  'FROZEN_RUN_ONLY','SELECTION_ONLY','AUTHORIZED_NOT_OBSERVED_EXECUTING',
  'DISPATCH_STARTED_NO_FINAL_OUTCOME','COMPLETION_RECORDED_UNVERIFIED',
  'FAILURE_RECORDED','EXECUTOR_DENIED','ROUTE_INFLUENCE_NOT_EXECUTED',
  'MIXED_TERMINAL_RECORDS_UNRESOLVED'
]);
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function assert(ok, code) { if (!ok) throw new Error(code); }
function exactKeys(obj, list, code) {
  assert(isObj(obj) && Object.keys(obj).length === list.length &&
    Object.keys(obj).every(k => list.includes(k)), code);
}
function fingerprint(publicKey) {
  return createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
}
function digestProjection(projection) {
  const { projection_hash: ignored, ...withoutDigest } = projection;
  return createHash('sha256').update('PV-VESSIE-R3C-REDACTED|' +
    JSON.stringify(withoutDigest)).digest('hex');
}
function signedBytes(packet, signer) {
  return Buffer.from(DOMAIN + JSON.stringify({ packet, signer }), 'utf8');
}
function validateProjection(p) {
  assert(isObj(p) && Object.keys(p).length === ALLOWED.size &&
    Object.keys(p).every(k => ALLOWED.has(k)), 'PROJECTION_FIELDS_INVALID');
  assert(p.schema === R3C_SCHEMA && p.source === SOURCE &&
    p.source_runtime === 'v2.0-alpha.11.0.54.12' &&
    p.evidence_level === 'UNATTESTED_OPERATOR_EXPORTED_RECORDS',
    'PROJECTION_SOURCE_INVALID');
  assert(FALSE_FLAGS.every(k => p[k] === false), 'PROJECTION_AUTHORITY_INVALID');
  assert(p.run_capsule_present === true &&
    p.brain_route_present === true || p.run_capsule_present === true &&
    p.brain_route_present === false, 'PROJECTION_RUN_INVALID');
  for (const k of ['dispatch_started_count','dispatch_completed_count',
    'dispatch_failed_count','frozen_pool_count']) {
    assert(Number.isSafeInteger(p[k]) && p[k] >= 0, 'PROJECTION_COUNTER_INVALID');
  }
  const conflict = p.dispatch_completed_count > 0 && p.dispatch_failed_count > 0;
  const klass = conflict ? 'MIXED_UNRESOLVED' :
    p.dispatch_completed_count > 0 ? 'COMPLETION_ONLY' :
    p.dispatch_failed_count > 0 ? 'FAILURE_ONLY' : 'NONE_RECORDED';
  assert(p.terminal_outcomes_conflict === conflict &&
    p.terminal_outcome_class === klass, 'PROJECTION_TERMINAL_CLASS_INVALID');
  assert(STATUSES.has(p.execution_record_status), 'PROJECTION_STATUS_INVALID');
  if (conflict) assert(p.execution_record_status === 'MIXED_TERMINAL_RECORDS_UNRESOLVED',
    'PROJECTION_MIXED_STATUS_INVALID');
  if (p.dispatch_completed_count > 0 && !conflict)
    assert(p.execution_record_status === 'COMPLETION_RECORDED_UNVERIFIED',
      'PROJECTION_COMPLETION_STATUS_INVALID');
  if (p.dispatch_failed_count > 0 && !conflict)
    assert(p.execution_record_status === 'FAILURE_RECORDED', 'PROJECTION_FAILURE_STATUS_INVALID');
  assert(typeof p.projection_hash === 'string' && /^[a-f0-9]{64}$/.test(p.projection_hash) &&
    p.projection_hash === digestProjection(p), 'PROJECTION_CHECKSUM_INVALID');
}
export function createOperatorEnvelope(bundle, privateKeyPem, { operatorReviewed = false,
  createdAt = new Date().toISOString() } = {}) {
  assert(operatorReviewed === true, 'OPERATOR_REVIEW_REQUIRED');
  assert(typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)) &&
    new Date(createdAt).toISOString() === createdAt, 'CREATED_AT_INVALID');
  const key = createPrivateKey(privateKeyPem);
  assert(key.asymmetricKeyType === 'ed25519', 'ED25519_KEY_REQUIRED');
  const publicKey = createPublicKey(key);
  const projection = projectCanonicalRoute(bundle, { operatorNames: false });
  validateProjection(projection);
  const packet = {
    packet_id: randomBytes(16).toString('hex'),
    created_at: createdAt,
    operator_review_declared: true,
    custody_claim: 'OPERATOR_SIGNED_REDACTED_PROJECTION_NOT_RUNTIME_ATTESTED',
    projection,
    runtime_origin_verified: false,
    independently_verified_answer_quality: false,
    authority_granted: false,
    can_execute: false,
    may_change_live_route: false
  };
  const signer = {
    algorithm: 'Ed25519',
    key_fingerprint_sha256: fingerprint(publicKey),
    trust: 'EXTERNAL_OPERATOR_PUBLIC_KEY_REQUIRED'
  };
  return {
    schema: ENVELOPE_SCHEMA,
    packet,
    signer,
    signature_base64: sign(null, signedBytes(packet, signer), key).toString('base64')
  };
}
// Caller MUST supply independently acquired, trusted public key.
// A public key supplied inside the packet would be self-asserted, so none is included.
export function verifyOperatorEnvelope(envelope, trustedPublicKeyPem) {
  exactKeys(envelope, ['schema','packet','signer','signature_base64'], 'ENVELOPE_FIELDS_INVALID');
  assert(envelope.schema === ENVELOPE_SCHEMA, 'ENVELOPE_SCHEMA_INVALID');
  exactKeys(envelope.packet, [
    'packet_id','created_at','operator_review_declared','custody_claim','projection',
    'runtime_origin_verified','independently_verified_answer_quality',
    'authority_granted','can_execute','may_change_live_route'
  ], 'PACKET_FIELDS_INVALID');
  exactKeys(envelope.signer, [
    'algorithm','key_fingerprint_sha256','trust'
  ], 'SIGNER_FIELDS_INVALID');
  const p = envelope.packet, s = envelope.signer;
  assert(typeof p.packet_id === 'string' && /^[a-f0-9]{32}$/.test(p.packet_id),
    'PACKET_ID_INVALID');
  assert(typeof p.created_at === 'string' && !Number.isNaN(Date.parse(p.created_at)) &&
    new Date(p.created_at).toISOString() === p.created_at, 'PACKET_TIMESTAMP_INVALID');
  assert(p.operator_review_declared === true &&
    p.custody_claim === 'OPERATOR_SIGNED_REDACTED_PROJECTION_NOT_RUNTIME_ATTESTED' &&
    p.runtime_origin_verified === false &&
    p.independently_verified_answer_quality === false &&
    p.authority_granted === false && p.can_execute === false &&
    p.may_change_live_route === false, 'PACKET_AUTHORITY_INVALID');
  assert(s.algorithm === 'Ed25519' &&
    s.trust === 'EXTERNAL_OPERATOR_PUBLIC_KEY_REQUIRED' &&
    typeof s.key_fingerprint_sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(s.key_fingerprint_sha256), 'SIGNER_METADATA_INVALID');
  validateProjection(p.projection);
  assert(typeof envelope.signature_base64 === 'string' &&
    /^[A-Za-z0-9+/]{86}==$/.test(envelope.signature_base64),
    'SIGNATURE_FORMAT_INVALID');
  const pub = createPublicKey(trustedPublicKeyPem);
  assert(pub.asymmetricKeyType === 'ed25519' &&
    fingerprint(pub) === s.key_fingerprint_sha256, 'TRUSTED_KEY_MISMATCH');
  assert(verify(null, signedBytes(p, s), pub,
    Buffer.from(envelope.signature_base64, 'base64')), 'SIGNATURE_INVALID');
  return {
    schema: 'superphivessel.gateway.r3e.operator-verification.v0.1',
    verification_status: 'OPERATOR_SIGNATURE_VERIFIED_RUNTIME_UNATTESTED',
    trusted_operator_key_matched: true,
    operator_signature_verified: true,
    key_fingerprint_sha256: s.key_fingerprint_sha256,
    projection_hash: p.projection.projection_hash,
    execution_record_status: p.projection.execution_record_status,
    terminal_outcomes_conflict: p.projection.terminal_outcomes_conflict,
    runtime_origin_verified: false,
    source_authenticity_attested: false,
    independently_verified_answer_quality: false,
    independent_execution_confirmation: false,
    browser_gateway_connected: false,
    live_trace_export_connected: false,
    can_execute: false,
    may_change_live_route: false,
    authority_granted: false
  };
}
