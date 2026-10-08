# Super Φ.Vessel ↔ BudgetGenius Bridge v0.6

**Status:** EXPERIMENTAL / DEFAULT-OFF / OUTCOME CLOSEOUT  
**BudgetGenius pin:** `44ffc8ccd0f8eafb7130a3051215e536daaa4dce`  
**Consumes:** governed v0.4 lease + v0.5 influence receipt  
**Live routing scope:** unchanged

v0.6 closes the evidence and economics loop after one bounded BudgetGenius canary decision.

v0.5 proved that BudgetGenius can influence exactly one canonical local route while preserving the frozen Run Capsule and downstream Executor Authorization. v0.6 answers the less glamorous but more important question:

> After the canary ran, did it actually help, and is the evidence clean enough to retain?

## Closeout sequence

```text
v0.5 governed route influence
        |
        v
execution under existing Executor Authorization
        |
        v
quality / evidence / latency outcome
        |
        v
independent verification
        |
        v
v0.6 canary closeout
        |
        +--> tripwire? ----------> ROLLBACK_REQUIRED
        |
        +--> clean verified result
                  |
                  +--> causal savings settlement
                  +--> Budget Ledger writeback
                  +--> NBG outcome writeback
                  +--> qualification report
```

## Hard tripwires

Any of the following prevents verified savings and blocks verified NBG/Ledger writeback:

- critical miss
- governance violation
- quality failure
- evidence below the lease floor
- latency regression above the lease ceiling
- verifier failure
- verifier confidence below policy
- verifier independence below policy
- missing verifier evidence

A cheap result that fails verification is not savings. It is merely an inexpensive mistake with good branding.

## Causal savings

v0.6 keeps the economic accounting conservative.

```text
total causal cost
  = actual route cost
  + attributable downstream / repair / verification cost

verified savings
  = max(0, baseline estimated cost - total causal cost)
```

Savings exist only when the outcome is verified and no tripwire fired.

The acceptance suite cross-checks the v0.6 result against the real pinned BudgetGenius `settleBudgetPass(...)` and `certifySavings(...)` APIs.

## NBG + Ledger writeback

A clean verified closeout may emit two evidence artifacts.

### Budget Ledger entry

The Ledger row retains:

- lease ID
- influence ID
- closeout hash
- qualification ID
- task class
- selected route
- verified savings
- evidence score
- latency regression

It explicitly retains:

`authorityGranted = false`

### NBG outcome record

The NBG record stores a compact governed observation suitable for later learning:

- task class
- route
- quality result
- evidence score
- latency regression
- causal cost
- verified savings
- source closeout hash

The writeback explicitly states:

```text
mayChangeLiveRoute = false
scopeExpansionAllowed = false
authorityGranted = false
```

Memory is evidence, not authority.

## Qualification report

A collection of integrity-valid closeout receipts can be compiled into a v0.6 qualification report.

A clean report may become:

`CANARY_EVIDENCE_READY_FOR_REVIEW`

That means only that evidence is ready for Operator / Steward / Board review.

It does **not** mean:

- automatic activation
- automatic lease renewal
- wider model scope
- more task classes
- more decisions
- paid-provider authority
- execution authority

Every scope expansion still requires a fresh governance decision.

If any retained closeout contains rollback evidence, the report becomes:

`HOLD_OR_ROLLBACK`

## Tamper resistance

The closeout receipt is SHA-256 bound over its canonical fields.

Changing claimed savings, outcome evidence, route identity, or verification state invalidates the receipt.

The runtime state object is intentionally excluded from the closeout digest because v0.6 certifies the immutable evidence artifact rather than mutable orchestration state.

## Acceptance

The v0.6 suite exercises 18 checks:

- real pinned zero-dollar BudgetPass reservation
- governed v0.4 route influence fixture
- clean verified closeout
- closeout digest integrity
- real BudgetPass settlement agreement
- Ledger + NBG writeback
- review-only qualification report
- critical-miss rollback
- quality rollback
- evidence-floor rollback
- latency rollback
- governance rollback
- verifier-failure rollback
- authority-promotion rejection
- economic tamper detection
- rollback writeback rejection
- mixed-result qualification hold
- no-verifier fail-closed behavior

Expected:

```text
BudgetGenius canary closeout v0.6: PASS (18/18)
```

## Non-claims

v0.6 does not widen the v0.5 live canary.

It does not create empirical evidence by itself. Real qualification still requires real field or replay evidence under the existing qualification protocol.

It does not let learned memory rewrite governance.

## Next rung

A later v0.7 may wire this closeout artifact directly into the canonical runtime's post-execution completion seam so the receipt is emitted automatically after the one-shot canary finishes.

That should remain separate from scope expansion.
