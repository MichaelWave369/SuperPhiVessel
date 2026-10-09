# SPV-SCOUT-01: Manual PhiBot qualification handoff view

**Scope:** React Vessie cockpit only (`apps/vessie-web`). This feature introduces **no live PhiBot network connection**, Ollama execution, routing access, Vessie/BrainC prompts, NBG memory admission, tool capability, background monitoring, or Reality Gate grants.

## Why this exists

The first Windows PhiBot Scout field run completed with `PASS_LOCAL_SCOUT_SHADOW` on an installed local `qwen3:4b` model. PhiBot then independently loaded its own private receipt files, verified a domain-separated SHA-256 digest, and emitted a redacted **`phibot.scout-vessie-handoff.v0.1`** manual-copy JSON packet.

The packet itself is an operator-provided, self-reported evidence projection. **This browser never receives the underlying qualification.json bytes or independent public keys**. Therefore the browser must not assert that a digest was cryptographically verified, that a particular model actually executed, or that source/operator identity is trusted.

## How to use

1. On the operator's Windows PC, from `C:\Users\micro\PhiBot`, run:

   ```powershell
   npm.cmd run scout:handoff -- --receipt .phibot\scout-qualification\scout-J1h0Kv --ack-local-self-report
   ```

2. Copy only the JSON output to the browser clipboard.
3. Open the GitHub Pages Vessie React cockpit at `/SuperPhiVessel/vessie/`.
4. Select **SCOUT HANDOFF** and paste the redacted JSON.
5. Select **REVIEW LOCALLY**. The component evaluates it only in browser memory. The **CLEAR** button discards the local copy.

The cockpit displays the model tag, run ID, qualification date, source expiry, digest prefix, and a fresh calculation of whether source evidence is current **at the moment of review**.

## Rejection criteria

- Unknown, extra, or nested fields and invalid JSON
- More than 4 KiB of input
- Unrecognized schema, identity, model, result, or evidence classification
- Any true authorization, memory, model/runtime attestation, signed-identity, bot spawn, or Vessie-connected flag
- Any routing influence other than NONE
- Invalid digest shape or run ID
- Impossible timestamps and future qualification timestamps

No user-supplied string is rendered as HTML; React escapes it. An invalid handoff is not shown as a PASS. Browser parsing never stores to localStorage or fetches a URL. No interface is offered to export as a BrainC or routing candidate.

## What it cannot prove

A self-reported digest field can be forged: changing the digest string in the paste will not be detected without the original file bytes. **The screen explicitly displays the digest as unverified** and `UNWIRED_REVIEW_ONLY` as the integration status. It is an informational, human-review-only display and grants no action authority.

This feature does not alter the legacy hosted Vessie HTML, the private Windows-only PhiBot receipts, or the production routing policy.
