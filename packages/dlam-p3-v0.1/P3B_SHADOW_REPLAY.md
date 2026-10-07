# PV-DLAM P3-B — Held-Out Paired Shadow Replay

**Status:** CANDIDATE / EXTRACTED / UNWIRED  
**Phase:** P3-B  
**Depends on:** P3-A immutable routing observations

P3-B introduces held-out policy comparison without pretending observational logs reveal outcomes for routes that were never run.

## Core rule

> **Unobserved counterfactuals are unsupported.**

A production route log tells us what happened under the selected route. It does not tell us what would have happened under a different Genius/model route.

Therefore P3-B only makes route-vs-route outcome comparisons when a benchmark case contains **paired observed outcomes** for both the baseline route and the candidate route.

## Replay case

A replay case binds:

- one benchmark `task_id`;
- one task class;
- one baseline P3 observation;
- one or more actually observed alternative P3 observations;
- one partition-group reference.

All paired observations must share the same task ID and task class and must represent distinct exact `Genius|model` route signatures.

Raw task text is not copied into the replay case.

## Leakage-safe split

Train/test assignment is deterministic from:

```text
seed + partition_group_ref
```

All cases sharing a group must land in the same partition.

This prevents closely related cases from quietly appearing in both training and held-out evaluation.

## Shadow route policy

The v0.1 candidate policy is deliberately descriptive.

For each task class, training-only paired observations are summarized by exact:

```text
GA108 profile + exact model artifact
```

A route requires a minimum support floor and zero observed:

- governance violations;
- critical misses.

Eligible training routes are ranked by:

1. mean quality;
2. success rate;
3. calibration loss;
4. evidence satisfaction;
5. correction rate;
6. latency;
7. cost;
8. stable route signature.

The resulting preference is **shadow only**.

No weights are installed into BrainC, Crane Fly, P1-C, or SFR.

## Held-out evaluation

For each held-out case:

### Supported paired comparison

If the candidate policy's preferred route was actually run on that case, P3-B can report paired deltas versus the baseline for:

- success;
- quality;
- Brier calibration loss;
- evidence satisfaction;
- user correction;
- latency;
- context tokens;
- estimated cost.

### Unsupported counterfactual

If the candidate prefers a route that was **not actually run** on the held-out case:

`UNSUPPORTED_COUNTERFACTUAL`

The case is excluded from paired performance deltas.

P3-B does not use model confidence, Genius reputation, similarity, or wishful thinking to fabricate the missing outcome.

## Causal boundary

Replay reports state:

`causal_claim = NONE`

This rung is a controlled retrospective benchmark, not an off-policy causal estimator.

Future exploration or randomized/paired shadow probes may create broader support, but P3-B does not infer it from deterministic production logs.

## Sparse Frontier threshold replay

P3-B can also replay an alternate SFR soft threshold.

If the candidate threshold produces the **same** escalation decision as the logged policy, the observation is on-policy supported.

If the threshold would flip:

```text
LOCAL_RESOLVE ↔ ESCALATE_INVESTIGATION
```

the result is:

`UNSUPPORTED_COUNTERFACTUAL`

unless both outcomes were actually observed.

Hard governance/risk escalation reasons remain hard reasons and cannot be overridden by a softer/higher threshold.

## Promotion boundary

Every policy/report carries:

```text
policy_is_live = false
promotion_eligible = false
may_change_live_route = false
may_change_live_thresholds = false
may_grant_authority = false
authority_granted = false
```

P3-B cannot promote itself.

P3-C must still establish dataset coverage, minimum evidence floors, held-out partitions, SFR calibration requirements, and the promotion packet that P4 will evaluate.

## Why this matters

Without paired support, an offline router can appear brilliant by selecting routes whose outcomes are unknowable.

P3-B treats missing counterfactual evidence as missing evidence, which is annoyingly less glamorous and substantially more useful.
