# SPV-COMPANY-11: Real Browser Acceptance for the Company → Anti-M Recovery Flow

This is an executable **Chromium Playwright acceptance suite** for the actual Vessie React controls, not just the offline Node unit tests.

## Tested end-to-end user journey

1. Open the React cockpit served from the project's nested GitHub Pages-style Vite base path `/SuperPhiVessel/vessie/`.
2. Create a Company Mode founder plan and one `REPO_WRITE` task.
3. Record an explicit human Mission Priority review. Verify its priority is visible but the Company task remains `ACTION_REVIEW_HELD`.
4. Propose that task to Anti-M; manually copy the draft, freeze a new contract, declare the action, record operator review, submit self-reported evidence, accept it, and close locally.
5. Download the full replayable Anti-M event ledger, return to Company Mode, and explicitly attach it through the Completion Dashboard. Verify `VERIFIED_DONE_LOCAL` does **not** change the Company's `ACTION_REVIEW_HELD` state.
6. Explicitly encrypt and save a Company workspace in the browser-local vault with a testing-only passphrase. Read the test browser's IndexedDB slot to confirm it contains an AES-GCM encrypted envelope, **not** the original Company name, journal text or passphrase.
7. Reload the page. Verify there is no automatic unlock or workspace restore, then check that the encrypted slot is present. Wrong-passphrase recovery must fail, preserving the empty workspace.
8. Unlock with the correct passphrase, preview the replayed archive without restoring, and explicitly restore it. Verify the Company plan, human priority review and Anti-M local journal recover, but no external DONE or action authority is granted.
9. Separate negative-control test changes a byte of stored ciphertext, reloads the app, and verifies correct-password decryption fails with no Company state mutation.
10. Assert no **unexpected external application/network endpoints** are reached during the acceptance journey. The existing Vessie CSS references Google's static font services (fonts.googleapis.com and fonts.gstatic.com), which are explicitly allowlisted, not mistaken for a new API call. The suite uses only synthetic operator-entered test data, never real plans, tokens or subscriptions.

## Execution

CI workflow: `.github/workflows/vessie-browser-acceptance.yml`. Runs on pull requests modifying `apps/vessie-web/**` or the acceptance workflow, and also on relevant main pushes. Chromium is installed with a pinned `@playwright/test@1.56.1` runner; temporary browser testing dependencies are not bundled into production app dependencies or static GitHub Pages assets.

To run locally from `apps/vessie-web`:

```sh
npm install --no-audit --no-fund
npm install --no-save --no-package-lock @playwright/test@1.56.1
npx playwright install chromium
npx playwright test --config=playwright.acceptance.config.mjs
```

On Windows/macOS/Linux, local browser installation may require OS-specific prerequisites. The test runner automatically launches and stops its own Vite dev server at `127.0.0.1:4173/SuperPhiVessel/vessie/`; it does not hit the public hosted site.

## Trust and scope

- **Network observation:** Google's externally hosted fonts remain a separate pre-existing outbound request and may disclose normal browser request metadata. This suite does not establish a strict no-network offline mode or a privacy audit of these font services.
- **Browser acceptance passing** means the selected operator-driven UI flow behaved correctly in a GitHub-hosted Chromium CI runner for that commit. It does not independently verify production Pages deployment, service-worker offline behavior, a customer's browser environment or real GitHub write/execution permissions.
- The acceptance tests deliberately record self-reported mock operator approvals and evidence; the strings are test fixtures, not real-world attestations.
- Tests cannot confer agent authority, validate source truth, or turn Anti-M `VERIFIED_DONE_LOCAL` into verified external work.
- CI screenshot, trace and JUnit metadata are retained for diagnosis. Browser traces are only uploaded **on failure**; the suite must not introduce real user secrets.
- A separate post-deployment browser smoke gate would be a future milestone. This PR only establishes reliable browser-level regression evidence for the real React UI in an isolated test environment.

**Ledger Above Ego. DONE Means Verified.** The browser test verifies product behavior, not the reality of any operator's external delivery.
