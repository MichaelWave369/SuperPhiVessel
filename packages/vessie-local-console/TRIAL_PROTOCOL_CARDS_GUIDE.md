# Vessie Local Console · repeatable protocol cards (manual)

The previous evidence rungs established Windows operator-observed Ollama
model discovery, one-shot explicit local inference, redacted performance
receipts, manual answer reviews and portable comparisons.

**Problem:** comparing two models against different prompts is not a
controlled comparison. The operator needs recognizable, versioned *public*
prompt cards without granting automatic execution or saving private prompts.

## What is implemented

The local trial panel now offers three **static public** protocol cards:

| Protocol ID | Lane | Output limit | Task |
| --- | --- | --- | --- |
| `governance-one-sentence-v1` | governance | 64 tokens | Explain discovery vs execution authorization in one sentence |
| `logic-steps-v1` | reasoning | 128 tokens | Same-color sock-drawer reasoning question |
| `code-bug-v1` | coding | 128 tokens | Explain the off-by-one JavaScript array bug |

These cards are **examples, not an independently validated benchmark**.
A model may answer incorrectly, exhaust its token budget, interpret
prompts differently, or use CPU offloading. Cards are not sufficient
evidence for autonomous routing or a model quality guarantee.

## Operator workflow

1. Start with the **default read-only launcher** for inventory and
   evidence review; no protocol can invoke inference there.
2. To deliberately experiment, close the console and launch the
   separate `Start-Local-Trial.cmd`, entering `ENABLE`.
3. After discovery, choose a public protocol and click
   **Load selected protocol into prompt**. Loading does not execute.
4. Select one eligible **LOCAL FILE** model. Read the public fixed
   prompt and its 64/128-token output limit. Check the per-prompt
   approval box, click run, and approve the separate browser dialog.
5. After the model responds, review its actual text before optionally
   recording your human assessment. The receipt includes the fixed
   `protocol_id` that the server verified against the exact current
   public prompt and output-token cap.
6. To compare another model, choose another eligible local model and
   **separately approve** another execution. There is no batch runner,
   unattended loop, auto-retry or background prompt scheduling.
7. Click **Keep current performance receipt** and optionally
   **Keep current human review** in the evidence bench; export a
   portable bundle if you want to reopen it in a later session.

A user-edited preset is not protocol-qualified. If the prompt or token
cap changes, running with a selected protocol is refused. Select
Custom to execute your own prompt under the original consent
requirements, in which case `protocol_id` is null.

## What the evidence ID does NOT certify

- The ID identifies which public prompt and token cap the localhost
  server verified in this individual request. It is **not** a
  cryptographic signature, an independent assertion that hardware
  executed weights locally, or evidence of model answer correctness.
- The original v0.1 redacted receipt schema is retained with optional
  `protocol_id` and a fixed scope marker. Historical freeform
  receipts import as `protocol_id:null` ("Unlabeled/custom").
- The evidence bench includes a **Protocol** column. Its portable
  bundles carry this label using strict allowlists. Old bundles
  missing the protocol key continue to import.
- No private prompt text is included in redacted receipts, portable
  bundles or human reviews. The public protocol text is already
  committed to the repository; by selecting a protocol, the operator
  accepts that its identity indirectly discloses the public test task.
- A matching protocol ID does not ensure equal system state or
  benchmark conditions. Load/cache state, prompt tokenization,
  runtime version, model quantization, concurrency, VRAM residency
  and elapsed time must still be assessed separately.
- No learned BrainC route, Genius assignment, autonomy, cloud
  invocation, model admission or API charge is granted.

## Fixed invariants

The exact localhost hostname, ephemeral bearer, same-origin checks,
read-only default, manual opt-in, one active trial, six attempted
trials per hour, max 128 output tokens, 90-second request timeout,
Ollama cloud-reference rejection and explicit operator per-prompt
confirmation remain unchanged. Pure protocol definitions make no
network calls.
