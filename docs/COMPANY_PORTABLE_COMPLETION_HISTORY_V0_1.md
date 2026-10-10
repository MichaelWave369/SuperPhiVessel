# SPV-COMPANY-09: Portable Completion History v0.1

**Status:** voluntary, offline file-based recovery of the Vessie Company Mode workspace. This is not cloud persistence, encrypted local storage, independently signed evidence, browser auto-save or a server-backed ledger.

## What's actually backed up

One JSON document contains:
- The exact existing **Company Mode plan** with its bounded nodes, human action-review records, and operator-entered evidence.
- The existing **Mission Priority Queue** review set with bounded human assessments. If the workspace never had a set, a valid empty review set is included.
- Up to 12 full **Anti-M replayable journals** that the operator previously imported and matched to specific Company nodes in the Completion Dashboard. Crucially these are full event bundles, not the display-only journal summaries or standalone closure receipts.
- The export timestamp, a canonical payload SHA-256 for accidental-change detection, and immutable zero-authority provenance flags.

No data is fetched automatically; neither the GitHub Issue Scout nor the Mission Health Desk snapshots are saved into the archive. Unexported content and the current standalone Anti-M console state are not automatically collected.

## Export and restore

1. Create or import a Company plan, record human priority reviews, and optionally use **Completion Dashboard → REPLAY + ATTACH LOCAL STATUS** to associate one or more matching Anti-M journals.
2. Under **Portable Completion History**, click **EXPORT REPLAYABLE WORKSPACE JSON**. All included journals are replayed again before a downloadable file is constructed. The browser download step is user-initiated; check your Downloads folder and keep the file private.
3. On a future session (including after refresh), return to Company Mode's **Portable Completion History**, choose your JSON archive file, then click **VALIDATE + PREVIEW ARCHIVE**.
4. The importer enforces a 1.8 MB total JSON byte limit, current Company and Priority schemas, immutable zero-authority flags, matching payload checksum, and full canonical Anti-M SHA-256 event chain **for every included journal**. Each contract must match its selected Company task by title/function, deliverable/output and sole acceptance criterion/check.
5. The preview displays company name, node count, priority review count, locally replayed Anti-M journal count, locally closed journal count and archive checksum. At this stage the active workspace remains untouched.
6. Click **RESTORE VALIDATED WORKSPACE (EXPLICIT)**. If an existing Company plan is open, the UI asks for additional confirmation before replacement. Plan, priority reviews, journal status summaries and preserved full journal sources are restored together.
7. If validation fails, **nothing** is replaced. Restoration never runs a project, fixes a repository, closes an issue, starts agents or grants a permission.
8. Reloading without an exported archive still loses work. The browser does **not** auto-save to localStorage, IndexedDB, cloud storage, GitHub, the gateway, or any other service.

## Epistemic boundaries

- The archive SHA-256 detects accidental edits or corruption **only**. Someone with control of the file can recompute the checksum. It is not a digital signature, evidence of authorship, or independent verification of source truth.
- Every Anti-M journal retains its own separately replayed SHA-256 chain of self-reported event data. That integrity chain is not authenticated third-party CI verification and cannot establish real-world deployment success.
- Company `LOCAL_REVIEW_ACCEPTED` and Anti-M `VERIFIED_DONE_LOCAL` remain **separate** local outcomes. Restoring or inspecting either does not promote the other or create external DONE.
- No browser credentials, signed identities, remote provenance, OAuth tokens, cookies, Github writes, external publication, authorization grants or execution occurs.
- Portable files are unencrypted. They can include operator-entered evidence references and private planning details. Treat downloaded archives as potentially sensitive, store them appropriately and avoid sharing them publicly.

## Limits and tests

- Up to 12 Company nodes and 12 unique Anti-M journals; each Anti-M journal max 128 KiB; total archive max 1.8 MB.
- Reject unknown/extra fields, over-limit files, forged authorization or completion flags, corrupt payload hash, stale priorities, duplicate journal node IDs, tampered Anti-M events, unmatched contract scope, malformed JSON and receipt-only data.
- Validate **all** sources before updating any displayed Company state; no partial recovery.
- From `apps/vessie-web`, run `npm test && npm run build`.
- Browser manual test: export a plan plus two priorities and one replayable Anti-M journal, refresh, choose archive, inspect preview, then restore; confirm Company's local status and Anti-M's imported local closure remain independent. Edit one event or export checksum and confirm fail-closed import.

## Next architecture rung

A separately reviewed, **explicitly opt-in encrypted local persistence adapter** could later reduce manual backup friction, provided device-key custody, migration, retention, deletion and tamper limitations are specified and tested. That is intentionally **not** part of this file-based recovery rung.
