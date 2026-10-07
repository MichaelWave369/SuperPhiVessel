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
- [x] P1 — **qualified extracted one-node reference**: durable admitted ledger, governed context composition, static routing, model swap, forgetting, crash/write-failure recovery, backup/restore, and projection rebuild. Live runtime wiring remains separate.
  - [x] **P1-A** — extracted one-node exact ledger: WAL/FULL SQLite, FTS5 lexical recall, epistemic provenance, contradictions, tombstone/derived invalidation, idempotency, namespace isolation, deterministic event hashes, cold restart.
  - [x] **P1-B** — bounded context composer with deterministic packet manifest, purpose/target/origin admission, exact injected tokenizer-budget seam, strict contradiction pairing, bounded provenance expansion, and INSUFFICIENT/HELD/DENIED failure.
  - [x] **P1-C** — exact model-artifact registry, deterministic GA108/static routing receipts, attributable outcome identity, structured task checkpoints, replacement-tokenizer context recomposition, and changed-model cold statistics.
  - [x] **P1-D** — abrupt committed/uncommitted crash boundaries, real SQLite `SQLITE_FULL` fail-closed behavior, WAL-safe backup/restore, corrupt-backup rejection, and deletion-safe projection rebuild.
- [x] **Sparse Frontier Routing v0.1 precursor** — extracted deterministic “when is deeper reasoning worth calling?” gate with bounded escalation envelopes, sparse GA108 recommendations, Frontier Duty Cycle + usefulness/critical-miss metrics, shadow-only routing knowledge, and disciplined NBG signal classes. **UNWIRED**; does not replace P1-D or activate learned thresholds.
- [x] P2 — **qualified extracted + live native-hosted loopback synchronization reference**: scoped signed memory/tombstone exchange, Infinite Porch carrier integration, restart continuity, partition queueing, revocation freshness, stale-epoch rejection, and bidirectional recovery.
  - [x] **P2-A extracted reference** — signed scoped memory/tombstone envelopes, Ed25519 identity seam, durable outbox/inbox receipts, replay protection, monotonic revocation epochs, tombstone precedence, no transitive forwarding, conflict preservation, and Porch-compatible transport adapter boundary.
  - [x] **P2-B adapter contract** — map signed P2 envelopes/receipts onto Infinite Porch 0.1.2 `message.send`, with explicit P2↔Porch identity/scope binding, loopback-only control, offline queue semantics, and no trust/grant minting. Deterministic adapter semantics are qualified; live Porch daemon/network evidence remains for P2-C.
  - [x] **P2-C live Porch + partition/revocation closeout** — pinned/builds Infinite Porch `5e00f2d`, runs real daemon TCP/Noise loopback, restart, outage queueing, Porch grant revocation, stale P2 epoch rejection, quarantine of rejected carriers, and refreshed bidirectional recovery.
- [x] P3 — **structurally qualified extracted observability/shadow-evaluation framework**: immutable full-roster outcomes, honest paired held-out replay, explicit evidence floors, SFR calibration gates, and a non-activating P4 evaluation packet. Real empirical learner qualification remains P4 work.
  - [x] **P3-A Routing Observatory candidate** — immutable route-outcome observations anchored to P1-C receipts, full 108-profile scorecards including dormant identities, exact-model/task-class/calibration history, optional SFR usefulness joins, provenance-pinned snapshots, and shadow-only dormant roster ranking. Live dispatch/thresholds remain unchanged.
  - [x] **P3-B held-out shadow replay candidate** — deterministic group-held-out datasets, paired observed route alternatives, training-only shadow policy fit, unsupported-counterfactual abstention, paired held-out deltas, and SFR threshold replay with no causal/promotion claim. Live routing remains static.
  - [x] **P3-C qualification dataset closeout** — task-class/route/SFR evidence floors, five deterministic held-out seeds, synthetic-fixture guard, deterministic qualification hashes, and a non-activating P4 evaluation packet; CI structural fixture 22/22 PASS.
- [ ] P4 — qualify bounded learned routing with rollback and operator-owned activation.
  - [x] **P4-A bounded learner candidate** — pure-Python 24-feature batch ridge + UCB shadow scorer, P1-C hard eligibility first, sparse GA108/model shortlist, exact-route support floors, non-tradable breach blocking, source-evidence pinning, immutable learned snapshots, and explicit rollback lineage. No activation method; synthetic evidence remains structural only.
  - [ ] **P4-B empirical held-out evaluation** — evaluate learned candidate against frozen P3-C empirical packets across >=400 held-out tasks and >=5 seeds; require >=5% relative utility improvement with positive 95% lower bound, no governance/critical-miss regression, and declared latency thresholds.
  - [ ] **P4-C operator activation + rollback** — activation lease, explicit operator approval, live canary bounds, rollback snapshot, automatic demotion on gate breach; close P4 only after empirical evidence and rollback drill.
- [ ] P5 — evaluate optional NBG learned views against capacity-matched baselines; base memory must remain operational when the sidecar is disabled.
- [ ] P6 — run a bounded real-machine pilot with hardware profiling, recovery drill, and independent peer/security review.

The canonical standalone runtime remains unchanged until a later phase explicitly satisfies its integration gate.

