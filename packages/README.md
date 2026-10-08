# Packages

Reusable or extractable Super Φ.Vessel components belong here.

Packages should declare an implementation status such as **LIVE**, **EXPERIMENTAL**, or **UNWIRED**.

Historical standalone packages must not be represented as integrated merely because they are present in this repository.

## Current extracted packages

- `dlam-p1-v0.1` — local continuity, context composition, routing/model-swap, durability.
- `dlam-p2-v0.1` — signed peer synchronization and Infinite Porch adapters.
- `dlam-p3-v0.1` — routing observatory, shadow replay, qualification evidence.
- `dlam-p4-v0.1` — bounded linear-UCB learned-routing snapshot in SHADOW_ONLY mode.
- `sparse-frontier-v0.1` — deterministic sparse frontier escalation gate.
- `budgetgenius-bridge-v0.1` — **EXPERIMENTAL / UNWIRED** protocol compatibility bridge pinned to BudgetGenius commit `44ffc8ccd0f8eafb7130a3051215e536daaa4dce`.
- `budgetgenius-bridge-v0.2` — **EXPERIMENTAL / SHADOW ECONOMICS / UNWIRED** runtime-economic mirror for BudgetCompute, Credit Governor, PV-GPU, Run Capsule, and P4-A shadow evidence.
- `budgetgenius-bridge-v0.3` — **EXPERIMENTAL / SHADOW QUALIFICATION / UNWIRED** held-out economic evidence gate; may request a bounded canary lease only after empirical qualification.
- `budgetgenius-bridge-v0.4` — **EXPERIMENTAL / BOUNDED CANARY LEASE / UNWIRED** operator/steward/board-approved route-influence envelope with hard expiry, spend/decision caps, revocation, and automatic rollback.
- `budgetgenius-bridge-v0.5` — **EXPERIMENTAL / DEFAULT-OFF / CANONICAL RUNTIME CANARY** one-shot local builder/code route influence bound to an empirical v0.4 lease, a real RESERVED BudgetPass, frozen Run Capsule approval, and downstream Executor Authorization.
- `spdw-v0.1` — frozen experimental SPD-W acceptance contract.
- `phibot-physical-observer-v0.1` — **EXPERIMENTAL / UNWIRED / ADVISORY-ONLY** receiver for pinned NBG physical-experience handoffs; renders evidence/questions and grants no tool or physical authority.
- `phibot-physical-observer-v0.2` — **EXPERIMENTAL / DEFAULT-OFF / BROWSER-NATIVE / EPHEMERAL / UNWIRED** runtime seam for the same handoff; emits sanitized observer views, uses Web Crypto receipts, and writes no browser persistent storage.
- `phibot-physical-observer-v0.3` — **EXPERIMENTAL / CANDIDATE ONLY / NOT CANONICAL** operator-triggered physical observer panel compiled into a reproducible standalone `.54.13` HTML CI artifact, without modifying the shipped `.54.12` runtime.

Presence here is not runtime activation.
