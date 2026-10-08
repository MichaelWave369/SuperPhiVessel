import { createHash } from 'node:crypto';

const BRAINC_ORIGIN = 'http://127.0.0.1:8000';
const PATHS = ['/models', '/models/active'];
const MAX_BYTES = 65536;
const MAX_MODELS = 128;
const NAME_PATTERN = /^[^\u0000-\u001f\u007f<>]{1,128}$/u;
const SCHEMA = 'superphivessel.gateway.r3b.brainc-configuration.v0.1';

function safeName(value) {
  if (typeof value !== 'string' || !NAME_PATTERN.test(value) ||
      value.trim() !== value) return null;
  return value;
}

async function readLimitedJson(response) {
  if (!response?.ok) throw new Error('BRAINC_SOURCE_HTTP');
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('BRAINC_SOURCE_TYPE');
  }
  const headerLength = response.headers.get('content-length');
  if (headerLength !== null && Number(headerLength) > MAX_BYTES) {
    throw new Error('BRAINC_SOURCE_TOO_LARGE');
  }
  if (!response.body) throw new Error('BRAINC_SOURCE_BODY_MISSING');
  const reader = response.body.getReader();
  const pieces = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new Error('BRAINC_SOURCE_TOO_LARGE');
      }
      pieces.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  let obj;
  try { obj = JSON.parse(Buffer.concat(pieces).toString('utf8')); }
  catch { throw new Error('BRAINC_SOURCE_JSON'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('BRAINC_SOURCE_INVALID');
  }
  return obj;
}

function base(status, fields = {}) {
  return {
    schema: SCHEMA,
    source: 'BRAINC_V1_LOCAL_READ_ONLY_API',
    probe_status: status,
    source_class: 'UNATTESTED_LOCAL_PROCESS',
    configuration_only: true,
    execution_observed: false,
    executed_model_ref: null,
    per_request_effective_model: 'UNKNOWN',
    per_user_model_preference_inspected: false,
    brainc_crane_fly_receipt_observed: false,
    brainc_routing_trace_verified: false,
    model_artifacts_qualified: false,
    activation_allowed: false,
    may_change_live_route: false,
    can_execute: false,
    can_change_active_model: false,
    authority_granted: false,
    ...fields,
  };
}

export async function probeBrainC({ fetchImpl = fetch } = {}) {
  async function request(path) {
    const result = await fetchImpl(BRAINC_ORIGIN + path, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(1800),
    });
    return readLimitedJson(result);
  }
  try {
    const [catalog, active] = await Promise.all(PATHS.map(request));
    if (!Array.isArray(catalog.models) || catalog.models.length > MAX_MODELS ||
        !safeName(catalog.active) || !safeName(active.model)) {
      throw new Error('BRAINC_SOURCE_INVALID');
    }
    const names = catalog.models.map(safeName);
    if (names.some(x => x === null) || names.length !== new Set(names).size) {
      throw new Error('BRAINC_SOURCE_INVALID');
    }
    names.sort((a,b)=>a.localeCompare(b,'en'));
    if (catalog.active !== active.model) {
      return base('CONFIGURATION_DISAGREEMENT', {
        model_count: names.length,
        configured_active_model: null,
        configured_active_in_inventory: null,
        models: [],
        reason: 'BRAINC_ACTIVE_ENDPOINTS_DISAGREE',
      });
    }
    const configured_active_model = active.model;
    const checksum = createHash('sha256')
      .update(JSON.stringify({ models:names,configured_active_model })).digest('hex');
    return base('AVAILABLE', {
      model_count: names.length,
      configured_active_model,
      configured_active_in_inventory: names.includes(configured_active_model),
      models: names.map(name=>({
        name, locality: 'BRAIN_CATALOG_REPORT',
        source: 'BRAINC_MODELS_ENDPOINT',
        routing_approved: false, execution_authorized: false,
        exact_model_ref: null,
      })),
      local_configuration_checksum: checksum,
    });
  } catch {
    return base('UNAVAILABLE', {
      model_count: 0,
      configured_active_model: null,
      configured_active_in_inventory: null,
      models: [],
      reason: 'BRAINC_API_UNAVAILABLE_OR_INVALID',
    });
  }
}

// Safe to share as a review artifact. Exact local model names are not included.
export function redactBrainCConfig(probe) {
  if (!probe || probe.schema !== SCHEMA ||
      !['AVAILABLE','UNAVAILABLE','CONFIGURATION_DISAGREEMENT'].includes(probe.probe_status)) {
    throw new Error('BRAINC_PROBE_SCHEMA_INVALID');
  }
  const count = Number.isSafeInteger(probe.model_count) && probe.model_count >= 0 &&
    probe.model_count <= MAX_MODELS ? probe.model_count : null;
  return base(probe.probe_status, {
    model_count: count,
    configured_active_model: null,
    configured_active_in_inventory: typeof probe.configured_active_in_inventory === 'boolean' ?
      probe.configured_active_in_inventory : null,
    model_names_redacted: true,
    local_configuration_checksum: null,
    source_authenticity_attested: false,
    operator_review_required: true,
    models: [],
  });
}
