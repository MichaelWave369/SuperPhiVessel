# SPV-COMPANY-07: Anti-M Mission Priority Queue v0.1

**Mode:** deterministic, local, founder-reviewed *advisory ordering* of existing Company Mode graph nodes. This is **not** a model-run planner, live task assignment engine, an authorization system, or proof that work is done.

## Workflow

1. Create or import a Company Mode plan with one or more tasks. Public GitHub Issue Scout, Repository Health Desk, RepoRider mock intake, and multi-repo Mission Control can still prepare tasks independently.
2. In **Anti-M / Mission Priority Queue**, select one existing node and explicitly enter your assessments for **impact** (HIGH/MEDIUM/LOW), **urgency** (NOW/SOON/LATER), **effort** (SMALL/MEDIUM/LARGE), and whether it blocks a release (boolean). A reviewer name and a short concrete rationale are required; this is self-reported and is not an authenticated identity.
3. Click **RECORD HUMAN TRIAGE**. An unreviewed task stays **unranked**; no fallback score is inferred from GitHub issue title, CI failure, repo popularity, apparent severity, or agent output.
4. Reviewed, still-active tasks are ordered using an explicit, deterministic weighting:

   `score = impact×4 + urgency×3 + effort×1 + (blocksRelease ? 5 : 0)`

   Category points are HIGH/NOW/SMALL=3, MEDIUM/SOON/MEDIUM=2, LOW/LATER/LARGE=1. Higher numbers sort first. Ties preserve Company node order. This formula is a transparent **operator preference heuristic**, not an externally validated business priority.
5. Every row shows the existing Company dependency/review state. A `DEPENDENCY_BLOCKED` node can still score highly (important blockage), but its **queue handoff button is disabled** until predecessor review is complete. Other unfinished reviewed nodes offer **PROPOSE TO ANTI-M (DRAFT ONLY)**.
6. This calls the existing COMPANY-02 *proposal-only* contract transfer; it never opens, freezes, fills, verifies, or closes an Anti-M contract without the existing separate operator clicks. No evidence, approvals, grants or statuses are transferred.
7. Existing `LOCAL_REVIEW_ACCEPTED` nodes are excluded from the **active** scored queue, but are only locally reviewed; this is **not** independently attested external success.
8. Export/import the **priority review set** as a separate, bounded JSON document. Company graph export does **not** embed priority assessments. A review set may only be imported for the exact same company identity and unchanged scope of each referenced node. Replacing or resetting the Company plan clears current triage; adding nodes retains existing triage.

## Trust contract

The priority review set carries explicit flags:

- `provenance = OPERATOR_ENTERED_UNATTESTED`
- `actionAuthorityGranted = false`
- `evidenceTransferred = false`
- `completionCertified = false`

Its schema is exact-shape-validated and bounded to 32 KiB, with at most 12 distinct reviewed nodes. Every assessment must name a node that exists in the Company graph, with a matching immutable copy of its ID/function/output/check/dependencies/risk and company name/founder/product/customer. Forged positive authority flags, oversized input, unknown or changed node scope, duplicated review entries, invalid category values, empty rationale or missing reviewer are refused without changing the current queue.

The queue does **not** edit Company node dependencies, status, evidence, action reviews, or risk categories. It never grants permission to write to GitHub, run agents, deploy, spend, use credentials, or publish. It does not fetch or independently verify any source.

## Limitations

- Scoring weights are only a v0.1 decision aid. They are not calibrated against actual market, customer, security, or operational impact.
- Priorities are editable self-reported judgments and may be wrong, stale, or contradictory. An assessment marked “release blocker” is not independently verified as a blocker.
- A high-scoring task can be held for human approval and still require independent review.
- No persistence except explicit priority JSON export/import, no backend queue, no automated reminders, no scheduled execution, no webhooks, and no agent self-prioritization.
- Existing Company Mode and Anti-M finalization trust rules remain unchanged.

## Checks

From `apps/vessie-web`: `npm test && npm run build`.

Browser smoke: create a Company graph with one dependency, review both priorities, confirm one can rank higher while remaining `DEPENDENCY_BLOCKED`; record a predecessor's local acceptance and confirm the handoff control becomes enabled. Import an old assessment against a changed node and confirm it refuses. Export both the Company plan and priority review set before reloading.
