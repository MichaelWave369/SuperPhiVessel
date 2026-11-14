# Vessie React Browser Tasks · R1

**Status:** New manual UI integrated into the **modular** Vessie React cockpit, not the frozen canonical Netlify/standalone Vessie chat runtime. Live Windows Browsallax Desktop end-to-end acceptance remains pending.

## Launch

1. Run Browsallax Desktop on a machine with a supported local Ollama model.
2. Open the exact Vessie React cockpit document inside Browsallax Desktop: https://michaelwave369.github.io/SuperPhiVessel/vessie/
3. Click **BROWSER TASKS** in the cockpit navigation.
4. Click **CHECK CONNECTION**, then provide one public HTTP(S) URL and goal, explicitly check the human-request box, and click **START GOVERNED TASK**.
5. Use **REFRESH TASK STATUS** to inspect task state. If HELD for interaction, grant authorization in Browsallax Desktop chrome (not the Vessie page), then click **RESUME AFTER DESKTOP APPROVAL**. The user can click **CANCEL TASK** while a task is nonterminal.
6. If task creation/control has an uncertain outcome, the UI blocks duplicate submission until the operator manually checks Browsallax Desktop and acknowledges the warning.

Ordinary Chrome and most browsers will show the local bridge as unavailable. The cockpit never tries to call a public HTTP bridge API, read a bearer token, or open a local network port.

## Security

- Browsallax PR #48 grants exact-document trust only to /SuperPhiVessel/vessie/ and /SuperPhiVessel/vessie/index.html on michaelwave369.github.io. It does not trust every sibling repository under that shared origin.
- The browser-page bridge creates only dedicated task tabs and enforces caller ownership. No arbitrary existing browser tab access.
- Native Browsallax policy retains control over navigation, actions, and interactive grants. The web page cannot grant them.
- No automatic task start, background polling, fallback to hosted BrainC, or retries after unknown outcomes.
- Source evidence remains Browsallax's responsibility; the React cockpit reads only bounded status diagnostics.
- Read-only research is the declared task intent, **not an elevation or bypass of native Browsallax policy**.

## CI

- Existing Vessie React cockpit build/typecheck in core-integrity.
- Existing Playwright acceptance workflow runs browsallax-panel.spec.mjs with ordinary Chromium (bridge absent), a synthetic bridge, and an ambiguous-outcome negative control.
- The standalone Node adapter contract suite covers direct task dispatch and manual resume/cancel with forged or unavailable bridges.

**Not proven by these tests:** real Windows Desktop preload path, local Ollama planner reliability, live Vessie canonical chat routing, independent evidence correctness, or physical model execution. Those require a separate field acceptance.

## Remaining canonical integration

The old standalone Vessie Netlify runtime remains preserved. Its native chat/browser-intent provider orchestration still needs a separately scoped change that invokes the Browser Intent adapter before normal hosted provider completion. Do not mark that route live based on this React cockpit feature.
