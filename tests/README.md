# Tests

Deterministic tests, fixtures, acceptance contracts, and regression harnesses belong here.

The goal is to preserve the project's preference for explicit receipts and machine-checkable boundaries while the monolithic runtime is normalized.

## Current release gates

- `blank-state.test.js` reads the canonical runtime from `runtime/MANIFEST.json` and verifies `PV-BLANK-STATE-0.1`:
  - legacy Vessie-owned local/session state is removed on epoch migration;
  - unrelated browser storage is preserved;
  - the legacy recovery IndexedDB is retired;
  - the public data epoch is written;
  - the reset does not repeat after the epoch is current;
  - operator-specific seeded memory is absent.
- `service-models-render.test.js` verifies `PV-SERVICE-MODELS-REPAIR-0.2`:
  - `exportKeyring`, `autoAssignOllama`, and `applyOllamaStabilityPreset` are each defined exactly once;
  - each definition appears before its Service / Models UI binding;
  - portable-keyring warning/import seams remain present.
- `dlam-v0.1.contract.test.js` verifies the unwired `PV-DLAM-0.1` P0 contract:
  - core capability/memory/authority invariants remain frozen;
  - memory, context-packet, and route-receipt schemas remain parseable and retain required governance fields;
  - context packets grant no action authority;
  - route receipts cannot grant authority;
  - runtime wiring remains false;
  - ownership/migration boundaries remain explicit and unwired.
- `ga108-roster.test.js` verifies the canonical GA108 P0 export:
  - exactly 108 profiles remain present as gaId 001–108;
  - profile IDs and memory namespaces are deterministic and unique;
  - the frozen 18-category structure remains six entries per category;
  - every profile carries `authority=NONE` and `modelBinding=null`;
  - the export remains pinned to the canonical `.54.10` runtime identity.
- `packages/dlam-p1-v0.1/acceptance.py` verifies **P1-A single-node exact-ledger continuity**:
  - SQLite WAL + FULL durability mode and FTS5 lexical floor;
  - durable local admission receipts never grant authority;
  - epistemic origins such as DREAMED remain unchanged;
  - contradictory memories remain separate and linked;
  - namespace/purpose/target filtering prevents forbidden recall output;
  - tombstones block transitive derived memory without hard deletion;
  - admission and tombstone mutations are idempotent;
  - conflicting reuse of a stable memory ID fails closed;
  - state survives cold restart;
  - Genius identity remains independent of model binding;
  - event hashes replay deterministically under pinned inputs.
- `packages/dlam-p1-v0.1/context_acceptance.py` verifies **P1-B governed context composition**:
  - current/stale/denied authority is consumed rather than minted;
  - purpose/target/origin filters run before packet exposure;
  - contradiction companions travel together or fail closed;
  - provenance expansion is bounded and never leaks inaccessible source content;
  - exact injected tokenizer accounting enforces the configured memory budget;
  - required context fails as `INSUFFICIENT` rather than emitting a partial packet;
  - empty retrieval never fabricates context;
  - packet hashes are deterministic under pinned inputs and recompose across model swaps/restarts;
  - every packet carries `action_authority=NONE`.
- `packages/dlam-p1-v0.1/p1c_acceptance.py` verifies **P1-C static routing and model-swap continuity**:
  - GA108 identity remains authority-free and unbound to a model;
  - exact model identity changes when quantization or prompt-template identity changes;
  - unqualified/remote/capability-missing/over-budget models are hard-excluded;
  - routing remains static and deterministic with selection probability 1.0;
  - route receipts bind exact model, context packet, policy/index frontiers, and never grant authority;
  - task checkpoints preserve structured work while rejecting opaque model state;
  - route outcomes are attributable observations only;
  - replacement models start with fresh empirical statistics;
  - model swaps preserve task/Genius/memory identity while recomposing context under the replacement tokenizer;
  - checkpoints and route receipts survive restart deterministically.
- `packages/dlam-p1-v0.1/p1d_acceptance.py` verifies **P1-D durability and recovery**:
  - abrupt process loss after commit preserves memory even if the caller cannot rely on receiving the receipt;
  - retry after that ambiguous commit boundary is idempotent;
  - abrupt process loss inside an uncommitted transaction leaves no partial ledger/projection state;
  - a deterministic real SQLite `SQLITE_FULL` condition fails closed with no partial memory;
  - SQLite backup/restore preserves logical manifests, current ledger frontiers, P1-C registry/routes/checkpoints, and latest committed WAL-visible state;
  - restored state recomposes the same governed P1-B context under identical inputs;
  - corrupt backups fail closed;
  - damaged FTS/active projections are detectable and rebuildable;
  - tombstoned sources and derived descendants cannot resurrect during rebuild;
  - verification/backup/restore/rebuild receipts grant no authority.
- `packages/sparse-frontier-v0.1/acceptance.py` verifies **Sparse Frontier Routing v0.1**:
  - easy/high-confidence local cases do not wake the frontier tier or any Genius;
  - contradiction + irreversible-risk cases escalate deterministically;
  - only a small GA108 subset is recommended and remains dormant/non-authoritative;
  - learned/experimental NBG anomaly signals are log-only and cannot escalate by themselves;
  - deterministic projected NBG signals are bounded features rather than authority;
  - stale/denied authority blocks frontier exposure;
  - routing usefulness updates shadow knowledge without changing live thresholds or granting authority;
  - Frontier Duty Cycle is measured alongside critical misses, escalation usefulness, governance violations, latency/cost, and Genius activation count;
  - escalation envelopes contain bounded references rather than raw memory text.
- `packages/spdw-v0.1/spdw-v0.1.acceptance.js` is run separately by CI for the frozen SPD-W package contract.

Historical tests should identify the runtime/protocol version they were written against.
