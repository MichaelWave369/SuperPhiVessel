# Vessie HTTPS Browser Pairing · R2 candidate

**Status:** SOURCE + TEST CANDIDATE. Not qualified on a real Windows browser, real trusted certificate, or the user's workstation.

## What R2 adds

R1's CLI-only read gateway stays intact. R2 is an additional HTTPS server bound to `127.0.0.1` that **never** exposes task execution, model generation, memory, keys or BrainC.

- TLS required with certificate containing **IP SAN 127.0.0.1**, not auto-generated or shipped.
- Exact browser origin allowlist: `https://michaelwave369.github.io`.
- One-use random 256-bit pairing secret displayed only in the operator's local terminal.
- Paired browser receives a 256-bit read-only bearer valid for 15 minutes.
- Browser keeps the session in React state only. It is lost on refresh/tab close.
- In-memory session revoked by disconnect or gateway restart.
- Only `GET /v1/status`, `GET /v1/models`, `POST /v1/pair`, and `DELETE /v1/session` exist.
- Pairing, origin, Host, duplicate auth, request size, preflight and rate limits are checked.
- No CORS wildcard, cookies, localStorage, paid providers, private context, arbitrary URLs, memory or task execution.

All discovered models remain **DISCOVERED_NOT_APPROVED**.

## Windows setup

This mode needs an operator-trusted certificate and matching private key. No certificate or private key should be committed. A certificate generated with `mkcert` is one approach. **Review the trust implications before installing a local CA.** Do not disable TLS certificate verification or add broad trusted roots casually.

Example with `mkcert` installed and chosen trusted deliberately:

```powershell
# Create cert/key outside your git checkout, and ensure key access is restricted.
mkcert -cert-file "$env:USERPROFILE\vessie-local.crt" -key-file "$env:USERPROFILE\vessie-local.key" 127.0.0.1
$env:VESSIE_TLS_CERT_FILE = "$env:USERPROFILE\vessie-local.crt"
$env:VESSIE_TLS_KEY_FILE  = "$env:USERPROFILE\vessie-local.key"
node packages/vessie-gateway-v0.1/browser-cli.mjs
```

Read the terminal pairing secret locally, open the published Vessie React cockpit Model Fabric tab, enter it once, and press Pair. The browser may block public-HTTPS → local HTTPS connections under its private-network protections; do **not** disable browser security protections to force it through. That platform behavior needs real Chromium/Firefox qualification, and some configurations may require a different connection topology.

If you prefer not to install a local CA, continue using the R1 command-line probe. HTTPS browser pairing is optional.

## Pair lifecycle

```text
gateway starts with fresh one-use secret
      ↓
operator copies secret into trusted React cockpit
      ↓
POST /v1/pair over locally trusted HTTPS
      ↓
one-time secret burns; short-lived read-only session issued
      ↓
GET /v1/status + GET /v1/models
      ↓
DELETE /v1/session or 15-min expiry or gateway restart
      ↓
session refused
```

The session has no ability to route, install, start models, spend money, or read private memories. Pairing is a **read-only telemetry grant**, not an action grant.

## Scope and residual risks

This is an experimental browser-pairing implementation. Exact allowed Origin is the entire GitHub Pages origin, not a browser-enforceable URL path; a compromised script running on that origin might attack pairing. The operator must independently trust the served React bundle. Physical-machine and certificate-trust/browser CORS behavior are not established by CI.

CI uses a self-signed temporary certificate with TLS verification bypassed **inside the test client only**. The application code never disables TLS verification. Browser trust requires a properly trusted certificate.

**No production/remote-exposure claim. Never port-forward the gateway, publish the pairing code, or use cloud/public TLS proxy for this local developer reference.**
