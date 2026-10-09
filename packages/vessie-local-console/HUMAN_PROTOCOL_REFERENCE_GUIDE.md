# Local Vessie · human-review reference cards

The local console already provides operator-consented, one-shot
inference, versioned public trial protocols, human usefulness reviews,
redacted evidence receipts, portable backups and descriptive protocol
cohorts. These do not establish whether an individual response is
correct.

This rung adds **public, versioned reviewer-only reference cards**
that make it easier to assess answers to the three frozen public tests.

## User flow

1. Start the updated Windows console in the separate trial-enabled
   mode, after entering `ENABLE`.
2. Scan inventory, select and load a public protocol, select an eligible
   local model, approve the checkbox and separately confirm that
   **single** prompt.
3. After Vessie displays a successful response, the existing Human
   Answer Review area shows **Fixed protocol · operator review reference**.
4. Click **Reveal operator answer reference**. Review the answer key,
   three interpretation checks and caveat. Nothing is scored or
   submitted by this button.
5. **You** decide usefulness (1–5/not assessed), apparent completeness
   and whether you checked the claims. The existing optional
   human-review export remains a redacted, subjective self-report.
   A new trial or model discovery resets the revealed reference.

No reference is offered for an old, custom/unlabeled, failed or
unverified trial. The guide is selected using the completed trial
receipt, **not the current protocol dropdown**, so changing the
dropdown after a trial cannot change which task's reference appears.

## Reference expectations

- `governance-one-sentence-v1`: discovery describes inventory or
  capability; permission must come from an explicit operator/governance
  decision. Merely finding a model cannot authorize execution.
- `logic-steps-v1`: answer **3 socks**. Taking two could yield one
  red and one blue. Three must include a same-color pair because
  there are only two colors.
- `code-bug-v1`: JavaScript `items[1]` means second element; the
  stated intention to return the first element requires `items[0]`.
  Handling empty arrays is optional.

Answers may phrase explanations differently. The checklist is a
**review aid**, not an exact-match scoring rubric or proof of
reasoning quality. A 64/128-token cap can truncate an otherwise
promising response.

## Important boundaries

- The answer reference is static PUBLIC repository content. It is
  not a held-out secret test set, cryptographic provenance, or
  independently audited benchmark.
- The model's generated text is never sent to the review guide
  module. No automatic grading, network call, memory write,
  scheduled action or model execution is performed.
- Revealing a reference changes no existing human rating or
  evidence JSON. Its checks are not silently exported.
- Existing performance, review and portable bundle schemas remain
  unchanged. The evidence bench remains descriptive and unranked.
- The optional reference is only offered for a receipt indicating the
  localhost server verified the public protocol ID. That indicator
  is not independent authentication, GPU verification or proof of
  a correct model answer.
- No BrainC/Genius model admission, routing promotion, autonomy,
  cloud invocation or additional billing capability is granted.
