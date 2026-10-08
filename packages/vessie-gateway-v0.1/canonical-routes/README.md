# Vessie R3-C — Canonical Native Routing Evidence Projector

**Status:** EXTRACTED / OFFLINE / OPERATOR-EXPORTED RECORDS / NOT LIVE BROWSER WIRED

R3-C reviews and projects evidence already present in the frozen `.54.12` SuperPhiVessel runtime. It does **not** patch the 13 MB production HTML, alter live routing, install models, or run an executor.

## Audited canonical source

The canonical manifest pins:

- Runtime `v2.0-alpha.11.0.54.12` (`BudgetGenius Canonical Outcome Handoff`).
- SHA-256 `a9e67b12d1c3622315b6937f1c2405acbd5b2a6bc6d32cf578c67d5178fa7212`.
- Git blob `c9dc18eb76be9883d18014de129c07cf78c5a498`.

The exact canonical blob was inspected. Existing runtime functions/records include:

| Source | Existing meaning | Limitation |
| --- | --- | --- |
| `frozenRunCapsule` / `PhiRunCapsule` | Frozen request context, approved model pool, role mappings, routing mode, task hash and a `fastHash` | A frozen plan is not a dispatch. `fastHash` is not attested proof. |
| `brainRouteRole` / `BrainRouteReceipt` | Configured, recommended, selected model and mode | Selection is not authorization or execution. |
| `executorAuthorizationDecision` / `ExecutorAuthorizationReceipt` | Per-request permission decision, provider, model, role, run-capsule link | An authorized route may never be attempted. |
| `attemptLedgerRecord` / attempt row | Per-run/provider/model/role status `DISPATCH_STARTED`, `COMPLETED`, or `FAILED`, authorization receipt ID and latency | Recorded completion is not independently verified response quality. |
| `budgetGeniusCanaryRuntimeInfluence` / `BudgetGeniusCanaryInfluenceReceipt` | One-shot local route influence, explicitly `executionAuthorized=false`, `mayDispatch=false` | Still requires subsequent Executor Authorization; paid spend remains zero. |

The `PhiRunCapsule` and authorization receipt hash the existing native objects with `fastHash`. This module **does not** pretend those source fields are cryptographic signatures or independently attested. The R3-C projector's SHA-256 is a checksum of its own redacted result only.

## Honest evidence ladder

```text
FROZEN_RUN_ONLY
  ↓ optional BrainRouteReceipt
SELECTION_ONLY
  ↓ optional ExecutorAuthorizationReceipt
AUTHORIZED_NOT_OBSERVED_EXECUTING   or   EXECUTOR_DENIED
  ↓ optional matching AttemptLedger record
DISPATCH_STARTED_NO_FINAL_OUTCOME
  ↓ matching terminal record
COMPLETION_RECORDED_UNVERIFIED   or   FAILURE_RECORDED
```

A BudgetGenius influence receipt alone yields `ROUTE_INFLUENCE_NOT_EXECUTED`, never authorization or completion.

R3-C verifies the run-capsule/authorization IDs and hash references, executor provider/model/role agreement, approved local pool, BrainRoute selection match unless a valid explicitly bounded canary influenced the route, and refusal of attempts under denied authority. Mislinked or contradictory records fail closed.

R3-C cannot prove:

- that a copied/exported record came from the actual running browser or from the reported `.54.12` build;
- that `fastHash` prevents an attacker from forging an internally consistent bundle;
- that a model actually completed inference in the real world, rather than a copied ledger row saying so;
- that the answer was correct, safe, or independently verified;
- that the selected model tag corresponds to an exact qualified P1-C artifact;
- that a BrainRoute native role equals a stable GA108 profile identity;
- that browser HTTPS pairing/Windows PNA actually passed;
- that a model or agent gained permission to dispatch.

## Operator-local usage

Create a private, **locally stored** JSON bundle from the canonical runtime's existing records, if the operator has a legitimate export path. Do **not** paste private memory, full run capsules, tokens, or credentials into GitHub or a chat. R3-C does not automatically extract localStorage or the runtime's private ledger.

Accepted top-level input fields:

```json
{
  "runCapsule": { "receiptType": "PhiRunCapsule" },
  "brainRoute": { "receiptType": "BrainRouteReceipt" },
  "authorization": { "receiptType": "ExecutorAuthorizationReceipt" },
  "attempts": [],
  "budgetGeniusInfluence": null
}
```

The placeholders above show expected record types, not a runnable example.

From a local repository checkout, after obtaining a legitimate local bundle:

```powershell
node packages/vessie-gateway-v0.1/canonical-routes/cli.mjs --input "C:\private\vessie-routing-bundle.json"
```

The CLI limits input to 256 KiB, fails closed on inconsistent receipts, and reports only a safe allowlist by default. Model/provider names are redacted. For operator-only local diagnostics add `--operator-names`; do not publish its output.

No scanner, private storage reader, endpoint, browser extension, cookie-access bridge, credential store, or automatic routing execution is provided.

## Acceptance

```powershell
node --test packages/vessie-gateway-v0.1/canonical-routes/tests/projector.test.mjs
```

Tests check separate selected/authorized/attempted/completed states, no invented outcome, conflicting IDs, model/provider mismatch, repeated attempts, malformed metadata, privacy defaults, local approved-pool boundaries, canary non-authority and deterministic projection checksum.

## R3-D terminal-outcome reconciliation

The extracted operator-exported records do not contain a verifiable attempt/retry
lineage establishing which of multiple terminal rows represents the final
run outcome. R3-D therefore makes **no last-write-wins assumption**:

- Only completion rows: `COMPLETION_RECORDED_UNVERIFIED`.
- Only failure rows: `FAILURE_RECORDED`.
- Both `COMPLETED` and `FAILED` rows for one projected run:
  `MIXED_TERMINAL_RECORDS_UNRESOLVED`, regardless of row order or timestamps.
- A conflicting bundle retains both counts, reports
  `terminal_outcomes_conflict=true` and
  `terminal_outcome_class=MIXED_UNRESOLVED`, and is flagged for operator
  review by the GitHub Pages *unverified import* inspector.

This conservative interpretation avoids treating a failed later run as success
just because some older row says `COMPLETED`. It also avoids assuming that
a later completion resolves an earlier failure without signed, correlated
retry evidence. Even `COMPLETION_ONLY` remains unverified, and **no
completion/failure counters are suitable as training rewards or promotion
signals yet**.

The R3-C schema identifier is retained for compatibility, with two additive
fields and one additional outcome state. The schema, unit tests and React
import inspection agree on the new state. A future governed export must pin
attempt lineage and independently validate source origin before any routing
learner may consume these records as outcomes.

No live runtime, canonical manifest, BrainC model setting, browser-pairing
grant, BudgetGenius permission, Physical Observer promotion status or
executor authorization is changed.

## R3-E offline operator-signed envelope

[**Operator walkthrough and verification boundary**](OPERATOR_ENVELOPE_R3E.md).

R3-E adds an optional, **operator-local, no-network** Ed25519 signature to
the redacted R3-C/R3-D evidence projection. A reviewer must supply the
operator's public key independently to validate custody of the signed packet.
It uses an exact projection allowlist and preserves mixed terminal outcomes
as unresolved. The key and raw receipts never belong in GitHub Pages.

**Not connected:** canonical browser export, BrainC, local HTTPS R2, live
execution, model quality, signer identity proof, runtime-origin attestation,
P4 learning or authority. A valid operator signature only says a given key
signed this packet. See [R3-E implementation](operator-envelope.mjs) and
[negative controls](tests/operator-envelope.test.mjs).

## R3-F offline signed-custody batch audit

See the [R3-F operator guide](CUSTODY_BATCH_R3F.md). R3-F checks up to
32 already-redacted R3-E operator-signed packets **offline** with one
caller-supplied public key. It detects duplicate signed packet IDs,
ambiguous repeated redacted projections, reported mixed terminal states,
and operator timestamp regressions, all **within one provided batch**.
A matching redacted projection does not prove that two source runs were
the same. The public key's independent trust is NOT attested by code.

R3-F is not a live canonical source exporter, replay registry, R2 field
qualification, proof of executed inference, or authority to change
GA108/P4 routing weights. No private ledger scan, action endpoint, model
execution, server listener, or canonical runtime mutation is introduced.

## Integration boundary

Every exported result includes:

```text
evidence_level = UNATTESTED_OPERATOR_EXPORTED_RECORDS
independent_execution_confirmation = false
independently_verified_answer_quality = false
source_authenticity_attested = false
cryptographic_signature_verified = false
exact_model_artifact_attested = false
ga108_genius_identity_attested = false
live_trace_export_connected = false
browser_gateway_connected = false
can_execute = false
may_change_live_route = false
authority_granted = false
```

The next integration candidate must introduce a **governed, operator-reviewed export seam in a separate canonical runtime promotion** or a justified secure local bridge, with independently checkable source provenance. Physical R2 browser pairing qualification is still outstanding. Do not assume a green CI is permission to expose the private ledger over GitHub Pages.

**The Physical Observer `.54.13` review hold and all BudgetGenius permissions remain unchanged.**
