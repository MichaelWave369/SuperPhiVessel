# Architecture

## Overview

Super Φ.Vessel is a governed cognitive operating layer that sits between a human operator, AI model capabilities, tools/bridges, persistent state, and executable effects.

The architecture is intentionally built around separation of concerns rather than assuming that a capable model should also be the authority boundary.

## Core separation

```text
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
```

## Governing invariants

- CAPABILITY ≠ AUTHORITY
- GOAL ≠ PERMISSION
- INFERENCE ≠ OBSERVATION
- PROPOSAL ≠ EXECUTION
- retrieval ≠ prompt admission
- readable page ≠ usable service
- usable service ≠ established session
- established session ≠ proven interaction
- evidence transport does not transport authority

## Major subsystem families

The standalone runtime has evolved around subsystem families such as:

- **Conversation / Work context** — bounded user/model work state
- **Crane Fly / Brain Registry** — governed routing and executor selection
- **Dreamer / Translator / Builder / Ledger** — role-separated cognitive chambers
- **Reality Gate** — deterministic and policy review before promotion
- **Promotion / Evidence Fabric** — immutable claim/evidence custody
- **Memory** — bounded Vessel-scoped context with explicit admission rules
- **Browser / Research lanes** — observation separated from interactive authority
- **PhiOS bridge** — proposal/context handoff separated from execution leases
- **System Map / Inspector** — read-only runtime truth surfaces
- **Labs / instruments** — bounded experimental compute surfaces
- **Chamber Fitness / Challenger Bench** — evidence for human model-routing review, not automatic promotion

## Status discipline

Documentation should classify subsystems using explicit states such as:

- LIVE
- CONDITIONAL
- EXPERIMENTAL
- LOCKED
- LEGACY
- UNWIRED

The presence of a subsystem in source or documentation must never be interpreted as evidence that it is active or authorized in the current runtime.

## Canonical runtime

Until the runtime is modularized, the current standalone HTML artifact is the source of truth for shipped behavior. It belongs under `runtime/`.

This document is architectural orientation, not an executable specification. Protocol-specific invariants belong under `protocols/`.


## Sparse Frontier Routing

An extracted **Sparse Frontier Routing (SFR)** candidate now explores a bounded escalation layer between cheap/local decision work and specialist/frontier investigation.

Its purpose is not to choose the “best big model” for every task. It asks first whether deeper reasoning is warranted at all.

Current extracted status: **EXPERIMENTAL / UNWIRED**.

Key boundaries:

- local/deterministic work remains preferred when adequate;
- frontier escalation receives only a bounded evidence-linked region;
- GA108 specialists remain persistent dormant identities and only a small subset may be recommended;
- SFR recommendations do not activate a model or grant authority;
- learned NBG signals remain log-only in v0.1;
- routing usefulness is recorded in shadow mode and cannot change live thresholds yet;
- Reality Gate / existing authorization remains the action boundary.

See `packages/sparse-frontier-v0.1/README.md`.


## PV-DLAM P2 peer synchronization

An extracted P2 reference now defines the application-level synchronization seam above the qualified P1 local store.

The boundary is intentionally narrow:

- the local PV-DLAM service decides memory admission;
- peer identity/signing and network transport remain replaceable dependencies;
- Infinite Porch is the intended transport/identity donor, not the memory source of truth;
- only signed scoped MEMORY_ADMIT and MEMORY_TOMBSTONE objects are accepted;
- SQLite/WAL files, vectors, context packets, opaque routing state, and action authority are not synchronized as canonical objects;
- remote claims receive collision-safe local replica identities;
- concurrent incompatible claims remain visible;
- same-peer source rewrites quarantine rather than overwrite;
- tombstone frontiers suppress stale replay;
- revocation epochs invalidate queued old-authority envelopes;
- signed receipts are evidence, never authority.

The extracted package lives at `packages/dlam-p2-v0.1/`. It is not yet live-wired to Infinite Porch or the canonical runtime.


## P3 Routing Observatory

P3 begins with an extracted observability layer over the qualified P1/P2 substrate.

The observatory records immutable finalized outcomes anchored to exact P1-C route receipts and optional Sparse Frontier decisions. It creates scorecards across the complete GA108 roster while preserving dormant identities with zero evidence.

The observatory may summarize:

- per-Genius task-class outcomes;
- exact model usage;
- quality/success history;
- confidence calibration;
- evidence satisfaction;
- corrections;
- latency/tokens/cost;
- SFR escalation usefulness;
- governance violations and critical misses.

It deliberately does not store raw prompt/memory text and does not activate learned routing.

P3 shadow rankings carry:

- `activation_status=SHADOW_ONLY_DORMANT`
- `ranking_is_live=false`
- `may_change_live_route=false`
- `authority_granted=false`

Live dispatch remains P1-C static policy until a later P4 qualification explicitly activates a bounded learner.


## P4 bounded learned routing

P4 begins with an extracted shadow-only learner. P4-A does not replace P1-C.

The routing order remains:

1. current authority must be valid;
2. GA108 candidates are sparsely shortlisted;
3. P1-C hard model eligibility is evaluated;
4. only hard-eligible exact Genius/model routes reach the learned scorer;
5. exact-route support floors and non-tradable breach blocks apply;
6. the learned candidate may emit a shadow recommendation;
7. the live router remains P1-C static.

P4-A uses a fixed 24-feature pre-route schema and task-class-specific batch
ridge parameters with a UCB uncertainty term. Features contain no raw memory,
prompt text, hidden model state, policy secret, or post-outcome information.

Changed exact model artifacts begin with zero exact-route support, so a model
swap cannot silently inherit the prior artifact's learned eligibility.

P4-A learned snapshots are immutable and pin source P3-C evidence plus an
explicit rollback parent. There is intentionally no activation method.
