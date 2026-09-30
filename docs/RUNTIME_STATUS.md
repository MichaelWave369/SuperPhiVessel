# Runtime Status

Canonical runtime: **v2.0-alpha.11.0.54.10 — Service Models Handler Restoration**

The current source of shipped behavior is the standalone HTML artifact under `runtime/`.

## Integrity

- Path: `runtime/Super_PhiVessel_v2.0-alpha.11.0.54.10_Service_Models_Handler_Restoration.html`
- Size: `13,332,646` bytes
- SHA-256: `96767c267b0d9ed20be9f4d182c30129944311096c0959d20b5d80c89fb2c09e`
- Git blob: `b44e0411f7477f2041cb3f130452a6d1f0410121`
- Blank-state protocol: `PV-BLANK-STATE-0.1`
- Public data epoch: `PV-PUBLIC-BLANK-2026-09-29-V1`
- Service / Models repair: `PV-SERVICE-MODELS-REPAIR-0.2`

## Current high-level surfaces

| Surface | Runtime truth | Boundary |
|---|---|---|
| Service / Models Handler Restoration | LIVE / production-verified | Restores `exportKeyring`, `autoAssignOllama`, and `applyOllamaStabilityPreset`; no authority change |
| Blank-State Release Hardening | LIVE inherited invariant | Pre-.54.8 Vessie-owned browser state is cleared/ignored once before runtime recovery; unrelated origin storage is preserved |
| Frozen Challenger Bench | LIVE / operator-triggered | Bench execution only; no automatic install, routing, promotion, or Chamber Fitness mutation |
| Model Scout intake | LIVE with external evidence dependency | Candidate proposals remain pending until explicit human watchlist admission |
| Direct Research Fabric | LIVE for read-only public research | WEB_READ only; observed material is quarantined evidence |
| Proof-Bound Interaction Gate | LIVE | No remote-interaction claim without typed proof |
| Vessel Memory / Memory Horizon | LIVE | Starts empty for a fresh public epoch; retrieval does not imply prompt admission or authority |
| Environmental + Semantic Motion | LIVE presentation layer | Motion cannot mutate provider, permission, gate, handoff, or Ledger state |
| Browsallax interactive lane | CONDITIONAL | Interactive authority belongs to governed Browsallax/human grants |
| Netlify BrainC | LIVE in current deployment | Hosted credentials remain server-side; availability does not grant authority |
| SPD-W v0.1 | EXPERIMENTAL / UNWIRED | Frozen package acceptance passes, but it is not integrated into the canonical runtime |

## Current release principle

The .54.10 hotfix restores the complete known-good Service / Models handler set still referenced by the render tree. It inherits the .54.8 clean public data epoch unchanged, so upgrading does not intentionally wipe post-.54.8 state.

**Capability to remember is not permission to ship memory.**

## Production verification

- Netlify production deploy: `6abc4ccce7a12e379f0ca57f` — READY
- BrainC function digest preserved: `f87d5db0cd384125fcd02af78c9fa697365f3bf23aa0180780d9e84486ac9f53`
- Netlify secret scan: zero matches
- Service → Models: operator-verified working on .54.10 before canonical promotion

## Repository normalization state

- canonical .54.10 runtime promoted from production-tested bytes
- runtime digest and Git blob identity recorded
- blank-state release contract retained
- deterministic blank-state migration harness retained
- deterministic Service / Models handler regression harness added
- CI reads canonical path/version/hash from `runtime/MANIFEST.json`
- SPD-W remains separately tested and **UNWIRED**

## Important interpretation rule

The existence of code, a named subsystem, a historical release note, or a package in this repository does not by itself establish that the subsystem is currently active, authorized, integrated, or production-ready.
