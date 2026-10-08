import { createHash } from 'node:crypto';

export const OLLAMA_ORIGIN = 'http://127.0.0.1:11434';
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_MODELS = 256;

const boundedString = (value, max = 128) =>
  typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value)
    ? value : null;
const bytes = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value : null;

function sanitizeModel(raw, runningByName) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = boundedString(raw.name ?? raw.model);
  if (!name) return null;
  const digest = boundedString(raw.digest, 160);
  const details = raw.details && typeof raw.details === 'object' ? raw.details : {};
  const current = runningByName.get(name);
  return {
    name,
    source: 'OLLAMA_LOCAL_PROBE',
    status: 'DISCOVERED_NOT_APPROVED',
    model_ref: null,
    digest: digest && /^[a-f0-9]{32,128}$/i.test(digest) ? digest : null,
    size_bytes: bytes(raw.size),
    quantization: boundedString(details.quantization_level, 48),
    parameter_size: boundedString(details.parameter_size, 48),
    family: boundedString(details.family, 80),
    loaded: !!current,
    runtime_vram_bytes: current ? bytes(current.size_vram) : null,
    locality: 'LOCAL',
    execution_authorized: false,
    routing_approved: false,
  };
}

async function readJson(response) {
  if (!response.ok) throw new Error('OLLAMA_HTTP_FAILURE');
  const type = response.headers.get('content-type');
  if (!type || !type.toLowerCase().includes('application/json')) throw new Error('OLLAMA_INVALID_TYPE');
  const advertised = response.headers.get('content-length');
  if (advertised && Number(advertised) > MAX_RESPONSE_BYTES) throw new Error('OLLAMA_RESPONSE_TOO_LARGE');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('OLLAMA_EMPTY_RESPONSE');
  let count = 0;
  const parts = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('OLLAMA_RESPONSE_TOO_LARGE');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(parts.map(x => Buffer.from(x)));
  let data;
  try { data = JSON.parse(body.toString('utf8')); }
  catch { throw new Error('OLLAMA_INVALID_JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('OLLAMA_INVALID_BODY');
  return data;
}

export async function discoverOllama({ fetchImpl = fetch } = {}) {
  const get = async (route) => {
    const response = await fetchImpl(OLLAMA_ORIGIN + route, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(1800),
    });
    return readJson(response);
  };
  try {
    const [tags, active] = await Promise.all([get('/api/tags'), get('/api/ps')]);
    if (!Array.isArray(tags.models) || !Array.isArray(active.models)) {
      throw new Error('OLLAMA_INVALID_MODELS');
    }
    if (tags.models.length > MAX_MODELS || active.models.length > MAX_MODELS) {
      throw new Error('OLLAMA_MODEL_COUNT_EXCEEDED');
    }
    const running = new Map();
    for (const model of active.models) {
      const name = boundedString(model?.name ?? model?.model);
      if (name) running.set(name, model);
    }
    const models = tags.models.map(model => sanitizeModel(model, running))
      .filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'en'));
    const seen = new Set();
    const unique = models.filter(model => {
      if (seen.has(model.name)) return false;
      seen.add(model.name); return true;
    });
    const snapshotHash = createHash('sha256')
      .update(JSON.stringify(unique)).digest('hex');
    return {
      schema: 'superphivessel.gateway.models.v0.1',
      provider: 'OLLAMA',
      provider_origin: 'LOCAL_LOOPBACK_FIXED',
      probe_status: 'AVAILABLE',
      model_count: unique.length,
      loaded_model_count: unique.filter(x=>x.loaded).length,
      models: unique,
      snapshot_hash: snapshotHash,
      authority_granted: false,
      can_execute: false,
      can_install: false,
      can_approve_models: false,
    };
  } catch (error) {
    // Do not expose external response data, connection details or stack traces.
    return {
      schema: 'superphivessel.gateway.models.v0.1',
      provider: 'OLLAMA',
      provider_origin: 'LOCAL_LOOPBACK_FIXED',
      probe_status: 'UNAVAILABLE',
      error_code: error?.message === 'OLLAMA_RESPONSE_TOO_LARGE' ? 'OLLAMA_RESPONSE_TOO_LARGE' :
        error?.message === 'OLLAMA_INVALID_MODELS' ||
        error?.message === 'OLLAMA_MODEL_COUNT_EXCEEDED' ? 'OLLAMA_INVALID_MODELS' :
        'OLLAMA_UNAVAILABLE_OR_INVALID',
      model_count: 0,
      loaded_model_count: 0,
      models: [],
      snapshot_hash: null,
      authority_granted: false,
      can_execute: false,
      can_install: false,
      can_approve_models: false,
    };
  }
}
