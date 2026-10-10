# SPV-COMPANY-08: Anti-M Completion Dashboard v0.1

**Status:** local-only, founder-reviewed progress surface inside Company Mode. Three separate lanes:

1. **Company status:** deterministic graph projection covering dependency blocked, action-review-held, ready for manual work, failed check, pending evidence review, rejected check and locally accepted.
2. **Human priority:** reviewed active nodes ordered by COMPANY-07, unranked active nodes thereafter, locally accepted nodes last. Scores are advisory, not independent proof.
3. **Anti-M journal:** optional local snapshot, added *only* after the human imports the complete replayable Anti-M JSON ledger and the canonical SHA-256 event chain is recomputed.

## How to use

1. Create/import a Company plan and review the completion board's counts and manual next-step prompts.
2. Optionally propose a node as a separate Anti-M contract through COMPANY-02's manual handoff. That path does not freeze or open a contract automatically.
3. In **Anti-M / FINISH**, create, review and export a full replayable ledger JSON. A closure receipt by itself is not suitable for linking.
4. In **Completion Dashboard**, explicitly select the Company node, paste the complete ledger JSON (max 128 KiB) and click **REPLAY + ATTACH LOCAL STATUS**.
5. The canonical Anti-M importer replays every hash-chain event. The contract title, deliverable, and *sole* acceptance criterion must exactly match the selected Company node's function, output and check after canonical whitespace trimming.
6. Display local Anti-M status, contract ID, SHA-256 tail and event count. Possible statuses: EVIDENCE_PENDING, APPROVAL_HELD, READY_TO_CLOSE, VERIFIED_DONE_LOCAL.
7. The operator can detach the in-memory status or confirm replacing it with a freshly replayed ledger. To see updates, manually reimport a newer full ledger; no live sync is provided.
8. Company and Priority JSON exports remain separate. Imported Anti-M summaries are memory-only and cleared on Company plan replacement or page reload.

## No trust escalation

- Company LOCAL_REVIEW_ACCEPTED is self-reported evidence plus operator-entered review inside editable Company JSON. It is **not cryptographically attested**.
- Anti-M VERIFIED_DONE_LOCAL means self-reported review events replayed with a valid local SHA-256 chain. It is **not proof of genuine external execution, authenticated reviewer identity or independently verified deployment**.
- Neither status upgrades the other. A matching Anti-M journal never changes Company evidence, reviews, dependencies, status, action grants or priority scores.
- A task may have a closed Anti-M journal while its Company status remains READY_FOR_MANUAL_WORK, and vice versa. These are distinct local ledgers, not contradictory status claims.
- A validated ledger summary only reflects the state **at manual import time** and is not itself a signed receipt or an append-only ledger.
- No GitHub writes, model/agent executions, proof URL fetches, deployments, payments, credential use or scheduled background monitoring occur.

## Refusals and verification

Malformed/oversized Anti-M journal, modified event hashes or sequence, fake DONE fields, standalone closure-receipt format, unknown Company node, or mismatched contract scope must be refused. An imported display-only link cannot assert positive external attestation or authority.

Tests verify dependency blocks persist despite high human priority, independent Company/Anti-M local state, forged flag refusals, and tamper detection. Browser smoke should confirm manual journal import and Company task preservation.

Run from apps/vessie-web: npm test && npm run build

No canonical HTML, gateway, workflows or runtime executors are changed.
