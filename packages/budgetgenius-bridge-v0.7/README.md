# Super Φ.Vessel ↔ BudgetGenius Bridge v0.7

**Status:** EXPERIMENTAL / DEFAULT-OFF / CANONICAL OUTCOME HANDOFF
**BudgetGenius pin:** 44ffc8ccd0f8eafb7130a3051215e536daaa4dce
**Runtime target:** v2.0-alpha.11.0.54.12
**Live canary scope:** unchanged from v0.5

v0.7 connects the canonical one-shot BudgetGenius canary to the v0.6 closeout layer.

> **Execution completion is observable truth. Quality is not.**

A provider returning a response proves execution completed. It does not prove the result was correct, well-evidenced, safe, or economically useful.

## Canonical seam

On first-attempt success, v0.7 records the completed local canary immediately after computeBrokerRecord and moves the experiment to AWAITING_VERIFICATION before the existing response commit path.

On first-attempt failure, v0.7 records ROLLBACK_REQUIRED immediately after computeBrokerRecord and before the existing paid-fallback decision. A remote rescue therefore cannot cause a failed canary to receive credit for the final successful user request.

## Runtime outcome receipt

The canonical runtime automatically emits a SHA-256-bound BudgetGeniusCanaryRuntimeOutcomeReceipt containing lease, qualification, mandate, BudgetPass and influence identity; the actual executor/provider/model; execution status; provider-receipt digest; output digest on success; and failure code on failure.

A completed attempt remains AWAITING_VERIFICATION. A failed attempt becomes ROLLBACK_REQUIRED.

## Normalization seam

The v0.5 browser receipt uses presentation-oriented route fields while the v0.6 closeout layer consumes economic route IDs. v0.7 normalizes them explicitly, including the exact governed canary route ollama::<approved-model>.

## No fake verification

The runtime outcome always retains verifiedOutcome=false, writebackAllowed=false, scopeExpansionAllowed=false, and authorityGranted=false. Successful execution does not invent a quality pass, evidence score, verified savings, or qualification promotion.

Those claims require the v0.6 closeout layer plus explicit independent verification evidence.

## Authority boundary

v0.7 adds no dispatch, paid-provider, verifier, evidence-promotion, memory-writeback, scope-expansion, lease-renewal, or model-qualification authority. The frozen Run Capsule and authorizeExecutor remain authoritative.

## Reproducibility

scripts/build-budgetgenius-outcome-runtime-v0.7.mjs deterministically derives .54.12 from canonical .54.11, inserts the outcome block, instruments success and pre-fallback failure, then updates exact byte size, SHA-256, Git blob SHA-1, and the runtime manifest.

## Acceptance

The v0.7 suite covers 14 checks: manifest and byte integrity; preserved v0.5 canary and Executor Authorization; success/failure call-site placement; real BudgetPass reservation; automatic AWAITING_VERIFICATION semantics; runtime-to-v0.6 normalization; independent verified closeout; rollback-before-fallback; prohibition on failed-result promotion; tamper detection; authority-promotion rejection; and cross-lease rejection.

Expected: BudgetGenius canonical outcome handoff v0.7: PASS (14/14)

## Next rung

v0.8 can connect a qualified independent verifier to this outcome handoff and automatically invoke v0.6 closeout only when sufficient evidence exists. That automates verification rather than merely observing execution.
