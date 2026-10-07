# PV-DLAM P1-B — Governed Context Composer

**Status:** CANDIDATE / EXTRACTED / UNWIRED  
**Protocol:** PV-DLAM-0.1  
**Phase:** P1-B of P1 one-node continuity

P1-B implements the boundary:

> **RETRIEVAL ≠ PROMPT ADMISSION**

P1-A proved that exact admitted memory can survive locally. P1-B proves that a model receives only a bounded, target-specific, purpose-specific packet under a current external authority decision.

## What P1-B adds

- exact injected tokenizer/counting seam;
- task + surface + purpose-specific context composition;
- stable Genius identity independent of the selected model;
- current/stale/denied authority status handling;
- epistemic-origin admission;
- strict contradiction pairing;
- bounded provenance expansion;
- required-memory semantics;
- deterministic budget accounting;
- deterministic packet hashing;
- explicit `READY / INSUFFICIENT / HELD / DENIED` dispositions;
- zero action authority in every packet.

## Tokenizer boundary

The composer does **not** pretend that whitespace, characters, or a generic estimate equals a model tokenizer.

A caller must provide:

```python
ContextComposer(
    store,
    tokenizer_id="exact-model-tokenizer-id",
    token_counter=exact_counter,
)
```

The acceptance harness uses a deterministic fixture tokenizer only to prove the accounting contract. P1-C will bind this seam to exact qualified model artifacts.

## Contradiction law

Known contradiction companions travel together.

If a claim is admissible but a known contradictory companion is not admissible for the same purpose/target/origin policy, the claim group fails closed rather than presenting a one-sided packet.

## Provenance law

Direct evidence refs and derivation parents are expanded to a bounded depth when they are admissible.

Inaccessible provenance contributes only an opaque reference/reason entry. Its content is never copied into the packet.

## Required memory

A caller may declare critical `required_memory_ids`.

If any required memory:

- is missing;
- is blocked/tombstoned;
- is denied by purpose/target/origin policy;
- has an unavailable contradiction companion; or
- cannot fit with its governed closure inside the memory budget;

the result is `INSUFFICIENT` with **no partial required packet**.

## Authority boundary

P1-B consumes an external:

- `authority_decision_ref`
- `policy_epoch`
- `authority_status = CURRENT | STALE | DENIED`

It does not create that decision.

`STALE` returns `HELD`.  
`DENIED` returns `DENIED`.  
Every packet carries `action_authority = NONE`.

## Run

```bash
python3 packages/dlam-p1-v0.1/context_acceptance.py
```

Expected:

```text
SUMMARY 17/17 PASS
```

## Still deferred

P1-B does not invoke a model and does not complete P1.

Next:

- **P1-C** — static GA108/model routing receipts, exact model identity registry, task checkpoints, and model-swap continuity;
- **P1-D** — crash/disk-full/backup/restore/deletion-rebuild qualification.

Peer sync, learned routing, and learned NBG residue remain later phases.
