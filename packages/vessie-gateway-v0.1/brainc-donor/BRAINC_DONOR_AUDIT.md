# BrainC Donor R3-B · Source-specific configuration telemetry

**Status:** EXTRACTED READ-ONLY LOCAL PROBE / NO LIVE PER-REQUEST ROUTING TRACES / NOT BROWSER WIRED

The public [BrainC](https://github.com/MichaelWave369/BrainC) repository was inspected before authoring this adapter.

## Source evidence (repository main, 2026-10-08)

| Source | Git blob SHA | Observed behavior |
| --- | --- | --- |
| `api/routes/models.py` | `98d4f2e78001cecd763151c099b22674d42118c1` | GET `/models` returns `{models: [...], active: active_model_name()}`; GET `/models/active` returns `{model: active_model_name()}`. POST `/models/switch` is admin-gated and writes model choice to `.env`. |
| `api/core/queue.py` | `be2906df5447d9a035825d4be336342e7ab507af` | `active_model_name()` returns the process-local `_active_model` setting. |
| `api/routes/chat.py` | `dc4bad1b13af21e216773e8276ee257c22f202b5` | Chat selects `prefs.get('model', MODEL_NAME)` where `MODEL_NAME` is `braincbrain`. The endpoint can also invoke tools, retrieve memory and stream Ollama generation. |
| `api/core/audit.py` | `28da01dd7d5cc5c6e93a3eb6cb1029c206e5856f` | Defines an audit action for model switching, but that is not a per-inference route receipt. |

### Major correctness finding

**Configured active model and actually executed chat model are not the same claim.** BrainC's global active setting can differ from a user preference or chat's `MODEL_NAME` fallback. Current source does not expose a canonical per-request authenticated Crane Fly/P1-C-style receipt. Therefore R3-B does **not** claim to observe execution decisions, Genius activation or quality outcomes.

Further, the exposed BrainC v1 API is a local model switcher and Ollama assistant. The GA108/Crane Fly orchestration in SuperPhiVessel is a distinct runtime ownership boundary. **Never rename a BrainC configured-model snapshot to a Crane Fly trace.**

## What R3-B implements

`config-probe.mjs` makes exactly two GET requests, with no redirection, to:

```text
http://127.0.0.1:8000/models
http://127.0.0.1:8000/models/active
```

The v1 source handlers are read-only. R3-B never supplies credentials, requests a chat, invokes tools, executes a model or switches the model.

The returned configuration snapshot distinguishes:

- `model_count`: locally reported available Ollama model tags;
- `configured_active_model`: value reported consistently by both endpoints;
- `configured_active_in_inventory`: whether the configured tag is present in the reported inventory;
- `execution_observed = false`;
- `per_request_effective_model = UNKNOWN`;
- `brainc_crane_fly_receipt_observed = false`;
- `brainc_routing_trace_verified = false`;
- `model_artifacts_qualified = false`;
- `authority_granted = false`.

An endpoint mismatch yields `CONFIGURATION_DISAGREEMENT` and refuses the claimed active identity. Empty/malformed/unavailable API responses produce `UNAVAILABLE`, not a fake connected status.

## Operator PowerShell example

With BrainC's local FastAPI server *already running* on port 8000:

```powershell
node packages/vessie-gateway-v0.1/brainc-donor/cli.mjs probe
```

This prints a **redacted JSON report**, safe to inspect/share after operator review. It does not include any raw model tags. For operator-only troubleshooting:

```powershell
node packages/vessie-gateway-v0.1/brainc-donor/cli.mjs probe --local-names
```

The second command reveals your local model tags **in that terminal only**; do not paste it into public issues or screenshots. It does not contact the cloud.

### Why this is not the R2 browser gateway

The R2 HTTPS browser pairing/physical Windows pilot is still pending operator machine evidence. This module does not add BrainC to R2's existing `/v1/models` endpoint, does not introduce an unaudited `/v1/brainc` path, and does not create a privileged credential relay from the public GitHub Pages origin.

## Validation and next rung

CI fixtures test local-only GET paths, bounded JSON, injection and oversized input, absence of model-switch POST, inconsistent endpoints, missing configured model, redacted reports and no authority/execution claims.

Next: after physical R2 trust qualification and review of actual live Crane Fly/Vessie source, introduce a separately scoped operator-read-only **routing receipt producer** that captures *per-request model identity, policy epoch, and outcome evidence* at the canonical routing boundary, without capturing prompts or memory or granting actions.

If this per-request receipt cannot be observed, the UI must continue to show `EXECUTED_MODEL_UNKNOWN` rather than guessing from global configuration.
