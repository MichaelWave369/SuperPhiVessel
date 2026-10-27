# Anti-M / Smergeon Recovery Ward · Shadow Intake v0.1

**Status:** Browser-only, opt-in, unsigned, unverified. No live authority.

## What this adds

The React cockpit's **ANTI-M / FINISH** view already contains the V3.1
Evidence Gate Shadow Bench. This rung adds a separate **07 / Smergeon ·
Surgical Handoff** pane below the existing evidence replay section.

The new pane accepts a Smergeon v0.6 surgical receipt produced by a separate
operator, then inspects the same exact fields and Python-compatible canonical
SHA-256 checksum that GitPorch's read-only intake supports.

The pane does **not** convert the receipt into an incident-evidence source,
Anti-M completion criterion, signed adapter, trusted GitPorch worker result,
CI PASS, deployment evidence, or authorized action. The original
\`anti-m.mjs\`, \`evidence-gate.mjs\`, and \`evidence-custody.mjs\` are unchanged.

## Browser procedure

1. Open the SuperPhiVessel React cockpit and select **ANTI-M / FINISH**.
2. In **07 / Smergeon · Surgical Handoff**, select a local JSON receipt
   or paste its contents. Browser input is bounded to **16 KiB**.
3. Optionally paste a lowercase 64-hex SHA-256 checksum that you had saved
   **independently** from the receipt.
4. Select **INSPECT UNSIGNED HANDOFF**.
5. Review **REVIEW_ONLY** or **REJECT**. Inspect the referenced original
   GitHub PR and diff independently before making any human decision.

The pane never uploads the JSON, requests a GitHub token, performs a
network fetch, accesses local storage, or changes the existing Anti-M
ledger. It holds the current pasted JSON and result only in React memory.
CLEAR LOCAL INPUT removes both from the component's current state.
Selecting a new file or changing the checksum discards the previous result.

## Semantic boundaries

| Property | Output |
| --- | --- |
| Valid receipt structure and SHA-256 | \`REVIEW_ONLY\` |
| Bad or unexpected structure, hash, signature or authority claims | \`REJECT\` |
| Trust classification | \`UNSIGNED_UNVERIFIED\` |
| Signed evidence accepted | \`false\` |
| Worker execution verified | \`false\` |
| Anti-M completion | \`false\` |
| Permission to execute, merge or close | \`false\` |

A receipt marked \`DRAFT_CREATED\` may contain a GitHub URL. It is a
**self-reported** draft-PR location. The pane never fetches the URL or
verifies that the PR exists, is current or has green CI. The link is displayed
only when it matches the exact validated GitHub PR URL shape.

The receipt's SHA-256 is an *integrity checksum*, not a digital signature,
authenticated custody, witness, independent CI result or proof of successful
code repair. The issuer or an attacker could recompute both receipt and
checksum. An out-of-band independently preserved digest detects change
relative to that digest; it does not identify who originally produced it.

Smergeon's diagnostic and patch-related plans remain governed in Smergeon.
This browser pane has **no direct bridge** to those executors. No automatic
promotion of proposals to Anti-M V3.1 custody is allowed.

## Code and acceptance

- \`src/smergeon-shadow.mjs\`: pure WebCrypto-based, strict read-only schema
  and checksum inspection derived from GitPorch's v0.1 intake contract.
- \`src/SmergeonShadowPanel.tsx\`: explicit browser-memory intake UI.
- \`tests/smergeon-shadow.test.mjs\`: cross-language staged/draft fixtures and
  negative cases for claimed worker PASS, Anti-M DONE, unsafe branch/path,
  tampered data, unsupported fields, and checksum mismatch.
- \`src/EvidenceGatePanel.tsx\`: adds the separate shadow pane without
  altering the incumbent V3/V3.1 assessment and receipt/replay pathways.

From \`apps/vessie-web\`, run \`npm test\` and \`npm run build\`; the regular
CI workflow must remain green before promotion. Tests do not claim that a
real external GitHub job executed or that a human verified the receipt.

This is **SuperPhiVessel-only** integration. GitPorch's read-only intake and
Smergeon's v0.6 handoff producer remain unchanged in their own repos.

**Ledger above ego. First, do no merge harm.**
