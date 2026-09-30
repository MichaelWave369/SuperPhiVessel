# Blank-State Release Contract

Status: **LOCKED release requirement**

Super Φ.Vessel public releases MUST start from a clean operator state.

## Required initial state

A fresh public runtime MUST contain **zero user-derived records** in chat/conversation history, Dreamer history, persistent operator memory, pins/canvases/drafts, prior model/session state, imported private evidence, receipts, or persisted credentials.

Architecture, schemas, empty stores, deterministic test fixtures, and explicitly synthetic examples are allowed. They MUST NOT contain prior operator-derived content.

## Persistence behavior

Persistence capability may exist, but a public release must distinguish:

1. **schema** — the shape of a store;
2. **empty initial state** — the state shipped with the release;
3. **runtime-created state** — data created only after the current operator begins using the runtime.

No build step may silently promote runtime-created state into shipped initial state.

## Public-release data epoch

The current public data epoch is `PV-PUBLIC-BLANK-2026-09-29-V1`.

On first boot into that epoch, Vessie clears or ignores legacy Vessie-owned state before loading chat, dream, memory, pin, session, receipt, work-object, benchmark, or credential state. The reset is scoped to Vessie-owned keys/databases and must not indiscriminately clear unrelated browser storage.

## Canonical implementation

Current canonical runtime:

- version: `v2.0-alpha.11.0.54.10`
- name: `Service Models Handler Restoration`
- blank-state base: `v2.0-alpha.11.0.54.8 — Blank-State Release Hardening`
- epoch protocol: `PV-BLANK-STATE-0.1`
- public data epoch: `PV-PUBLIC-BLANK-2026-09-29-V1`
- recovery DB: `parallax_vessel_recovery_public_epoch_1`
- SHA-256: `96767c267b0d9ed20be9f4d182c30129944311096c0959d20b5d80c89fb2c09e`
- Git blob: `b44e0411f7477f2041cb3f130452a6d1f0410121`

The .54.10 Service / Models repair does **not** establish a new public data epoch. Upgrading from .54.8/.54.9 therefore does not intentionally repeat the legacy-state wipe.

The previous operator-specific Global Memory seed remains replaced with the neutral invariant: **“The current human operator retains final authority over goals and decisions.”**

Creator/maintainer attribution may still identify the project creator. Attribution is provenance, not restored operator memory.

## Verification status

Source-level verification:

- [x] canonical runtime bytes audited;
- [x] known browser persistence namespaces enumerated;
- [x] shipped seed/default state contains no prior operator chat, dream, or committed Vessel-memory record;
- [x] legacy-state migration simulation clears Vessie-owned state while preserving unrelated storage;
- [x] legacy IndexedDB is ignored by namespace rotation and requested for deletion;
- [x] same-epoch simulation proves new runtime-created state survives subsequent loads;
- [x] deterministic Node migration harness exists at `tests/blank-state.test.js`;
- [x] .54.10 is the sole canonical standalone runtime in `runtime/`;
- [x] `runtime/MANIFEST.json` records the exact production-tested .54.10 bytes and digest;
- [x] CI verifies canonical path, size, SHA-256, and version from the manifest;
- [x] CI executes the blank-state migration harness;
- [x] CI executes the Service / Models handler regression harness;
- [x] CI executes the frozen SPD-W acceptance contract independently.

Deployment-level verification:

- [x] the public Netlify site has been upgraded to the .54.10 production deploy;
- [x] Service → Models renders successfully on the production .54.10 deployment;
- [ ] an independent fresh-browser storage smoke test confirms no prior user content renders;
- [ ] an explicit existing-browser migration test confirms legacy Vessie state is cleared once and current-epoch state persists afterward.

A source artifact can be blank-state verified before deployment, but the **full deployment-level blank-state verification remains incomplete** until the two browser-storage checks above are completed.

## Governance rule

**Capability to remember is not permission to ship memory.**

Memory features may remain present. Their stores must begin empty unless a future release explicitly ships synthetic fixtures that are clearly labeled as test/demo data and cannot be mistaken for operator history.
