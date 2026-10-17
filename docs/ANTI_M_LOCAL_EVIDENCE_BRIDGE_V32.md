# Vessie V3.2 · Local Evidence Bridge (Ollama inventory)

**Status: operator-triggered experiment. Source-signed observation, not hardware attestation, model admission, network incident verification, Anti-M completion, or runtime permission.**

This is a **command-line companion in the GitHub source tree**, not a new HTTP server, browser credential bridge, or part of the standalone Windows ZIP. It reuses Vessie's existing governed \`discoverOllama()\` probe, which only GETs fixed \`http://127.0.0.1:11434/api/tags\` and \`/api/ps\` and already separates reported local size from cloud references.

No \`/api/generate\`, inference, model install, auto routing, BrainC access, external upload, DNS target, private prompt, or new listener is needed.

## On your Windows PC (PowerShell)

Run these from the cloned \`SuperPhiVessel\` repository, with Node.js 22 or newer installed.

\`\`\`powershell
$KeyDir = Join-Path $HOME '.vessie-evidence-keys'
$Out = Join-Path $HOME 'Downloads\vessie-ollama-observation.json'

# One-time operator enrollment: creates private.pem and public.pem.
node .\packages\vessie-local-console\local-evidence-cli.mjs enroll --key-dir $KeyDir

# Every capture is ONE operator-invoked read-only Ollama discovery.
# The output file must not already exist: use a new filename next time.
node .\packages\vessie-local-console\local-evidence-cli.mjs capture --key-dir $KeyDir --out $Out

# Verify with a public key from the separately enrolled key directory.
node .\packages\vessie-local-console\local-evidence-cli.mjs verify --public-key (Join-Path $KeyDir 'public.pem') --receipt $Out
\`\`\`

The capture never prints or exports \`private.pem\`; it signs the exact source snapshot in memory. The verifier uses only the public key you supply **outside the receipt**. It does not trust a public key embedded in a receipt.

**Windows secret-handling note:** Node's file-creation mode alone cannot guarantee strong Windows ACLs. Use a private directory under your Windows user profile; inspect its Security permissions. Do not put the directory into a shared folder, OneDrive, GitHub checkout, or ZIP. Back up the key separately if you intend to verify future old receipts. Losing it doesn't make the old snapshot false, but breaks future ability to authenticate it against the same enrolled identity. Key rotation and revocation policy are not yet implemented.

To re-enroll a new key, choose a new key directory. The command refuses to overwrite existing keys.

## Receipt scope

The bounded JSON has schema \`superphivessel.local-evidence-bridge.signed-receipt.v0.1\`. Its signature covers:

- A one-time random nonce, UTC capture timestamp and adapter name
- Advisory Ollama probe status (available/unavailable), sanitized model list and loaded flags
- Reported size/VRAM values, classification basis and local/cloud/unknown categories
- Literal \`false\` values for routing approval, closure and execution authority

The signature is Ed25519. Verification compares the SHA-256 fingerprint of the separately supplied SPKI public key, checks the signature over deterministic canonical JSON, and classifies freshness:

- \`FRESH\`: captured within 15 minutes (with 30 seconds of tolerated clock skew), probe available
- \`STALE\`: older than 15 minutes
- \`FUTURE\`: timestamp beyond the tolerated 30-second future skew
- \`UNAVAILABLE\`: valid signed snapshot of an unavailable local probe, not proof that Ollama works

The verifier exits with 0 only for a fresh and available signed observation, 3 for stale/future/unavailable, and 2 for malformed, forged or otherwise refused input.

### Trust boundaries

- A valid signature proves **the enrolled key signed those bytes**. It does not prove that Ollama was honest, the probe ran on the intended PC, the GPU is working, a model is installed or callable, or that the observer is human.
- Cloud model references are **not** proof of local model weights. Local size is **not** performance verification.
- This is **not a V3.1 network-switch \`CONNECTIVITY\` or \`IMPACT\` record** and cannot be used to invent verified switch severity. The V3.1 policy's schema is intentionally distinct.
- The snapshot is only written to the operator-chosen file after the explicit command. It is not an append-only ledger, does not automatically feed Anti-M, and is not loaded into the hosted React page.
- Keep \`private.pem\` out of conversation uploads, GitHub commits and logs. Public keys can be distributed, but enrollment authenticity must be checked independently.

## Developer tests

\`\`\`sh
node --test packages/vessie-local-console/tests/local-evidence-bridge.test.mjs
node --test packages/vessie-local-console/tests/*.test.mjs
\`\`\`

Tests generate disposable in-memory signing keys, use mocked GET responses and isolated temporary directories, and do not require a local Ollama server. GitHub CI is a **synthetic software gate**, not proof that the user's RTX 5070 was observed.

## Next possible rung

A future operator-approved offline reviewer could import a V3.2 receipt plus an independently pinned public key into a dedicated **Ollama inventory** pane, preserving the distinction from V3.1 incident-evidence policy. No automatic model promotion, routing, or runtime execution should follow from the signature alone.
