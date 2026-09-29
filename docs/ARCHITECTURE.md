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
