# Runtime Status

Canonical runtime: **v2.0-alpha.11.0.54.8 — Blank-State Release Hardening**

The current source of shipped behavior is the standalone HTML artifact under `runtime/`. This document records high-level subsystem status from that runtime. It does not replace the runtime's own System Map / Operator Manual.

## Integrity

- Path: `runtime/Super_PhiVessel_v2.0-alpha.11.0.54.8_Blank_State_Hardening.html`
- Size: `13,328,818` bytes
- SHA-256: `3dbf3dc162196dfcb1561563f2b61c45ba5c4f88b5566844cdf75e8d16cfc81d`
- Git blob: `6f070c8d9265ea2c79035ea88ee1544d4cd80568`
- Blank-state protocol: `PV-BLANK-STATE-0.1`
- Public data epoch: `PV-PUBLIC-BLANK-2026-09-29-V1`

See `runtime/MANIFEST.json` and `docs/BLANK_STATE.md`.

## Current high-level surfaces

| Surface | Runtime truth | Boundary |
|---|---|---|
| Blank-State Release Hardening | LIVE release invariant | Pre-.54.8 Vessie-owned browser state is cleared/ignored once before runtime recovery; unrelated origin storage is preserved |
| Frozen Challenger Bench | LIVE / operator-triggered | Bench execution only; no automatic install, routing, promotion, or Chamber Fitness mutation |
| Model Scout intake | LIVE with external evidence dependency | Candidate proposals remain pending until explicit human watchlist admission |
| Direct Research Fabric | LIVE for read-only public research | WEB_READ only; observed material is quarantined evidence |
| Proof-Bound Interaction Gate | LIVE | No remote-interaction claim without typed proof |
| Packet Bus / evidence integrity | LIVE | Immutable ref/digest conflict detection; unresolved evidence fails closed |
| Runtime Spine / PhiTurnEnvelope | LIVE | Attempts are bounded and receipted; authority remains separate |
| System Map / Operator Manual | LIVE, read-only | Reports status; grants no capability or authority |
| PhiOS Bridge | CONDITIONAL | Trusted host required; proposal context does not carry authority |
| WorkObject | LIVE | Context/state only; no workflow or execution authority |
| Vessel Memory / Memory Horizon | LIVE | Starts empty for a fresh public epoch; retrieval does not imply prompt admission or authority |
| Portable Vessel Bundle | LIVE | New identity on import; live authority does not travel |
| Chamber Fitness | LIVE, EXCLUDE_ONLY | May exclude on evidence; never approves or activates |
| Build Execution Receipt | CONDITIONAL on bounded execution | Builder prose cannot substitute for PASS execution evidence |
| Promotion / Page Evidence Fabric | LIVE | Source claim class is immutable; page content remains untrusted |
| Environmental + Semantic Motion | LIVE presentation layer | Motion cannot mutate provider, permission, gate, handoff, or Ledger state |
| Browsallax interactive lane | CONDITIONAL | Interactive authority belongs to governed Browsallax/human grants |
| Netlify BrainC | CONDITIONAL on deployment | Hosted credentials remain server-side; availability does not grant authority |
| SPD-W v0.1 | EXPERIMENTAL / UNWIRED | Frozen package acceptance passes, but it is not integrated into the canonical runtime |

## Current release principle

The .54.8 release adds a clean public data epoch without removing Vessie's ability to form new state after first boot.

**Capability to remember is not permission to ship memory.**

A fresh public runtime must not restore pre-release operator chat, Dreamer history, committed Vessel memory, prior session/work state, receipts, persisted credentials, or other operator-derived state. The migration is scoped to Vessie-owned persistence namespaces and must not wipe unrelated storage on the same origin.

The .54.7 Challenger Bench behavior remains present: model comparison produces evidence for human review only. A `ModelChallengeGrant` remains exact-role, exact-model-pair, exact-fixture, session-scoped, and time-bounded.

## Repository normalization state

- canonical .54.8 runtime imported
- runtime digest recorded
- blank-state release contract established
- deterministic blank-state migration harness added
- governance/security documentation established
- historical deployment bundles held out of current deployment truth
- SPD-W preserved separately as a tested but currently **UNWIRED** candidate package
- extraction of current deployment adapters and broader deterministic regression suites remains pending

## Important interpretation rule

The existence of code, a named subsystem, a historical release note, or a package in this repository does not by itself establish that the subsystem is currently active, authorized, integrated, or production-ready.
