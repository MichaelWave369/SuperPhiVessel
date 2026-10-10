# Company Mode v0.1: founder-owned planning graph (SPV-COMPANY-01)

Company Mode is a **separate, offline React planning surface** in the Vessie cockpit. It is **not** a multi-agent executor, not a company incorporation service, and not an authority delegation mechanism. No tools, models, deployments, email, remote APIs, accounts, or payments are invoked.

## Functional slice
- Create one mission with company name, founder, product, customer, weekly goal and a **display-only** dollar budget ceiling (not enforced at runtime).
- Add up to 12 function nodes, each with exactly one expected output, one observable check, optional dependencies on previously created nodes, and a declared consequential-action category.
- Strictly reject duplicate node IDs, unknown or forward references, cyclic dependencies, unrecognized action classes, unbounded payloads and improperly formatted evidence references.
- Derive ready, blocked, action-review-held, check-failed, evidence-review-required, rejected, and locally-accepted node states. Independent ready nodes are displayed together; none are run automatically.
- For a consequential-action node, require a named operator **review record**, which is not a permission grant.
- Record check evidence, method, URL or SHA-256 reference, and named ACCEPT/REJECT review. Evidence is operator-entered and not fetched or authenticated.
- Export/import a bounded JSON plan manually. There is no autosave, persistence service, background work, durable audit history, ledger hashing, or model routing.

## Safety, provenance, DONE
- **LOCAL_REVIEW_ACCEPTED** is only a user-entered check result plus an explicit local review. **Complete** means all nodes reach this local status. Neither is evidence of deployment, execution, third-party attestation, or genuine revenue.
- The document can be replaced or edited in any text editor. **No tamper resistance or cryptographic custody is provided.** Do not treat it as an Anti-M closure receipt.
- Review of a risky node is not authorization to deploy, spend, publish, contact customers, or access credentials. Any real execution requires a future independent adapter and per-action policy + grant.
- Do not bridge these self-reported records into Anti-M VERIFIED_DONE_LOCAL or independently verified DONE.
- Operators should export before leaving the tab. Do not paste secrets or credentials.

## Next bounded steps
1. Optional, explicitly user-triggered, read-only import of repository/CI evidence through a separately authorized adapter.
2. A governed **proposal-only** mapping of a Company Mode node to a new Anti-M completion contract, without merging trust classes.
3. Durable, tamper-evident event journal and recovery when separately designed, tested and approved.
4. Real execution only through established approval boundaries, never inferred from a UI review.

Run \`npm test && npm run build\` from \`apps/vessie-web\`.
