# Sparse Frontier Routing v0.1

**Formal name:** Sparse Frontier Routing (SFR)  
**Internal nickname:** Spider Layer  
**Status:** CANDIDATE / EXTRACTED / UNWIRED  
**Integration stance:** P3/P4 precursor built on PV-DLAM P1-A/B/C; does not replace Crane Fly, BrainC, Reality Gate, or GA108.

## Principle

> **Make intelligence abundant while making expensive attention scarce.**

The most expensive model should move as rarely as possible while decision quality, critical-miss control, provenance, and governance remain acceptable.

SFR answers a different question from ordinary model routing:

> **Is deeper reasoning worth calling here at all?**

Only after SFR says deeper investigation is warranted should existing routing choose the exact qualified model/recipe.

## Stack

```text
Human / Vessie
      ↓
local answer / synthesis
      ↑
sparse GA108 specialist recommendations
      ↑
Sparse Frontier Routing
      ↑
cheap/local decision fabric + P1-C static routing
      ↑
PV-DLAM exact memory + evidence + route outcomes
      ↑
optional deterministic NBG projections
```

SFR is not a second source of authority and is not a replacement for Crane Fly.

## v0.1 implemented behavior

SFR v0.1 is intentionally **deterministic**.

It records and evaluates:

- cheap-layer confidence / uncertainty;
- novelty;
- meaningful state-change magnitude;
- consequence;
- provenance gaps;
- missing evidence;
- irreversible-action risk;
- model/agent disagreement;
- routing confidence;
- prior attributable model failures from P1-C;
- contradiction neighborhoods derived from admitted memory;
- memory inconsistency;
- explicit governance concern;
- authority-boundary concern;
- optional deterministic NBG projection signals.

The gate emits only:

- `LOCAL_RESOLVE`
- `ESCALATE_INVESTIGATION`
- `HELD`
- `DENIED`

It does not call a model.

## Sparse Genius activation

GA108 remains a roster of 108 persistent logical specialist identities.

SFR may **recommend** a small set by deterministic affinity to task tags and each profile's existing category/routing emphasis.

A recommendation has:

```text
activation_status = RECOMMENDED_DORMANT
authority = NONE
```

SFR v0.1 does not instantiate a model process or awaken the entire roster.

## Escalation context

The SFR envelope contains a bounded **reference region**, not the entire memory corpus:

- trigger reasons;
- memory refs;
- evidence refs;
- state-change descriptors;
- cheap prediction and confidence;
- normalized gate features;
- prior routing evidence;
- recommended Genius refs;
- external authority receipt/status;
- explicit token budget;
- `action_authority=NONE`.

Raw memory text is intentionally not copied into the SFR envelope. If a frontier investigation proceeds, P1-B remains responsible for governed prompt admission and exact model-tokenizer budgeting.

## Frontier Duty Cycle

```text
FDC = frontier investigations / total candidate decisions
```

FDC is an operating metric, **not** a standalone optimization target.

The actual objective is:

```text
minimize FDC

subject to:
  decision quality evidence >= required floor
  critical miss rate <= qualified ceiling
  governance violations = 0
  provenance/evidence requirements satisfied
```

v0.1 also measures:

- escalation precision;
- critical escalation recall;
- avoided frontier calls;
- frontier calls that changed the outcome;
- unnecessary frontier calls;
- critical miss rate;
- Genius activation count;
- context tokens per escalation;
- latency/cost per resolved decision;
- local/frontier resolution ratio.

No target ratios are hard-coded.

## Learning loop

Every assessed decision is persisted.

Every completed resolution may later add:

- frontier model ref;
- selected Genius refs;
- frontier conclusion ref;
- whether frontier changed the decision;
- whether it discovered missing evidence;
- whether it caught a critical issue;
- whether a critical issue was eventually present;
- success/failure;
- latency;
- context tokens;
- cost estimate;
- governance-violation flag.

SFR builds a **routing knowledge snapshot** by trigger, Genius, and exact model.

In v0.1:

```text
learning_mode = SHADOW_OBSERVATION_ONLY
may_change_live_thresholds = false
may_grant_authority = false
```

P3 can qualify this evidence stream. P4 may evaluate a learner against it. v0.1 never self-modifies its thresholds.

## NBG boundary

NBG can contribute at two very different levels.

### Implemented / allowed to influence v0.1

Deterministic, evidence-linked projections may be supplied as `DETERMINISTIC_PROJECTED`, for example:

- temporal divergence;
- unresolved dependency count.

These are bounded features, not truth or authority.

### Engineering hypothesis

Potential future sparse-routing features include:

- activation concentration;
- transitions between memory regions;
- contradiction neighborhoods beyond direct edges;
- novelty relative to an NBG structural baseline;
- Genius-affinity neighborhoods.

These require their own qualification before affecting production routing.

### Experimental / log-only

Learned NBG residue, Θ-state, anomaly scores, hidden-microstructure indicators, or other learned NBG signals are classified as:

`LEARNED_EXPERIMENTAL`

v0.1 may record them for research, but their score effect is:

`LOG_ONLY_NOT_ROUTING`

They cannot escalate a decision by themselves.

### Non-claim

Nothing in SFR v0.1 establishes that NBG learned state predicts real-world importance, causality, or frontier-model usefulness.

## Governance

**CAPABILITY ≠ AUTHORITY** remains unchanged.

SFR may recommend:

- whether deeper inspection is warranted;
- which bounded evidence region matters;
- which Genius profiles are relevant.

It may not:

- authorize a consequential action;
- promote a memory to fact;
- install/activate a model;
- bypass current authority checks;
- mutate Reality Gate;
- convert routing utility into permission.

A stale authority state returns `HELD`. A denied state returns `DENIED` before any frontier envelope is emitted.

## Sequence discipline

SFR v0.1 is deliberately marked a **P3/P4 precursor** while P1-D remains open.

It can be merged and tested now because it is extracted, deterministic, and runtime-unwired. It must not be presented as a substitute for finishing one-node crash/restore qualification.

After P1-D:

1. keep SFR thresholds static;
2. collect P3 shadow telemetry;
3. measure critical misses and escalation usefulness;
4. compare candidate learners offline;
5. activate no learned policy until an explicit P4 qualification/rollback gate passes.
