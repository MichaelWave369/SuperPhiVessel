# PV-DLAM P4-A — Bounded Linear-UCB Shadow Learner

**Status:** CANDIDATE / EXTRACTED / SHADOW ONLY
**Phase:** P4-A
**Depends on:** structurally qualified P3 framework

P4-A introduces the first actual learned routing snapshot.

It does **not** activate learned routing.

## Why a small linear learner first

The routing learner should be cheaper and easier to inspect than the models it selects.

P4-A therefore uses deterministic batch ridge regression plus a bounded UCB exploration term.

There are no new ML dependencies. The implementation is pure Python and stores an auditable immutable snapshot.

## Hard eligibility remains first

P4-A does not decide whether a model is allowed to run.

For every shortlisted Genius, model candidates still pass through the existing P1-C eligibility rules:

- model qualification;
- locality;
- required capabilities;
- context-window minimum;
- VRAM budget;
- allowed-model set;
- tokenizer availability.

Only P1-C-eligible routes can reach the learned scorer.

A learned score cannot make an ineligible model eligible.

## Sparse Genius activation

P4-A never wakes the full GA108 roster.

A request may supply at most 8 candidate Genius profiles, or P4-A deterministically selects a bounded shortlist by frozen GA108 specialization affinity.

The combined Genius/model route shortlist is capped at 8.

Every Genius in the plan remains `SHADOW_ONLY_DORMANT` until a later activation gate exists.

## 24 pre-route features

The feature schema is `p4a-pre-route-24-v0.1`.

It contains only metadata available before route execution:

1. bias;
2. GA108 specialization affinity to bounded task tags;
3. model locality;
4. context capacity;
5. VRAM efficiency;
6. static deployment priority preference;
7. training-only exact-route support;
8. capability breadth;
9–16. deterministic GA108 identity hash buckets;
17–24. deterministic exact-model identity hash buckets.

It contains no prompt text, memory text, outcome, post-answer confidence, hidden/KV state, policy secret, or action authority.

Task class is modeled by a separate learned parameter set per task class.

## Exact model continuity

A changed model artifact receives a new exact `model_ref`.

Even if shared features generalize to it, the exact route starts with zero route support and cannot become learned-eligible until it meets the frozen minimum support floor.

Model swaps therefore do not inherit the old artifact's exact route support.

## Reward

Clean observations receive a bounded descriptive reward:

```text
0.35 quality
0.25 success
0.15 evidence satisfied
0.10 calibration
0.05 no user correction
0.05 latency efficiency
0.03 cost efficiency
0.02 token efficiency
```

Governance violations and critical misses are non-tradable and never receive a trainable reward.

Any task-class/exact-route combination with such a breach is recorded in the snapshot as blocked from learned selection.

## Batch ridge + UCB

For each task class:

```text
theta = (X^T X + lambda I)^-1 X^T y
```

The snapshot also stores the inverse ridge matrix.

A shadow candidate receives:

```text
predicted utility = theta dot x
uncertainty = sqrt(x^T A^-1 x)
UCB = predicted utility + alpha * uncertainty
```

The UCB term is bounded by hard eligibility and exact-route support. It grants no authority.

## Evidence frontier

Training observations must be an explicit subset of the source P3-C evaluation packet's observation IDs.

The learner pins the P3-C qualification ID/hash, P4 evaluation-packet ID/hash, exact training observation IDs, evidence class, feature schema, hyperparameters, reward weights, route support counts, blocked route keys, learned parameters, and parent/rollback snapshot ref.

## Synthetic guard

P4-A may structurally train against the synthetic P3-C fixture so CI can verify the learner.

Such a snapshot is `STRUCTURAL_FIXTURE_CANDIDATE` and remains permanently non-activating.

Only a source P3-C qualification with `READY_FOR_P4_EVALUATION` may create an `EMPIRICAL_SHADOW_CANDIDATE`.

Even that still cannot activate itself.

## Rollback lineage

Every learned snapshot pins an explicit `parent_snapshot_ref` and identical `rollback_target_ref`.

The initial parent is `P1C_STATIC`.

P4-A contains no activation method. The rollback pointer is evidence for later P4 activation/rollback work.

## Frozen boundary

Every snapshot and plan carries a shadow-only boundary:

```text
evaluation_mode = SHADOW_ONLY
activation_allowed = false
automatic_activation_forbidden = true
selection_is_live = false
may_activate_genius = false
may_change_live_route = false
may_change_live_thresholds = false
authority_granted = false
```

P4-A learns.

It does not drive.
