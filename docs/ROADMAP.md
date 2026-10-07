# Roadmap

This roadmap describes normalization work for the public repository. It is not a promise of release dates.

## Phase 0 — Establish the canonical repository

- [x] Public repository
- [x] MIT source license
- [x] Repository skeleton
- [x] Add current standalone runtime under `runtime/`
- [x] Record runtime checksum/version metadata
- [ ] Verify visual asset provenance

## Phase 1 — Normalize the existing runtime

- [ ] Extract deployable Netlify/server functions from historical bundles
- [ ] Separate current deployment adapters from obsolete .51.x packaging
- [ ] Extract deterministic tests and fixtures from historical runtime bundles
- [x] Establish machine-readable runtime/version manifest
- [ ] Add automated secret scanning and basic repository CI

## Phase 2 — Extract reusable governed components

- [ ] Promotion / evidence contracts
- [ ] WorkObject / turn-envelope contracts
- [ ] authority / lease primitives
- [ ] memory admission rules
- [ ] routing / Chamber Fitness primitives
- [x] SPD-W package imported as EXPERIMENTAL / UNWIRED until explicitly integrated

## Phase 3 — Deployment and integration

- [ ] Rebuild current Netlify deployment from canonical source
- [ ] Document Browsallax trust boundary
- [ ] Document PhiOS bridge contract
- [ ] Publish deployment/environment templates without secrets

## Phase 4 — Modular runtime

- [ ] Reduce dependence on the monolithic standalone HTML
- [ ] Preserve deterministic receipts and protocol invariants across module boundaries
- [ ] Establish reproducible release bundles
- [ ] Add migration/versioning policy for persistent Vessel state

## Non-goals

The roadmap does not grant autonomous authority, automatic model installation, automatic paid routing, self-modification authority, or automatic evidence promotion.

## Distributed Local-Agent Memory workstream — PV-DLAM-0.1

This workstream is deliberately staged so learned routing and learned NBG views cannot become dependencies before exact continuity and governance are qualified.

- [x] Freeze the initial `PV-DLAM-0.1` contract, schemas, donor inventory, and deterministic contract harness.
- [x] Complete P0: exact SCM v0.8 internal master-spec artifact pinned by SHA-256; no canonical repository implementation invented.
- [x] Author the PV-DLAM ownership/migration crosswalk: SuperPhiVessel orchestration, PhiOS target governed-memory boundary, BrainC P1 reference service, NBG views, Infinite Porch transport.
- [x] Export/freeze the canonical GA108 roster from `.54.10`: 108 stable source IDs, namespaced profile IDs, deterministic memory namespaces, no model binding.
- [ ] P1 — prove one-node continuity: durable admitted ledger, context composition, static routing, model swap, forgetting, and recovery.
  - [x] **P1-A** — extracted one-node exact ledger: WAL/FULL SQLite, FTS5 lexical recall, epistemic provenance, contradictions, tombstone/derived invalidation, idempotency, namespace isolation, deterministic event hashes, cold restart.
  - [x] **P1-B** — bounded context composer with deterministic packet manifest, purpose/target/origin admission, exact injected tokenizer-budget seam, strict contradiction pairing, bounded provenance expansion, and INSUFFICIENT/HELD/DENIED failure.
  - [ ] **P1-C** — static Genius/model route receipts plus task checkpoint/model-swap continuity with changed-model cold statistics.
  - [ ] **P1-D** — crash/disk-full/backup/restore and deletion-rebuild qualification; close the full P1 evidence gate.
- [ ] P2 — qualify scoped signed two/three-node synchronization and partition/revocation behavior.
- [ ] P3 — collect inspectable routing outcomes for the full logical roster; keep dispatch static while the learner runs in shadow mode.
- [ ] P4 — qualify bounded learned routing with rollback and operator-owned activation.
- [ ] P5 — evaluate optional NBG learned views against capacity-matched baselines; base memory must remain operational when the sidecar is disabled.
- [ ] P6 — run a bounded real-machine pilot with hardware profiling, recovery drill, and independent peer/security review.

The canonical standalone runtime remains unchanged until a later phase explicitly satisfies its integration gate.

