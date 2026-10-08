import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { discoverOllama } from './ollama-probe.mjs';

const LOOPBACK = '127.0.0.1';
const READ_PATHS = new Set(['/v1/status', '/v1/models']);

function validToken(token) {
  return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
}

function equalBearer(authorization, token) {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return false;
  const supplied = authorization.slice(7);
  if (supplied.length > 128) return false;
  const hash = (v) => createHash('sha256').update(v).digest();
  return timingSafeEqual(hash(supplied), hash(token));
}

function response(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, private',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'",
  });
  res.end(JSON.stringify(data));
}

function forbidden(res) {
  response(res, 403, { error: 'ACCESS_DENIED', authority_granted: false });
}

export async function startGateway({ token, port = 0, probe = discoverOllama } = {}) {
  if (!validToken(token)) throw new Error('A fresh 64-character hex VESSIE_GATEWAY_TOKEN is required');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('port must be 0..65535');
  const server = createServer(async (req, res) => {
    // Refuse browser Origin requests entirely in R1, including Pages, to avoid
    // teaching clients an unsafe HTTPS->localhost HTTP pairing pattern.
    // No CORS, no cookies, no credentialed cross-origin browser support.
    if (req.headers.origin || req.headers.referer || req.headers['sec-fetch-site']) {
      return forbidden(res);
    }
    if (req.headers['x-forwarded-host'] || req.headers['x-forwarded-for'] ||
        req.headers['forwarded'] || req.headers['proxy-authorization']) {
      return forbidden(res);
    }
    const expectedHost = LOOPBACK + ':' + server.address().port;
    if (req.headers.host !== expectedHost) return forbidden(res);
    const headerNames = req.rawHeaders.filter((v,i)=>i%2===0).map(x=>x.toLowerCase());
    if (headerNames.filter(x=>x==='authorization').length !== 1) return forbidden(res);
    if (!equalBearer(req.headers.authorization, token)) return forbidden(res);
    if (req.method !== 'GET') {
      response(res, 405, { error: 'READ_ONLY', authority_granted: false });
      return;
    }
    if (req.headers['transfer-encoding'] || req.headers['content-length']) return forbidden(res);
    if (!READ_PATHS.has(req.url)) {
      response(res, 404, { error: 'NOT_AVAILABLE', authority_granted: false });
      return;
    }
    if (req.url === '/v1/status') {
      response(res, 200, {
        schema: 'superphivessel.gateway.status.v0.1',
        gateway_status: 'LOCAL_READ_ONLY',
        host_binding: '127.0.0.1',
        browser_pairing: 'NOT_IMPLEMENTED',
        backend_routes: ['GET /v1/status', 'GET /v1/models'],
        model_probe_mode: 'ON_DEMAND',
        cloud_providers_connected: false,
        memory_connected: false,
        brainc_connected: false,
        canonical_runtime_connected: false,
        action_authority: 'NONE',
        authority_granted: false,
      });
      return;
    }
    try {
      const data = await probe();
      response(res, data?.probe_status === 'AVAILABLE' ? 200 : 503, data);
    } catch {
      response(res, 503, { error: 'OLLAMA_PROBE_UNAVAILABLE', authority_granted: false });
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 3000;
  server.maxHeadersCount = 32;
  server.maxRequestsPerSocket = 25;
  server.listen(port, LOOPBACK);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return server;
}
