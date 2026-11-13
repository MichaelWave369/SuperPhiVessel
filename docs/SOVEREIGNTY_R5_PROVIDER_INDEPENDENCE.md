# Vessie Sovereignty R5 · Local Provider Independence Rehearsal

**Scope:** a read-only capability-degradation display in Vessie's EXISTING localhost console. This is a provider-choice *rehearsal*, not a new provider gateway, runtime switch, full restored AI assistant, or real hardware acceptance.

## What the operator sees

The `Sovereignty · Provider Independence` panel in the local console offers three explicit planning choices: **No inference**, **Ollama local**, and **PhiServe local**. Changing this setting only recomputes explanatory text in the browser; it never changes model routing, model selection in either inference form, process flags, browser storage, login identity, memory, or tool permissions.

- Ollama: only the existing button-initiated `/api/models` inventory and separate `/api/status` startup flag are used. A positive local-size report allows the panel to *describe* the existing one-shot trial path only when the operator separately enabled it; cloud references and unknowns cannot count as local weights.
- PhiServe: the panel NEVER probes the daemon, reads a token, or presumes an available model. When enabled at process startup it still reports `SEPARATE_DISCOVERY_REQUIRED`. The pre-existing Model Desk must explicitly discover aliases and obtain approval for each prompt.
- No inference: no model is selected and no automatic provider fallback is planned.

In all states, the portable records reader is a **separate offline utility**, canonical Vessie provider routing is **not connected**, and tool/memory/execution authority stays **NONE**. The panel itself is not proof that hosted BrainC is absent from the separately deployed canonical Vessie runtime. It does not claim independent hardware attestation.

## Provider-absent acceptance matrix

| Operator preference | Evidence or mode | Correct report |
|---|---|---|
| No inference | No scan | `OFF_BY_OPERATOR_CHOICE` |
| Ollama | No scan | `NOT_SCANNED` |
| Ollama | Scan failed or unavailable | `BACKEND_UNAVAILABLE` |
| Ollama | Only cloud references or unknown locations | `NO_LOCAL_WEIGHTS_REPORTED` |
| Ollama | Local size-positive model, default startup | `OPERATOR_STARTUP_REQUIRED` |
| Ollama | Local size-positive model, explicit local-trial startup | `EXPLICIT_ONE_SHOT_APPROVAL_REQUIRED` |
| PhiServe | Default startup | `OPERATOR_STARTUP_REQUIRED` |
| PhiServe | Explicit desk startup | `SEPARATE_DISCOVERY_REQUIRED` |

The statuses do not authorize execution, route promotion, persistence, cloud billing or a subsequent model request. An absent backend is never silently switched to a second backend.

## Test and field gates

Reproducible synthetic tests:
```bash
node --test packages/vessie-local-console/tests/provider-independence.test.mjs packages/vessie-local-console/tests/server.test.mjs
node --check packages/vessie-local-console/ui/provider-independence.mjs
node --check packages/vessie-local-console/ui/app.js
```

On a real Windows device: launch the default read-only console and choose each provider before and after a read-only Ollama scan; stop Ollama and rescan to confirm graceful degradation; distinguish cloud references; relaunch using the explicit Ollama or PhiServe opt-in entrypoint only if desired. Test real local inference **only** through the pre-existing per-prompt approval controls, never through this panel. Verify the Windows ZIP contains `provider-independence.mjs` and all UI scripts load with no 404.

**Still unverified:** device acceptance, local PhiServe daemon availability, private-file ACLs, missing hosted provider while canonical Vessie is running, model quality, backend interchangeability, full record restore, deletion/revocation and weight licensing. Issue #91 was already closed before this PR; this addition does not retroactively satisfy its unverified physical criteria. Physical Observer HOLD remains separate.
