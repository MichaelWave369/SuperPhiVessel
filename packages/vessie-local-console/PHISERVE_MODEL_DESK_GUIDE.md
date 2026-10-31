# Vessie Φ PhiServe Model Desk · local visual review v0.2

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

- Browser File API plus same-page WebCrypto only. No new network request, service endpoint, background sync, shared storage, model API token, or arbitrary file access.
- A SHA-256 match proves **local file consistency**, not that the model ran or that either file originated from an authentic PhiServe service. An adversary controlling both files could forge a matching pair.
- The browser's per-session review state is guarded so a caller cannot simply submit an arbitrary object claiming to be verified. This UI flow guard is not independent attestation.
- The model text is untrusted and only assigned to textContent. It cannot cause Vessie action, tool use, route approval, model promotion, agent memory admission, financial actions, or release.
- Receipt limit 16 KiB, response limit 100 KiB. Unknown receipt keys, partial/fake statuses, role/authority promotions, corrupted UTF-8 and mismatched hashes fail closed.
- Model Desk review is **separate** from existing Ollama trial receipts and the evidence bench. These two receipt schemas are not interchangeable.
- If privacy matters, clear the Model Desk after review. Selected files and in-memory model content are dropped. Export happens only on an intentional button press.
- The Physical Observer promotion/requalification draft PR #94 and its safety HOLD remain unrelated and untouched.

## Verification

Node 22 cross-platform CI runs 13 dedicated unit tests for honest SHA-256 matching, Unicode, edits to text, malicious receipt fields, empty/oversized files, redacted human self-reports, in-session review gates and absence of fetch/storage/eval from the view. The original PhiServe CLI security tests also rerun.

**Physical acceptance still pending:** start the real CLI with local licensed weights, generate private draft/receipt, import both in the localhost console, compare the displayed text, try an intentionally modified draft, and confirm it refuses the bad pair. CI uses fixtures and does not witness model execution or GPU acceleration.
