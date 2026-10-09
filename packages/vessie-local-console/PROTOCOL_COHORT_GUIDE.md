# Vessie Local Evidence Bench · unranked protocol cohorts

PR #58 introduced three public fixed-prompt protocols with explicit
operator consent per local model trial. This view groups **already
collected**, redacted observations by protocol and model in the existing
Local Evidence Bench. It is available even in read-only mode.

## Why grouping matters

Comparing two arbitrary model answers or unrelated prompts does not
establish which model is more useful for a lane. The new Protocol Cohorts
table uses only the fixed protocol IDs already known to this version
of the local console, and requires the recorded output-token budget
to equal that protocol's defined limit. Each cohort is a
**protocol + model** combination.

The table presents observed receipt counts, the number of those
observations with a matching *operator self-reported* human review,
median console wall time, median Ollama-reported model load time,
median reported generation-only throughput, and missing-evidence flags.

Data is never sorted by quality or speed. The rows appear in public
protocol-definition order and model-name order, not a ranking.
Select an individual public protocol to view only its cohorts.

## Evidence gaps (descriptive, not decisions)

- **SINGLE_OBSERVATION**: only one redacted performance receipt exists.
  Two receipts are not automatically statistically independent.
- **MISSING_HUMAN_REVIEW**: at least one matching generated-output hash
  lacks an operator review. This is not evidence of poor performance.
- **NO_USEFULNESS_RATING**: none of the operator reviews supplies a
  rated usefulness value. "Not assessed" remains legitimate evidence.
- **MISSING_WALL_TIME**, **MISSING_GENERATION_RATE** or
  **MISSING_PROMPT_EVAL_TIME**: Ollama did not report all relevant
  timing fields, or those values were sanitized to missing.
- **OUTPUT_CAP_REACHED_ON_SOME_TRIALS**: at least one result reached the
  requested output-token limit; it might not have finished naturally.

These gaps are labels **for human inspection only**. The lack of a
listed gap does not certify a model. The cohort table does not infer
an answer's correctness, verified source facts, hardware placement,
VRAM fit, uncertainty, safety or operator authorization.

## Exclusions and compatibility

- Custom/unlabeled receipts remain in the main Evidence Bench table,
  not the grouped protocol cohorts. Old v0.1 redacted files and
  portable bundles continue to import normally.
- An apparent public protocol ID with an incompatible token cap is
  **excluded** from the cohort count and separately counted as
  inconsistent. Do not silently merge it into another group.
- A human review only matches performance by model name and output
  SHA-256, and remains a subjective **operator self-report**. Even a
  claim that the operator checked facts is not independent fact-check
  evidence.
- Re-importing identical evidence is idempotent. A different metric
  under the same evidence identity conflicts and is refused.
- Missing durations remain **not reported**, never zero. Medians are
  computed only over durations/rates that were actually reported.
- All source files are **unauthenticated**, operator-selected JSON.
  Recognized IDs, timestamps, hashes and matched receipts are not
  cryptographic proof of genuine execution or fair comparisons.
- Existing imported evidence is limited to **24 entries** in browser
  memory. The existing portable redacted export is unchanged.

## Operator path

In either read-only console or trial-enabled console, use the Local
Evidence Bench to manually import an old portable bundle or keep
the current redacted receipt after each independently approved trial.
The Protocol Cohorts view updates automatically **from existing
in-memory evidence only**. Filtering or opening it sends no model
request and authorizes no software, agents, cloud models or routing.

For any new test, the existing separate `Start-Local-Trial.cmd`
startup `ENABLE` and per-prompt approval are mandatory. No model
tournaments, automated retries, warm-cache benchmarking, Genius
admission or BrainC/Crane Fly route approvals are performed.

The pure cohort analysis is in `ui/protocol-cohorts.mjs`. It performs
no I/O, no automatic quality scoring and no route promotion.
