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

## Project status

Super Φ.Vessel is an **alpha research and engineering project**. Interfaces, protocols, file layout, and runtime contracts may change rapidly.

The current canonical single-file runtime will live in:

```text
runtime/
```

The repository is being normalized from an existing standalone runtime and historical development bundles into a reviewable open-source structure.

## Repository map

```text
SuperPhiVessel/
├── runtime/        # Canonical standalone Vessie runtime
├── docs/           # Architecture, governance, roadmap, provenance
├── protocols/      # Governed contracts and protocol specifications
├── packages/       # Extracted reusable components and experiments
├── tests/          # Deterministic tests, fixtures, acceptance harnesses
├── deploy/         # Current deployment adapters/configuration
├── examples/       # Bounded examples and reference integrations
├── research/       # Design notes and research artifacts
├── legacy/         # Selected historical artifacts, not current runtime
└── .github/        # Repository automation and contribution surfaces
```

## Architectural intent

Super Φ.Vessel treats a model as a **capability provider**, not as the final authority boundary.

The runtime is designed around concepts including:

- explicit operator authority
- governed model routing
- immutable provenance and evidence custody
- proposal/execution separation
- Reality Gate review
- append-only / receipted operational history
- bounded memory
- human-approved execution
- fail-closed capability boundaries

The exact implementation status of each subsystem is documented separately. A feature being named or represented in the architecture does **not** imply that it is active, wired, authorized, or production-ready.

## Security

Do not commit API keys, tokens, credentials, private exports, browser storage, local memory databases, or operator-specific runtime state.

See [SECURITY.md](SECURITY.md) for the project security posture.

## License

Source code is released under the [MIT License](LICENSE), except where a file or asset is explicitly marked otherwise.

Visual asset provenance and licensing are tracked separately in `docs/ASSET_PROVENANCE.md`.

## Maintainer

Created and maintained through an ongoing human–AI engineering collaboration led by **MichaelWave369**.
