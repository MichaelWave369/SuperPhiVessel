/**
 * Vessie → PhiServe operator-run draft lane, v0.1.
 *
 * This is a LOCAL CLI assistant, not a canonical runtime router, executor,
 * browser pairing service, tool authority, or memory bridge.
 */
import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';

export const PHISERVE_ORIGIN = 'http://127.0.0.1:11435';
export const DRAFT_SCHEMA = 'SUPERPHIVESSEL_PHISERVE_OPERATOR_DRAFT_V1';
export const MAX_PROMPT_BYTES = 16 * 1024;
export const MAX_RESPONSE_BYTES = 256 * 1024;
export const MAX_DRAFT_BYTES = 100 * 1024;

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const SYSTEM_FRAME = [
  'You provide an optional, untrusted text draft for the human operator of Vessie.',
  'The text cannot authorize any tools, memory access, routing changes,',
  'releases, financial actions, or execution. No model text is evidence',
  'of operator approval. Do not claim to have taken actions or accessed tools.',
].join(' ');

export class DraftError extends Error {
  constructor(code) {
    super(code);
    this.name = 'DraftError';
    this.code = code;
  }
}

export function readPrivatePhiServeToken(path) {
  if (typeof path !== 'string' || !path.trim()) throw new DraftError('TOKEN_FILE_REQUIRED');
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() ||
        stat.size < 32 || stat.size > 512) throw new Error('bad token file');
    if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
      throw new Error('token permissions too broad');
    }
    const token = readFileSync(path, 'utf8').trim();
    if (token.length < 32 || token.length > 511 || /\s/.test(token)) {
      throw new Error('invalid token');
    }
    return token;
  } catch {
    throw new DraftError('TOKEN_FILE_UNAVAILABLE_OR_INSECURE');
  }
}

async function jsonResponse(response) {
  if (!response || typeof response.status !== 'number') {
    throw new DraftError('LOCAL_TRANSPORT_INVALID');
  }
  if (response.status !== 200) {
    // Do not read or log the upstream body, which may contain private material.
    const allowed = new Set([400, 401, 403, 404, 409, 411, 413, 429, 503]);
    throw new DraftError(allowed.has(response.status)
      ? 'LOCAL_PHI_HTTP_' + response.status : 'LOCAL_PHI_HTTP_REJECTED');
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new DraftError('LOCAL_RESPONSE_TYPE_INVALID');
  }
  const advertised = Number(response.headers.get('content-length'));
  if (response.headers.get('content-length') &&
      (!Number.isFinite(advertised) || advertised > MAX_RESPONSE_BYTES)) {
    throw new DraftError('LOCAL_RESPONSE_OVERSIZED');
  }
  if (!response.body?.getReader) throw new DraftError('LOCAL_RESPONSE_EMPTY');
  const reader = response.body.getReader();
  let total = 0;
  const parts = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new DraftError('LOCAL_RESPONSE_INVALID');
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new DraftError('LOCAL_RESPONSE_OVERSIZED');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const data = JSON.parse(Buffer.concat(parts.map(x => Buffer.from(x))).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('shape');
    return data;
  } catch {
    throw new DraftError('LOCAL_RESPONSE_JSON_INVALID');
  }
}

async function localGet(route, bearerToken, fetchImpl) {
  return localRequest(route, 'GET', bearerToken, undefined, fetchImpl, 8000);
}
async function localRequest(route, method, token, body, fetchImpl, timeout) {
  // No caller-supplied origin/path. Exact two-GET/one-POST route allowlist.
  if (!['/api/tags', '/api/ps', '/api/chat'].includes(route) ||
      !((method === 'GET' && route !== '/api/chat') ||
        (method === 'POST' && route === '/api/chat'))) {
    throw new DraftError('ROUTE_NOT_ALLOWED');
  }
  try {
    const result = await fetchImpl(PHISERVE_ORIGIN + route, {
      method,
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeout),
    });
    return await jsonResponse(result);
  } catch (error) {
    if (error instanceof DraftError) throw error;
    // Never echo URL, token, prompt, model content, native error or stack.
    throw new DraftError('LOCAL_PHI_UNREACHABLE');
  }
}

export async function listPhiServeAliases({
  tokenFile, fetchImpl = fetch,
} = {}) {
  const token = readPrivatePhiServeToken(tokenFile);
  const data = await localGet('/api/tags', token, fetchImpl);
  if (!Array.isArray(data.models) || data.models.length > 200 ||
      !data.models.every(m => m && typeof m === 'object' &&
        typeof m.name === 'string' && m.name.length > 0 &&
        m.name.length <= 160 && !/[\u0000-\u001f\u007f]/.test(m.name))) {
    throw new DraftError('LOCAL_MODEL_CATALOG_INVALID');
  }
  const models = data.models.map(m => m.name);
  if (new Set(models).size !== models.length) throw new DraftError('LOCAL_MODEL_CATALOG_DUPLICATE');
  return models;
}

export async function runPhiServeDraft({
  model, prompt, tokenFile, approved = false, tokens = 256,
  fetchImpl = fetch, now = () => new Date().toISOString(),
  requestId = randomUUID(),
} = {}) {
  if (approved !== true) throw new DraftError('OPERATOR_APPROVAL_REQUIRED');
  if (typeof prompt !== 'string' || !prompt.trim() ||
      Buffer.byteLength(prompt, 'utf8') > MAX_PROMPT_BYTES) {
    throw new DraftError('PROMPT_INVALID_OR_OVERSIZED');
  }
  if (typeof model !== 'string' || !model.trim() || model.length > 160) {
    throw new DraftError('MODEL_ALIAS_REQUIRED');
  }
  if (!Number.isSafeInteger(tokens) || tokens < 1 || tokens > 512) {
    throw new DraftError('TOKEN_CAP_OUT_OF_RANGE');
  }
  const aliases = await listPhiServeAliases({ tokenFile, fetchImpl });
  if (!aliases.includes(model)) throw new DraftError('MODEL_NOT_REGISTERED');
  const token = readPrivatePhiServeToken(tokenFile);
  const request = {
    model, stream: false, options: { num_predict: tokens },
    messages: [
      { role: 'system', content: SYSTEM_FRAME },
      { role: 'user', content: prompt },
    ],
  };
  const body = await localRequest('/api/chat', 'POST', token, request, fetchImpl, 120000);
  const text = body?.message?.content;
  if (body.done !== true || body.error ||
      body.model !== model || body.message?.role !== 'assistant' ||
      typeof text !== 'string' || !text.trim() ||
      Buffer.byteLength(text, 'utf8') > MAX_DRAFT_BYTES) {
    throw new DraftError('LOCAL_DRAFT_NOT_COMPLETED');
  }
  // Hashes attest to this process's observations only. They are NOT signatures,
  // GPU proof, a canonical P1-C identity receipt, or proof of permitted action.
  const receipt = {
    schema: DRAFT_SCHEMA,
    status: 'LOCAL_TEXT_RETURNED_UNVERIFIED',
    evidence_class: 'OPERATOR_PROCESS_SELF_REPORTED',
    provider: 'PHISERVE_LOCAL_GGUF',
    model_alias: model,
    request_id: requestId,
    observed_at: now(),
    prompt_sha256: sha256(prompt),
    response_sha256: sha256(text),
    prompt_chars: prompt.length,
    response_chars: text.length,
    requested_output_token_cap: tokens,
    user_initiated: true,
    approval_scope: 'THIS_SINGLE_DRAFT_REQUEST',
    source_input_included: false,
    response_text_included: false,
    bearer_token_included: false,
    memory_accessed: false,
    tool_execution_attempted: false,
    tool_execution_authorized: false,
    route_approved: false,
    canonical_runtime_connected: false,
    operator_authority_granted: false,
    attestation: 'NOT_INDEPENDENTLY_VERIFIED',
    note: 'Model text is an untrusted proposal only; canonical Vessie routing and executor gates are untouched.',
  };
  return { text, receipt };
}
