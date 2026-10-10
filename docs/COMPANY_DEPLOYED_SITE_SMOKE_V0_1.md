# SPV-COMPANY-12: Public GitHub Pages Browser Smoke v0.1

This rung tests Vessie's **deployed public Pages website**, not only the source-hosted Vite dev server tested by SPV-COMPANY-11.

## Two deliberately distinct gates

**PR / manual live smoke:** GitHub Actions launches headless Chromium against the current deployed live site:

- \`https://michaelwave369.github.io/SuperPhiVessel/vessie/\`
- Page returns HTTP 200, a Vessie title, functioning React root and actual hydrated cockpit.
- "COMPANY MODE" opens, no founder plan is fabricated, and both optional **Portable Completion History** and **Encrypted Local Workspace** panels appear without triggering a read or restore of IndexedDB.
- "ANTI-M / FINISH" opens in an empty, unfrozen state. Nothing is entered, uploaded, purchased, saved or executed on the live website.
- Deployed Vite JS and CSS bundle URLs exist under the expected nested GitHub Pages path and return HTTP 200 with nonempty bytes.
- No unexpected outbound third-party requests (existing Google Fonts static assets are expressly acknowledged), no HTTP mutating requests, and no uncaught page JavaScript errors.

This runs on PRs that affect the new smoke suite or Pages deployment workflow, but **does not verify that the PR has deployed**. The revision proof test is skipped in PR/manual mode, visibly and explicitly.

**After-successful-deployment live gate:** \`vessie-deployed-site-smoke\` also runs on completion of \`github-pages\`, *but only* if the upstream workflow reported \`success\`, originated as a push to the **main** branch in this repository, and its reported source repository is unchanged. Skipped jobs do not mean a successful deployment.

During the Pages workflow, the deployed React HTML is stamped with a \`spv-pages-build-sha\` meta tag and \`site/vessie/deploy-provenance.json\` is generated **after** the React build, before artifact publication. The document contains only the deployment workflow's commit SHA, run ID, repo/path and explicit non-attestation fields.

After the Pages deployment finishes, the live smoke gate polls the public \`deploy-provenance.json\` for up to 120 seconds. It must match **both the successful Pages workflow's source commit SHA and its unique run ID**, then checks the live HTML meta tag contains the expected SHA as well. This refuses passing on older CDN content or a different deployment. The live Chromium UI/asset tests also must succeed; **only that complete result** is revision-scoped deployed-site evidence.

The file's values are a GitHub Actions *reported build revision*, not cryptographic proof of hosting origin, of who wrote the code, or of work completed by Vessie.

## Workflow safety

- \`.github/workflows/vessie-deployed-site-smoke.yml\`: checkout runs with read-only contents access and no persisted GitHub credential, no environment secrets, and no deployment permission. The only browser interactions are read-only panel navigation and non-state-changing storage introspection in an isolated ephemeral CI Chromium profile.
- No real user data, accounts, passphrases or persistent browser profile are used. It never creates a Company plan, closes an Anti-M contract, decrypts a real vault, or imports a real archive.
- Browser screenshot/trace and JUnit artifacts are uploaded only on failures for diagnosis.
- The existing \`vessie-browser-acceptance\` workflow continues to test a synthetic, local server against full Company → Anti-M → encrypted restore, including tamper refusal. The production smoke is complementary rather than a replacement.
- Static Google Fonts requests are pre-existing external website traffic. That is explicitly disclosed; this is not an offline privacy audit.
- No self-reported "DONE" in user files is promoted, and successful smoke checks do not attest real external agent/model execution, physical device connectivity, independent customer acceptance, or a safe production workflow with private data.

## Development/test

Run manually from \`apps/vessie-web\`:

\`\`\`sh
npm install --no-audit --no-fund
npm install --no-save --no-package-lock @playwright/test@1.56.1
npx playwright install chromium
npx playwright test --config=playwright.deployed.config.mjs
\`\`\`

Without \`EXPECTED_DEPLOY_SHA\` and \`EXPECTED_PAGES_RUN_ID\`, the revision test is clearly skipped and only the **currently deployed main** is tested. The automatic post-deployment workflow supplies these values and requires the current public site to match.

**Operational caution:** GitHub Pages and CDN publishing are asynchronous. The bounded polling window tolerates short propagation delays; after its timeout it fails rather than pretending that stale content is current. If the public site is unavailable, restricted or blocked by CI egress, the smoke job fails and the release must be investigated, not marked complete.

**Ledger Above Ego. DONE Means Verified.**
