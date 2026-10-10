# SPV-COMPANY-04: Public GitHub Issue Scout

**Status:** explicitly triggered, uncredentialed, read-only public issue discovery inside Vessie's Company Mode. This supplements the separate offline RepoRider mock receipt intake introduced in COMPANY-03.

## Supported source and workflow

- First create/import a Company Mode plan. Issue Scout starts with `MichaelWave369/reporider` prefilled but sends **no network request** until the operator clicks **FETCH OPEN ISSUES (GET ONLY)**.
- A strict `owner/repo` parser constructs the only allowed network target: `https://api.github.com/repos/{owner}/{repo}/issues?state=open&per_page=20&page=1`.
- The browser issues a credential-free GET, omits cookies, and never captures tokens. This works for **public** GitHub repositories only, subject to GitHub's API availability, CORS policy and unauthenticated rate limits.
- GitHub's issues API also returns pull requests, so these are filtered. It is a **first-page preview**, not an exhaustive inventory. The preview displays issue title, number and exact canonical GitHub issue link. Source body/comments, metadata, labels, identities, receipts and approvals are dropped.
- The operator must explicitly select one or more issues, then click **ADD SELECTED TASK PROPOSALS**. Selection defaults to zero.
- Every selected issue becomes a Company Mode graph node, with a task title, source issue URL embedded in its acceptance-check text, and `REPO_WRITE` action risk requiring separate review. The node has **no evidence, approved action, or agent permission**.
- Local IDs are generated without overwriting existing graph nodes. Duplicate source issue URLs and exceeding the 12-node graph capacity are rejected.

## Epistemic/authority boundaries

- The public read is not authenticated to the user's GitHub account. The metadata is current only at fetch time, not signed or independently attested.
- The issue URL is **context** for later human inspection, not a passing artifact, proof of closure or granted authority. Imported task state is `ACTION_REVIEW_HELD`.
- The API GET **never posts, patches, closes, creates, assigns, labels or comments on issues**, and cannot read private repositories.
- No background polling, scheduled agent runs, model invocation, OAuth, memory admission, wallet/payment action, or automatic RepoRider/Anti-M handoff is performed.
- RepoRider's mock ride export and actual GitHub issues remain separate source classes. A mock issue title is not treated as an actual GitHub issue.
- Local plan imports and previews are editable and unauthenticated. No trust promotion is inferred from either.
- The query refuses arbitrary URLs, protocol or host overrides, path traversal and hidden credentials.
- A response over 2 MiB, malformed JSON, unexpected list, invalid title, duplicate item, closed item, or off-repository issue URL fails closed. HTTP rate limits may surface as an error; no retries are automatic.
- The public data reader does not persist results to disk; Company Mode's JSON export remains the only deliberate persistence option.

## Manual smoke test

1. Load the Vessie React cockpit Company Mode with an existing plan.
2. Confirm no network request occurred from Issue Scout before the fetch click.
3. Fetch `MichaelWave369/reporider` and observe an open-issues preview with actual source links; PRs should never appear as issue tasks.
4. Select one issue. Confirm preview alone creates no graph node.
5. Click ADD SELECTED TASK PROPOSALS, confirm new node has source URL, `ACTION_REVIEW_HELD`, empty evidence and no approval.
6. Attempt to import the same issue a second time; it must refuse, not duplicate.
7. Try a fake URL or nonexistent repository; no arbitrary host contact or invented results.
8. Verify the existing Company → Anti-M proposal mechanism still requires explicit human steps.

CI: from `apps/vessie-web`, run `npm test && npm run build`.

**This is a read-only discovery rung, not a trusted project-management executor.**
