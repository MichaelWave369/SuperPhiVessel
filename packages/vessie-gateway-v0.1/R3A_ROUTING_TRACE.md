# Vessie R3-A: Offline P1-C/P3-A Routing Trace Projection

**Status:** EXTRACTED / READ-ONLY / OFFLINE / NO BROWSER OR LIVE BRAINC CONNECTION

R3-A introduces a deliberately small and inspectable projection of existing **P1-C static routing receipts** and **P3-A shadow observations** from one local PV-DLAM SQLite database. It is not the live BrainC/Crane Fly API.

## Source of truth

The exporter reads the actual historical table shapes:

- `p1c_route_receipts` for `receipt_json`, `receipt_hash`, exact `decision_id`, `profile_ref`, and `model_ref`.
- `p3_route_observations`, when present, for the observation hash and explicit outcome fields keyed by `route_decision_id`.

It opens the DB using `mode=ro` and `PRAGMA query_only=ON`. It does not create tables, upgrade the DB, write observations, or evaluate a new route.

## Integrity and provenance

The code re-computes canonical hash domains exactly:

```text
PV-DLAM-ROUTE| + canonical(P1C route body)
PV-DLAM-P3A-OBS| + canonical(P3A observation body)
```

It verifies the self-hash against the row, the hash-derived identifier, route/observation join, task/profile/model identity, P3 shadow-only flags, and the prohibition on any authority grants. Rehashed but cross-task observations still fail.

**Hash equality is not external authenticity or a digital signature.** A malicious database author can forge a new internally consistent record. The result always reports `external_signature_verified=false` and `source_authenticity_attested=false`. Do not use it to authorize action or approve a provider.

## Projected fields

Allowed fields include the route-decision ID, exact Genius/model refs, static routing mode, SHA-256 checksum and, if P3 exists, observation ID/hash, coarse task class and bounded success, quality, calibration, evidence, correction, latency, token and cost statistics.

Never export raw task ID/prompt, context packet, memory contents, source evidence refs, candidate lists, optimizer internals, policy authority ref, budget credentials, SFR raw payloads, task tags or free-text logs.

With no P3 observation, the exporter explicitly prints `NO_P3_OBSERVATION`. It never invents a completed outcome.

## Local test

From the SuperPhiVessel checkout:

```powershell
python packages/vessie-gateway-v0.1/r3a_acceptance.py
```

## Local read-only inspect

The operator must identify an **existing** P1-C SQLite database and an exact route decision ref. Nothing auto-scans disks, searches private folders, or starts a router.

```powershell
python packages/vessie-gateway-v0.1/r3a_route_trace.py --db "C:\path\to\existing-pv-dlam.sqlite" --decision "route_REPLACE_WITH_32_HEX_CHARACTERS"
```

Any bad path, missing table, malformed content, mismatched P3 link or authority claim returns a generic refusal. Input database content is not printed on errors.

## Safety boundary

```text
source = EXTRACTED_P1C_P3A_SQLITE
self_hash_consistent = true (only when all checks pass)
external_signature_verified = false
source_authenticity_attested = false
live_brainc_connected = false
browser_gateway_connected = false
activation_allowed = false
can_execute = false
may_change_live_route = false
authority_granted = false
```

Nothing in R3-A reaches the public React cockpit or R2 local HTTPS gateway. Those connections await an explicit, separate operator-reviewed integration after field qualification.

## Follow-on R3-B

1. Inspect the actual deployed BrainC/Crane Fly route receipt/evidence format and its source authenticity mechanism.
2. Define a donor-specific, non-authoritative trace projection and source identity verification.
3. Gate it by a qualified, paired, read-only endpoint with authorization scoped to the operator's actual device.
4. Demonstrate no raw memory/query/token leakage, no hidden learned-weight activation, no BudgetGenius canary bypass and no Physical Observer promotion.
5. Test physical browser connection and denial controls before claiming live routing telemetry is operational.

R3-A establishes extracted SQLite continuity; R3-B must establish verified live BrainC ownership, not quietly claim the two were the same system.
