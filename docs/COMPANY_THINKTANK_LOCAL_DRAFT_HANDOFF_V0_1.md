# SPV-COMPANY-15: Local ThinkTank Draft Launch

This is a companion to ThinkTank PR #34. The design intentionally **does not call a live model or bypass ThinkTank governance**. Vessie's current local ThinkTank connection is a human-authored, explicit, review-only handoff to the ThinkTank UI.

## Why not call the provider bridge directly?

The current ThinkTank loopback bridge (port 3691) exposes public `GET /health` and `GET /providers/status` plus `POST /providers/invoke` for a *single model-seat/role invocation*. It does not expose a governed council-session API. Direct Vessie calls to `/providers/invoke` would **not run the ThinkTank event kernel, Crane Fly planning, argument/claim governance, Reality Gate, decision dossier or its event ledger**. A standalone provider response cannot credibly stand in for a governed ThinkTank council.

## Human-controlled handoff

1. Run the ThinkTank provider bridge locally (`npm run bridge`, default `http://127.0.0.1:3691`) and its React Vite UI (`npm run dev -- --host 127.0.0.1 --port 5173`).
2. Open Vessie's **Company Mode > ThinkTank Local Draft Launch**. No local network requests happen on mount. Optionally click **CHECK LOCAL THINKTANK BRIDGE (GET ONLY)**. Its strict service/version response merely indicates a local bridge answered; it **does not prove models or the ThinkTank UI are ready**.
3. Type your *own* bounded non-sensitive directive (3–1200 characters). Optionally suggest COUNCIL/DEBATE/AUDIT/TRIO/BUILD. Mode selection is advisory only; it will not change ThinkTank automatically.
4. Acknowledge the fragment-privacy disclosure, then click **PREPARE LOCAL THINKTANK DRAFT (NO RUN)**. This is a deterministic local-only serialization; no network or GitHub operation runs. The link is `http://127.0.0.1:5173/#spv-draft=<base64url JSON>`, with exact schema and all authority flags false.
5. Explicitly click **OPEN DRAFT IN LOCAL THINKTANK**, opening a new local browser tab. The ThinkTank #34 companion feature strips the URL fragment from the address bar before parsing it, presents it as untrusted review-only text, and requires a separate click **USE REVIEWED DRAFT IN OPERATOR INPUT (NO RUN)**.
6. Only then can the operator choose actual ThinkTank mode, local model or paid providers, and explicitly run `RUN LIVE PROVIDERS` subject to its existing event kernel and governance.
7. If a Decision Dossier is produced, export it from ThinkTank, then return to Vessie's **ThinkTank Decision Bridge** (#77), import and inspect, and **write and approve a fresh Company task**. That is the safe return path, not automatic sync.

## Security and limitations

- The `#spv-draft` Base64URL encoding **is not encryption**. Fragment contents generally aren't sent to a web server by the browser, but browser history, clipboard, plugins, screenshots and local page scripts can expose it. **Never put secrets, passwords, tokens or sensitive customer/person details in drafts**. Vessie rejects a few known secret patterns as a defense-in-depth aid, not a comprehensive secret detector.
- Loopback `GET /health` may fail from a hosted HTTPS Vessie UI because `THINK_TANK_ORIGIN` was not set on the local ThinkTank provider bridge, because browser private-network policy/CORS blocks it, or because local software is not running. Failure is shown as **UNKNOWN/UNAVAILABLE**, not healthy. The manual fragment link can still be prepared and opened.
- The local Vite port is fixed to 5173 and local bridge to 3691 for this rung; no arbitrary remote destination input, remote tokens or forwarded API keys. Users with a custom local port can still copy/paste text manually in ThinkTank until configuration is supported.
- The ThinkTank-side inbox is only a browser review UI. No provider invocation, session creation, model routing, ledger event or budget spend is caused by receiving, inspecting or copying a draft into its input.
- A copy-to-input click is an operator action **only within the ThinkTank UI**. Every later governed ThinkTank RUN remains a separate operator action. It still cannot approve Anti-M closure, attach Vessie evidence, or confer Company execution rights.
- Preflight health responses may be unauthenticated and spoofed by another service on the local computer. They do not prove identity, trustworthy software, live session readiness or completion.
- Companion ThinkTank PR #34 must be merged/deployed on that local UI first for automatic preview. Until then, just copy the directive manually.
- No automatic background scan, cross-app write, model operation, sync, paid API use, external posting or cloud relay.

## Tests

`cd apps/vessie-web && npm test && npm run build`

The `thinktank-local-handoff.test.mjs` suite checks exact fixed-origin fragment creation, Unicode roundtrip, no query-string leakage, false authority fields, secret-pattern refusal and GET-only status probes. Playwright exercises explicit consent and local network mock inspection in a real Chromium browser. These tests are not actual paid provider calls.

**Ledger Above Ego. DONE Means Verified.**
