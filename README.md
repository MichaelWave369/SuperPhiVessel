# Super Φ.Vessel

**Super Φ.Vessel (Vessie)** is an experimental governed cognitive operating layer for AI systems.

Its core design principle is simple:

> **CAPABILITY ≠ AUTHORITY**

Super Φ.Vessel explores how increasingly capable models can be composed behind explicit boundaries for authority, provenance, evidence, routing, verification, memory, and execution.

## Core principles

- **CAPABILITY ≠ AUTHORITY**
- **GOAL ≠ PERMISSION**
- **INFERENCE ≠ OBSERVATION**
- **PROPOSAL ≠ EXECUTION**
- **IDENTITY / PROVENANCE / EVIDENCE MAY TRAVEL; AUTHORITY DOES NOT TRAVEL BY DEFAULT**
- **CAPABILITY TO REMEMBER ≠ PERMISSION TO SHIP MEMORY**

## Project status

Super Φ.Vessel is an **alpha research and engineering project**. Interfaces, protocols, file layout, and runtime contracts may change rapidly.

Current canonical runtime:

```text
v2.0-alpha.11.0.54.10 — Service Models Handler Restoration
runtime/Super_PhiVessel_v2.0-alpha.11.0.54.10_Service_Models_Handler_Restoration.html
```

Its SHA-256 and Git identity are recorded in [runtime/MANIFEST.json](runtime/MANIFEST.json). See [docs/RUNTIME_STATUS.md](docs/RUNTIME_STATUS.md) for high-level subsystem truth and [docs/BLANK_STATE.md](docs/BLANK_STATE.md) for the clean-start release contract.

## Architectural intent

Super Φ.Vessel treats a model as a **capability provider**, not as the final authority boundary.

The runtime is designed around explicit operator authority, governed model routing, immutable provenance and evidence custody, proposal/execution separation, Reality Gate review, bounded memory, human-approved execution, and fail-closed capability boundaries.

A feature being named or represented in the architecture does **not** imply that it is active, wired, authorized, or production-ready.

## Blank-state public releases

A fresh public Vessie must not wake with prior operator-derived chat, dream history, committed Vessel memory, receipts, work/session state, persisted credentials, or private browser-derived state.

The `.54.10` runtime inherits the scoped public data epoch introduced in `.54.8`. It clears or ignores legacy **Vessie-owned** persistence before recovery begins while preserving unrelated browser storage. New state created after the epoch is established persists normally, and the `.54.10` hotfix does not intentionally repeat that reset.

## Service / Models repair

`.54.10` restores the complete known-good handler set still referenced by Service → Models:

- `exportKeyring`
- `autoAssignOllama`
- `applyOllamaStabilityPreset`

The exact canonical bytes were verified in the live Netlify deployment before promotion. CI includes a regression gate so these handlers cannot silently disappear while their UI bindings remain.

## Experimental packages

### SPD-W v0.1.0

`packages/spdw-v0.1/` contains the tested Source Provenance Differential Weighting package.

**Status: EXPERIMENTAL / UNWIRED.**

Its frozen acceptance harness currently passes **31/31 checks**, but SPD-W is not integrated into the canonical .54.10 runtime.

## Integrity automation

`.github/workflows/core-integrity.yml` verifies:

- the canonical runtime path, size, SHA-256, and version from `runtime/MANIFEST.json`
- the blank-state epoch migration contract
- the Service / Models handler restoration contract
- the frozen SPD-W acceptance contract

## Security

Do not commit API keys, tokens, credentials, private exports, browser storage, local memory databases, or operator-specific runtime state.

See [SECURITY.md](SECURITY.md) for the project security posture.

## License

Source code is released under the [MIT License](LICENSE), except where a file or asset is explicitly marked otherwise.

## Maintainer

Created and maintained through an ongoing human–AI engineering collaboration led by **MichaelWave369**.
