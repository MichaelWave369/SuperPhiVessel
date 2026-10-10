# SPV-COMPANY-05: Repository Health Desk (public GitHub workflow snapshots)

**Status:** intentionally limited, operator-triggered read-only dashboard in the Super Φ.Vessel Company Mode React cockpit. Builds on COMPANY-04 public Issue Scout and COMPANY-02 proposal-only Anti-M handoff.

## Operator flow

1. Create/import a Company plan. Open **Repository Health Desk**.
2. Enter `owner/repo` for a **public** GitHub repository. The field starts at `MichaelWave369/reporider` as a convenient example, but there is **no automatic fetch**.
3. Click **FETCH WORKFLOW HEALTH (GET ONLY)**. The browser makes *two* unauthenticated GitHub GET requests:
   - Public repository metadata to determine its actual default branch.
   - First page of up to **20** GitHub Actions runs, filtered by that branch.
4. Group the sampled runs by workflow ID, keeping only the newest observed run of each workflow within that limited sample. Display its status, conclusion, created timestamp, and validated GitHub URL.
5. Only the latest sampled run for a given workflow that is **completed** with conclusion **failure** or **timed_out** can be selected for an investigation proposal. Previously failed runs that were superseded by a sampled success are **not** selectable.
6. Explicitly select failures and click **ADD SELECTED CI INVESTIGATIONS**. No nodes are added during fetch or preview.
7. Each selection creates a new **REPO_WRITE** planning node with `ACTION_REVIEW_HELD`, a source run URL in its proposed acceptance check, and no evidence or approval. Existing nodes are preserved. Capacity is bounded at 12.
8. If desired, use the preexisting **PROPOSE NEW ANTI-M CONTRACT** control for a *second, separate human review* of the node. Nothing is automatically marked done.

## Evidence and authority

- The run is a **public unauthenticated API snapshot**, not signed CI evidence and not proof of build correctness or deployment health. It can become stale immediately; no background refresh is enabled.
- GitHub's public APIs are subject to rate limits, CORS and availability. Private repositories do not work, and no credentials are supplied.
- Default-branch runs outside the first 20 records or workflows not represented in the first page are **not inspected**. A green sampled run is not a guarantee that all workflows or all branches are green.
- There is no credential use, private repo read, GitHub mutation, agent execution, spending, posting, remote scheduling or authorization transfer. Existing Anti-M proof requirements stay unchanged.
- URLs are context only. They are never imported as PASS evidence or a signed claim of success. A failed workflow creates a **proposal to investigate**, not a verified root cause or implicit instruction to fix code.
- Neither Company Mode's local review nor Anti-M's self-reported local closure grants actual deployment or repository-write permission.

## Refusal controls

- Hardcode the GitHub API host and endpoint shapes; reject URL/host substitution, path traversal, unsafe branch syntax, response redirects, oversized JSON (2 MiB max per response), mismatched source repository/branch/run URLs, duplicate runs and malformed status/conclusion.
- Reject forged positive permission/attestation flags in any preview used for task import, unknown run IDs, duplicate selections, non-failing results and overflow without partially modifying the plan.
- Issue Scout and RepoRider mock receipt intake remain separate and unchanged. This feature adds no GitHub server-side configuration.

## Verify

From `apps/vessie-web`: `npm test && npm run build`.

Manual checks: fetch one public repo, verify exact default branch and run links, select latest failed run (if any), confirm the resulting task remains ACTION_REVIEW_HELD with no evidence. In a repo with only successful runs, ensure no failures can be selected. Change input mid-fetch and confirm old responses are not displayed. Existing Company Mode ↔ Anti-M handoff must remain manual.
