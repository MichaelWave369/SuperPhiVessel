# Vessie local inference · redacted performance receipt interpretation

The first operator-provided local inference receipt established that the
**opt-in, one-shot Ollama API path can return timing fields**. It did *not*
include a generated answer, host GPU telemetry, independently verified
hardware facts, or a performance average. Keep privately supplied real
receipts out of this public repository.

This guide explains the optional v0.1 receipt fields added after that
observation. The **receipt schema remains v0.1**, with optional added
fields so the old exported receipts remain readable.

## Observations that can be compared

| Receipt key | Meaning | Important caveat |
| --- | --- | --- |
| `elapsed_wall_ms` | Console-observed wall time around the model API call | Includes more than generation; unrelated to UI render time |
| `ollama_total_duration_ns` | Ollama-reported total duration | Not an independent timer or system benchmark |
| `ollama_load_duration_ns` | Ollama-reported load phase | Cold start depends on model residency, disk/CPU/VRAM, cache, configuration |
| `ollama_prompt_eval_duration_ns` | Ollama-reported prompt evaluation time | Older receipts do not include this key |
| `ollama_prompt_tokens` | Prompt token count reported by Ollama | Depends on model tokenizer/template |
| `ollama_generated_tokens` | Ollama-reported generation count | A maximum-token request is not a proof of completion |
| `ollama_eval_duration_ns` | Ollama-reported generation-evaluation time | Generation throughput derives from this, not wall time |
| `ollama_done_reason` | Strictly `stop`, `length` or `UNREPORTED_OR_UNKNOWN` | Can only identify reported stop reason; not proof that an answer is correct |
| `output_token_cap_reached` | Count was at least the requested maximum | May indicate truncated output, but is not proof |
| `generated_text_sha256` | Digest of the output text | A hash is not answer-content evaluation or independent signing |

### Safe derived readings

With numbers from the same receipt:

- Generation throughput (reported) = `generated_tokens / (eval_duration_ns / 1e9)`;
  only if both values are finite, non-negative, and duration is positive.
- Load share (reported) = `load_duration_ns / total_duration_ns`;
  only if both are reported and total duration is positive.
- Unattributed remainder = `total_duration_ns - load_duration_ns -
  eval_duration_ns - prompt_eval_duration_ns` when all are reported
  and the result is nonnegative. If prompt evaluation is missing,
  **do not label the remainder as prompt evaluation**.
- Wall time and Ollama total duration are related but different timers;
  don't subtract them to assert hardware or model behavior.

Model loading may dominate the first request. The current trial runner
uses `keep_alive:0`, which tells Ollama to unload model weights after
the response. **Do not call sequential trials a warm-cache benchmark**.
Future warm-run experiments must be separately proposed, approved
and bounded. Trials remain at most six attempted calls per process per hour,
one active call at a time, never automatic.

### Privacy and operator authority

Every trial still requires explicit opt-in at startup and an individual
browser confirmation. Receipt export is manual. Prompt and generated answer
are not serialized into exported receipt JSON.

- Timing values originate from Ollama, not an independent hardware
  monitor. They do not establish which GPU ran inference.
- A successful API response does not prove the output was truthful,
  coherent or suitable for autonomous routing.
- Never approve BrainC, Genius-roster, P4 learned routes, model
  installs, cloud calls, or paid APIs based on an isolated timing result.
- Preserve previous receipt compatibility. Absent new fields mean
  `UNKNOWN`, never zero time or an inferred completion status.

Read-only startup, local metadata recheck, localhost binding, 128-token
output limit, no-cloud eligibility, in-memory bearer, rate limiting and
no automatic retries remain unchanged.
