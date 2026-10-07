# PV-DLAM P1-A — Single-Node Exact Ledger

**Status:** CANDIDATE / EXTRACTED / UNWIRED  
**Protocol:** PV-DLAM-0.1  
**Phase:** P1-A of P1 one-node continuity

P1-A is the first executable implementation rung after the P0 contract/inventory closure.

It proves the boring part first, because the boring part is where memory systems tend to quietly become haunted:

- one local SQLite owner;
- WAL + `synchronous=FULL`;
- append-only admitted/tombstone ledger events;
- stable Agent/Genius memory identity independent of models;
- epistemic origin preservation;
- explicit contradictions;
- FTS5 lexical recall;
- namespace + purpose + target filtering;
- source tombstones that suppress derived descendants;
- no hard delete during normal forgetting;
- idempotent mutation semantics;
- cold restart continuity;
- deterministic event hashing under pinned inputs.

## Not implemented in P1-A

This is **not the whole P1 gate**.

Still deferred to later P1 rungs:

- bounded context-packet composition;
- exact tokenizer budgeting;
- model qualification and swap checkpoints;
- static Genius/model route receipts;
- crash injection / disk-full qualification;
- managed backup/restore qualification;
- bridge wiring into Vessie, BrainC, or PhiOS;
- semantic/vector retrieval;
- peer synchronization;
- learned routing;
- learned NBG residue.

The canonical standalone SuperPhiVessel runtime is unchanged.

## Run

No third-party Python package is required.

```bash
python3 packages/dlam-p1-v0.1/acceptance.py
```

Expected:

```text
SUMMARY 15/15 PASS
```

## Files

- `dlam_store.py` — local exact ledger/projection implementation
- `acceptance.py` — deterministic P1-A acceptance harness
- `README.md` — scope, boundaries, and next gates

## Authority boundary

Every mutation receipt carries:

```text
authority_granted = false
```

The store may retain or retrieve evidence. It cannot grant action authority, install models, activate hosted providers, or promote a memory into fact.

## Forgetting boundary

A tombstone is an append-only event.

The source record remains auditable, while:

- the source is removed from active FTS recall;
- every transitive derived child is blocked;
- derived rows remain present for inspection/rebuild;
- repeating the same tombstone is idempotent.

P1-B will build the bounded context composer on this exact-history substrate.
