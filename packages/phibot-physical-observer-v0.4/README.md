# PhiBot Physical Observer Real-Browser Qualification v0.4

**Status:** EXPERIMENTAL / HEADLESS CHROMIUM QUALIFICATION / CANDIDATE ONLY  
**Canonical base:** `v2.0-alpha.11.0.54.12`  
**Generated candidate:** `v2.0-alpha.11.0.54.13`  
**Canonical promotion:** not performed  
**Real NBG producer pin:** `7b5cb309fcd2af409de6f8676cc074c395a666b4`

This rung tests the *whole generated standalone HTML candidate* using a real headless
Chromium browser, rather than testing only the injected module with a mocked DOM.

## Why a browser gate matters

The canonical artifact is a 13 MB standalone HTML runtime. A tiny mocked DOM
cannot reveal all of the surrounding page's CSS, script timing, module loading,
layout, focus, and DOM integration problems.

The browser test opens the actual built candidate from `file://`, interacts
with the Physical Observer panel, and captures desktop/mobile screenshots.

### Cases under test

- candidate loads and observer is hidden by default;
- operator opens the panel;
- a genuine pinned-NBG advisory packet renders read-only questions, evidence IDs and SHA-256 receipt;
- replay remains advisory;
- invalid JSON is refused;
- tool invocation payload injection is refused;
- authority escalation is refused;
- maintenance-promotion attempts are refused;
- modified-upstream-fingerprint packets are refused;
- a hostile HTML-looking signal renders only as literal text;
- clear removes the temporary view and import buffer;
- valid import works again after clear;
- panel can be closed;
- panel fits the 390-pixel mobile viewport;
- no observer-specific unhandled browser exceptions are detected.

The suite also reruns the v0.2 receiver and v0.3 generated candidate acceptance gates.

## Accessible Shadow DOM

v0.3 uses an **open Shadow DOM** for style isolation and testability.

This preserves CSS encapsulation while allowing browser automation and
accessibility tools to inspect the panel. Neither open nor closed Shadow DOM
constitutes a security boundary. All imported strings are still placed using
`textContent`, not HTML parsing.

## Test input origin

The browser fixture generator uses the **real pinned NestedBubbleGear producer**
to construct fresh, structurally valid physical-experience handoffs.

This checks end-to-end format compatibility without claiming that the synthetic
records represent real Raspberry Pi observations.

The unsafe cases mutate otherwise valid packets and must be refused.

## Artifact and qualification interpretation

The CI workflow emits:

- generated `.54.13` review candidate and SHA-256 manifest;
- real Chromium desktop screenshot;
- real Chromium mobile screenshot.

A green browser suite means **headless-browser behavior under tested conditions
passed**, not that a human visually approved the screenshots, live Netlify
behavior was validated, a source device was authenticated, or the Raspberry Pi
field boot qualification passed.

## Promotion is separate

This PR does **not** update `runtime/MANIFEST.json`, replace the shipped HTML,
alter the runtime release, or make the agent controller active.

Promotion should require:

1. core-integrity + browser qualification green;
2. operator review of the screenshots and actual candidate file;
3. a separate commit containing exact new canonical HTML bytes, manifest digest,
   release note, and intended deployment route;
4. unchanged independent tool/executor authorization.

```text
browser render != source authentication
similar history != causal proof
operator-visible question != tool grant
headless qualification != production approval
```
