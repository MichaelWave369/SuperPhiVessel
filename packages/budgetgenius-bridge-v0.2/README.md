# Super Φ.Vessel ↔ BudgetGenius Bridge v0.2

**Status:** EXPERIMENTAL / SHADOW ECONOMICS / CANONICAL RUNTIME UNWIRED  
**BudgetGenius pin:** `44ffc8ccd0f8eafb7130a3051215e536daaa4dce`  
**Super Φ.Vessel base:** includes PV-DLAM P4-A shadow learner  
**Date:** 2026-10-07

v0.2 moves the BudgetGenius integration from **protocol compatibility** to **shadow runtime economics**.

It still does not change a live route.

## Why shadow first

Super Φ.Vessel already has real routing and authorization boundaries:

- BudgetCompute Broker v1.0,
- Credit Governor / paid-run ceiling,
- PV-GPU-0.1 GPU Runtime Governor,
- frozen PhiRunCapsule,
- final Executor Authorization Gate,
- P3 routing observations,
- P4-A bounded learned routing in SHADOW_ONLY mode.

BudgetGenius must not bulldoze those controls because a second repo has a clever optimizer.

v0.2 therefore answers a narrower question:

> Given the route Super Φ.Vessel is allowed to consider, what would BudgetGenius say about its economic cost and alternatives?

The answer is recorded as **shadow evidence only**.

## Mappings

### PhiRunCapsule -> economic policy view

The bridge reads:

- execution policy,
- paid fallback mode,
- paid-run ceiling,
- active provider,
- approved local model pool.

The translated policy explicitly carries:

- `mayDispatch=false`,
- `executorAuthorizationRequired=true`,
- `authority=NONE`.

A BudgetGenius recommendation still has to pass the existing Super Φ.Vessel Executor Authorization Gate before any model call.

### Credit Governor -> read-only budget envelope

The bridge mirrors a `creditSnapshot()` into:

- ceiling,
- already reserved spend,
- remaining amount,
- execution policy.

The Super Φ.Vessel Credit Governor remains the authoritative paid reservation mechanism in v0.2. BudgetGenius does not reserve the same dollars a second time.

A zero configured ceiling is represented as **NO_HARD_CEILING**, not as an invented infinite budget.

### Credit rates -> conservative BudgetGenius price snapshot

Super Φ.Vessel currently stores provider-level input/output rates.

BudgetGenius uses provider+model price rows and understands cached input separately.

The bridge expands the provider-level rate onto the exact candidate models and deliberately sets:

`cachedInputUsdPer1M = inputUsdPer1M`

because the current Credit Governor does not prove a cache discount. No phantom cache savings are claimed.

### GPU runtime state -> BudgetGenius residency evidence

Measured `gpuRuntimeState()` rows map to BudgetGenius residency entries.

- loaded + >=80% GPU residency -> GPU-fit candidate,
- loaded + <80% -> hybrid / not GPU-fit,
- missing measurement remains absent.

The bridge does not convert static VRAM heuristics into measured residency.

### BudgetCompute decision -> BudgetGenius shadow route

BudgetCompute's deterministic `difficultyHint` remains routing metadata only.

It is **never** copied into `successProbability`.

BudgetGenius quality qualification must come from empirical calibration evidence, such as P3/P4-derived route statistics.

### P4-A -> advisory learned signal

P4-A is already a bounded learned router, but it is frozen to:

- `selection_is_live=false`,
- `may_change_live_route=false`,
- `authority_granted=false`.

v0.2 can carry its shadow recommendation beside BudgetGenius economics, but cannot activate it.

## Shadow receipt

A v0.2 shadow receipt may say:

- what Super Φ.Vessel selected,
- what BudgetGenius would economically prefer among supplied qualified candidates,
- what P4-A shadow-selected,
- why candidates were rejected,
- expected monetary and movement cost.

It always says:

- `selectionIsLive=false`,
- `mayChangeLiveRoute=false`,
- `authorityGranted=false`,
- `executorAuthorizationRequired=true`.

## What v0.2 proves

Cross-repository CI proves:

1. Run Capsule state becomes economic policy, not execution authority.
2. Credit state is mirrored without double reservation.
3. provider rates become conservative BudgetGenius price rows.
4. measured GPU state becomes residency evidence.
5. BudgetCompute difficulty never masquerades as quality.
6. BudgetGenius can make a shadow economic comparison over empirically qualified candidates.
7. P4-A stays shadow-only through the bridge.
8. the resulting economic receipt cannot change the live route.

## Non-claims

Passing v0.2 does **not** mean BudgetGenius drives BudgetCompute.

That activation requires a later, explicit operator-reviewed integration gate.
