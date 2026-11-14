# Browsallax Explicit Browser Intent · R0

**Contract:** PV-BROWSER-INTENT-0.1
**Status:** Extracted adapter + synthetic tests. **Not wired into canonical Super Φ.Vessel / Netlify runtime.**
**Purpose:** Make explicit browser work enter Browsallax's existing governed page-task lane directly, rather than waiting for unrelated BrainC/text-provider completion.

## Existing connection

Browsallax Desktop already provides the exact-origin, owner-bound window.browsallaxOperator interface to the trusted https://superphivessel.netlify.app page when opened **inside Browsallax Desktop**.

The API contains manifest(), status(), startTask(spec), getTask(taskId), resumeTask(), and cancelTask(). startTask() creates a dedicated, governed browser task tab. Browsallax alone enforces browser authority, uses local Ollama inventory for approved planner hints, and applies the existing human grants.

This package does not create that bridge, add local networking, install models, grant permissions, or assume that ordinary Chrome, GitHub Pages, or the standalone hosted application has access to it.

## R0 adapter

Source: [browser-intent.mjs](browser-intent.mjs).

It exports:

- normalizeExplicitBrowserIntent(input): bounded, explicit HTTP(S) URL + goal validation. Rejects URL-embedded credentials and non-web schemes.
- dispatchExplicitBrowserIntent(input, { operator? }): checks the trusted page manifest then dispatches **one** startTask request. There are no provider calls, automatic retries, or fallback into normal Vessie completion.
- inspectExplicitBrowserTask(taskId, { operator? }): reads one already-owned task through getTask, returning a small status and selected redacted provenance fields.

Illustrative caller code for the future integrated trusted Vessie page:

~~~js
import { dispatchExplicitBrowserIntent, inspectExplicitBrowserTask } from './browser-intent.mjs';

const result = await dispatchExplicitBrowserIntent({
  url: 'https://www.nasa.gov/',
  goal: 'Find the main research topics on the public NASA homepage.',
  constraints: ['Read-only public research', 'Do not enter credentials'],
  maxSteps: 12
});
if (result.ok) {
  const status = await inspectExplicitBrowserTask(result.taskId);
  // Render status/HELD/errors in the Vessie UI, without silently retrying.
} else {
  // Show result.reason, e.g. BROWSALLAX_DESKTOP_BRIDGE_UNAVAILABLE.
}
~~~

The snippet is **not currently imported by the canonical hosted runtime**. It is an integration contract, not a claim of live production behavior.

## R0 handling

1. User explicitly requests browser work and identifies a public HTTP(S) target.
2. Vessie routes that request to this adapter **before** normal provider completion.
3. Adapter checks the Browsallax trusted-page manifest; no arbitrary tab or authority access is accepted.
4. Adapter invokes the trusted startTask(spec) at most once.
5. Browsallax creates the task and remains sole authority enforcer. The adapter returns the bounded task ID and observed state.
6. Vessie may inspect status with getTask, surface HELD and terminal failures, and ask the user to use existing Browsallax Desktop chrome for grants.
7. An ambiguous IPC response returns BROWSALLAX_TASK_OUTCOME_UNKNOWN_NO_RETRY. **Do not resubmit automatically**, since the first attempt might have created a task.

A missing Desktop bridge returns HELD with BROWSALLAX_DESKTOP_BRIDGE_UNAVAILABLE. It does not dispatch an unrelated hosted model in its place.

## Authority and privacy

- **CAPABILITY != AUTHORITY**. A valid intent or manifest does not grant browser mutation power.
- Only Browsallax native policy can permit action; page cannot grant itself authority.
- Registry planner hints are advisory; the local Browser Operator independently checks inventory.
- The adapter does not expose browser bearer tokens, page selectors, arbitrary tab IDs, filesystem paths, prompt content, or the model's raw response.
- Returned diagnostics are a small allowlist; evidence integrity remains Browsallax's responsibility.
- URL navigation still depends on Browsallax Desktop and its existing page/task policy.
- No third-party browser agent or paid API integration.

## Test and acceptance

~~~sh
node --check packages/browsallax-intent-v0.1/browser-intent.mjs
node --test packages/browsallax-intent-v0.1/browser-intent.test.mjs
~~~

The tests use an in-memory fake trusted bridge only. They check no-provider dispatch, strict manifest gating, unconfirmed outcomes, duplicate-retry avoidance, and bounded failure provenance. **They do not prove live Browsallax Desktop, Windows, or canonical runtime integration.**

## Next rung (NOT complete)

1. Inspect the canonical Vessie browser-intent router and identify where an explicit browser request currently awaits ordinary provider orchestration.
2. Import and call this adapter from the actual trusted Vessie runtime before the provider path. Preserve existing authority boundaries and negative-path UI.
3. Validate inside Browsallax Desktop on Windows with the live Vessie origin and installed Ollama model: direct browser intent, success, no local planner, HELD mutation, cancel, and sender-close cleanup.
4. Record bounded acceptance receipts and only then mark direct Vessie→Browsallax routing complete.

Do not silently mark R0 as a canonical fix or enable automatic cross-provider fallback.
