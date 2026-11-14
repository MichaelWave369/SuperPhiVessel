# Sovereignty R7 · One-shot integrity and unknown-outcome recovery

**Purpose:** strengthen the EXISTING local-only Ollama and PhiServe one-shot GUIs. This rung does not add an inference backend, automatic provider selection, hidden retries, model training, memory import, portable restore, canonical runtime routing, tool permissions, or independent GPU attestation.

## R7 behavior

- **Ollama response integrity:** the localhost server already hashes completed generated text. R7 introduces a separate browser-side WebCrypto SHA-256 verification of the exact UTF-8 text and a strict fail-closed result/receipt schema before text is admitted into the display and manual evidence bench. The reported model, output cap, loopback route and all absence-of-authority flags must match. A hash match proves local consistency only, not that Ollama really executed or that the answer is true.
- **PhiServe:** continues to use its existing independent SHA-256 receipt/draft verifier. Adds a separate native one-shot confirmation, parallel to Ollama's existing confirmation, after checking the explicit per-prompt checkbox.
- **Unknown execution outcome:** if a submitted request fails, times out or returns a contract-invalid result, the browser cannot know whether the local backend may have already run. The corresponding Run button is disabled, the outcome is described as **UNKNOWN**, and the user must explicitly acknowledge before beginning a new attempt.
- **Reset discipline:** Ollama acknowledgement clears model choice, prompt, previous inventory and approval, resets derived evidence and requires a fresh scan. PhiServe acknowledgement clears model alias, prompt, approval and reviewed draft and requires a new discovery. Neither acknowledgement submits a new request. Both local modes continue to be mutually exclusive at process startup.
- **Handoff interaction:** R6 prompt staging cannot overwrite the PhiServe editor while its Run button is locked by unknown-outcome recovery. Ollama staging was already blocked by its disabled Run button.
- **Fail-closed cryptography:** when WebCrypto is missing, corrupted, or the SHA-256 does not match, no Ollama text or receipt is accepted. The request may have executed, so the ambiguous-outcome gate still applies.

## Evidence-based limits

A browser/network error after `fetch` is attempted does not prove whether the request reached the backend. A server error may have occurred before or after the local model started. R7 deliberately **overestimates uncertainty**: even a 403 or malformed result after a submitted attempt is treated as unknown in the UI, rather than inventing proof of zero execution. It does not attempt to cancel a running backend task, clear backend logs, guarantee no model resource use, or undo a provider's effects.

No prompt or generated text is put in the new outcome status. The existing user-selected redacted receipt export remains a separate action. SHA-256 is not an authenticity or source attestation.

## Acceptance tests

```bash
node --check packages/vessie-local-console/ui/local-outcome.mjs
node --check packages/vessie-local-console/ui/app.js
node --check packages/vessie-local-console/ui/model-desk-ui.mjs
node --test packages/vessie-local-console/tests/local-outcome.test.mjs packages/vessie-local-console/tests/provider-independence.test.mjs packages/vessie-local-console/tests/server.test.mjs packages/vessie-local-console/tests/phi-gui-live.test.mjs
```

GitHub CI additionally checks Windows portable ZIP allowlists and independent archive verification. Synthetic tests cover matching Unicode, altered text, forged permissions, model/cap mismatches, missing crypto and UI unknown-outcome latches. The full core-integrity suite and existing PhiServe approval/security tests must remain green.

## Physical Windows gate still pending

On the user's PC: download the updated, verified ZIP; use a real installed local Ollama model with a bounded prompt, inspect the SHA-verified output; stop the local backend during an approved request and confirm **UNKNOWN** and the blocked Run button; acknowledge, rescan and choose anew. Separately start the PhiServe desk with locally licensed GGUF and private token file, approve one draft and induce an unavailable/timeout response, then confirm a blocked Run button until acknowledgement and rediscovery. Observe network traffic to verify no automatic fallback, and independently validate the received text/receipt.

CI simulations are not physical acceptance. Neither this rung nor its merger qualifies canonical hosted Vessie as running offline, proves real hardware inference, or changes Physical Observer HOLD.
