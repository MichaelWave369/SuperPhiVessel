# Super PhiVessel — SPD-W v0.1.0

**Source Provenance Differential Weighting** is a deterministic pre-promotion gate for the Reality Ledger / Promotion Firewall path.

## Purpose

SPD-W asks two separate questions before a claim is promoted:

1. **What kind of source do we actually have?**
2. **What epistemic or authority state are we trying to assign?**

It then emits a numeric provenance-gap weight (`SPD_W` from 0–10), a categorical disposition, explicit missing requirements, and a deterministic receipt.

SPD-W is **not** a truth score and **not** a model-confidence score.

## Frozen v0.1 boundaries

- Analogy may generate a **HYPOTHESIS**.
- Analogy is not evidence and is never called “symbolic proof.”
- Novelty does not auto-promote state.
- `TESTED` requires a real `TEST_RESULT` artifact.
- `SUPPORTED` requires empirical/test evidence plus at least two independent confirmations.
- `OBSERVED` requires direct observed custody. Derived or interpreted material cannot be promoted into `OBSERVED`.
- `ACTIONABLE` requires a bounded low-risk scope, acceptance PASS, and Reality Gate PASS.
- `AUTHORIZED` requires `ACTIONABLE` state, acceptance PASS, Reality Gate PASS, and an explicit Human Commitment Write.
- Unknown source classes and unknown target states fail closed.

## Source classes

`SYMBOLIC | AXIOMATIC | INTERPRETED | DERIVED | TEST_RESULT | OBSERVED`

## Target states

`SYMBOLIC | HYPOTHESIS | TESTABLE | TESTED | SUPPORTED | OBSERVED | ACTIONABLE | AUTHORIZED`

## Dispositions

- `ALLOW` — transition requirements are satisfied.
- `WARN` — structurally allowed, but the provenance differential is non-trivial and must remain visible.
- `REQUIRE_EVIDENCE` — the state cannot advance until listed requirements are supplied.
- `BLOCK` — invalid or authority-sensitive transition; fail closed.

## Receipt schema

`superphivessel.spdw.receipt.v0.1`

A receipt contains:

- source class
- target state
- SPD-W weight
- disposition
- rule ID
- missing requirements
- reasons
- `epsilon.provenance`
- `epsilon.ontology`
- deterministic identity hash

The included FNV-1a hash is for deterministic receipt identity only. It is **not cryptographic integrity** and must not replace existing Super PhiVessel custody hashes.

## Recommended runtime seam

Run SPD-W **inside or immediately before the Promotion Firewall decision** and before any promotion is committed to the Reality Ledger.

```text
candidate claim
  -> Semantic Custody / source class
  -> SPD-W
  -> ALLOW/WARN/REQUIRE_EVIDENCE/BLOCK
  -> Promotion Firewall
  -> Reality Gate
  -> Ledger handoff
  -> Human Commitment Write (AUTHORIZED only)
```

`BLOCK` must make promotion ineligible.

`REQUIRE_EVIDENCE` must keep the current state unchanged.

`WARN` may continue, but the SPD-W receipt must remain attached to the claim/ledger record.

## Deliberately excluded from v0.1

- automatic semantic source classification
- LLM-generated weights
- machine-learned transition matrices
- automatic promotion on novelty
- economic/collateral semantics
- “universal harmonic” claims
- dynamic ontology creation

Those would make the first experiment harder to falsify and easier to game.
