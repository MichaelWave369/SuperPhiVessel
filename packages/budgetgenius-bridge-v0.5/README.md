# Super Φ.Vessel ↔ BudgetGenius Bridge v0.5

**Status:** EXPERIMENTAL / DEFAULT-OFF / CANONICAL RUNTIME CANARY SEAM  
**BudgetGenius pin:** \`44ffc8ccd0f8eafb7130a3051215e536daaa4dce\`  
**Runtime target:** \`v2.0-alpha.11.0.54.11\`

v0.5 is the first rung that places BudgetGenius canary route influence directly in the canonical Super Φ.Vessel runtime path.

It remains deliberately tiny.

## Exact live seam

The runtime order is:

\`\`\`text
computeBrokerRoute(...)
        ↓
budgetGeniusCanaryRuntimeInfluence(...)
        ↓
runProvider / runModelOverride
        ↓
existing call path
        ↓
authorizeExecutor(ACTIVE_RUN_CAPSULE, ...)
        ↓
execution
\`\`\`

The canary can change the proposed local route.

It cannot authorize execution.

## v0.5 live limits

The canonical runtime tightens the broader v0.4 lease to:

- **stage:** \`builder\` only
- **task class:** \`code\` only
- **route count:** exactly 1
- **provider:** local Ollama only
- **model:** exact discovered + operator-approved model
- **decisions:** exactly 1
- **lease lifetime:** at most 5 minutes
- **paid spend:** exactly $0
- **proxy/tool path:** excluded

After one route influence, runtime state becomes:

\`CONSUMED\`

and normal BudgetCompute routing resumes.

There is no rolling live experiment in this rung.

## Real BudgetPass binding

v0.5 no longer treats BudgetPass as a generic \`ALLOW\` flag.

The runtime consumes the real BudgetGenius Rung-6 BudgetPass result and requires:

- \`pass.state === RESERVED\`
- \`pass.passId === canaryLease.budgetPassRef\`
- \`pass.mandateId === canaryLease.mandateRef\`
- \`pass.selectedRouteId === canaryLease.scope.routeIds[0]\`
- \`pass.reservedUsd === 0\`
- the selected plan route matches the pass
- the banker reservation succeeded

That makes the economic/governance object concrete instead of ceremonial.

## Lease validation inside the browser runtime

The runtime independently recomputes the v0.4 lease SHA-256 using Web Crypto.

It also rechecks:

- empirical qualification disposition
- Operator approval
- Steward approval
- Board approval
- route-influence-only authority
- no dispatch authority
- no paid-approval authority
- no authority minting
- no Executor Authorization bypass
- exact task scope
- exact route scope
- one decision
- zero paid spend
- local model discovery
- operator model approval
- lease expiry

The validated lease is then stored as a runtime snapshot with a separate local tamper hash.

Runtime snapshot tampering fails closed and deletes the state.

## Frozen Run Capsule remains a veto

Even after installation, the exact candidate model must still appear in the active frozen \`PhiRunCapsule.approvedModels\`.

If it is absent, the canary enters:

\`ROLLBACK_REQUIRED\`

and the original BudgetCompute route is preserved.

## Local compatibility remains a veto

The existing \`computeBrokerLocalCompatibility(...)\` check is run for the exact candidate using the real task profile and request files.

An incompatible model cannot be forced through by BudgetGenius.

## No execution authority

The influence receipt explicitly freezes:

\`\`\`text
executionAuthorized = false
mayDispatch = false
executorAuthorizationRequired = true
authorityGranted = false
paidApprovalGranted = false
paidSpendUsd = 0
\`\`\`

The existing \`authorizeExecutor(...)\` call remains downstream.

This is the central invariant of v0.5.

## Runtime promotion

The repository's canonical runtime is a large standalone HTML artifact.

\`scripts/build-budgetgenius-canary-runtime-v0.5.mjs\` deterministically derives the v0.5 candidate from the currently pinned v0.4-era canonical runtime.

It:

1. verifies the expected base version and runtime seams;
2. inserts the canary block;
3. wires the call immediately after \`computeBrokerRoute(...)\`;
4. writes the new standalone runtime;
5. computes exact byte size;
6. computes SHA-256;
7. computes Git blob SHA-1;
8. updates \`runtime/MANIFEST.json\`.

The old canonical file remains untouched as historical evidence.

## Acceptance

The v0.5 acceptance suite runs against the generated canonical runtime itself.

It covers 27 checks including:

- manifest/digest integrity
- exact call-site order
- real pinned BudgetPass creation
- SHA-256 v0.4 lease verification
- real one-shot route substitution
- automatic return to baseline after consumption
- proxy exclusion
- stage/task restriction
- Run Capsule veto
- local compatibility veto
- operator model-pool veto
- local discovery veto
- five-minute live ceiling
- one-decision live ceiling
- zero-paid-spend requirement
- exact BudgetPass ID/mandate/route binding
- explicit revocation
- runtime snapshot tamper detection
- preserved downstream Executor Authorization

Expected:

\`\`\`text
BudgetGenius live canary seam v0.5: PASS (27/27)
\`\`\`

## Non-claims

v0.5 does not claim that a real empirical qualification has already been earned.

The runtime is **default-off**.

Without an externally issued, empirically qualified v0.4 lease and a real matching BudgetPass reservation, normal BudgetCompute routing remains unchanged.

## Next rung

Only after this seam is stable should v0.6 add outcome-aware runtime closeout:

- verified result receipt
- quality/evidence outcome
- latency outcome
- critical-miss/governance tripwires
- NBG + Ledger writeback
- explicit savings settlement
- canary qualification report

Even then, scope expansion should require a new Operator / Steward / Board decision.
