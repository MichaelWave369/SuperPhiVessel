# Vessie Gateway v0.1 · proposed connection contract

**Status:** R1 LOCAL READ-ONLY REFERENCE AVAILABLE · BROWSER PAIRING, HOSTED BACKEND AND TASK EXECUTION UNIMPLEMENTED

GitHub Pages hosts HTML/CSS/JS, not an authorized memory/router/executor. A public React site must never contain remote API secrets or automatically connect to local Ollama.

## Deployment topology

```text
GitHub Pages /SuperPhiVessel/vessie/ (public, static)
      ↓ explicitly paired HTTPS origin, authenticated session
Vessie Gateway (operator-controlled local agent or Netlify server)
      ↓ signed/tightly scoped read and route interfaces
BrainC · Ollama · PV-DLAM · SFR · BudgetGenius · Reality Gate
      ↓ provider adapters, keys stay server-side
local and approved remote model providers
```

## Proposed read-only endpoints before any chat

- `GET /v1/status` : current, short-lived signed service capability/health envelope.
- `GET /v1/models` : measured/approved models and provider allowance; not secrets.
- `GET /v1/routing/trace/:id` : operator-authorized redacted receipt and canonical signature/evidence verification.
- `GET /v1/genius/:profileId` : authorized status summary only, not raw private memory.

All routes default to DENIED/UNAVAILABLE until the operator has paired the gateway and explicitly selected the trust domain.

## Future task path (NOT implemented by the React preview)

`POST /v1/tasks/propose` would accept bounded, typed intent and desired recipients; it may propose a route, not execute.
`POST /v1/tasks/:id/execute` would require explicit current executor authorization and a short-lived operator-approved lease. Do not expose this endpoint until later integration qualification.

## Hard security requirements

- HTTPS for the browser-facing gateway, authenticated pairing, exact origin allowlist, CSRF defenses where cookies apply.
- Never use browser localStorage, static build constants or public repo for provider keys or authority credentials.
- Server-side egress restriction and URL allowlists; forbid client-supplied arbitrary backend URLs and open proxies.
- Bound request size, budget, token exposure, failure retries, rate limits and per-task timeout.
- Per-recipient memory disclosure gate before a hosted provider sees bytes.
- Revocation has precedence over cache/session and pending queues; stale leases fail closed.
- Independent executor authorization after route influence; BudgetGenius cannot mint grants.
- Every important request/response has exact model identity, policy epoch, context manifest, request/response hashes and receipt.
- Treat client-supplied JSON and fingerprints as untrusted; a parsed receipt is NOT signature verification.

## Front-end preview boundary

The first React deployment is functional as a GA108 explorer, model-candidate inventory, topology view and locally bounded receipt inspector. It makes **zero model calls** and has no chat claim.
Before connecting any new service, independently verify canonical runtime `.54.12` permissions and `.54.13` hold; do not expose an old unrestricted endpoint for convenience.


## R1 concrete read-only reference

The first local gateway reference now lives in
[`packages/vessie-gateway-v0.1/`](../../packages/vessie-gateway-v0.1/).

It probes fixed loopback Ollama GET endpoints with bounded, sanitized results and
offers token-gated CLI-accessible `GET /v1/status` and `GET /v1/models` only.
It refuses all cross-origin browser requests, including GitHub Pages, until
a separately qualified HTTPS pairing path exists.

R1 is **not** the browser-capable gateway described by the target contract.
No BrainC, task routing, private memory or remote-provider secrets are connected.
