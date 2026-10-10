# SPV-COMPANY-13: Public Release Evidence Desk v0.1

This is an operator-triggered, read-only cockpit view of observed **public deployment health**. It is **not** Anti-M closure, a signed provenance chain, a production safety certification, a deployment authority grant, or evidence of independent completion by a human or agent.

## Source checks

No requests occur on page load. When the operator clicks **CHECK LIVE RELEASE EVIDENCE (GET ONLY)**, Vessie performs three bounded unauthenticated public GETs:

1. `https://michaelwave369.github.io/SuperPhiVessel/vessie/deploy-provenance.json`, emitted during the latest GitHub Pages build. The exact schema, repository, commit SHA, workflow run ID, cockpit path and zero-authority flags must match.
2. `https://api.github.com/repos/MichaelWave369/SuperPhiVessel/actions/runs/{pagesRunId}`. This GitHub REST record must refer to the matching public repository, exact commit SHA, workflow name `github-pages`, main branch and push event. A non-successful conclusion cannot be green.
3. `https://api.github.com/repos/MichaelWave369/SuperPhiVessel/actions/workflows/vessie-deployed-site-smoke.yml/runs?per_page=20`. The desk checks the first 20 returned runs, rejects forgeries on matching records, and chooses the **newest matching commit** `workflow_run` begun no earlier than the Pages run's last updated time. A later failed smoke supersedes an older success. An unfinished, failed, absent or out-of-window result **never becomes green**.

Only if Pages and the newest qualifying smoke both report success does the view use `PUBLIC_RELEASE_OBSERVED`. The other possible outcomes are `PAGES_NOT_SUCCESS`, `NO_MATCHING_SMOKE_IN_SAMPLE`, and `SMOKE_NOT_SUCCESS`. Network and schema failures render a refusal instead of hiding an error behind a healthy status.

GitHub REST records and a live public Pages file are useful **observable sources**, not signed attestations. The API's public run-list response does **not independently prove the exact GitHub workflow parent linkage** from a smoke run to the Pages workflow. Matching SHA and creation-time conditions are a bounded heuristic. The more tightly scoped #75 post-deploy GitHub Actions smoke gate checks the exact Pages run ID; prefer its CI logs for release-gate evidence.

## Authority and evidence boundaries

- Snapshot provenance is `UNAUTHENTICATED_PUBLIC_PAGES_AND_GITHUB_GET`.
- `signatureVerified`, `independentlyAttestedExternalDone`, `approvalGranted`, `executionAuthorityGranted`, `evidenceTransferred`, and `exactWorkflowParentIndependentlyProven` remain permanently false.
- The operator may copy a **plain-text observation summary** with GitHub run links into their own notes. Copying doesn't attach Anti-M evidence, mark a task accepted, sign anything, run GitHub actions, initiate deployments, spend money or grant permission.
- No automatic polling, cookies, bearer tokens, storage, external URL input, OAuth, uploads, or background tasks. Requests are read-only GETs with a 1 MiB response bound, same fixed public endpoints and no credential attachment.
- The desk is available inside Company Mode even without a founder plan. An operator must click scan; results are a transient browser-memory snapshot and may be stale if GitHub status changes. The source list is limited to the 20 newest **smoke workflow** runs; when older results fall outside the sample the view must remain inconclusive.
- A public GitHub API outage, rate limit, HTTPS/CORS error or inaccessible Pages receipt means **status unavailable**, not healthy.
- This does not re-run the browser, test the deployment or independently inspect actual project functionality. A separate successful #75 workflow run does that in GitHub CI. The desk only reads public results.

## Testing

`cd apps/vessie-web && npm test && npm run build`

The `public-release-evidence.test.mjs` suite uses exact-shaped public GitHub fixtures for mismatched SHA, forged authority, unknown URL, stale/failed newer smoke runs, absent sample, in-progress smoke, transport errors and read-only credentials. The `e2e/public-release-evidence.spec.mjs` Playwright suite stubs the public GETs and asserts no automatic reads, manual scan, source links, and fail-closed errors in Chromium.

Tests do not contact or mutate a private operator workspace, create cloud accounts, deploy anything, or access credentials.

**Ledger Above Ego. DONE Means Verified.**
