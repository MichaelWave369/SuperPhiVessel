# Vessie Gateway R1 · Local Model Discovery

**Status:** REFERENCE / LOCAL READ-ONLY / NOT CONNECTED TO REACT / NOT A PRODUCTION PAIRING SERVICE

The gateway's first rung is an operator-run local-only Node 22 service. It reads from the **actual** Ollama daemon on fixed loopback only. It cannot run models, install models, read PV-DLAM memory, change BrainC/P1-C routing, approve providers, or grant authority.

**Do not expose this HTTP endpoint through a reverse proxy or firewall port-forward.** HTTPS browser pairing, per-device identity and authorization remain for R2.

## Quick test (Windows PowerShell)

From a cloned checkout of SuperPhiVessel:

~~~powershell
node packages/vessie-gateway-v0.1/cli.mjs probe
~~~

This reads the local Ollama \`/api/tags\` and \`/api/ps\` endpoints, printing a sanitized read-only discovery result. It works only if Ollama is reachable on its standard local port.

To launch an authenticated loopback API for local command-line programs:

~~~powershell
$env:VESSIE_GATEWAY_TOKEN = (node packages/vessie-gateway-v0.1/cli.mjs token).Trim()
node packages/vessie-gateway-v0.1/cli.mjs start
~~~

The server runs in that terminal and binds \`127.0.0.1:8789\`. In another PowerShell terminal, supply the **same** secret as a process environment variable (do not paste it into an online chat, a public log, a GitHub issue or the GitHub Pages UI):

~~~powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8789/v1/status' -Headers @{Authorization = "Bearer $env:VESSIE_GATEWAY_TOKEN"}
Invoke-RestMethod -Uri 'http://127.0.0.1:8789/v1/models' -Headers @{Authorization = "Bearer $env:VESSIE_GATEWAY_TOKEN"}
~~~

PowerShell environment variables do **not** automatically propagate to an unrelated second terminal. For the second-terminal example, copy the generated token locally using an appropriate protected method. Avoid putting it in shell history or screenshots.

Or simply use the one-shot \`probe\` command without a gateway server for now.

## Hardcoded local network scope

The only Ollama upstream is:

- \`http://127.0.0.1:11434/api/tags\`
- \`http://127.0.0.1:11434/api/ps\`

No remote endpoint, proxy/redirect, arbitrary URL or model execution route exists.

The gateway listens **only** on \`127.0.0.1\`. It requires exactly one \`Authorization: Bearer <64 hex>\` header and the exact loopback Host header. It refuses \`Origin\`, \`Referer\`, browser fetch metadata, forwarding headers, cookies are not used, and sends no CORS allow headers. All APIs are GET-only, responses use \`Cache-Control: no-store\`, and requests never touch memory or provider credentials.

These are defense-in-depth controls for a developer reference, not a substitute for an audited authentication system or TLS.

## Discovery is not model qualification

The model inventory includes only bounded, allowlisted fields:

- model name/tag and optional digest;
- parameter size, quantization and architecture family;
- advertised model weights size;
- whether Ollama currently lists the model as loaded;
- reported loaded VRAM usage.

A \`digest\` is a local Ollama artifact hint, **not yet the full exact P1-C identity tuple** and not a cryptographic attestation.

Each result explicitly says:

~~~text
status = DISCOVERED_NOT_APPROVED
model_ref = null
execution_authorized = false
routing_approved = false
authority_granted = false
~~~

The gateway is not a router and cannot turn discovery into authorization.

## Connectivity states

- \`GET /v1/status\`: the gateway reports \`LOCAL_READ_ONLY\`, \`browser_pairing = NOT_IMPLEMENTED\`, and the absence of BrainC, PV-DLAM, canonical runtime, and cloud model connections.
- \`GET /v1/models\`: probes actual Ollama; \`AVAILABLE\` only when well-formed responses arrive from both tags and running-model APIs.
- If Ollama is unreachable or malformed, \`UNAVAILABLE\` is returned with an explicit bounded error code. No fake model inventory is created.

## Why Pages cannot directly use this

The React cockpit is served over public HTTPS. Browsers enforce network boundary rules and a public webpage must never be told to reach privileged HTTP localhost by embedding a fixed credential.

We deliberately refuse browser cross-origin access in R1.

R2 must separately qualify an authenticated HTTPS trust bridge, operator pairing, short-lived scoped capabilities, disclosure policy, revocation/rotation, and origin confinement. Only then should React display actual live model status. The canonical .54.12 Vessie and .54.13 Physical Observer review hold remain unchanged.

## CI

\`node --test packages/vessie-gateway-v0.1/tests/*.test.mjs\` exercises fixed local probe paths, schema sanitation, missing Ollama, oversized inputs, invalid startup secrets, read-only routes, unauthorized probes, browser Origin denials, no model execution, and DNS-rebinding Host denial. CI uses fixtures and does not claim a real local workstation was inspected.
