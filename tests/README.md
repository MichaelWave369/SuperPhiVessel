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
  - unresolved full-roster stable-ID work remains explicit until P0 exit.
- `packages/spdw-v0.1/spdw-v0.1.acceptance.js` is run separately by CI for the frozen SPD-W package contract.

Historical tests should identify the runtime/protocol version they were written against.
