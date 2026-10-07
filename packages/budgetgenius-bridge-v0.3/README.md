# Super Φ.Vessel ↔ BudgetGenius Bridge v0.3

**Status:** EXPERIMENTAL / SHADOW QUALIFICATION / CANONICAL RUNTIME UNWIRED  
**Depends on:** BudgetGenius runtime bridge v0.2 + PV-DLAM P3-C evidence contract  
**Date:** 2026-10-07

v0.3 answers the question that v0.2 deliberately left open:

> When has a BudgetGenius shadow recommendation earned enough evidence to be considered for bounded live influence?

The answer is intentionally conservative.

A passing v0.3 qualification does **not** activate BudgetGenius, does not mutate BudgetCompute, does not reserve paid credits, and does not bypass the Executor Authorization Gate.

It may only produce:

\`EMPIRICAL_QUALIFIED_CANDIDATE\`

which means the evidence can be presented to the Operator / Steward / Board layer for a separate bounded canary lease.

## Evidence contract

The qualification pack consumes paired held-out observations comparing:

- the route Super Φ.Vessel actually used;
- the BudgetGenius v0.2 shadow-economic alternative;
- quality outcome;
- evidence score;
- effective economic cost;
- latency;
- critical misses;
- governance outcomes;
- the v0.2 shadow receipt.

The bridge accepts empirical evidence classes:

- \`REPLAY_BENCHMARK\`
- \`FIELD_OBSERVED\`

Synthetic CI data remains:

\`SYNTHETIC_QUALIFICATION_FIXTURE\`

and can never promote itself into empirical qualification.

## Default gates

The v0.3 candidate gate requires:

1. at least 400 paired held-out cases;
2. at least 5 held-out seeds;
3. at least 50 cases per represented seed;
4. at least 4 task classes;
5. held-out observations only;
6. zero train/test observation leakage;
7. unique observation and source identities;
8. only already-qualified routes;
9. at least 5% relative effective-economic-cost improvement;
10. a positive 95% lower confidence bound on paired savings;
11. quality pass-rate regression no worse than 1 percentage point;
12. mean evidence-score regression no worse than 1 percentage point;
13. mean latency regression no worse than 10%;
14. no critical-miss regression;
15. zero governance violations;
16. every v0.2 receipt still proving shadow-only / no-authority behavior;
17. an empirical evidence manifest whose P3 source is \`READY_FOR_P4_EVALUATION\`.

Critical misses, governance violations, and authority promotion are non-tradable. A larger cost saving cannot compensate for them.

## Authority boundary

Every qualification output remains frozen to:

\`\`\`text
activationAllowed = false
mayChangeLiveRoute = false
authorityGranted = false
rollbackRequired = true
\`\`\`

Only an \`EMPIRICAL_QUALIFIED_CANDIDATE\` receives:

\`\`\`text
mayRequestCanaryLease = true
canaryLeaseAuthority = OPERATOR_STEWARD_BOARD_REVIEW
\`\`\`

That field is a request path, not an execution path.

## Relationship to the wider architecture

The intended authority flow remains:

\`\`\`text
Operator / Constitution
        ↓
Board / Steward
        ↓
Cognitive Mandate / Grant
        ↓
BudgetGenius
        ↓
BudgetPass
        ↓
existing Super Φ.Vessel execution gates
        ↓
Reality Gate
        ↓
NBG + Ledger evidence
\`\`\`

BudgetGenius optimizes. BudgetPass enforces the granted budget boundary. Existing Super Φ.Vessel runtime controls retain execution authority.

## Acceptance coverage

The v0.3 acceptance suite uses deterministic test vectors to exercise the gate logic.

It verifies positive mechanics plus negative controls for:

- insufficient case count;
- insufficient seeds;
- thin per-seed support;
- train/test leakage;
- duplicate source evidence;
- ineligible routes;
- <5% savings;
- positive mean savings with a non-positive 95% lower bound;
- quality regression;
- evidence regression;
- latency regression;
- critical-miss regression;
- governance violation;
- authority promotion inside a shadow receipt;
- empirical labels without manifests;
- empirical manifests whose P3 source is not ready.

A green CI result proves the qualification machinery behaves as specified.

It is **not** an empirical claim that BudgetGenius has already passed the real-world qualification gate.

## Next rung

After a real evidence pack reaches \`EMPIRICAL_QUALIFIED_CANDIDATE\`, the next integration rung should be:

**v0.4 — explicit operator canary lease + tiny bounded route influence + automatic rollback drill**

That future rung must still preserve the final Executor Authorization Gate and produce receipts suitable for Reality Gate, NBG, and Ledger review.
