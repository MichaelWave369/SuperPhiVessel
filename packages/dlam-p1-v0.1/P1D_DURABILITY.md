# PV-DLAM P1-D — Durability, Recovery, Backup/Restore, and Rebuild

**Status:** CANDIDATE / EXTRACTED / UNWIRED  
**Protocol:** PV-DLAM-0.1  
**Phase:** P1-D, final qualification rung for P1 one-node continuity

P1-D closes the one-node evidence gate by testing the failure cases that ordinary happy-path persistence tests politely avoid.

## Qualification claims

P1-D is designed to prove, on the CI qualification environment:

1. committed memory survives abrupt process loss;
2. a retry after a commit whose receipt was lost is idempotent;
3. an uncommitted transaction disappears after abrupt process loss;
4. a deterministic SQLite `SQLITE_FULL` condition produces no partial memory/ledger state;
5. the store remains usable after the constrained condition is removed;
6. SQLite's backup API captures committed WAL-visible state;
7. restore verifies integrity, foreign keys, and a logical state manifest;
8. P1-C exact model registry, route receipts, and task checkpoints survive backup/restore;
9. P1-B context recomposes identically after restore when the logical state/request are unchanged;
10. active-search projection damage is detectable and rebuildable;
11. rebuilding cannot resurrect a tombstoned source or its blocked derived lineage;
12. corrupt backups fail closed before becoming a restored store;
13. backup receipts represent a point-in-time snapshot, not an alias to later live mutations.

These claims remain bounded to the tested SQLite/Python reference implementation and qualification environment. They are not claims about arbitrary filesystems, power-loss hardware, network storage, or every operating-system failure mode.

## Crash boundary

Two subprocess tests deliberately exit with `os._exit`:

### Commit completed, receipt not relied upon

```text
ADMIT
  ↓
SQLite COMMIT
  ↓
process disappears
  ↓
restart
  ↓
memory exists
  ↓
same admission retry => idempotent
```

This is the classic “did the write happen or did the reply get lost?” boundary.

### Transaction open, process disappears

```text
BEGIN IMMEDIATE
  ↓
partial ledger/projection writes
  ↓
process disappears before COMMIT
  ↓
restart
  ↓
no event
no memory
no consumed sequence
```

## Write-failure negative control

P1-D uses SQLite's own `PRAGMA max_page_count` on a throwaway database to force a real `SQLITE_FULL` write failure.

The acceptance condition is strict:

- no admission receipt;
- no partial memory row;
- no partial ledger event;
- subsequent normal operation succeeds after the artificial cap is lifted.

This is not equivalent to physically unplugging a disk. It is a deterministic database-level full-condition qualification.

## Backup / restore

Live SQLite/WAL files are **not** copied directly.

P1-D uses the SQLite backup API for both backup and restore.

A backup receipt pins:

- SHA-256 of backup bytes;
- logical manifest hash;
- namespace ledger frontiers;
- method = `SQLITE_BACKUP_API`;
- `authority_granted=false`.

Restore refuses unreadable/corrupt sources and verifies:

- `PRAGMA integrity_check`;
- `PRAGMA foreign_key_check`;
- logical manifest equality.

## Logical manifest

The logical manifest hashes continuity-relevant state counts and per-namespace ledger frontiers, including P1-C registry/route/checkpoint state when present.

It intentionally does not equate byte-for-byte SQLite layout with logical identity.

## Projection rebuild

FTS and active/tombstone flags are replaceable projections.

P1-D can reconstruct active suppression from:

- durable tombstone records;
- derivation edges;
- durable memory records.

The rebuild then repopulates FTS only from records that are neither tombstoned nor blocked.

A tombstoned source therefore remains suppressed, and every transitive derived child remains blocked after projection rebuild.

## Authority

Backup, restore, verification, and rebuild receipts all carry:

```text
authority_granted = false
```

Durability is not permission.

## Run

```bash
python3 packages/dlam-p1-v0.1/p1d_acceptance.py
```

Expected:

```text
SUMMARY 20/20 PASS
```

## P1 exit

If P1-A, P1-B, P1-C, and P1-D all remain green together, the extracted one-node continuity evidence gate is complete.

That establishes the reference path for:

- durable exact memory;
- governed prompt admission;
- exact model identity and safe model swap;
- crash/write-failure recovery;
- managed backup/restore;
- deletion-safe projection rebuild.

It still does **not** mean live Vessie/BrainC/PhiOS wiring is complete, peer synchronization is qualified, learned routing is activated, or learned NBG memory is production-qualified.
