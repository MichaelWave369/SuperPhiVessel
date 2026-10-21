# Super Φ.Vessel

**Super Φ.Vessel (Vessie)** is an experimental governed cognitive operating layer for AI systems.

> **CAPABILITY ≠ AUTHORITY**

Vessie explores how capable AI models, local compute, hosted inference, memory, browser research, tools, evidence, and execution can live inside one system **without collapsing capability into permission**.

## Start here

| Surface | Purpose |
| --- | --- |
| **[Project site](https://michaelwave369.github.io/SuperPhiVessel/)** | Public front door, architecture, release status, and project orientation |
| **[Portable Windows Local Console](https://michaelwave369.github.io/SuperPhiVessel/local/)** | New portable, self-contained read-only local Ollama inventory dashboard; bundled Node runtime, no Git checkout or separate Node installation |
| **[React Vessie Cockpit](https://michaelwave369.github.io/SuperPhiVessel/vessie/)** | New modular review-only React shell, full GA108 explorer, candidate models and local evidence inspector. No model gateway connected. |
| **[Searchable User Manual](https://michaelwave369.github.io/SuperPhiVessel/manual/)** | Live searchable operator guide for chambers, models, memory, SOMA, browser tools, governance, bridges, output, and troubleshooting |
| **[Launch Vessie](https://superphivessel.netlify.app/)** | Current live Netlify deployment |
| **[GitHub Releases](https://github.com/MichaelWave369/SuperPhiVessel/releases)** | Frozen standalone runtime downloads and checksums |
| **[Current release](https://github.com/MichaelWave369/SuperPhiVessel/releases/tag/v2.0-alpha.11.0.54.10)** | v2.0-alpha.11.0.54.10 — Service Models Handler Restoration |

## Portable local Vessie console (Windows R2-LC)

The portable [Windows local console](https://michaelwave369.github.io/SuperPhiVessel/local/)
is a separately scoped **read-only localhost application**. It ships as a
self-contained ZIP containing a Node 22 executable, its redistribution
license, a fixed loopback-only HTTP server, the existing bounded Ollama
probe, and an offline dashboard. Extract and double-click
`Start-Local-Vessie.cmd`. No Git clone, developer setup, TLS certificate,
Node installation, firewall changes, admin rights or cloud API keys needed.

- Bind address: `127.0.0.1:8791` only, no LAN or public listener.
- The dashboard is served from the same loopback origin as its local API.
- API requires a random in-memory session bearer and rejects cross-site
  origins, forwarded hosts, foreign Host values, cookies, writes and
  unknown routes; no CORS allowlist for remote sites.
- Real Ollama inspection queries fixed `127.0.0.1:11434` read-only endpoints.
- Only explicit operator-triggered inventory reads are shown. **No
  model execution, agent action, private memory, writeback or model
  approval.**
- The hosted React `/vessie/` and classic Netlify runtime remain separate;
  the portable local console does **not** magically connect those sites.
- Windows package is assembled from an exact allowlist during the
  GitHub Pages workflow and redistributed with the Node runtime license.

Cloud-backed Ollama entries now display as **CLOUD REF** rather than
**INSTALLED**, with separate local-size, cloud and unknown counts. A cloud
name suffix is a hint; an on-disk size is only a reported weight size,
not a GPU compatibility claim. Nothing contacts a cloud provider.
See [model-location evidence rules](packages/vessie-local-console/MODEL_LOCATION_NOTES.md).

See [local console source](packages/vessie-local-console/),
[Windows portable packager](windows-local/build-portable.ps1), and
[operator notes](windows-local/START_HERE.txt). Windows source/packaging
CI cannot replace the operator's actual machine test.

## Optional one-shot local inference pilot · OFF by default

Starting from the portable Windows Local Console, you can now choose
between two separate double-click entrypoints:

- `Start-Local-Vessie.cmd`: **default read-only** discovery and metadata
  only; this mode never calls Ollama's generate endpoint.
- `Start-Local-Trial.cmd`: requires you to type `ENABLE` at startup.
  This explicitly enables **individual, operator-approved** text-generation
  experiments against the fixed local Ollama `/api/generate` endpoint.

For each trial, select a `LOCAL_WEIGHTS_REPORTED` entry, supply a prompt
of up to 2,000 characters, select 64 or 128 maximum output tokens, check
the approval box, then confirm the separate browser dialog. The server
re-probes Ollama immediately before running and refuses cloud references,
unknown origins, stale lists, extra request fields, and missing approval.
Maximum 6 attempts per process per hour, one active trial at a time,
90-second Ollama timeout, bounded model response and no automatic retry.

The local browser displays the generated text and an **ephemeral redacted
receipt** with model name, wall time, Ollama-reported token timings and a
response hash. The receipt excludes the prompt and generated text; exporting
a JSON receipt is a separate human action. Neither the prompt nor reply is
stored by this console, but Ollama itself may have runtime logs or
implementation-specific behavior.

No BrainC/Crane Fly automatic model routing, agent execution, cloud-model
invocation, training, background tasks, governance promotion, memory access
or paid API calls are enabled. Location classification and Ollama timing
metadata are only source-reported observations, not proof of GPU placement,
security isolation, successful training or independent attestation. For
best first results use a **small local model** such as `qwen3:4b`. Close
the process and restart the default launcher to restore read-only mode.

See [local Windows operator instructions](windows-local/START_HERE.txt)
and [trial source](packages/vessie-local-console/trial-runner.mjs).

After a **future** completed local one-shot trial, the operator may
record a separate, categorical **human answer review** in the active
browser session and explicitly export a small, redacted JSON review.
The review references the generated answer only by its SHA-256 digest
and never includes the prompt or the answer itself. Operator ratings
are self-reports, not independently verified quality or a BrainC route
approval. See [Human Review Guide](packages/vessie-local-console/HUMAN_REVIEW_GUIDE.md).
Previously exported timing receipts cannot be given retroactive answer
quality ratings unless the human also retained the actual answer.

The **Local Evidence Bench** can compare up to 24 explicitly selected,
redacted performance and human-review JSON receipts, in browser memory
only. Import is through a manual file selection, or the operator can
explicitly keep the latest receipt in the bench. Exports require another
click. Rows remain **chronological and unranked**. A matching human
self-report is linked to a performance observation by model and output
SHA-256, not by presumed hardware or a routing endorsement.
Old performance-only receipts are supported, but no model answer quality
is invented. See [Evidence Bench Guide](packages/vessie-local-console/EVIDENCE_BENCH_GUIDE.md).

The bench can now be deliberately saved as a **portable, redacted
evidence bundle** and restored in a later session by selecting that JSON
file manually. The earlier descriptive-comparison export remains
available, but is deliberately not reimportable. The portable bundle
contains only up to 24 validated, normalized observations; it never
contains prompts, model answers, bearer secrets, or routing approvals.
No automatic disk save, cloud sync, retention, or import on startup.
See [Portable Bench Guide](packages/vessie-local-console/PORTABLE_BENCH_GUIDE.md).
New optional receipt timing fields and careful interpretation of cold load
versus prompt processing and generation are documented in
[performance receipt guide](packages/vessie-local-console/PERFORMANCE_RECEIPT_GUIDE.md).
A trial reaching the requested token count is not automatically a
complete, correct answer or a benchmark of GPU residency.

### Repeatable local trial protocol cards (operator-approved only)

The Windows Local Console offers three public fixed-prompt cards for
governance, basic logic and code review. Clicking **Load** only fills the
prompt editor; it cannot execute a model. The separately enabled trial
runner still requires a locally size-reported model, a per-prompt
checkbox and a separate browser confirmation. The local server
accepts a `protocol_id` in its redacted receipt **only** after
validating the exact versioned public prompt and output-token cap.
Old custom trials remain valid and explicitly unlabeled. The evidence
bench and portable bundles preserve allowed protocol IDs for
human-reviewed, unranked comparisons. No automatic batch runs or
model routing. See
[trial protocol operator guide](packages/vessie-local-console/TRIAL_PROTOCOL_CARDS_GUIDE.md).

### Evidence Bench · protocol-specific coverage (descriptive only)

The Local Evidence Bench now includes **Protocol Cohorts**, a pure
read-only view of existing redacted observations grouped by public
protocol and model. It shows sample counts, matching operator review
counts, reported median timings/throughput and evidence gaps.
A fixed-protocol label with a mismatched output-token limit is
excluded rather than treated as a comparable trial. Custom/legacy
unlabeled receipts remain in the original comparison table.
The view neither runs tests nor ranks/qualifies models, and source
JSON is unauthenticated. See
[Protocol Cohort Guide](packages/vessie-local-console/PROTOCOL_COHORT_GUIDE.md).

### Human protocol reference checks (optional, not grading)

After a successfully completed, server-labeled public protocol trial,
the local Human Answer Review panel can reveal a **human-only public
answer reference and three review checks** by a separate operator click.
Governance, sock-drawer logic and JavaScript indexing references help
an operator inspect correctness before voluntarily recording the
existing subjective review. There is no automatic grade, new exported
rating, answer parsing, AI judge or routing permission. Custom,
unlabeled or failed trials show no answer reference. See
[Human Protocol Reference Guide](packages/vessie-local-console/HUMAN_PROTOCOL_REFERENCE_GUIDE.md).

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

## Windows Starter · no local checkout needed

If this is your first time using SuperPhiVessel on a Windows PC,
**nothing is installed by merging GitHub pull requests**. Use the
[Windows starter page](https://michaelwave369.github.io/SuperPhiVessel/starter/)
and download the portable `SuperPhiVessel-Windows-Starter.zip`
built and hosted automatically by the GitHub Pages workflow.

Extract the ZIP and double-click `Start-Vessie.cmd` (no administrator
rights required). The read-only launcher checks optional local Ollama
at `127.0.0.1:11434` and opens the hosted React cockpit. No Node.js,
Git clone, gateway credentials, TLS certificate or private key are
required for this first step.

**This is a first-run starter, not a full local SuperPhiVessel
installation.** It does not install a model, execute inference, import
private memory, or make the hosted cockpit read your local models. The
secure browser pairing gateway remains a separate optional R2 field
pilot requiring Windows trust/browser qualification.

The package is built from three allowlisted files in
[`windows-starter/`](windows-starter/) with
[`build-package.py`](windows-starter/build-package.py). No download
scripts, package-manager installs, self-updaters, server exposure,
certificate bypasses or privileged actions are included.

## R2 guided Windows physical pairing pilot

The [R2 field-pilot guide](packages/vessie-gateway-v0.1/pilots/README.md)
includes `Invoke-R2FieldPilot.ps1` with explicit `Collect` and
`Assess` stages. It combines the *existing* no-key-read preflight,
fresh operator trial ID, Windows strict TLS/refusal checks and later
offline redacted-browser comparison. An actual Windows browser run is
still mandatory; no CI test or local helper self-certifies a machine,
changes route weights, or grants model execution.

## R2 Windows operator source preflight

Before physically testing browser-to-localhost pairing, the
[Windows R2 operator preflight](packages/vessie-gateway-v0.1/pilots/README.md)
can check Node version, the public TLS certificate's IP SAN/validity,
and the **existence of** the private key outside the repository, without
opening that key or changing Windows trust. It deliberately reports
no real machine, gateway, browser or routing qualification. The physical
Windows R2 pilot still requires separate operator testing.

## R2 Windows/browser operator trial correlation

The R2 [physical field pilot](packages/vessie-gateway-v0.1/pilots/README.md)
now generates one random, non-secret trial ID for the Windows HTTPS
report and React browser report. The assessor requires the same label
and a bounded timestamp relationship, preventing accidental comparison
of unrelated runs. Browser receipts use schema v0.3. Matching reports
still do **not** attest a machine, prove inference quality, qualify
R2 physically, approve BrainC, or grant execution authority.

## R2 browser revocation confirmation

The [Windows R2 physical-pilot guide](packages/vessie-gateway-v0.1/pilots/README.md)
now requires the browser to observe both an acknowledged read-only
session deletion **and** subsequent `403 SESSION_DENIED` for that same
old bearer. The redacted browser report is now `v0.2`; older reports
cannot pass the updated field comparator. A browser-observed refusal
does **not** equal independent Windows/Chromium field qualification,
live routing permission or runtime attestation.

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

### Manual Scout qualification handoff (SPV-SCOUT-01)

The React Vessie cockpit includes a **SCOUT HANDOFF** tab to review operator-pasted `phibot.scout-vessie-handoff.v0.1` JSON from a real Windows PhiBot Scout qualification. The UI recomputes source freshness but **does not verify the SHA digest** (it has no original receipt bytes), authenticate model execution, or grant any capability. No network, model, routing or memory connection is implemented. See [operator guide](docs/SCOUT_HANDOFF_REACT.md).

### SPV-SCOUT-02 optional paired Scout receipt read

The **SCOUT HANDOFF** React tab can now read a previously qualified, redacted PhiBot Scout receipt from the existing optional local HTTPS pairing gateway. The operator must explicitly configure one local `scout-*` receipt directory at gateway startup. Default disabled; no model, tool, memory, routing or agent invocation. Pair under MODEL FABRIC, then perform one explicit read in SCOUT HANDOFF. Browser session remains in memory across tabs for at most 15 minutes. See [Windows operator guide](docs/SCOUT_PAIRED_READ_V0_1.md).


## R9: Skill Passport offline compatibility reader

SuperPhiVessel now includes a small **offline read-only** Node.js 20+ consumer for PhiLearn Skill Passport v1:

    node interop/verify-passport.mjs path/to/skill-passport.json

It is **not connected** to Vessie routing, local-console APIs, memory, agent identities, deployment gates or tools. No network calls occur. The command reads a locally supplied JSON file capped at 256,000 bytes, replays six simulated PhiLearn R6 actions, verifies R7 and R8 SHA-256 checksums, and outputs a JSON report.

Pass statuses are explicitly REPLAY_PASS_UNTRUSTED; failing data returns REPLAY_FAIL_UNTRUSTED. In both cases authority = NONE and permissions = []. Checksums are not digital signatures and cannot prove model identity or that a claimed observation happened. A JSON author can fabricate and rehash synthetic traces. Imported passports **never grant capabilities or authority**.

Conformance checks:

    node --test interop/skill-passport-verifier.test.mjs

This adapter establishes wire-protocol compatibility, **not** live interchange or any trust promotion. PhiLearn's interop/README.md documents the contract.


## R10: Optional Ed25519 signed Skill Passport provenance

R10 adds a **read-only offline signature-verification layer** to the existing R8/R9 portable Skill Passport. The outer format is philearn.signed-skill-passport.v1, enclosing an unchanged R8 philearn.skill-passport.v1 record. Signature checking is optional and requires an independently operator-pinned public key; **receiving a public key from the sender is not sufficient authentication**.

### Operator workflow (Node.js 20+)

Run on a trusted operator-owned machine:

    node interop/r10-cli.mjs keygen /secure/operator-dir field-lab
    node interop/r10-cli.mjs sign passport.json /secure/operator-dir/issuer.private.pem field-lab signed.json

Keygen creates a private Ed25519 PEM and a candidate public trust file. The **unencrypted private key** is saved with permission mode 0600, but must be protected using local access controls, excluded from Git, and kept out of shared or cloud-synced directories. For higher-risk signing prefer hardware-backed key protection. The recipient separately authenticates the issuer identity and public key fingerprint through an out-of-band channel, then pins that key in their own local trust-store copy. A key delivered along with an untrusted passport must not be automatically accepted.

Verify using an already authenticated receiver-controlled local trust store:

    node interop/r10-cli.mjs verify signed.json /local/operator-pinned-trust.json

Optional --review is an *explicit inspection acknowledgment*, not a permission change. Unknown keys, revoked/inactive keys, wrong scope, modified payloads, forged signatures or missing evidence fail closed. Without a trust store the signature remains UNPINNED_SIGNATURE. Key revocation is manual at the receiver and never auto-synchronized.

The Ed25519 signature covers a versioned domain separator, issuer ID, SHA-256 DER-SPKI public key fingerprint, claimed signing time and validated R8 passport payload digest. The verifier always validates the six frozen synthetic R6 tool traces and the R7/R8 hashes *before* accepting provenance.

### Consumers and boundaries

- PhiLearn: offline Node 20+ signer/verifier and conformance checks.
- BrainC: offline Python 3.11+ verifier using cryptography; no FastAPI integration.
- SuperPhiVessel: offline Node 20+ verifier; no routing or local-console integration.

In all outcomes, even after a valid pinned-key signature and manual inspection: authority NONE, permissions [], and actionAllowed false. A valid signature confirms use of the matching operator-pinned private key, **not** the historic truth of an editable synthetic benchmark, real-world model ability, changes to weights, an externally attested clock, or permission to execute actions. No signing keys are committed to the repository.

### Conformance checks

    node --test interop/r10-signed-passport.node-check.mjs


## R11: Governed agent evidence enrollment (inspection-only)

R11 keeps **signing-key identity, demonstrated synthetic benchmark evidence, and operational permissions** as three different concepts. The last remains **completely outside this module**. The receiver cannot enroll anything for action execution, even when every test succeeds.

A standalone receiver-controlled **inspection enrollment registry** records the operator's explicit approval to inspect one exact R10 Ed25519 signed R8 Skill Passport. The review entry is bound to the entire signed envelope's SHA-256, issuer ID, signing key fingerprint, model label, the exact R6 synthetic-only scope, the reviewing operator, and a short lease (1–168 hours). The system replays the six synthetic R6 traces and validates R10's operator-pinned public key every time. The receiving machine's local registry is not a cryptographic credential. Keep it outside shared/untrusted locations.

### Offline operator workflow

Node.js 20+ (PhiLearn or SuperPhiVessel):

    node interop/r11-cli.mjs init local-registry.json
    node interop/r11-cli.mjs check signed.json /local/pinned-keys.json local-registry.json
    node interop/r11-cli.mjs approve signed.json /local/pinned-keys.json local-registry.json operator-id 24 reviewed-registry.json
    node interop/r11-cli.mjs check signed.json /local/pinned-keys.json reviewed-registry.json

To revoke, copy the enrollmentId from your locally approved registry and run:

    node interop/r11-cli.mjs revoke reviewed-registry.json <enrollment-sha256> operator-id revoked-registry.json

BrainC Python 3.11+ with cryptography installed:

    python3 scripts/r11_enrollment.py init local-registry.json
    python3 scripts/r11_enrollment.py approve signed.json /local/pinned-keys.json local-registry.json operator-id 24 reviewed-registry.json
    python3 scripts/r11_enrollment.py check signed.json /local/pinned-keys.json reviewed-registry.json
    python3 scripts/r11_enrollment.py revoke reviewed-registry.json <enrollment-sha256> operator-id revoked-registry.json

All *approve* and *revoke* operations require explicit CLI invocation. Updates are written to new files rather than silently overwriting existing registries; operators decide whether and when to replace the active receiver-controlled file.

### Fail-closed decision states

- SIGNATURE_REJECTED: R10 signer pin or R8/R9 source replay failed.
- REGISTRY_REJECTED / NOT_ENROLLED: absent, malformed, mismatched, or unapproved receiver-local registry.
- NOT_YET_VALID / EXPIRED: local enrollment clock outside the bounded lease.
- REVOKED: operator revoked this exact envelope; same envelope cannot be silently renewed.
- APPROVED_FOR_INSPECTION_ONLY: exact payload, pinned key, valid evidence replay, and receiver's manually approved unexpired inspection lease.

**Invariant:** Every result carries authority NONE, permissions [], actionAllowed false. Even approval authorizes only *local passive evidence inspection*. This is not executable agent enrollment, an access token, deployment approval, a persisted learned skill, or a privilege escalation. No API endpoints, tool bridges, model calls, agent-memory writes, shell execution from evidence, key generation, network exchange, or runtime permission modifications were added by R11. No signing key is checked in.

The registry can be edited by whoever controls the host, and local timestamps depend on that machine's clock. It therefore does not establish an independently verified human approver or trusted time. A more advanced release would require authenticated operator decisions, tamper-evident log storage, key lifecycle operations and a separate real-world action policy gate before permitting any tool execution.


## R12: Tamper-evident, operator-signed governance event ledger

R12 adds a **separate, offline operator event history** on top of R10 pinned-key provenance and R11 inspection-only enrollment. It is intentionally **not** wired into live BrainC or Vessie APIs, agents, model routing, memory, authorization or tooling.

The event log's scope is limited to **inspection of evidence**. It records an operator-signed event for APPROVE_INSPECTION, REVOKE_INSPECTION, or EXPIRE_INSPECTION, with an incrementing sequence number, SHA-256 of the prior signed event, exact signed passport envelope hash, pinned issuer key fingerprint, model label, claim scope, reviewing operator's pinned Ed25519 key fingerprint, timestamp, and bounded expiry (at most seven days).

A receiver independently validates every Ed25519 event signature using a **separate, operator-controlled R12 public-key trust store**, reconstructs the hash-linked chain, validates state transitions, compares the entire event chain with an **independently preserved checkpoint** (event count + head SHA-256), and then rechecks the underlying R10 signed passport and R6 synthetic replay. A changed, reordered, forged, truncated or stale log is rejected when the receiver has the authentic latest checkpoint. A signed revocation or explicit expiry is terminal for that exact enrollment.

**Critical limitations:** The chain alone does not prevent deletion or rewriting. If an attacker can also replace the receiver's checkpoint or pinned keys, a local verification cannot detect all tampering. Keep the latest known head independently from the writable ledger, ideally replicated to independent protected storage. Ed25519 authenticates possession of a pinned operator signing key, not an independently verified human identity or honest historical action. Local timestamps are untrusted. All CLI operations create new files, not silent in-place overwrites. Private operator keys must be generated and stored outside Git or synced folders.

**Invariant:** Even a valid checkpointed and operator-approved report returns authority NONE, permissions [], actionAllowed false. It authorizes *passive evidence inspection only*. No runtime permissions, agent tool grants, live deployment approval, memory-writing, or model execution exist in R12.

### Operator commands

The full offline signing and event-authoring CLI is included with PhiLearn:

    node interop/r12-cli.mjs operator-keygen /secure/outside-repo/dir operator.alpha
    node interop/r12-cli.mjs init new-ledger.json new-checkpoint.json
    node interop/r12-cli.mjs approve signed.json R10-pinned-keys.json R12-operator-keys.json ledger.json operator-private.pem operator.alpha 24 prior-checkpoint.json next-ledger.json next-checkpoint.json --confirm
    node interop/r12-cli.mjs revoke enrollment-sha256 R12-operator-keys.json ledger.json operator-private.pem operator.alpha prior-checkpoint.json next-ledger.json next-checkpoint.json --confirm
    node interop/r12-cli.mjs expire enrollment-sha256 R12-operator-keys.json ledger.json operator-private.pem operator.alpha prior-checkpoint.json next-ledger.json next-checkpoint.json --confirm
    node interop/r12-cli.mjs check signed.json R10-pinned-keys.json R12-operator-keys.json ledger.json independent-checkpoint.json

The operator-keygen command creates an **unencrypted** mode-0600 private key PEM and a candidate public trust-store JSON. Recipients must verify and pin the public key through a separate authenticated process before accepting it. Do not commit either real private keys or approvals as authorization credentials. Explicit event expiry is optional because elapsed lease expiry is enforced during verification even without a new event.

BrainC has its own Python 3.11+ standard-library/cryptography implementation in scripts/r12_governance.py. SuperPhiVessel includes a passive read-only Node verifier in interop/r12-check.mjs, with the matching shared Node event-chain implementation. These implementations deliberately **do not connect** the ledger to real privileges.

Only signature-chain consistency, separately known head continuity, and synthetic-evidence replay are established. This remains a research governance audit, not a trustworthy external authorization system.


### SuperPhiVessel passive local check

    node interop/r12-check.mjs signed.json R10-pinned-keys.json R12-operator-keys.json ledger.json independently-saved-head.json

This consumer does not expose an HTTP route or mutate Vessie's routing, sessions, agents or memory. Operator signing and event-authoring remain separate from the runtime.
