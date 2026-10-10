# SPV-COMPANY-18: Browser Contract → ThinkTank Terminal → Dossier → Company Review

**Scope:** acceptance-only, cross-repository regression gate that exercises the exact contract and dossier boundary shipped in merged SuperPhiVessel #80 / ThinkTank #35. **No product-run button or remote model API is added.** The user still executes real inference manually in their own ThinkTank terminal.

## Exact sources and trust

- GitHub Actions checks out the current SuperPhiVessel branch and the immutable reviewed ThinkTank #35 merge SHA `c5f1d32d1def388b675b229d338b630598c53a14`.
- A real Chromium browser opens the Vessie **Local Governed Council Contract** panel on local Vite port 4173. The test writes a synthetic research question and exact `gemma3:12b` model, explicitly marks the human-review checkbox, chooses COUNCIL (5 roles) and downloads the JSON.
- Browser test records the displayed SHA-256 and verifies it against **actual downloaded bytes**. No local or paid provider calls occur in the browser. File and digest are stored inside CI's temporary `test-results/`, not a public release artifact.
- A separate Node test launches ThinkTank's **real compiled terminal CLI** in `inspect` mode and checks its SHA matches Vessie's displayed digest and model/role metadata. The wrong approval digest and a missing second confirmation flag are independently refused before any model call.
- A **synthetic localhost mock** is started on `127.0.0.1:3691` **only inside the CI test process**; it supports a fixed observational `/providers/status` and fixed `/providers/invoke` responses for the local model. No real Ollama is started, no external model service is called, and remote provider environment keys are blanked.
- The Node test then **intentionally calls** the terminal CLI's `run` command with the exact SHA and explicit confirmation flags. This simulates the *user consenting to the exact file* in a safe synthetic test fixture. This is never triggered by Vessie or a production browser.
- ThinkTank's normal LIVE runner and event kernel emit the real five canonical role turns and Challenger event, produce replay verification and a `WITHHELD` decision dossier from the synthetic provider text. The exported dossier is then read by Vessie's **real #77 ThinkTank dossier importer**, which recomputes its FNV basis fingerprint.
- **Critical provenance nuance:** ThinkTank marks source `live-provider` because the mocked replies traveled through the *actual LIVE runner/provider event type*. This does **not** mean genuine Ollama or a real external provider was used. This CI run is **SYNTHETIC_TEST_BROWSER + SYNTHETIC_MOCK_ADAPTER**, not live inference or external attestation.
- Finally, the test asserts the importer cannot automatically create a task, and that a separately human-authored (synthetic test-operator) Company proposal starts `ACTION_REVIEW_HELD` with `actionReview:null`, `evidence:null`, no dependencies and no external DONE.

## What passing proves

It proves, for pinned source revisions, that **Vessie's actual downloaded bytes** agree with ThinkTank CLI's validator, SHA-consent gate and local model/role scheme; that the terminal program generates a replay-checked dossier on a known-good synthetic adapter; and that **Vessie's importer and Company action-review boundaries** accept that dossier without promoting it to authorized external work.

It does **NOT** prove that an installed user Ollama model is available, can execute those five turns at a reasonable speed, that the simulated model answers are accurate, that the original provider response came from an authenticated identity, that cloud API access works, or that any claim has independent evidence. The ThinkTank `WITHHELD` result is the expected conservative governance response.

The CI test intentionally invokes a mock-only terminal run. **It does not authorize a production task** or imply a web page can execute models. A real local run still requires the human to review the downloaded file, run `npm run council:inspect`, and separately run the terminal with the matching `--approve-sha256` and `--confirm-local-model-inference` flags.

## Running this regression

In a workspace containing `./think-tank` checked out at the fixed commit above, from SuperPhiVessel root:

```sh
cd think-tank
npm install --no-audit --no-fund
npm run council:build
cd ../apps/vessie-web
npm install --no-audit --no-fund
npm install --no-save --no-package-lock --no-audit --no-fund @playwright/test@1.56.1
npx playwright install chromium
npx playwright test --config=playwright.council-contract-crossrepo.config.mjs
node --test tests/council-contract-crossrepo.node.mjs
```

The standalone regression mock binds port 3691. **Do not run it while your actual local ThinkTank provider bridge is running**. This test refuses to proceed if another process already occupies that port. CI runs in an ephemeral isolated runner. No API tokens, GitHub write privileges, Docker containers, real GPU or user accounts are required.

The dedicated GitHub workflow is `.github/workflows/vessie-thinktank-council-contract-crossrepo.yml`. This acceptance suite is **excluded from the single-app Playwright configuration**; it requires a separately built pinned ThinkTank CLI and is not designed to run as part of regular Vessie unit tests. Existing two-app UI acceptance remains independent.

**Ledger Above Ego. DONE Means Verified.**
