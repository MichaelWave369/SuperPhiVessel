# SPV-COMPANY-06: Cross-Repository Mission Control v0.1

**Mode:** explicit, public-only, read-only portfolio snapshot in the Vessie React Company Mode cockpit. This is not a company executor or a trusted source of completed work.

## Founder workflow

1. Create or import a Company Mode plan, then find **Mission Control / Public Portfolio**.
2. The five editable public example repositories are SuperPhiVessel, reporider, OpenBlueprintStudio (OpenBlue), phioffice369 and EVIE under MichaelWave369. The examples are prefilled but **no request occurs until the operator clicks SCAN PORTFOLIO**.
3. Enter 1–5 distinct GitHub public `owner/repo` names, separated by newlines or commas. Only this host is allowed.
4. Clicking **SCAN PORTFOLIO (GET ONLY)** makes up to three credential-free GitHub GET requests per repository: first-page open issues, public repository metadata for the real default branch, and up to twenty recent workflow runs on that default branch. At most two repositories are scanned concurrently, with no background retry or polling.
5. Review each repository separately: open issues seen, distinct workflows represented in the sample, latest sampled failed/timed-out, in-progress, and successful workflows. **Unavailable** means the relevant API request failed, not that CI is green.
6. Review the candidate list, with failure-investigation candidates preceding open issues *within each repository*. This is a source grouping, **not a claimed business impact or severity ranking**. A stale failure superseded by a sampled success is not imported.
7. Select zero or more items, then explicitly click **ADD SELECTED TO COMPANY GRAPH**. Selection defaults to zero. Total graph capacity remains twelve nodes. Each imported issue or CI investigation becomes an independent `REPO_WRITE` planning node, with source URL in its check, no evidence, and no approval.
8. The existing Company → Anti-M handoff remains manual and proposal-only. Every contract starts with fresh evidence and separate authorization boundaries. Use explicit Company JSON export for session persistence.

## Trust and completeness

- Public GitHub APIs are unauthenticated and subject to availability, CORS and rate limits. Private repos are unsupported. All source claims are snapshots taken on a single operator click and may become stale.
- For each repo, issue and health fetches can fail **independently**; partial data is shown with `UNAVAILABLE` rather than treated as zero issues or clean CI. A whole-repo unavailable read is not proof of anything.
- Only the **first 20 open issue/PR entries** are requested (PR entries are excluded from issue candidates), and the **first 20 default-branch workflow runs** are examined. Neither set exhaustively represents the repo or all branches.
- A GitHub "success" conclusion is a reported CI status, **not** a guaranteed working deployment, manual browser validation, external attestation, or sign-off. A failure is merely a prompt for investigation, not a verified root cause.
- Imported data is never permission, company completion evidence, an authorized GitHub repair, or an independently attested Anti-M DONE state.
- The widget does **not** call private APIs, authenticate, store credentials, send PRs, open/close GitHub issues, deploy, start models, spend, email, or schedule agent actions. Source links are ordinary external browser links for human inspection.
- Imported source URLs remain context inside checks, not positive evidence. Company Mode's existing review and Anti-M's independent closure remain mandatory.

## Validation and security

- Reject arbitrary hosts/URLs, unrecognized repositories, duplicate repo inputs, forged permission flags, source mismatch, invalid issue/run shapes and unsafe titles.
- Bound scan at five repositories; importer at twelve distinct selected candidates; preserve existing Company graph on any failure. The existing source-specific import checks catch duplicate issue/run sources already represented in the graph.
- Browser fetches run without credentials and return untrusted text through strict issue/health parsers.
- The browser invalidates stale scan results if the repository input changes during a fetch. An explicit reload loses the session unless manually exported.
- There are no hidden background tasks or subscriptions.

## Verification

From `apps/vessie-web`, run:

```sh
npm test
npm run build
```

Manual smoke: start Company Mode, scan two public repos, verify independent issue and CI statuses; select one uncompleted item; check it enters `ACTION_REVIEW_HELD` and retains its source. Confirm no source data is added before the second button click. Simulate one failed GitHub endpoint and ensure only that source is marked unavailable. Confirm the existing Anti-M handoff remains proposal-only.
