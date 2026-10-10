# Anti-M v0.1: Completion Console (SPV-AM-01)

Anti-M is the finishing executive role in Vessie, not a privileged autonomous agent. The initial React cockpit has **no executor**. It is an operator-owned closure workflow for one bounded objective, with explicitly logged review decisions and portable audit data.

## Contract and loop

1. Create a title, deliverable, and 1-8 immutable, testable acceptance criteria. The contract ID and criteria are frozen when created.
2. Declare consequential proposed actions by class: repo write, deployment, external post, spend, credential use, or other side effect.
3. Record a named operator review for each action. **This is not an OAuth token, runtime permission, credential, or capability grant.** Real actions still require the target system's independent approval.
4. Add evidence against each acceptance criterion, including PASS/FAIL, method, HTTPS reference or SHA-256 identifier, and a short summary.
5. Explicitly record ACCEPT/REJECT reviews. Only the latest evidence for each criterion counts; a failed, unreviewed, or rejected latest result blocks closure.
6. When all criteria have latest PASS+ACCEPT and all declared actions have a review, Anti-M may emit a CLOSED event and an operator-reviewed receipt.
7. Export the full JSON journal for durable storage and later import. No autosave, background job, live GitHub write, gateway call, localStorage, credential capture, or hidden AI generation.

## Status contract

- EVIDENCE_PENDING: required evidence or review missing.
- APPROVAL_HELD: at least one declared action has no operator review.
- READY_TO_CLOSE: latest evidence PASS and operator ACCEPT for each criterion, and all declared actions reviewed.
- VERIFIED_DONE_LOCAL: a CLOSED event exists and the journal's SHA-256 hash chain replays and passes the **local review completeness rules**.

**VERIFIED_DONE_LOCAL IS NOT INDEPENDENT PROOF OF DEPLOYMENT OR EXECUTION.** The operator typed the evidence and review. Links are not fetched or authenticated. A local hash chain detects modifications to a bundle relative to its event hashes, but anyone can generate a new valid bundle. No trusted operator identity, external attestor, signed provenance, Reality Gate grant, or actual execution capability is present. Display and receipts must retain these negative flags.

## Threat model and limits

All JSON is parsed with exact top-level/event/payload fields and bounded sizes, counts, text lengths, IDs, event order, and known action classes. Imported events are replayed from the first contract creation, checking SHA-256 of each canonical event and previous hash. A copied status label or altered receipt cannot override computed readiness. Sources/links are plain text, never executed. Hashes are tamper-evident within a bundle, not signed or immutable against someone rewriting the entire history.

No runtime or canonical HTML file is modified. The cockpit is a separate React preview. Downloaded JSON contains operator-entered text and should be handled as potentially sensitive metadata.

## Future real-trust rung (not in v0.1)

Integrate independently verified CI/deployment attestations via a scoped authenticated adapter, time-bound operator execution grants with the existing gateway / Reality Gate, signed receipts anchored to a trusted ledger, durable queue recovery, and end-to-end physical acceptance. Preserve VERIFIED_DONE_LOCAL as its own provenance class; do not silently promote it to an externally verified DONE.

Run from apps/vessie-web: npm test && npm run build. See ANTI-M / FINISH MODE in the React cockpit.
