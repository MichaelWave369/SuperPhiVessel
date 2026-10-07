# PV-DLAM P3-C — Qualification Dataset Closeout

**Status:** CANDIDATE / EXTRACTED / UNWIRED  
**Phase:** P3-C  
**Depends on:** P3-A observatory + P3-B held-out paired replay

P3-C closes the routing-observability phase by defining a deterministic evidence gate and a non-authoritative packet that P4 may evaluate.

It does **not** activate learned routing.

## Default evidence floors

The v0.1 closeout requires at least:

- 400 paired replay cases;
- 4 task classes;
- 50 cases in every represented task class;
- 8 observed GA108 profiles;
- 2 exact model identities;
- 5 deterministic held-out seeds;
- 50 held-out cases per seed;
- 80% paired support coverage on every seed;
- zero supported-candidate governance/critical breaches;
- 100 SFR-linked observations;
- 30 completed frontier investigations;
- 20 observed critical-issue cases;
- critical miss rate <= 2%;
- escalation usefulness/precision >= 50%;
- zero SFR governance violations;
- 100% support when replaying the currently deployed static SFR soft threshold.

These are **qualification floors**, not claims that the current live system has already accumulated them.

## Five-seed replay

P3-C refits and evaluates the P3-B descriptive shadow policy across at least five deterministic group-held-out splits.

It records the exact policy/report hashes for every seed.

Any train/test observation leakage blocks qualification.

## SFR calibration closeout

P3-C checks the observational support around the current SFR policy.

It does not use unsupported threshold flips as if their alternate outcomes were known.

The current threshold replay must remain fully supported by the logged decisions.

Critical misses and governance violations remain non-tradable.

## Synthetic fixture guard

CI needs enough generated data to prove the qualification machinery itself.

That data is explicitly labelled:

`SYNTHETIC_QUALIFICATION_FIXTURE`

Even if every numeric gate passes, the final status is:

`STRUCTURAL_PASS_SYNTHETIC_ONLY`

and:

`p4_evaluation_allowed = false`

Synthetic fixtures therefore cannot promote themselves into empirical evidence by being numerous.

For a future real corpus, P3-C accepts either:

- `REPLAY_BENCHMARK`
- `FIELD_OBSERVED`

with explicit evidence-manifest refs. Only a non-fixture corpus that passes every technical gate can become:

`READY_FOR_P4_EVALUATION`

That still does **not** activate anything.

## P4 evaluation packet

P3-C emits a deterministic packet containing:

- qualification hash;
- eligible task classes;
- exact source observation IDs;
- exact five-seed replay report hashes;
- SFR threshold-report hash;
- evidence class/manifests;
- the P4 evaluation contract.

The packet freezes later P4 expectations including:

- at least 400 held-out tasks;
- at least 5 seeds;
- >=5% relative utility improvement;
- positive 95% lower confidence bound;
- zero governance violations;
- no critical-miss regression;
- declared latency thresholds;
- operator-owned activation;
- rollback snapshot;
- no automatic activation.

The packet itself still says:

```text
activation_allowed = false
may_change_live_route = false
may_change_live_thresholds = false
authority_granted = false
```

P4 must earn those rights separately.

## P3 completion meaning

When the P3-C structural gate is green, P3 can be considered complete as an **extracted qualification framework**:

- P3-A records outcomes;
- P3-B performs honest held-out paired replay;
- P3-C defines evidence floors and the promotion/evaluation packet.

It does not mean a learned router has been empirically qualified or activated.
