# Super Φ.Vessel

**Super Φ.Vessel (Vessie)** is an experimental governed cognitive operating layer for AI systems.

> **CAPABILITY ≠ AUTHORITY**

Vessie explores how capable AI models, local compute, hosted inference, memory, browser research, tools, evidence, and execution can live inside one system **without collapsing capability into permission**.

## Start here

| Surface | Purpose |
| --- | --- |
| **[Project site](https://michaelwave369.github.io/SuperPhiVessel/)** | Public front door, architecture, release status, and project orientation |
| **[React Vessie Cockpit](https://michaelwave369.github.io/SuperPhiVessel/vessie/)** | New modular review-only React shell, full GA108 explorer, candidate models and local evidence inspector. No model gateway connected. |
| **[Searchable User Manual](https://michaelwave369.github.io/SuperPhiVessel/manual/)** | Live searchable operator guide for chambers, models, memory, SOMA, browser tools, governance, bridges, output, and troubleshooting |
| **[Launch Vessie](https://superphivessel.netlify.app/)** | Current live Netlify deployment |
| **[GitHub Releases](https://github.com/MichaelWave369/SuperPhiVessel/releases)** | Frozen standalone runtime downloads and checksums |
| **[Current release](https://github.com/MichaelWave369/SuperPhiVessel/releases/tag/v2.0-alpha.11.0.54.10)** | v2.0-alpha.11.0.54.10 — Service Models Handler Restoration |

## Current canonical runtime

**Version:** v2.0-alpha.11.0.54.12 — BudgetGenius Canonical Outcome Handoff

**Path:** runtime/Super_PhiVessel_v2.0-alpha.11.0.54.12_BudgetGenius_Outcome_Handoff.html

**SHA-256:** a9e67b12d1c3622315b6937f1c2405acbd5b2a6bc6d32cf578c67d5178fa7212

**Git blob:** c9dc18eb76be9883d18014de129c07cf78c5a498

The canonical runtime was promoted from the exact standalone artifact tested in the live Netlify deployment. Runtime identity, size, version, and release invariants are recorded in [runtime/MANIFEST.json](runtime/MANIFEST.json).

## What is Super Φ.Vessel?

Super Φ.Vessel treats an AI model as a **capability provider**, not as the final authority boundary.

The system separates:

- human intent from operational permission
- model generation from verified evidence
- observation from inference
- proposal from execution
- memory retrieval from prompt admission
- browser reading from browser interaction
- model discovery from model approval
- model approval from model activation
- evidence transport from authority transport

The result is less “one giant AI agent that can do everything” and more a **governed cognitive workstation** where different capabilities have explicit boundaries.

## Core governance invariants

- **CAPABILITY ≠ AUTHORITY**
- **GOAL ≠ PERMISSION**
- **INFERENCE ≠ OBSERVATION**
- **PROPOSAL ≠ EXECUTION**
- **RETRIEVAL ≠ PROMPT ADMISSION**
- **EVIDENCE TRANSPORT DOES NOT TRANSPORT AUTHORITY**
- **CAPABILITY TO REMEMBER ≠ PERMISSION TO SHIP MEMORY**

When authorization, provenance, evidence integrity, or execution state cannot be established, governed paths are designed to prefer explicit **BLOCKED / HELD / FAILED / INSUFFICIENT** outcomes over invented success.

Read the full model in [docs/GOVERNANCE.md](docs/GOVERNANCE.md).

## The five-chamber workflow

Vessie can be used as a normal conversational interface, but its main governed work path is organized around five chambers:

| Chamber | Role |
| --- | --- |
| **Quick Chat** | Everyday conversation, questions, planning, and bounded research |
| **Dreamer** | Symbolic, speculative, unconventional, and exploratory thinking |
| **Translator** | Converts selected Dreamer material into explicit mappings and reality-bridge candidates |
| **Builder** | Produces governed candidate builds, patches, tests, and verification evidence |
| **Ledger** | Audits provenance, evidence, conflicts, execution facts, and final governed receipts |

These chambers are **not a mandatory ceremony**. Use only the path the task requires.

## Major runtime surfaces

| Surface | Current status | Boundary |
| --- | --- | --- |
| Quick Chat / Dreamer / Translator / Builder / Ledger | **LIVE** | Role separation does not itself grant execution authority |
| PV-MEM Vessel Memory | **LIVE** | Recall is context only; it does not promote truth or authority |
| Multi-Vessel Tabs / WorkObject | **LIVE** | Context and project state do not carry authority by default |
| Professor Φ / Genius Atlas | **LIVE** | Specialist perspectives remain non-authoritative |
| Brain Registry / AutoFabric / Crane Fly | **LIVE** | Discovery and routing remain bounded by approved model pools |
| Model Scout / Challenger Bench | **LIVE** | Comparison evidence never silently installs, activates, or promotes a model |
| SOMA sensory surfaces | **LIVE / CONDITIONAL** | Device/browser permission and operator action remain required where applicable |
| Direct Research Fabric | **LIVE** | Read-only public web observation; no network mutation |
| Browsallax Browser Operator | **CONDITIONAL** | Interactive authority remains separately governed |
| Netlify BrainC | **LIVE in deployment** | Hosted cognition does not inherit tool or action authority |
| PhiOS Bridge | **CONDITIONAL** | Proposal context does not equal execution; execution requires an existing lease |
| Local Ollama Fabric | **CONDITIONAL** | Installed/discovered does not mean approved or active |
| Artifact Workshop | **LIVE** | Output/presentation does not promote evidence or authorize action |
| SPD-W v0.1 | **EXPERIMENTAL / UNWIRED** | Frozen acceptance contract passes independently; not integrated into the canonical runtime |

For current subsystem truth, use [docs/RUNTIME_STATUS.md](docs/RUNTIME_STATUS.md) and the **[live searchable manual](https://michaelwave369.github.io/SuperPhiVessel/manual/)**.

## Searchable User Manual

The GitHub Pages manual is a live static documentation app:

**[Open the Super Φ.Vessel User Manual](https://michaelwave369.github.io/SuperPhiVessel/manual/)**

It includes:

- instant client-side search
- WORK / INTELLIGENCE / SENSES / GOVERNANCE / LABS / BRIDGES / OUTPUT filters
- LIVE / CONDITIONAL / EXPERIMENTAL / LOCKED / LEGACY / UNWIRED status labels
- purpose and location for major operator-visible systems
- explicit authority boundaries
- five-chamber quick start
- Service / Models guidance
- memory guidance
- web reading vs interaction guidance
- troubleshooting notes
- shareable query/filter URLs

The manual is **read-only documentation**. It cannot route a model, approve an executor, install software, promote evidence, mint a grant/lease, or execute an action.

## Run Vessie without installing anything

### Live web version

Open **[superphivessel.netlify.app](https://superphivessel.netlify.app/)**.

The hosted deployment provides the current web experience and Netlify BrainC integration.

### Standalone HTML

Download the current runtime from the **[v2.0-alpha.11.0.54.10 GitHub Release](https://github.com/MichaelWave369/SuperPhiVessel/releases/tag/v2.0-alpha.11.0.54.10)** and open the HTML file in a modern browser.

The standalone runtime can provide a large portion of Vessie's interface and local browser behavior without an install. Hosted/server-side integrations such as Netlify BrainC require their deployment environment, and local-model execution requires a configured local model runtime such as Ollama.

## Blank-state public releases

A fresh public Vessie must not ship with prior operator-derived:

- chat or Dreamer history
- committed Vessel memory
- prior session/work state
- receipts
- persisted provider credentials
- private browser-derived state

The public data epoch introduced in .54.8 is retained by .54.10:

**PV-PUBLIC-BLANK-2026-09-29-V1**

The .54.10 hotfix does **not** establish a new epoch, so it does not intentionally repeat the legacy-state reset for users already on the current epoch.

The source-level blank-state contract and CI gate remain active. Full browser-storage deployment verification is tracked separately in [docs/BLANK_STATE.md](docs/BLANK_STATE.md).

## v2.0-alpha.11.0.54.10

.54.10 repairs the complete known-good Service → Models handler set that remained referenced by the UI after later runtime merges dropped the implementations:

- exportKeyring
- autoAssignOllama
- applyOllamaStabilityPreset

The exact artifact was verified in production before canonical promotion.

CI now contains a regression gate ensuring those handler definitions remain present before their Service / Models bindings.

## Integrity and release discipline

[core-integrity.yml](.github/workflows/core-integrity.yml) verifies:

- canonical runtime path from runtime/MANIFEST.json
- runtime byte size
- SHA-256
- version marker
- blank-state migration contract
- Service / Models handler restoration contract
- frozen SPD-W acceptance contract

The repository also contains an automated canonical-release workflow. A release is published only after the runtime identified by the manifest matches its expected digest.

Release chain:

    production-tested runtime
            ↓
    runtime/MANIFEST.json
            ↓
    deterministic CI
            ↓
    main
            ↓
    GitHub tag + prerelease
            ↓
    standalone HTML + checksum
            ↓
    GitHub Pages status/manual

## Architecture

    Human Operator
          │
          ▼
    Intent / Work Context
          │
          ▼
    Governance + Authorization
          │
          ▼
    Routing / Cognitive Roles
          │
          ▼
    Model / Tool Capability
          │
          ▼
    Evidence + Verification
          │
          ▼
    Effect Boundary
          │
          ▼
    Receipts / Ledger / Persistent State

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the architectural overview.

## Repository map

    SuperPhiVessel/
    ├── runtime/        Canonical standalone runtime + integrity manifest
    ├── site/           GitHub Pages project site + searchable user manual
    ├── docs/           Architecture, governance, runtime status, blank-state contract, release notes
    ├── protocols/      Governed contracts and protocol specifications
    ├── packages/       Extracted reusable components and experiments
    ├── tests/          Deterministic tests, fixtures, and acceptance harnesses
    ├── deploy/         Deployment adapters/configuration
    ├── examples/       Bounded examples and reference integrations
    ├── research/       Design notes and research artifacts
    ├── legacy/         Selected historical artifacts, not current runtime truth
    └── .github/        CI, release publishing, Pages deployment, contribution surfaces

## Useful documentation

- **[Project site](https://michaelwave369.github.io/SuperPhiVessel/)**
- **[Searchable User Manual](https://michaelwave369.github.io/SuperPhiVessel/manual/)**
- [Architecture](docs/ARCHITECTURE.md)
- [Governance](docs/GOVERNANCE.md)
- [Runtime Status](docs/RUNTIME_STATUS.md)
- [Blank-State Release Contract](docs/BLANK_STATE.md)
- [Roadmap](docs/ROADMAP.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Release notes](docs/releases/)

## Project status

Super Φ.Vessel is an **alpha research and engineering project**.

Interfaces, protocols, file layout, model support, bridges, and runtime contracts may change rapidly. A named feature, source file, package, or historical note is not evidence that a subsystem is currently active, authorized, integrated, or production-ready.

## Security

Do not commit:

- API keys
- access tokens
- provider credentials
- private exports
- browser storage
- local memory databases
- operator-specific runtime state

See [SECURITY.md](SECURITY.md).

## License

Source code is released under the [MIT License](LICENSE), except where a file or asset is explicitly marked otherwise.

## Maintainer

Created and maintained through an ongoing human–AI engineering collaboration led by **MichaelWave369**.

## Modular React cockpit (candidate)

The existing GitHub Pages front door and searchable manual remain intact.
The new React shell is built from `apps/vessie-web/` into `site/vessie/` only during Pages deployment.

- [Open Vessie React cockpit](https://michaelwave369.github.io/SuperPhiVessel/vessie/)
- [Routing rebase](docs/routing/ROUTING_REBASE_V1.md)
- [Local/free-API model audit](docs/routing/MODEL_AUDIT_2026_10_08.md)
- [Gateway contract](docs/routing/GATEWAY_CONTRACT_V1.md)

**Preview-only:** shows real GA108 roster and repository manifest, explicit candidate model statuses, and browser-only bounded receipt inspection. Does not run models, accept secrets, validate signatures, or replace the canonical executor. Physical Observer .54.13 remains a separate unpromoted review candidate.

## Experimental read-only browser pairing (R2)

The React Model Fabric tab can optionally pair with a locally trusted HTTPS
gateway started by the operator. Pairing is a one-use secret from the local
terminal and a short-lived in-memory read-only session, never a model execution
grant. See [R2 local certificate setup and field limitations](packages/vessie-gateway-v0.1/BROWSER_PAIRING_R2.md).

The canonical .54.12 runtime and unpromoted .54.13 Physical Observer are
untouched. R2 is source/test qualified only; real browser/private-network
behavior requires an explicit Windows pilot.

## R3-A extracted route trace inspector (offline)

The local Python [R3-A routing trace exporter](packages/vessie-gateway-v0.1/R3A_ROUTING_TRACE.md)
uses read-only SQLite to verify P1-C route receipts and optional P3-A shadow
outcomes before projecting only safe, bounded routing metadata. The React receipt
inspector recognizes that projection **without** claiming a signature or authority.

No live BrainC telemetry, model execution or browser gateway trace endpoint
is enabled. R2 field qualification remains an operator-owned prerequisite.

## R3-B: BrainC donor configured-state telemetry (read-only)

[R3-B source audit](packages/vessie-gateway-v0.1/brainc-donor/BRAINC_DONOR_AUDIT.md)
pins the actual BrainC v1 model/chat code and provides a fixed-loopback local
probe for `/models` and `/models/active`. The CLI defaults to a redacted
review report. This is **not** an executed chat-model or Crane Fly route receipt,
and it does not connect BrainC to the React HTTPS gateway.

## R3-F offline batch custody and duplicate-evidence review

The [R3-F signed batch auditor](packages/vessie-gateway-v0.1/canonical-routes/CUSTODY_BATCH_R3F.md)
reviews multiple operator-signed R3-E receipts together and flags
repeated packet IDs, indistinguishable redacted summaries, non-monotonic
operator signing times and mixed terminal outcomes. Its results remain
operator-custody **only**, not a runtime trace, independent quality
metric, cross-batch replay prevention or P4 learning reward. Production
runtime `.54.12` remains frozen; R2 physical field qualification and
Physical Observer `.54.13` hold remain unchanged.

## R3-E offline operator-signed evidence

An optional [R3-E Ed25519 operator envelope](packages/vessie-gateway-v0.1/canonical-routes/OPERATOR_ENVELOPE_R3E.md)
wraps the **redacted** R3-C/R3-D projection for independently checkable
operator-key custody, using an externally supplied trusted public key.
It does not attest canonical runtime source, completed inference, answer
quality, physical R2 pairing, or grant action/learning authority. The
canonical `.54.12` production HTML and `.54.13` promotion hold remain
unchanged. React recognizes imports but cannot validate signatures.

## R3-D routing outcome reconciliation

R3-D hardens the R3-C projector and React inspector against misleading
mixed terminal outcomes. When the same imported run contains both native
`FAILED` and `COMPLETED` rows, the report now declares
`MIXED_TERMINAL_RECORDS_UNRESOLVED` instead of selecting completion by
precedence. This **does not** prove a final outcome, a valid retry sequence,
or suitability for routing-learning rewards. The canonical runtime and
authorization chain remain unchanged. See the
[R3-C/R3-D evidence contract](packages/vessie-gateway-v0.1/canonical-routes/README.md).

## R3-C canonical routing evidence (operator-exported, offline)

[R3-C receipt projector](packages/vessie-gateway-v0.1/canonical-routes/README.md)
joins native `.54.12` `PhiRunCapsule`, `BrainRouteReceipt`,
`ExecutorAuthorizationReceipt`, attempt-ledger and optional BudgetGenius
canary influence records. Selection, authorization, attempt and recorded
completion are separate claims; completion is **not independently verified**.
The React inspector recognizes the resulting redacted schema without treating
it as live or as an executor grant. No production HTML bytes are changed.
