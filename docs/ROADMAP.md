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
- [ ] SPD-W package as EXPERIMENTAL / UNWIRED until explicitly integrated

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
