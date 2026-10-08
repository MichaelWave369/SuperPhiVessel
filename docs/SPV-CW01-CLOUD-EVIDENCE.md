# SPV-CW01 · FieldCloudWorker cockpit observation seam

**Status:** EXPERIMENTAL / OPERATOR-CLICK ONLY / BRAIN C UNWIRED

This rung adds a Cloud Evidence tab to the new React Vessie cockpit at the project's GitHub Pages site. The canonical standalone runtime and hosted Netlify BrainC are unchanged.

### Explicit read sequence

The operator clicks **Inspect Cloud Worker**. The browser makes four public unauthenticated GET requests to GitHub:
1. FieldCloudWorker `main` branch metadata, obtaining the snapshot commit.
2. The status receipt at that exact commit.
3. The history JSONL at that exact commit.
4. GitHub Actions metadata for the receipt's exact run ID.

Both file bodies get SHA-1 Git blob-id validation. The receipt parser enforces the frozen three-task allowlist, schema, exact output shapes, bounded sizes, error-code-only failures, linked latest history, GitHub workflow identity and time window. The UI projects only three task states, metadata and a link to the run, not raw task output.

A moving `main` revision is NOT a preexisting independent trusted pin. A correlating GitHub Actions run is NOT a signature on the actual measurement. There is no authenticated source or actor, no proof of task truth, and no action grant. Old green observations are labeled stale after eight hours. Unknown, inconsistent or unreachable evidence is refused instead of being presented as healthy.

### BrainC future seam

The optional **Export BrainC shadow candidate** button creates a sanitized local-only JSON document with `integration_status=UNWIRED_REVIEW_CANDIDATE`. The output includes only source run ID, timestamp, fixed task statuses, disposition and no-authority flags.

This is *not* sent to BrainC, not saved to Vessie memory, not used as a prompt and not used for live routing. No cloud worker dispatch or PhiOS executor method is invoked. An actual BrainC consumer would require a separate reviewed integration, input schema gate, operator opt-in, routing-policy proof, and no-authority model tests.

### Verification

`cd apps/vessie-web && npm test && npm run build`

The new test suite contains no network requests, uses synthetic GitHub API envelopes with correctly computed blob IDs, and tests corrupted blobs, unexpected task output, wrong repo/branch/commit, forged run conclusions, stale/future timestamps and unauthorized candidate creation.

The published cockpit is a public review-only shell; the older Netlify runtime is not touched by this change.
