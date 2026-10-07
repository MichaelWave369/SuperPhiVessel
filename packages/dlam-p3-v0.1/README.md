# PV-DLAM P3-A — Routing Observatory

**Status:** CANDIDATE / EXTRACTED / UNWIRED  
**Phase:** P3-A  
**Depends on:** qualified P1-C route receipts; optional Sparse Frontier v0.1 decisions/outcomes

P3-A starts the observability phase without giving a learner control of routing.

> **Observe first. Learn in shadow. Activate later, if qualified.**

## Purpose

P1-C already records exact route decisions and exact model identities.

Sparse Frontier Routing already records whether deeper investigation was proposed and whether it later proved useful.

P3-A joins those evidence streams into immutable final route-outcome observations and scorecards across the complete GA108 logical roster.

## Observation record

Every P3 observation is anchored to an existing P1-C route receipt.

It records:

- exact route decision/ref hash;
- task class and bounded task tags;
- GA108 profile;
- exact model artifact;
- success/failure;
- quality score;
- pre-outcome confidence;
- Brier calibration score;
- whether evidence requirements were satisfied;
- governance violation flag;
- critical miss flag;
- user-correction flag;
- latency;
- context tokens;
- estimated cost;
- explicit outcome evidence refs;
- optional joined SFR decision/outcome summary.

It does **not** persist raw prompt text or raw memory content.

A route can have one immutable finalized P3 observation. Repeating the same observation is idempotent; attempting to rewrite the finalized outcome fails closed.

## Full GA108 scorecards

A scorecard snapshot contains all 108 canonical Genius profiles.

Profiles with no evidence remain present as:

`DORMANT_NO_EVIDENCE`

Observed profiles include:

- observation count;
- success rate;
- Beta(1,1) posterior success mean as a descriptive small-sample estimate;
- mean quality;
- mean Brier calibration loss;
- mean latency/tokens/cost;
- evidence satisfaction rate;
- user-correction rate;
- governance violations;
- critical misses;
- exact model usage;
- task-class usage.

No zero-evidence Genius receives invented performance numbers.

## Non-tradable failures

Governance violations and critical misses are surfaced as:

`non_tradable_breach = true`

P3-A does not average them away into a utility score.

That does not itself disable or punish a live route; live dispatch remains P1-C static policy. It simply prevents a shadow ranking from presenting that evidence as clean success.

## Shadow roster rank

P3-A can produce a deterministic **shadow-only** roster ranking for a task class.

The rank uses:

1. sufficient task-class evidence and no non-tradable breach;
2. higher observed mean quality;
3. higher descriptive posterior success mean;
4. lower calibration loss;
5. deterministic specialization affinity from task tags to the frozen GA108 routing emphasis;
6. stable profile ID tie-break.

This is not a live router.

Every ranked Genius remains:

```text
activation_status = SHADOW_ONLY_DORMANT
authority = NONE
```

and the rank says:

```text
ranking_is_live = false
may_activate_genius = false
may_change_live_route = false
authority_granted = false
```

## Sparse Frontier join

When an observation references an SFR decision, P3-A verifies the task identity and records only the bounded decision/outcome summary.

This supports later analysis of:

- local resolution vs escalation;
- frontier usefulness;
- whether frontier changed the decision;
- whether missing evidence was discovered;
- whether a critical issue was caught;
- exact frontier model ref.

P3-A does not modify SFR thresholds.

## Learning boundary

Scorecard snapshots explicitly state:

```text
learning_mode = SHADOW_OBSERVATION_ONLY
learned_weights = null
may_change_live_route = false
may_change_live_thresholds = false
may_grant_authority = false
```

P4 may later compare candidate learners against these frozen observations.

P3-A itself contains no activated learned weights.

## Calibration

For a binary finalized outcome:

```text
Brier = (predicted_confidence - outcome)^2
```

This allows later calibration analysis by Genius, model, and task class.

The confidence is evidence to inspect, not authority.

## Privacy / provenance

The observatory stores refs and bounded routing metadata, not task prose.

Every finalized observation requires at least one explicit `outcome_source_ref`.

Snapshots preserve the exact source observation IDs used to compute them and are deterministically hashed.

## P3 sequence

P3-A establishes the durable observatory.

Later P3 rungs should add:

- broader shadow replay/counterfactual comparison;
- explicit Sparse Frontier trigger calibration by task class;
- qualification datasets with held-out partitions;
- candidate learner reports for P4.

No learner should become live merely because P3 collected enough rows to make a chart look persuasive.
