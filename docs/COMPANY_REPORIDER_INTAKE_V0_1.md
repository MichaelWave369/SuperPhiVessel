# SPV-COMPANY-03: RepoRider mock ride → Company Mode manual task intake

**Mode:** offline, operator-triggered proposal intake. Not a live RepoRider adapter or GitHub connector.

## Source contract

This integration reads the `reporider.ride-receipt.v1` **typed JSON Ride Complete receipt** already exported by RepoRider (`src/lib/rideReceiptJson.ts`). The exporter is explicitly mock-mode and contains `queuedIssues[].title`, `queuedFiles[].path`, `ride.repositoryUrl`, `ride.mode`, `boundary.mode`, and local safety metadata.

Only the *titles* from `queuedIssues` become proposed Company graph tasks. The displayed mocked repository URL, file count, and local safety status provide context **only**. No source fields, fingerprints, receipt hashes, approval summaries, or locally approved states grant authority. Source bytes are not authenticated or replay-verified; the intake is intentionally **not** a trusted receipt verifier.

## Operator workflow

1. In RepoRider, complete a **mock** ride and copy its **typed JSON ride receipt**.
2. In Vessie's **Company Mode**, create or import a company plan, then paste the RepoRider JSON in **RepoRider / Proposed task intake**.
3. Click **PREVIEW PROPOSED TASKS**. Nothing changes in the graph. Check each title and the capacity estimate.
4. Click **ADD PROPOSED TASKS TO GRAPH**. Up to 12 total Company nodes are allowed. Each imported title becomes one independent, unapproved `REPO_WRITE` node, with a concrete manual artifact/test check, no evidence or reviews, and no deployment privileges.
5. Before any real work, review the proposed tasks and record explicit approval boundaries and independent evidence as usual. If a node should become an Anti-M contract, use the existing COMPANY-02 *proposal-only* handoff. No automated execution occurs.

## Refusals and limits

- Reject anything except mock-mode typed RepoRider receipts (both `ride.mode` and `boundary.mode` must say `mock`).
- Reject locally reported safety blockers, malformed/oversized JSON (max 256 KiB), missing or duplicate issue titles, suspicious secret-like strings in issue titles, unexpected issue fields, and non-GitHub-shaped mocked repository URLs.
- Reject graph capacity overflow atomically. Do not silently truncate, mutate existing nodes, inherit approvals or complete dependencies.
- A local RepoRider safety pass is never presented as an independently verified security result.
- The untrusted JSON is parsed in the user's browser and is **not uploaded** by this feature. Do not paste credentials, secrets or personal data into the planning console.
- Company Mode's in-memory state remains non-persistent unless the operator exports the Company JSON.
- The proposed `REPO_WRITE` nodes remain `ACTION_REVIEW_HELD` until a separate action review; this is still **not** permission to write.

## Excluded from this rung

- Direct GitHub issue scraping, authentication, remote polling, RepoRider MCP connection or courier inbox, replay verification, secret storage.
- Automatically creating/closing GitHub issues, writing source code, deploying, transferring approved file drafts, or turning mock Ride Complete into verified DONE.
- Any modification to RepoRider's repository.

Run from `apps/vessie-web`: `npm test && npm run build`. The Vessie React `vessie-web` CI job covers these tests.
