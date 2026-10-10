# SPV-COMPANY-02: Company Mode to Anti-M proposal handoff

This rung adds a proposal-only, in-browser transfer from a Company Mode function node to an empty Anti-M draft. It does not execute agents, validate real-world output, approve side effects, or attest evidence.

## Operator workflow

1. In the Vessie React cockpit, open COMPANY MODE and create or import a company graph.
2. On a specific node, click PROPOSE NEW ANTI-M CONTRACT. Proposed scope contains only the function as a title, expected output as a deliverable, and its observable check as one acceptance criterion.
3. The cockpit switches to ANTI-M / FINISH and displays unverified provenance, dependency IDs and consequential action category.
4. If no Anti-M contract is open, click COPY DRAFT INTO EMPTY CONTRACT FORM. This fills ordinary editable inputs only. The operator may inspect/edit and must separately click FREEZE CONTRACT.
5. The resulting Anti-M journal starts EVIDENCE_PENDING, with no actions, reviews or evidence. For a risky node, the action category and proposed description may be prefilled, but the operator must still declare the action after freezing and explicitly review it. Runtime authority remains zero.
6. Export JSON before refreshing. No storage service, autosave or background execution exists.

## Trust boundary

The handoff object has a strict exact-shape validator, bounded at 4 KiB:
- Source metadata: self-reported company/founder, node ID, dependency IDs and declared action risk.
- Fresh contract text only: title, deliverable, one criterion.
- Fixed provenance OPERATOR_ENTERED_UNATTESTED.
- All flags evidenceTransferred, approvalTransferred and executionAuthorityGranted are false.

It never transfers PASS/FAIL records, accepted reviews, earlier action reviews, budgets, permissions, completed states or receipts. Dependency IDs are contextual only, and do not become independently verified by Anti-M. No external proofs, CI results or URLs are fetched. A node check longer than Anti-M's 220-character maximum is refused, never silently truncated.

Switching between the Company Mode and Anti-M tabs now preserves both panels' in-memory state within the mounted page. An existing Anti-M contract blocks copying a proposal rather than being overwritten. Refreshing still clears unsaved state. Each panel has manual export/import paths.

## Boundary tests

- A formerly accepted Company Mode node becomes a proposal with zero transferred proof. Creating an Anti-M bundle from the draft must begin EVIDENCE_PENDING, with no actions or evidence.
- A risk category never becomes an execution grant.
- Unknown nodes, forged positive authority flags, extra fields and oversized criteria are rejected.
- Existing Anti-M closure and hash-chain rules are unchanged.

CI: cd apps/vessie-web && npm test && npm run build

This PR does not change canonical HTML, gateway, routing decisions, spending or deployments.
