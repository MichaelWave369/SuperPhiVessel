# Blank-State Release Contract

Status: **LOCKED release requirement**

Super Φ.Vessel public releases MUST start from a clean operator state.

## Required initial state

A fresh public runtime MUST contain **zero user-derived records** in each of these domains:

- chat / conversation history
- Dreamer prompts, dreams, continuations, or generated dream history
- persistent memory records or recalled operator memory
- pinned outputs, saved canvases, scratchpads, drafts, or temporary work products
- prior model responses, routing traces, benchmark sessions, or operator-specific session state
- imported files, private receipts, browser-derived observations, or personal provenance records
- provider credentials, tokens, API keys, private endpoints, or locally persisted secrets

Architecture, schemas, empty stores, deterministic test fixtures, and explicitly synthetic examples are allowed. They MUST NOT contain prior operator-derived content.

## Persistence behavior

Persistence capability may exist, but a public release must distinguish:

1. **schema** — the shape of a store;
2. **empty initial state** — the state shipped with the release;
3. **runtime-created state** — data created only after the current operator begins using the runtime.

No build step may silently promote runtime-created state into shipped initial state.

## Public-release data epoch

Before the first public deployment is declared clean, the runtime must establish a new public data epoch.

On first boot into that epoch, Vessie must clear or ignore legacy user-state namespaces owned by earlier Super Φ.Vessel builds before loading chat, dream, memory, pin, scratchpad, session, receipt, work-object, benchmark, or credential state.

The reset must be scoped to Vessie-owned keys/databases. It must not indiscriminately clear unrelated browser storage on the same origin.

## Canonical implementation

The canonical runtime is:

- version: `v2.0-alpha.11.0.54.8`
- name: `Blank-State Release Hardening`
- epoch protocol: `PV-BLANK-STATE-0.1`
- public data epoch: `PV-PUBLIC-BLANK-2026-09-29-V1`
- recovery DB: `parallax_vessel_recovery_public_epoch_1`
- SHA-256: `3dbf3dc162196dfcb1561563f2b61c45ba5c4f88b5566844cdf75e8d16cfc81d`
- Git blob: `6f070c8d9265ea2c79035ea88ee1544d4cd80568`

The migration executes before device identity, Vessel-tab bootstrap, session recovery, PV-MEM, receipts, or WorkObject state is loaded.

On an epoch mismatch it:

- removes Vessie-owned `localStorage` and `sessionStorage` keys;
- includes persisted provider credentials and prior operator identity in the reset;
- preserves storage keys that do not belong to Vessie;
- requests deletion of the legacy `parallax_vessel_recovery_v1` IndexedDB;
- rotates all new recovery writes to the new epoch database;
- writes the new epoch marker only after the scoped reset;
- does not repeat the reset after the current epoch is established.

The previous operator-specific Global Memory seed was replaced with the neutral invariant: **“The current human operator retains final authority over goals and decisions.”**

A project-specific memory self-test fixture was also replaced with synthetic generic content.

Creator/maintainer attribution may still identify the project creator. Attribution is provenance, not restored operator memory.

## Verification status

Source-level blank-state verification is complete:

- [x] canonical runtime bytes audited;
- [x] known browser persistence namespaces enumerated;
- [x] shipped seed/default state contains no prior operator chat, dream, or committed Vessel-memory record;
- [x] legacy-state migration simulation clears Vessie-owned state while preserving unrelated storage;
- [x] legacy IndexedDB is ignored by namespace rotation and requested for deletion;
- [x] same-epoch simulation proves new runtime-created state survives subsequent loads;
- [x] deterministic Node migration harness exists at `tests/blank-state.test.js`;
- [x] .54.8 is committed as the sole canonical standalone runtime in `runtime/`;
- [x] `runtime/MANIFEST.json` records the exact .54.8 bytes and digest;
- [x] CI verifies the canonical SHA-256 and version marker;
- [x] CI executes the blank-state migration harness against the committed runtime;
- [x] CI executes the frozen SPD-W acceptance contract independently.

Deployment-level verification remains separate:

- [ ] the deployed public site has been upgraded to the .54.8 runtime;
- [ ] a fresh-browser deployed smoke test confirms no prior user content renders;
- [ ] an existing-browser deployed migration test confirms legacy Vessie state is cleared once and new epoch state persists afterward.

A source artifact can be blank-state verified before deployment, but the **public deployment must not be called blank-state verified** until the deployment-level checks pass.

## Governance rule

**Capability to remember is not permission to ship memory.**

Memory features may remain present. Their stores must begin empty unless a future release explicitly ships synthetic fixtures that are clearly labeled as test/demo data and cannot be mistaken for operator history.
