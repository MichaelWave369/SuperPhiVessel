# SPV-COMPANY-17: ThinkTank Local Governed Council Contract Desk

A **separate local-only model-inference contract** built on top of the already verified Vessie ↔ ThinkTank #79 two-app handoff. Vessie prepares inert bytes; a person must inspect and approve them via **ThinkTank PR #35's terminal tool**. The browser neither sends nor runs the contract.

## Steps

1. Open **Vessie → COMPANY MODE → Φ Local Governed Council Contract**.
2. Write a non-sensitive directive, choose an *installed* Ollama model (exact model name), choose COUNCIL, TRIO or AUDIT, and set a 30–600 second deadline. The role-count field is determined by ThinkTank's current mode contracts: 5, 3 or 2.
3. Explicitly acknowledge that you chose the directive/model, local inference consumes resources, and the contract is not an authority grant.
4. Click **PREPARE EXACT LOCAL COUNCIL CONTRACT (NO RUN)**. The browser produces strict `phi-thinktank-local-council.v0.1` JSON bytes and shows their SHA-256. **No HTTP provider request is sent.**
5. Click **DOWNLOAD INERT COUNCIL CONTRACT JSON** and place the file where your ThinkTank terminal can access it.
6. In a **separately installed local ThinkTank #35**, start local Ollama and the provider bridge (`npm run bridge`), then `npm run council:build`. Review the exact downloaded file and run `npm run council:inspect -- /absolute/path/to/thinktank-local-council.json` to check the SHA and role/model selection.
7. Only **if you deliberately approve local compute**, use `npm run council:run -- /absolute/path/to/thinktank-local-council.json --approve-sha256=THE_EXACT_SHA --confirm-local-model-inference`. No browser panel can perform this command.
8. The terminal runner records canonical offline remote-seat events, executes the actual ThinkTank LIVE event kernel, produces a replayable local ledger, and exports a dossier if synthesis reaches a decision. That dossier can return through Vessie's existing one-way ThinkTank Decision Bridge. It will still require the operator to author/review any Company task; **Anti-M completion remains independent**.

## Safety and limits

- In this v0.1, the SHA-256 is an **exact-byte matching check for operator consent**, not a signature/authentication token. Anyone can compute it.
- No paid provider access; OpenAI and Kimi are disabled by canonical events in ThinkTank's CLI run. Running local Ollama still consumes actual device time, power, CPU/GPU and may take minutes.
- The contract's deadline is an abort request and is not a proof that inference ended instantaneously. The existing ThinkTank provider bridge controls its own generation-token cap, and this UI cannot independently inspect/enforce it.
- ThinkTank may return a `WITHHELD` decision because there is no independently supported claim/evidence graph. That is correct and should not be mislabeled failed model execution or completed external work.
- No background jobs, repo writes, automatic server-side model calls, browser run permissions, imported author identities, credential storage, unexpected external network requests, provider keys in frontend, browser service workers or JSON-driven commands.
- The original directive and the downloaded file remain private to this tab and local download until a person chooses to share them. Do not put secrets or personal information in them. The superficial token-pattern refusal is *not* a full secret scanner.
- This requires manual local deployment of ThinkTank #35, and at this stage **no cross-app end-to-end real Ollama run has been witnessed or verified**. Unit and Chromium tests use only mocked/synthetic inert contracts.
- ThinkTank's true provider bridge uses localhost port 3691. **Do not expose it publicly**. A future authenticated council API is a separate security milestone.

## Tests

`cd apps/vessie-web && npm test && npm run build`.

Chromium specifically confirms that an explicit reviewed contract downloads with the exact SHA shown, the manifest disables paid/browser/authority flags, no local model POST or bridge request happens, and changing a prepared task invalidates the earlier consent and digest. Node tests check shape and fail-closed flags.

**Ledger Above Ego. DONE Means Verified.**
