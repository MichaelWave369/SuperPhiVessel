# Vessie Routing Rebase v1 · 2026-10-08

**Status:** REVIEW CANDIDATE · NO LIVE ROUTER REPLACEMENT
**Canonical runtime:** read `runtime/MANIFEST.json` at deploy time; current .54.12
**Physical Observer .54.13:** browser-qualified review candidate, NOT promoted

## Why this rebase

The monolithic runtime now has Brain Registry/Crane Fly, BudgetCompute/BudgetGenius, extracted PV-DLAM P1-P4, Sparse Frontier, GA108, Porch, and a review-only Physical Observer. Do not create a second set of competing route decisions in the React UI.

## One governed route, several advisory contributors

```text
Human / Vessie intent
    -> current authorization, purpose, memory disclosure scope
    -> deterministic tasks resolved in ordinary code
    -> P1-C model qualification / local discovery / approved pool / VRAM and tokenizer
    -> BrainC/Crane Fly static eligible model route
    -> optional SFR need-for-deeper-reasoning review
    -> optional BudgetGenius narrowly authorized route influence
    -> downstream Executor Authorization (unchanged)
    -> model or tool call
    -> independent quality/evidence verification
    -> exact receipts, P3 observatory and eventual qualified P4 learning
```

These are stages within ONE routing decision. They are not independent authorities allowed to race and choose a privileged executor.

## Local-first tiers

1. `CODE` : deterministic parsing, hashing, indexing, eligibility, ACL and receipts. No model.
2. `TINY_LOCAL` : Granite 4.2 3B candidate for classification, bounded transformation and tool schemas.
3. `GENERAL_LOCAL` : Granite 4.2 8B or current actually installed equivalent with enough tested VRAM headroom.
4. `LOCAL_SPECIALIST` : Gemma 4 compact vision, code specialist, or a measured GPU/CPU-offloaded large model.
5. `FREE_REMOTE_ADVISORY` : approved free-quota providers only if task scope and data handling permit remote disclosure.
6. `PAID_REMOTE` : OFF unless an explicit existing BudgetPass plus operator authority permits paid use.

Local candidate descriptions are published in `protocols/routing-v2/model-candidates.json`. They are **not** claims about currently installed or running models.

## Admission before score

- Operator scope/purpose and disclosure authorization are current.
- No pending tombstone or restricted memory enters a remote packet.
- Request includes required task capabilities, tokenizer, context, locality and VRAM budget.
- Actual model artifact digest/version, adapter/template, locality, and qualification are recorded.
- Model must appear in approved pool and pass P1-C hard eligibility.
- Do not use model publicity, name, cost, or a P4 score to waive hard exclusion.
- If local evidence is sufficient, SFR must not call frontier by default.
- SFR hard safety triggers are not softened by an ML score.
- A remote provider may be chosen only under explicit recipient/purpose-specific disclosure permission.
- No unexpected paid fallback; provider 429, quota exhausted and unknown pricing fail closed or route to a separately eligible zero-cost option.
- BudgetGenius may influence only the already implemented, exact one-shot local canary when fully authorized.
- Final Executor Authorization is still mandatory.

## Sparse Genius roles

GA108 identities are stable (`profileId`, `memoryNamespace`), not model deployments.
Only shortlist up to eight; default to one specialist, council up to four under a separate operator-approved budget.
Never initialize 108 models, one model per Genius, or load all 108 memory scopes into one context.

## Model discovery and verification

Next gateway must query actual local Ollama `/api/tags` and `/api/ps` through a local authenticated service, not from this public site.
Record measured VRAM use, first-token latency, throughput, tool/schema accuracy, context budget, actual quantization, idle residency and ability to swap/recover.
Use Challenger Bench and real task-class held-out receipts, not provider claims, to promote model artifacts.
Persist observed failures, including fallback and user correction, without promoting them to facts.

## Source and release collisions to protect

- Canonical `.54.12` includes BudgetGenius outcome capture with `AWAITING_VERIFICATION`; changing a route cannot skip this evidence step.
- `.54.13` Physical Observer candidate is `HOLD_FOR_EXPLICIT_OPERATOR_REVIEW`; never ship it through the React transition by assumption.
- PV-DLAM P4-A learned snapshot is structural/shadow-only and does not replace P1-C static selection.
- Netlify-hosted BrainC is an existing deployed capability, not a blank check for external memory or tool access.
- Every identity, memory and receipt must outlive any particular GUI or model.

## Completion ladder

**R1** Repo inventory, single route map and public candidate catalog; React read-only cockpit under existing Pages `/vessie/`.
**R2** Authenticated, TLS-capable local/hosted gateway contract; device pairing; secrets stored only server-side; actual dynamic Ollama discovery.
**R3** Read-only status + model health + routing trace receipt display from verified gateway, while legacy executor stays authoritative.
**R4** Real task execution with exact bounded context, server-issued leases, explicit disclosure grants and existing Executor Authorization; shadow comparison against legacy.
**R5** Independent qualification, operator canary, rollback and modular runtime migration.

**Never** cut directly from static GitHub Pages to arbitrary local model/remote API execution. The browser is an operator view, not an authority boundary.
