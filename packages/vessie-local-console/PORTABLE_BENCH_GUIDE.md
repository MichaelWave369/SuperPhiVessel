# Vessie Local Evidence Bench · operator-owned portable bundles

The original Evidence Bench holds up to 24 redacted trial and human
review observations **only in browser memory**. The former `Export
descriptive comparison` download is useful as a human-readable summary,
but deliberately lacks all normalized source-evidence fields and therefore
**cannot restore the bench**.

A portable bundle solves that missing workflow **without** introducing
automatic storage, syncing, agent memory, file access or authority.

## Save an existing bench

1. In the local console, manually import redacted evidence receipts or
   click to keep the current local performance and human-review receipts.
2. In the Local Evidence Bench, click **Save portable bench JSON**.
3. Your browser saves a file named
   `vessie-local-evidence-bench-portable.json` on your machine.
4. Keep that file wherever you manage your own evidence. Vessie does not
   send it to a server or reload it without your next explicit action.

This is **not encryption**. The bundle is redacted, but model labels,
timestamps, output SHA-256 digests, timing values and subjective human
ratings may themselves be sensitive. Treat the downloaded file
accordingly. Local files can be copied or modified by other programs.

## Restore in another session

1. Start the updated console in the **default read-only mode**. Trial
   execution does not need to be enabled to review evidence.
2. Locate the Local Evidence Bench at the bottom of the page.
3. Click the file input and manually select the portable JSON bundle.
4. Click **Read selected local files**.
5. The bench now shows the restored *descriptive, unranked* comparison.
   Imported review records match performance records only on model
   label plus output SHA-256, never on a guess.

The same file picker continues to accept the individual
`superphivessel.local-console.trial.receipt.v0.1` and
`superphivessel.local-console.human-review.v0.1` redacted JSON
receipts. The selection may mix these with one or more portable bundles.
An entire import batch is applied **transactionally**. If any part
fails, nothing from that batch is accepted.

## Strict limits and validation

- Maximum **24 distinct evidence entries** per bench, unchanged.
- Maximum **16 KiB** per individual receipt input.
- Maximum **64 KiB** per portable bench bundle input and output.
- The bundle format is
  `superphivessel.local-console.evidence-bench.bundle.v0.1`.
- Only the canonical redacted *normalized* evidence records are
  included. There are no prompt strings, generated answers, free-text
  notes, original untrusted JSON objects, session bearer secrets,
  API keys, filesystem paths or execution settings.
- Bundle and entry keys are **strictly allowlisted**. An unexpected
  key is a refusal, not a silent serialization or a new capability.
- Duplicate identical entries are idempotent when restoring. Same
  identity with mismatched metrics or ratings **fails closed** rather
  than silently overwriting evidence.
- Forged/malformed authority, extra fields, missing privacy flags,
  invalid timestamps, bad hash formats and impossible numeric values
  are refused.
- A descriptive **comparison summary** is deliberately **not
  reimportable** as a portable bundle; save both formats if you want
  a readable report and a session backup.
- No cryptographic signatures, external attestation or authenticity
  proofs are claimed by a response hash or bundle format. An attacker
  who can edit a JSON file may create plausible but false evidence.
  Imports are marked **operator-selected and unauthenticated**.

## Governance invariants

- No continuous benchmark, synthetic grading, leaderboard or
  automatic model choice.
- No BrainC, Genius roster or Crane Fly execution authorization.
- No model inference caused by importing, comparing or exporting.
- No cloud calls, file server, database, localStorage or IndexedDB.
- No automatic save on each answer, no background task, and no reload
  without an explicit operator file-selection action.
- The normal read-only launcher and per-prompt manual inference
  opt-in remain separate and unchanged.

To erase bench data from the active tab, click **Clear this bench**
after confirming. Exported files on your disk remain yours; Vessie
cannot delete them.
