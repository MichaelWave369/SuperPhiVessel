# Runtime

This directory contains the **canonical standalone Super Φ.Vessel runtime**.

## Canonical runtime

```text
Super_PhiVessel_v2.0-alpha.11.0.54.10_Service_Models_Handler_Restoration.html
```

Version: **v2.0-alpha.11.0.54.10 — Service Models Handler Restoration**

Integrity metadata is recorded in [MANIFEST.json](MANIFEST.json). High-level runtime status is documented in [../docs/RUNTIME_STATUS.md](../docs/RUNTIME_STATUS.md), and the locked clean-start requirement is documented in [../docs/BLANK_STATE.md](../docs/BLANK_STATE.md).

The .54.10 runtime inherits the .54.8 public data epoch `PV-PUBLIC-BLANK-2026-09-29-V1`, so upgrading from .54.8/.54.9 does not intentionally repeat the legacy-state wipe. Memory capability remains available, but operator-derived state is not shipped as initial state.

The .54.10 hotfix restores the complete known-good Service / Models handler set still referenced by that render tree: `exportKeyring`, `autoAssignOllama`, and `applyOllamaStabilityPreset`. This exact artifact was verified in the live Netlify deployment before canonical promotion.

Historical ZIP bundles, private state exports, secrets, and operator-specific memory do not belong in this directory.

A runtime artifact is canonical only when its version, checksum, release status, and required release invariants are explicitly recorded.
