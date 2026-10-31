# Vessie Φ PhiServe Model Desk · operator-approved live inference v0.3

## New: generate one PhiServe draft from the local GUI

This rung adds a **separately enabled** GUI flow for local inference, while preserving the previous file-only review and read-only default. It is not an automatic agent, delegated tool executor, remote interface, trained Vessie checkpoint, or promotion gate.

1. On the SAME machine, install a trusted llama.cpp binary, register a separately licensed GGUF model in PhiServe, create a private bearer-token file with `phiserve auth create --output PRIVATE_PATH`, and start PhiServe with its authenticated local mode using `--api-key-file PRIVATE_PATH` and a trusted `--browser-origin`. Only a local Node console contacts `127.0.0.1:11435`; the browser never receives the PhiServe bearer token.
2. **Windows portable:** stop any prior Vessie console, double-click `Start-PhiServe-Desk.cmd`, type `ENABLE`, and provide the path to the local private token file when prompted. This starts the Node console at `127.0.0.1:8791` with `--enable-phiserve-desk`. The default `Start-Local-Vessie.cmd` stays read-only.
3. **Source checkout:** set only the private file PATH in `PHISERVE_TOKEN_FILE` (not the bearer token value), then run `node packages/vessie-local-console/server.mjs --enable-phiserve-desk`. Do not start the optional Ollama `--enable-local-trial` mode in the same process.
4. In the Model Desk click **Discover local PhiServe models**. Choose a registered alias, enter a short prompt, choose a 64/128/256 output token limit and check the **one-shot operator approval**. Only then click **Generate one approved draft**.
5. The Node server uses the same private-file authenticated, fixed-loopback adapter introduced in PR #93. It validates the completed text, model alias and SHA-256; the browser independently checks the returned text against a strictly projected redacted receipt using the existing Model Desk verifier. The draft is shown as literal untrusted text, and can receive a redacted manual review just like CLI-imported files. A fresh approval is required every time.

The server allows at most **six attempted PhiServe drafts per hour per process**, one in flight. It rejects missing/wrong browser Origin, invalid session bearer, unknown request fields, excessive prompt size, unregistered models, bad model responses and unavailable/409/503 backends. There is no automatic retry on Ollama or cloud, no new listener, no persistence, no Vessie tool action, and no canonical routing authority.

If the local model needs more than your hardware can supply, this is a failed **untrusted draft attempt**, not permission to move it to a cloud provider. The browser's localhost page is not a public GitHub Pages model backend. Private token-file ACLs on Windows remain an operator responsibility.

## Existing workflow: import previous CLI draft files

The manual receipt/text file review remains available **even when the GUI live inference mode is disabled**. It does not require a token or a running model.

## Historical v0.2 review instructions (still applicable)



**Purpose:** Review files produced by the existing operator-run PhiServe draft CLI inside Vessie's existing local console. This is not a new model endpoint, runtime agent, tool-execution path, authenticated provenance system or approval for canonical promotion.

## Operator workflow

1. On the same trusted computer, start an authenticated local PhiServe daemon with a registered, legally held GGUF and installed llama.cpp executable. Generate one CLI draft with an explicit local approval:

~~~powershell
$env:PHISERVE_TOKEN_FILE="$HOME\.phiserve\vessie-token.txt"
node packages/vessie-phiserve-draft-v0.1/cli.mjs draft --model YOUR_REGISTERED_GGUF_ALIAS --prompt-file review-input.txt --output-text review-output.txt --output-receipt review-receipt.json --tokens 256 --approve-local-inference
~~~

2. Start Vessie's existing local console with its normal launcher. It remains bound to localhost (127.0.0.1:8791), including in its default read-only mode.
3. In **Φ PhiServe Model Desk**, select the two local files yourself and press **Verify local SHA-256 and review**.
4. The browser reads only the selected bytes. It validates the v1 receipt schema, explicitly false permissions, UTF-8 text length and exact SHA-256 of the draft file. A match displays the draft as literal text, never HTML or executable commands.
5. Optionally record categorical usefulness, completeness and factual-review decisions. The export button produces a redacted, human self-reported JSON file containing only allowlisted hashes, model alias, time and assessments. Private model text, prompts, bearer secrets, source file paths and Vessie memory are excluded.

## Security and meaning

- Manual file imports still use File API and WebCrypto only. The separately enabled live-draft mode makes **two authenticated same-origin localhost console requests**: explicit model discovery GET and one per-approved-prompt POST. The browser does **not** connect directly to PhiServe or obtain the private PhiServe bearer token. No cloud request, model tool, background sync, shared storage or arbitrary file access.
- A SHA-256 match proves **local file consistency**, not that the model ran or that either file originated from an authentic PhiServe service. An adversary controlling both files could forge a matching pair.
- The browser's per-session review state is guarded so a caller cannot simply submit an arbitrary object claiming to be verified. This UI flow guard is not independent attestation.
- The model text is untrusted and only assigned to textContent. It cannot cause Vessie action, tool use, route approval, model promotion, agent memory admission, financial actions, or release.
- Receipt limit 16 KiB, response limit 100 KiB. Unknown receipt keys, partial/fake statuses, role/authority promotions, corrupted UTF-8 and mismatched hashes fail closed.
- Model Desk review is **separate** from existing Ollama trial receipts and the evidence bench. These two receipt schemas are not interchangeable.
- If privacy matters, clear the Model Desk after review. Selected files and in-memory model content are dropped. Export happens only on an intentional button press.
- The Physical Observer promotion/requalification draft PR #94 and its safety HOLD remain unrelated and untouched.

## Verification

Node 22 cross-platform CI runs the original 13 review tests plus focused same-origin/local-auth/rate-limit live transport tests, and the original adapter suite. The older suite runs 13 dedicated unit tests for honest SHA-256 matching, Unicode, edits to text, malicious receipt fields, empty/oversized files, redacted human self-reports, in-session review gates and absence of fetch/storage/eval from the view. The original PhiServe CLI security tests also rerun.

**Physical acceptance still pending:** run the GUI with a real registered PhiServe GGUF model on the operator's PC, validate normal response, 401, 409, 503, browser Origin enforcement, private-token-file ACLs, Windows portable launch, and no persistence. The CI simulates network execution. The older file-only acceptance remains: start the real CLI with local licensed weights, generate private draft/receipt, import both in the localhost console, compare the displayed text, try an intentionally modified draft, and confirm it refuses the bad pair. CI uses fixtures and does not witness model execution or GPU acceleration.
