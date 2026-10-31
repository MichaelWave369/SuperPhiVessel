/*
 * Local, browser-side review of the operator PhiServe CLI's two exported files.
 * There is no network, eval, storage, inference request, or authority promotion.
 * Hash parity is local consistency, NOT model/GPU/provenance attestation.
 */
export const MODEL_DESK_SCHEMA = 'SUPERPHIVESSEL_PHISERVE_MODEL_DESK_REVIEW_V1';
export const SOURCE_DRAFT_SCHEMA = 'SUPERPHIVESSEL_PHISERVE_OPERATOR_DRAFT_V1';
export const MAX_RECEIPT_BYTES = 16 * 1024;
export const MAX_TEXT_BYTES = 100 * 1024;
const shaPattern = /^[0-9a-f]{64}$/;
const receiptKeys = [
  'schema','status','evidence_class','provider','model_alias','request_id',
  'observed_at','prompt_sha256','response_sha256','prompt_chars','response_chars',
  'requested_output_token_cap','user_initiated','approval_scope',
  'source_input_included','response_text_included','bearer_token_included',
  'memory_accessed','tool_execution_attempted','tool_execution_authorized',
  'route_approved','canonical_runtime_connected','operator_authority_granted',
  'attestation','note'
].sort();
const useful = new Set(['VERY_USEFUL','SOMEWHAT_USEFUL','NOT_USEFUL','NOT_ASSESSED']);
const complete = new Set(['APPEARS_COMPLETE','MAY_BE_INCOMPLETE','UNSURE']);
const checked = new Set(['NOT_CHECKED','OPERATOR_CHECKED_SUPPORTED','OPERATOR_CHECKED_CONTRADICTED']);

export class ModelDeskError extends Error {
  constructor(code) { super(code); this.name = 'ModelDeskError'; this.code = code; }
}

function bytes(value, max, code) {
  if (!(value instanceof Uint8Array) || value.byteLength === 0 || value.byteLength > max) {
    throw new ModelDeskError(code);
  }
  return value;
}
function jsonFromBytes(value) {
  let json;
  try {
    json = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(
      bytes(value,MAX_RECEIPT_BYTES,'RECEIPT_FILE_INVALID_OR_OVERSIZED')
    ));
  } catch { throw new ModelDeskError('RECEIPT_JSON_INVALID'); }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new ModelDeskError('RECEIPT_SCHEMA_INVALID');
  }
  return json;
}
function checkReceipt(r) {
  if (Object.keys(r).sort().join('|') !== receiptKeys.join('|') ||
      r.schema !== SOURCE_DRAFT_SCHEMA ||
      r.status !== 'LOCAL_TEXT_RETURNED_UNVERIFIED' ||
      r.evidence_class !== 'OPERATOR_PROCESS_SELF_REPORTED' ||
      r.provider !== 'PHISERVE_LOCAL_GGUF' ||
      r.attestation !== 'NOT_INDEPENDENTLY_VERIFIED' ||
      r.approval_scope !== 'THIS_SINGLE_DRAFT_REQUEST' ||
      r.user_initiated !== true ||
      !['source_input_included','response_text_included','bearer_token_included',
         'memory_accessed','tool_execution_attempted','tool_execution_authorized',
         'route_approved','canonical_runtime_connected','operator_authority_granted']
        .every(k => r[k] === false) ||
      typeof r.model_alias !== 'string' || !r.model_alias ||
      r.model_alias.length > 160 || /[\u0000-\u001f\u007f]/.test(r.model_alias) ||
      typeof r.request_id !== 'string' || !r.request_id ||
      r.request_id.length > 128 || /[\u0000-\u001f\u007f]/.test(r.request_id) ||
      typeof r.observed_at !== 'string' || r.observed_at.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T/.test(r.observed_at) ||
      !shaPattern.test(r.prompt_sha256) || !shaPattern.test(r.response_sha256) ||
      !Number.isSafeInteger(r.prompt_chars) || r.prompt_chars < 1 ||
      r.prompt_chars > 16384 ||
      !Number.isSafeInteger(r.response_chars) || r.response_chars < 1 ||
      r.response_chars > MAX_TEXT_BYTES ||
      !Number.isSafeInteger(r.requested_output_token_cap) ||
      r.requested_output_token_cap < 1 || r.requested_output_token_cap > 512 ||
      typeof r.note !== 'string' || r.note.length > 512) {
    throw new ModelDeskError('RECEIPT_CONTRACT_OR_AUTHORITY_INVALID');
  }
  return r;
}
async function sha256(bytesValue, cryptoImpl) {
  if (!cryptoImpl?.subtle?.digest) throw new ModelDeskError('WEBCRYPTO_REQUIRED');
  const hash = await cryptoImpl.subtle.digest('SHA-256', bytesValue);
  return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

export async function verifyPhiServeDraftPair({ receiptBytes, draftBytes, cryptoImpl = globalThis.crypto }) {
  const source = checkReceipt(jsonFromBytes(receiptBytes));
  const raw = bytes(draftBytes,MAX_TEXT_BYTES,'DRAFT_FILE_INVALID_OR_OVERSIZED');
  let draftText;
  try { draftText = new TextDecoder('utf-8',{fatal:true}).decode(raw); }
  catch { throw new ModelDeskError('DRAFT_UTF8_INVALID'); }
  if (!draftText.trim()) throw new ModelDeskError('DRAFT_EMPTY');
  if (draftText.length !== source.response_chars) {
    throw new ModelDeskError('DRAFT_CHARACTER_COUNT_MISMATCH');
  }
  const actualHash = await sha256(raw,cryptoImpl);
  if (actualHash !== source.response_sha256) {
    throw new ModelDeskError('DRAFT_SHA256_MISMATCH');
  }
  const receiptHash = await sha256(receiptBytes,cryptoImpl);
  return Object.freeze({
    source_schema:SOURCE_DRAFT_SCHEMA,
    model_alias:source.model_alias,
    source_request_id:source.request_id,
    observed_at:source.observed_at,
    prompt_sha256:source.prompt_sha256,
    response_sha256:actualHash,
    receipt_file_sha256:receiptHash,
    draft_text:draftText,
    status:'LOCAL_FILE_CONSISTENCY_MATCH_ONLY',
    content_trusted:false,
    provenance_independently_authenticated:false,
    model_executed_independently_witnessed:false,
    physical_gpu_execution_verified:false,
    operator_authority_granted:false,
    tool_execution_authorized:false,
    canonical_runtime_connected:false,
  });
}

export function makePhiServeDeskReview(verified, {
  usefulness, completeness, verification,
  reviewedAt = new Date().toISOString(),
} = {}) {
  if (!verified || verified.status !== 'LOCAL_FILE_CONSISTENCY_MATCH_ONLY' ||
      verified.content_trusted !== false ||
      verified.operator_authority_granted !== false ||
      verified.tool_execution_authorized !== false ||
      verified.canonical_runtime_connected !== false ||
      !shaPattern.test(verified.response_sha256) ||
      !shaPattern.test(verified.receipt_file_sha256)) {
    throw new ModelDeskError('REVIEW_REQUIRES_MATCHED_UNTRUSTED_DRAFT');
  }
  if (!useful.has(usefulness) || !complete.has(completeness) || !checked.has(verification)) {
    throw new ModelDeskError('REVIEW_RATINGS_INVALID');
  }
  if (typeof reviewedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(reviewedAt) ||
      reviewedAt.length > 40) {
    throw new ModelDeskError('REVIEW_TIMESTAMP_INVALID');
  }
  // Allowlisted receipt fields: never serialize draft text, model prompt,
  // token, source receipt object, arbitrary notes or executable directives.
  return Object.freeze({
    schema:MODEL_DESK_SCHEMA,
    review_kind:'EXPLICIT_HUMAN_SELF_REPORT',
    evidence_level:'LOCAL_HASH_MATCH_NOT_INDEPENDENT_AUTHENTICATION',
    source_schema:SOURCE_DRAFT_SCHEMA,
    model_alias:verified.model_alias,
    source_request_id:verified.source_request_id,
    source_response_sha256:verified.response_sha256,
    source_receipt_file_sha256:verified.receipt_file_sha256,
    reviewed_at:reviewedAt,
    usefulness, completeness, verification,
    prompt_included:false, generated_text_included:false,
    bearer_token_included:false, private_memory_accessed:false,
    inference_performed_by_review:false,
    independent_model_execution_attested:false,
    quality_gate_approved:false, model_routing_approved:false,
    operator_authority_granted:false, tool_execution_authorized:false,
    canonical_runtime_connected:false,
    can_promote:false, may_deploy:false,
  });
}
