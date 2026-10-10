# SPV-COMPANY-16: Real Two-App ThinkTank Handoff Acceptance v0.1

Two previously independently merged features now meet in **actual running React apps**, tested by Chromium in one isolated CI job. This is not an implementation of an authenticated council-session API. It proves the intended user-directed handoff and return path without executing a live provider.

## Immutable sources under test

- Super Φ.Vessel source: current PR / main commit checked out by CI
- Φ ThinkTank: immutable commit `c2cdb112eeac0cb4b07b5b128299cabce9f8bfe6`, the reviewed/merged ThinkTank #34 handoff
- Vessie Vite: `127.0.0.1:4173/SuperPhiVessel/vessie/`
- ThinkTank Vite: `127.0.0.1:5173/`
- **No** provider bridge started at port 3691, no API keys, Ollama, OpenAI, Kimi, tokens or real external work

The pinned ThinkTank source is an explicit test dependency; periodically update it through a reviewed PR after ThinkTank advances, rather than fetching uncontrolled HEAD at runtime.

## Actual browser test

1. Open real Vessie Company Mode. Prepare a human-reviewed, non-sensitive directive, yielding a bounded `#spv-draft=` localhost link. Assert no model requests.
2. Click the actual link, opening real ThinkTank. Verify text appears only in a **review-only incoming preview**, not the operator field. Verify the fragment was stripped from the address bar and zero canonical session events exist.
3. Click **USE REVIEWED DRAFT IN OPERATOR INPUT (NO RUN)**. Verify the exact directive appears in the operator textarea; no model calls or session event yet.
4. The operator explicitly clicks **RUN SIMULATION**. ThinkTank's own real event kernel and playback produce a canonical decision dossier. The test does **not** simulate a raw `POST /providers/invoke` response.
5. Download the real ThinkTank **TEAR / EXPORT DOSSIER** JSON from the UI and assert `executionSource:'simulation-fixture'`, original directive preserved, and the deterministic basis fingerprint present.
6. Return to real Vessie, deliberately create a synthetic Company plan, paste that *same downloaded dossier* into the existing Decision Bridge, and inspect it. Verify SIM provenance and no imported task.
7. Manually type a new consequential Company task and check the founder-review acknowledgement. Assert the new `REPO_WRITE` node remains `ACTION_REVIEW_HELD`; export Company JSON and prove `actionReview:null`, `evidence:null` and no inherited dependencies.
8. Separate negative-control browser test sends an altered fragment claiming `runRequested:true`. Real ThinkTank must refuse it, clear the URL fragment, leave its prompt empty, and mint no ledger events or dossier.

## Security and scope

- HTTP **POST requests are forbidden** in the acceptance tests; the ThinkTank provider endpoint is additionally blocked at browser routing level. A browser test cannot prove that model billing or real provider behavior works; that is explicitly out of scope.
- These are **two actual development builds in the same ephemeral CI runner**, not a production Vessie + ThinkTank deployment audit or a two-machine connection.
- Only synthetic data and deterministic ThinkTank simulation fixtures are used. The ThinkTank simulated Reality Gate score is **not** live-provider evidence.
- The fact a ThinkTank dossier can be imported does not verify third-party provenance seals, the factual truth of claims, independence of model reasoning, or source integrity against a maliciously recomputed FNV checksum.
- The accepted Company proposal is human typed and self-acknowledged only. It does not confer execution rights, use secrets, authorize GitHub writes or create an Anti-M completion receipt.
- This rung is complementary to the existing Vessie #75 deployed-revision browser gate and Vessie #77 ThinkTank import tests.

## Reproduce

Run from a SuperPhiVessel workspace containing the pinned ThinkTank repository checked out at `./think-tank`:

```sh
cd apps/vessie-web
npm install --no-audit --no-fund
npm install --no-save --no-package-lock @playwright/test@1.56.1
cd ../../think-tank
npm install --no-audit --no-fund
cd ../apps/vessie-web
npx playwright install chromium
npx playwright test --config=playwright.two-app.config.mjs
```

Do not run ThinkTank's provider bridge for this test. Playwright launches and stops both Vite dev servers on 4173 and 5173.

**Ledger Above Ego. DONE Means Verified.**
