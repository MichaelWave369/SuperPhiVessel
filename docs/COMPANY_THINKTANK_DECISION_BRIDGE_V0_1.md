# SPV-COMPANY-14: Φ ThinkTank Decision Bridge v0.1

**One-way, explicit, human-authored.** Imports the actual ThinkTank **TEAR / EXPORT DOSSIER** JSON envelope into founder-owned Vessie Company Mode. Source: https://github.com/MichaelWave369/think-tank.

## Workflow

1. Use ThinkTank's governed local control room. LIVE requires an explicit operator directive and locally configured provider bridge; SIM is fixture data.
2. Export an existing decision via **TEAR / EXPORT DOSSIER**, not **EXPORT RELEASE PACKAGE**.
3. In Vessie **COMPANY MODE → Φ ThinkTank Decision Bridge**, pick/paste the full exported JSON, at most 2 MiB, then explicitly **INSPECT DECISION BASIS**.
4. Inspection reads the exact current ThinkTank export fields and recomputes its lexicographic-stable FNV-1a 32-bit decision-basis fingerprint. No source is fetched, no execution happens, and Company Mode stays unchanged.
5. Review the original prompt, mode, normal outcome, Reality Gate, Claim Policy, Argument Policy, contradictory bindings, claims, and evidence counts. SIM provenance and WITHHELD outcomes are explicitly flagged. Attached seals, timestamps, witnesses and publication receipts are listed as **present only, not cryptographically verified**.
6. Choose the operator question or an exported claim as context. **Write your own** Company node ID, task/function, expected output, observable check, and consequential action class. Explicitly affirm review in the checkbox.
7. Click **ADD HUMAN-REVIEWED PROPOSAL TO COMPANY**. This reuses the existing addCompanyNode function: actionReview = null; evidence = null; dependsOn = []; risk = chosen class. REPO_WRITE, DEPLOY, SPEND and other consequential tasks remain held for separate Company review. Anti-M has its own proposal-only handoff and does not inherit ThinkTank approvals.

ThinkTank decision dossiers are decision-basis documents, not ready-made work tickets. Their referenced claims must not be treated as factual truth or auto-completed execution. Manually enter a source pointer (such as DOS-0042) in your own task criteria when traceability is desired; v0.1 deliberately does not change the Company schema or persist the imported full ThinkTank JSON.

## Security and epistemic constraints

- ThinkTank's FNV fingerprint is **publicly recomputable**, not a signature. An attacker can rewrite a document and recompute FNV. This bridge detects non-matching basis text against the supplied fingerprint, but **cannot authenticate authorship, source retrieval, signature chains or original execution**. A signature in an imported attachment is unverified until separately cryptographically checked.
- The importer records source: live-provider, simulation-fixture or governed-system. A successful Reality Gate, human override or ThinkTank actionAllowed is historical to ThinkTank; none grants Company/Anti-M authority or certifies external DONE.
- The preview is ephemeral and does not claim to prove provider transcripts or correct reasoning; count summaries merely reflect the imported document.
- The human review checkbox represents operator self-report, not independently authenticated identity. The resulting Company node still requires fresh action review, observable checks and evidence. Nothing from imported dossier is copied into its evidence fields.
- Bounded 2 MiB JSON, exact package/basis key sets, length limits, and bounded evidence arrays reduce accidental format drift and resource abuse.
- No automatic scans, remote model calls, tokens, database writes, GitHub writes, cloud uploads, billing, or background processes. No collaboration permissions are inferred.

## Testing

From apps/vessie-web: npm test && npm run build.

Unit negative controls cover altered content, mismatched basis checksum, forged intake authority, wrong override scope, malformed file shape, over-limit payload, missing human review, unsupported risks and duplicate IDs. Playwright exercises the real import and manually written Company proposal with a **synthetic** valid ThinkTank export plus tamper refusal.

This is a review-proposal bridge, **not** a functioning live bidirectional ThinkTank ↔ Vessie execution connector. A later local bridge would require explicit consent, hard model/spend controls, authorization, audit, and cancellation.

**Ledger Above Ego. DONE Means Verified.**
