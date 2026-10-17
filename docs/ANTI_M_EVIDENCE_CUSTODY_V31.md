# Anti-M Evidence Gate V3.1: signed adapter custody and replay receipts

Status: **shadow-only, model-neutral, no runtime authority**.

This PR extends the merged V3 Evidence Gate with an independent custody check, bounded source freshness, and replayable local receipts. It does **not** change the existing Anti-M completion ledger, canonical runtime, CraneFly routes, BrainC memory, local model execution, agent permissions, or external actions.

## Why

On October 17, 2026, local Qwen and Granite recommended different severity levels without known impact evidence. V3 enforces the risk policy; V3.1 adds the separate question: **who supplied each observation, and how recent is it?**

A model is never allowed to assert its own source authenticity. The source metadata for the shadow bench is constructed in code, not derived from the model proposal.

## Source custody contract

An input holds \`proposal\`, \`context\` (V3's exact-shape source records), and \`custody\` records. For each source, custody contains:

- \`sourceId\`: exact V3 source identifier
- \`adapterId\`: \`OPERATOR_REPORT\` for self-reported incidents, or the name of a separately enrolled adapter
- \`capturedAt\`: strict UTC timestamp
- \`signature\`: \`null\` for operator reports or an Ed25519 signature of the canonical source, adapter ID, and capture timestamp

Context and custody source IDs must match exactly. Missing and extra records fail closed. \`OPERATOR_REPORT\` can only submit \`REPORT/REPORTED\` sources and cannot verify network outages or business impact.

For \`VERIFIED\` connectivity/impact records, **the caller must configure an enrolled adapter public key outside any model text, pasted receipt or browser import**. The gate verifies the Ed25519 signature against the captured source and checks recency. Without an enrolled key, it refuses the verified source. No such key is enrolled in the current browser demo, so it is limited to reports.

An authentic signature establishes that a record was signed using a corresponding enrolled private key. It does **not** establish that a probe was truthful, unbiased, safe, or actually deployed to the claimed machine. Adapter enrollment and source-side behavior remain security-critical operator responsibilities. Synthetic unit-test keys do not represent a deployed trusted probe.

## Freshness policy (V3.1)

- Operator reports: 7 days
- Signed connectivity/impact observations: 15 minutes
- Future capture tolerance: at most 30 seconds, allowing minor clock differences
- Invalid time, stale or future records: custody reject, with no V3 risk evaluation

These are deliberately conservative **demo thresholds**, not a universal network-operations policy. Source trust and severity are distinct from precautionary incident priority.

## Shadow receipt and replay

\`createShadowReceipt(input, asOf, trustKeys)\` produces a bounded, self-contained JSON snapshot:

- Original model proposal, contextual sources and their custody records
- Exact historical \`asOf\` time and both policy versions
- Custody violations and V3 policy verdict
- SHA-256 digest over a canonically serialized receipt body
- Immutable **literal false** fields for execution authority, closure and persistent ledger write

\`replayShadowReceipt(receipt, trustedKeys, currentAsOf)\` checks the saved digest and recalculates the historical decision, then optionally calculates the current decision with the **current** freshness window. Trust keys are never accepted from the receipt. A revoked/missing key means replay cannot validate the prior trust context.

**Crucial limitation:** the receipt is **unsigned**. A party who can edit the whole JSON file can also recompute its hash, so this is a local replay/integrity convenience, **not a cryptographic identity proof, append-only ledger or externally authenticated attestation**. Independently preserving the digest is necessary for later tamper evidence. Rejected proposals are preserved in the downloadable snapshot just like allowed assessments.

## Browser operator flow

1. Navigate to **ANTI-M / FINISH**, then **Evidence Gate V3.1 · Shadow Bench**.
2. Use the default reported-only scenario: \`high\` risk must be **REJECT_POLICY / UNSUPPORTED_SEVERITY**.
3. Click **LOAD CONSERVATIVE CONTROL**: \`undetermined\` must be **ALLOW_ASSESSMENT_ONLY**.
4. Click **DOWNLOAD UNSIGNED SHADOW RECEIPT** or copy it into the replay input, then **REPLAY RECEIPT LOCALLY**.
5. Modify a receipt without recomputing the digest: replay must refuse \`CUSTODY_HASH_MISMATCH\`.

No live Ollama calls, credential enrollment, filesystem scanning, background uploads, localStorage, database, external action execution or automatic Anti-M evidence promotion occur.

## Run the acceptance suite

From \`apps/vessie-web\`:

\`\`\`sh
npm test
npm run build
\`\`\`

\`tests/evidence-custody.test.mjs\` exercises signed synthetic fixtures (generated test key pairs), forged content, untrusted signing keys, unsigned sources, missing custody, unmatched IDs, stale/future timestamps, conflicting verified observations, cited severity mismatch, incomplete privilege claims, historical/current replay, tampered receipts, and absent trust keys on replay.

The existing Vessie Chromium acceptance, core-integrity, and runtime-integrity checks should remain green. This PR **must not** activate live routing or DONE; external source adapters and true append-only ledger recording require separate, operator-reviewed work.
