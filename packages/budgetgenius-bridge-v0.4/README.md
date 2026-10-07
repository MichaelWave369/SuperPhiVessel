# Super Φ.Vessel ↔ BudgetGenius Bridge v0.4

**Status:** EXPERIMENTAL / BOUNDED CANARY LEASE / CANONICAL RUNTIME UNWIRED  
**Depends on:** v0.3 empirical qualification candidate  
**Date:** 2026-10-07

v0.4 defines the first authority envelope in which a BudgetGenius recommendation may influence a route.

It is intentionally tiny.

The package remains **runtime-unwired**. CI proves the canary authority and rollback mechanics; it does not claim that the canonical standalone runtime is already allowing BudgetGenius to steer live traffic.

## Entry condition

A lease may be issued only from a v0.3 result with:

\`\`\`text
disposition = EMPIRICAL_QUALIFIED_CANDIDATE
mayRequestCanaryLease = true
activationAllowed = false
mayChangeLiveRoute = false
authorityGranted = false
\`\`\`

Synthetic qualification cannot mint a lease.

## Required approvals

A lease requires three separate approval roles:

- \`OPERATOR\`
- \`STEWARD\`
- \`BOARD\`

The optimizer cannot approve itself.

The approvals authorize only the explicit lease envelope.

They do not grant general model, tool, payment, or execution authority.

## Hard canary ceilings

v0.4 refuses to create a lease broader than:

- 30 minutes;
- 10 influenced routing decisions;
- $1.00 cumulative shadow/canary spend;
- $0.10 per influenced decision;
- 4 task classes;
- 8 explicitly named candidate routes.

A real lease can be much smaller.

These are hard implementation ceilings, not suggested operating targets.

## Exact scope

Each lease pins:

- qualification ID;
- Cognitive Mandate reference;
- BudgetPass reference;
- issue and expiry timestamps;
- Operator / Steward / Board approvals;
- allowed task classes;
- allowed exact route IDs;
- maximum influenced decisions;
- cumulative spend ceiling;
- per-decision spend ceiling;
- outcome evidence floor;
- outcome latency-regression tripwire.

The complete immutable lease definition is SHA-256 pinned.

Changing expiry, scope, approvals, mandate, BudgetPass reference, or authority fields without issuing a new lease causes an integrity failure.

## What route influence means

A successful canary evaluation can produce:

\`CANARY_ROUTE_INFLUENCE_ALLOWED\`

That permits the routing layer to substitute one explicitly leased candidate for the current broker route.

It still says:

\`\`\`text
mayDispatch = false
executionAuthorized = false
executorAuthorizationRequired = true
authorityGranted = false
paidApprovalGranted = false
\`\`\`

So route influence and execution authority remain separate.

The existing final Executor Authorization Gate is still required before any model/tool execution.

The Credit Governor remains the paid reservation authority.

## BudgetPass remains a veto

Every canary proposal requires a BudgetPass receipt bound to:

- the exact canary lease ID;
- the exact Cognitive Mandate reference.

BudgetPass must say \`ALLOW\`.

Its receipt must also preserve:

\`\`\`text
authorityGranted = false
executorAuthorizationRequired = true
\`\`\`

A BudgetPass denial, stale lease reference, mandate mismatch, or authority promotion blocks route influence.

## Automatic rollback

Every influenced decision emits a canary influence receipt and later consumes an outcome.

Automatic rollback is required on:

- any critical miss;
- any governance violation;
- any quality failure;
- evidence score below the leased floor;
- latency regression above the leased tripwire.

Rollback changes the canary state to:

\`ROLLBACK_REQUIRED\`

After that state, route resolution returns the existing Super Φ.Vessel broker route.

The canary cannot continue spending its remaining decision or dollar budget after rollback.

## Explicit revocation

Operator-side revocation is immediate.

A revoked lease resolves future routing to the baseline broker route even if:

- the lease has time remaining;
- it has unused decision count;
- it has unused spend capacity.

## No self-renewal

The lease explicitly freezes:

\`\`\`text
selfRenewalAllowed = false
selfExtensionAllowed = false
scopeBroadeningAllowed = false
\`\`\`

BudgetGenius cannot extend its own clock, add task classes, add routes, increase its spend ceiling, or issue a successor lease.

A new lease requires a new externally approved issuance.

## Acceptance drill

The deterministic v0.4 drill covers 25 cases:

1. v0.3 empirical qualification is the entry condition;
2. synthetic evidence cannot mint a lease;
3. Operator / Steward / Board approvals are mandatory;
4. 30-minute hard duration ceiling;
5. 10-decision hard ceiling;
6. immutable hash-pinned lease;
7. bounded route influence inside scope;
8. Executor and paid-approval gates remain intact;
9. BudgetPass denial vetoes;
10. task scope enforcement;
11. route scope enforcement;
12. per-decision spend cap;
13. cumulative spend cap;
14. decision exhaustion;
15. exact expiry;
16. exact BudgetPass lease binding;
17. quality-failure rollback;
18. critical-miss rollback;
19. governance-violation rollback;
20. evidence-floor rollback;
21. latency-tripwire rollback;
22. baseline restoration;
23. explicit revocation;
24. lease tamper detection;
25. self-renewal refusal.

Expected:

\`\`\`text
BudgetGenius bounded canary lease v0.4: PASS (25/25)
NOTE this acceptance is a deterministic canary drill. The package remains runtime-unwired.
\`\`\`

## Authority chain

The intended chain remains:

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
bounded canary lease
        ↓
existing Super Φ.Vessel execution gates
        ↓
Reality Gate
        ↓
NBG + Ledger evidence
\`\`\`

No lower layer can mint authority belonging to a higher layer.

## Next rung

After the canary-lease contract is stable, v0.5 should wire the lease into one **extremely narrow canonical runtime seam**:

- one explicitly allowed task class;
- one exact candidate route;
- tiny decision count;
- tiny spend ceiling;
- mandatory receipts;
- automatic rollback;
- final Executor Authorization unchanged.

That should be treated as a runtime qualification exercise, not a general activation of BudgetGenius.
