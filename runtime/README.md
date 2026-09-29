# Runtime

This directory contains the **canonical standalone Super Φ.Vessel runtime**.

## Canonical runtime

```text
Super_PhiVessel_v2.0-alpha.11.0.54.8_Blank_State_Hardening.html
```

Version: **v2.0-alpha.11.0.54.8 — Blank-State Release Hardening**

Integrity metadata is recorded in [MANIFEST.json](MANIFEST.json). High-level runtime status is documented in [../docs/RUNTIME_STATUS.md](../docs/RUNTIME_STATUS.md), and the locked clean-start requirement is documented in [../docs/BLANK_STATE.md](../docs/BLANK_STATE.md).

The .54.8 public data epoch prevents legacy Vessie-owned browser state from silently reappearing in a fresh public runtime. Memory capability remains available, but operator-derived chat, dream, memory, receipt, session, credential, and work state is not shipped as initial state.

Historical ZIP bundles, private state exports, secrets, and operator-specific memory do not belong in this directory.

A runtime artifact is canonical only when its version, checksum, release status, and required release invariants are explicitly recorded.
