# Vessie Local Evidence Bench · manual comparison, no model routing

This feature was designed after the first operator-observed successful
Windows Ollama model discovery and one-shot inference, followed by the
human-review lane. It adds a **descriptive, browser-memory-only** bench
for comparing redacted performance receipts and operator self-reports.

It does **not** make Vessie choose a model, calculate a composite score,
run a new prompt, retrain a model, learn weights, install software, or
grant authority. Speed and quality must remain distinct kinds of evidence.

## What can be compared

The bench accepts two JSON document types:

1. `superphivessel.local-console.trial.receipt.v0.1`: a **redacted
   performance receipt** exported by a previously approved local trial.
   Older v0.1 receipts without new timing fields also work. Missing
   fields are displayed as unreported, not zero.
2. `superphivessel.local-console.human-review.v0.1`: a **manual,
   redacted human answer review** exported after a completed trial.
   This is a subjective assertion by the reviewer, not independent
   verification.

A human review is paired to a performance row **only** if both the
model label and the generated-output SHA-256 digest match. The hash
anchors the *answer text*, not a particular hardware execution. If a
review is unpaired, its existence is counted, but it is not attached
to an unrelated result or silently treated as a passing grade.

## Using the Windows console

The evidence bench appears in the console in **both** default
read-only mode and the separately enabled local trial mode. It cannot
start Ollama generation itself.

- To keep the most recent trial metadata in the comparison, after a
  successful manually approved trial click **Keep current performance
  receipt**. This is an explicit in-memory capture.
- To keep the latest human rating, after recording it click
  **Keep current human review**. This is a separate action.
- To compare prior sessions or models, manually select the exported
  redacted JSON receipts using the file input, then click
  **Read selected local files**. Select individual performance and/or
  human-review receipts, not a previous comparison summary.
- Files are read by the browser from the files **you** selected; they
  are never POSTed to localhost or uploaded to cloud APIs. A single
  imported file must be <=16 KiB and the bench can hold at most 24
  distinct redacted observations. Invalid or over-capacity import
  operations are rejected as a batch.
- Click **Export redacted comparison** to intentionally save the
  descriptive summary as JSON on your PC. The summary never includes
  prompts, generated answer text or free-text review notes.
- Click **Clear this bench** to discard all comparison entries from
  this tab. Refreshing or closing the tab also clears the in-memory
  comparison. There is no localStorage, IndexedDB, server database or
  automatic recovery.

The old first-pass trial performance receipt is acceptable as
*performance-only* evidence. If its actual model answer wasn't kept,
the bench does **not** invent an answer-quality review.

## How to read a row

Rows are chronological, **not ranked**. Fields can include:

- Model label + observed time
- Total console-wall and Ollama-reported model load time
- Ollama-reported prompt evaluation and generation phase duration
- Output token count and reported generation tokens/second
- Human self-reported usefulness, apparent completeness and
  verification selection, if a matching human review exists

All imported documents are **operator-selected, unauthenticated JSON**,
not signed device attestations. The counts, dates, hash, and model names
could be wrong or forged. Matching two JSON documents does not prove
that their claims are true. No aggregate speed score or autonomous
accuracy metric is produced. CPU/GPU residency remains unobserved.

## Invariants

- No network/file IO in the pure comparison helper
- No browser save except deliberate JSON download
- No cloud inference, prompt execution or model invocation
- No automatic candidate ranking or route optimization
- No BrainC/Crane Fly/Genius model approval
- No private prompt or answer serialized by the bench
- No human-review claims upgraded to independently audited facts
- No actual operator's sensitive receipts committed to the repository

The existing 127.0.0.1-only server, read-only default launcher, optional
human-approved one-shot inference, rate limits, and canonical governance
contracts remain unchanged.
