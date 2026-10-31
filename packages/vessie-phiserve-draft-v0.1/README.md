# Vessie ↔ PhiServe: operator-only draft adapter v0.1

**Status: independent operator-run CLI; NOT integrated into the canonical Vessie runtime, browser frontend, model router, executor, or gateway.**

The adapter makes an actual optional local PhiServe inference request, but generated text is an untrusted human-review draft. Nothing becomes executor authorization, canonical routing evidence, a learned model, or an agent vote.

## Operator setup

On the same trusted computer, run a locally installed PhiServe with a registered legally held GGUF and trusted llama.cpp server. Create a private token and start the daemon:

~~~powershell
phiserve models list
phiserve auth create --output "$HOME\.phiserve\vessie-token.txt"
phiserve daemon --llama-server "C:\path\to\llama-server.exe" --browser-origin "https://michaelwave369.github.io" --api-key-file "$HOME\.phiserve\vessie-token.txt"
~~~

The Node client does not send a browser Origin; PhiServe still requires the bearer token. It connects only to the fixed address http://127.0.0.1:11435.

In a private local SuperPhiVessel checkout:

~~~powershell
$env:PHISERVE_TOKEN_FILE = "$HOME\.phiserve\vessie-token.txt"
node packages/vessie-phiserve-draft-v0.1/cli.mjs models
~~~

Create a small, non-sensitive UTF-8 prompt file yourself, for example review-input.txt, and explicitly request a single draft:

~~~powershell
node packages/vessie-phiserve-draft-v0.1/cli.mjs draft --model YOUR_GGUF_ALIAS --prompt-file review-input.txt --output-text review-output.txt --output-receipt review-receipt.json --tokens 256 --approve-local-inference
~~~

Output files are exclusive-create, not overwrite. On POSIX they receive owner-only permissions. Protect files using NTFS ACLs on Windows. The receipt omits prompt, generated text, token and private file paths.

## Trust boundaries

- Fixed same-machine egress: authenticated GET /api/tags and POST /api/chat only. No server/listener, arbitrary host, redirect, proxy endpoint, browser credential, model install, or cloud fallback.
- Credentials read from a private local file identified by PHISERVE_TOKEN_FILE. POSIX owner-only permissions and symlink refusal are checked; Windows NTFS ACLs need operator review.
- The text prompt must be operator-selected, UTF-8 and 16 KiB or smaller. The CLI does not read Vessie memory, BrainC data, logs, GitHub files, agent instructions, or TIEKAT packets.
- Model alias must appear in the local PhiServe catalog. Text-only, one stream:false call with max 512 predicted tokens. Output must be an exact-alias, nonempty, done:true assistant response below 100 KiB. Failure or 401/409/503 never invokes Ollama or any other engine.
- The self-reported SHA-256 receipt can correlate files but is NOT independently signed, a GPU measurement, a P1-C identity record, a witnessed observation, or approval for any action.
- Does not touch the existing Vessie gateway read-only APIs, R2 browser pairing, canonical .54.12 executor permissions, .54.13 physical-observer hold, runtime manifest, or GA108 routing.

## Qualification

CI tests the strict request/response contract and refusal cases using HTTP stubs on Ubuntu and Windows Node 22. It does not run real weights or attest Windows security. A physical acceptance run against a real local PhiServe daemon is still required.

Future integrations should be separately reviewed governance proposals, not implicit imports of model-generated text into authority-bearing Vessie operations.
