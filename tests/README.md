# Tests

Deterministic tests, fixtures, acceptance contracts, and regression harnesses belong here.

The goal is to preserve the project's preference for explicit receipts and machine-checkable boundaries while the monolithic runtime is normalized.

## Current release gates

- `blank-state.test.js` verifies `PV-BLANK-STATE-0.1` against the canonical runtime:
  - legacy Vessie-owned local/session state is removed on epoch migration;
  - unrelated browser storage is preserved;
  - the legacy recovery IndexedDB is retired;
  - the new public data epoch is written;
  - the reset does not repeat after the epoch is current;
  - operator-specific seeded memory is absent.
- `packages/spdw-v0.1/spdw-v0.1.acceptance.js` is run separately by CI for the frozen SPD-W package contract.

Historical tests should identify the runtime/protocol version they were written against.
