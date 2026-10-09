# SPV-SCOUT-02: Optional paired local PhiBot receipt read

**Scope:** operator-selected, read-only, historical Scout *qualification receipt*, NOT a live model/agent session.

The first field-qualified Scout pilot ran on Windows with local Ollama `qwen3:4b`, and PHIBOT-15 issued a redacted, digest-bound receipt. SPV-SCOUT-01 displayed a manually pasted JSON copy in Vessie's React cockpit. SPV-SCOUT-02 optionally replaces that manual copy with an authenticated **HTTPS read of one already-saved local receipt** using the **existing R2 one-use pairing session**. All other model-routing, memory and executor surfaces remain disconnected.

## What changed

- The existing R2 gateway can optionally expose `GET /v1/scout` **only when configured** with `VESSIE_SCOUT_RECEIPT_DIR` at startup. The default mode remains disabled.
- The folder is chosen in the operator's Windows terminal, *not* by an HTTP parameter. The server only reads `qualification.json` and `qualification.sha256` from that exact `scout-*` folder.
- The reader rechecks SHA-256 **with PhiBot's fixed domain prefix**, exact 27-field receipt schema, canonical serialization, timestamp chronology, no-authority flags, no extra files/symlinks, and source-run/model shapes. A failure returns a generic refusal, never private contents.
- The paired gateway reuses its existing 15-minute, one-use, operator-entered bearer, exact GitHub Pages origin, loopback TLS, Host checks, no-store headers and revocation. Six paired Scout GETs maximum per minute.
- The **SCOUT HANDOFF** React tab now offers **READ PAIRED SCOUT RECEIPT**. The same ephemeral token from **MODEL FABRIC** persists across tabs in React memory, but disappears on refresh, expiry, or disconnect. No browser storage is used.
- The older paste-only workflow remains available and unchanged.

## Windows operator steps

**Prerequisite:** a working, individually reviewed local HTTPS R2 pairing setup, including a trusted TLS certificate with IP SAN `127.0.0.1`. If none exists yet, follow [BROWSER_PAIRING_R2.md](../packages/vessie-gateway-v0.1/BROWSER_PAIRING_R2.md). Do **not** disable certificate validation, CORS/private-network protections, or expose the service to your Starlink/public interface.

From PowerShell, on the PC where PhiBot already saved its successful Scout receipt:

```powershell
cd $HOME
git clone https://github.com/MichaelWave369/SuperPhiVessel.git
cd SuperPhiVessel

# The existing specific successful receipt. Use your actual path if different.
$env:VESSIE_SCOUT_RECEIPT_DIR = "$HOME\PhiBot\.phibot\scout-qualification\scout-J1h0Kv"

# Paths to your own *locally trusted*, IP-SAN-compatible key/certificate.
# Supply these only if you have explicitly reviewed your local TLS trust setup:
$env:VESSIE_TLS_CERT_FILE = "$HOME\vessie-local.crt"
$env:VESSIE_TLS_KEY_FILE  = "$HOME\vessie-local.key"

node packages/vessie-gateway-v0.1/browser-cli.mjs
```

The gateway prints a one-use secret **only to your terminal**. Do not upload, screenshot, or post it.

Then:

1. Open the [React Vessie cockpit](https://michaelwave369.github.io/SuperPhiVessel/vessie/) in a browser that trusts your local HTTPS certificate. Choose **MODEL FABRIC**.
2. Follow the existing R2 pairing procedure (including its non-secret trial ID), enter the one-time code, and pair the local browser session.
3. Switch to **SCOUT HANDOFF**. Select **READ PAIRED SCOUT RECEIPT**. The gateway will reread just the specific configured receipt; the browser applies the same strict redacted schema inspector as manual paste.
4. The screen should show `PAIRED FILE READ · SELF-REPORTED`, model `qwen3:4b`, source run `37851619515`, source expiry and the hash prefix. **The browser cannot independently attest model execution or source authenticity.**
5. Revisit **MODEL FABRIC** to **DISCONNECT / REVOKE**. If the browser loses connection before revocation confirmation, stop/restart the local gateway to invalidate its in-memory bearer.

The cloud observation expires at **2026-10-09T06:09:12Z**. The historical qualified receipt can be displayed after expiry, but it becomes **HISTORICAL**, never live authorization. A new Scout run requires separate human execution of the PhiBot CLI and a new explicitly selected receipt folder.

## Threat boundary and missing qualifications

A paired `GET` proves a gateway with the shared token served locally consistent receipt metadata, *not* authenticated human/operator identity, signed publisher provenance, model quality, network-to-agent control, or PhiOS isolation. The domain-separated SHA-256 only establishes local consistency, not a signature. The gateway cannot call Ollama or invoke PhiBot or select a different receipt automatically.

- No `POST` to run a bot, no `/api/chat`, no model routing, no command execution, no field memory admission, no automatic refresh, no arbitrary filesystem read.
- No token or local receipt bytes are stored in browser storage or transmitted to remote services by these feature components. Do not paste the pairing token into ChatGPT or a GitHub issue.
- The existing R2 trusted TLS and browser private-network qualification remains **operator-platform-dependent**. Green CI can verify source boundaries and mocked TLS tests, not actual Chrome/Windows certificate trust on this machine.
- The paired origin allowlist remains the entire `https://michaelwave369.github.io` origin. Trust the actual served Vessie bundle before entering a pairing code.

This is a **read-only paired data-plane connection**, not yet a live **PhiBot agent or control-plane integration**. The next phase, if qualified, can build a separately governed request/approval protocol.

**Capability ≠ authority. Evidence ≠ execution approval.**
