# Local answer-review lane · manual evidence without routing authority

The Windows local console already measures individual, operator-approved
Ollama generation trials and offers a redacted performance receipt. It
does not, by itself, establish whether the answer was useful or correct.

This optional review lane lets the **human who sees a newly completed
answer** record a short, categorical, self-reported evaluation. It does
not run another model, ask an AI judge, query cloud providers, access
private memory, or save the answer.

## Operator workflow

1. Start `Start-Local-Trial.cmd` and explicitly opt in with `ENABLE`.
2. Select a locally size-reported model and send a single approved
   short prompt, as before.
3. **After a response appears**, review what you actually read. The
   Human answer review panel becomes available only on a completed trial.
4. Choose usefulness (1–5 or not assessed), apparent completeness
   (complete, possibly cut off, unsure), and whether **you** separately
   checked any factual claims (not checked, found supporting evidence,
   found contradictory evidence).
5. Click **Record my assessment**. The operator-rated evidence is held
   only in the browser's current memory.
6. Click **Export redacted human review** only if you want a JSON
   document on your own PC. Export requires a separate click.

**The old standalone performance receipt does not contain the model's
answer.** Therefore it cannot be used to retroactively judge answer
accuracy or helpfulness. No score is inferred from speed, number of
tokens, a hash, or the presence of a success response.

## Format and privacy

Schema: `superphivessel.local-console.human-review.v0.1`.

The review JSON includes a reference to the original output by
`source_output_sha256`, the model label, review time, categorical
ratings and explicit no-authority fields.

It does NOT include the prompt, answer text, full original timing
receipt, user notes, URLs or provider credentials. Upstream unknown
fields are never copied to exports. These reviews are not uploaded by
Vessie. The user can still choose to share the exported JSON manually.

The labels are **operator self-reports**, not independent factual
verification or model qualification. Even selecting
`OPERATOR_CHECKED_SUPPORTED` records a human assertion, not the source,
a fact-check audit or a universal truthfulness score.

## Governance

- No decision from this review can authorize inference, cloud calls,
  agent actions, learned route weights, Genius admissions or BrainC
  model assignment.
- Human reviews are *separate* from measured performance receipts;
  do not combine ratings into automatic rankings or policies.
- `NOT_ASSESSED`, `UNSURE` and `NOT_CHECKED` are first-class
  choices. Never silently convert missing verification to approval.
- A new trial or inventory refresh clears the review's current
  association to avoid accidentally scoring a previous model's answer.
- The source answer stays in the current browser session. No prompt or
  answer storage is introduced.
- Do not publish the real operator's private receipts, answer text or
  device-specific identifiers into this public repository.

This is the first narrow input needed for later *advisory* comparisons
of speed and human-reviewed quality, not an automatic intelligence
or capability benchmark.
