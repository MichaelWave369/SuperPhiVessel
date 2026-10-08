# Vessie R2 · Windows Browser Field Pilot

**Status:** OPERATOR FIELD PILOT REQUIRED. GitHub Actions cannot prove the browser-to-localhost route on your Windows PC.

This pilot checks the HTTPS read-only pairing path. It cannot run inference, spend money, read memories, approve models, or change the canonical runtime.

## Before starting

1. Update your local SuperPhiVessel checkout. You need Node 22+, Ollama optionally running, and an up-to-date browser.
2. Review [BROWSER_PAIRING_R2.md](../BROWSER_PAIRING_R2.md). Use a locally trusted certificate with IP SAN `127.0.0.1`, and keep its private key outside the repository. Never disable certificate verification or browser network controls.
3. Start the gateway:

```powershell
$env:VESSIE_TLS_CERT_FILE = "$env:USERPROFILE\vessie-local.crt"
$env:VESSIE_TLS_KEY_FILE  = "$env:USERPROFILE\vessie-local.key"
node packages/vessie-gateway-v0.1/browser-cli.mjs
```

The local terminal prints a one-use pairing code. Keep it local: never paste it into chat, issues, email, screenshots or pilot artifacts.

## A. Windows TLS trust and refusal checks

While the gateway runs, open another PowerShell window in the checkout:

```powershell
.\packages\vessie-gateway-v0.1\pilots\Windows-R2-LocalTrust.ps1
```

The script uses normal Windows TLS certificate validation and refuses a process-level custom certificate-validation callback. It does not need a pairing code or bearer token.

Redacted output: `%TEMP%\vessie-r2-windows-pilot.json`.

Expected check states:

```text
WINDOWS_OS_TLS_TRUST         PASS
UNAUTHORIZED_REFUSAL        PASS
WRONG_ORIGIN_REFUSAL        PASS
LOCAL_TLS_AND_REFUSAL_PASS_BROWSER_PENDING
```

Windows TLS trust does not prove Chromium accepts the same certificate. That needs a real browser connection.

## B. GitHub Pages → local HTTPS, real browser

Open [Vessie React](https://michaelwave369.github.io/SuperPhiVessel/vessie/) → **Model Fabric**.

1. Enter the one-use code from the operator's terminal.
2. Press **Pair Read-Only**. The browser must accept the valid TLS certificate and comply with its private-network permission policy. Do not bypass either.
3. Press **Discover Local Models**. Inventory must reflect only what Ollama actually reports, with every model unapproved.
4. Press **Disconnect / Revoke**. Confirm the UI reports gateway revocation rather than just local disconnect.
5. Press **Export Redacted Browser Report** and find `vessie-r2-browser-pilot.json` in Downloads.

The browser report includes only checks and model count. It deliberately excludes model names, device identity, pairing secret, bearer, API keys and private memory.

If the browser refuses TLS or local-network access, keep that failed result. Do not disable protections or use browser flags to force success.

## R2 revocation confirmation, browser report v0.2

The browser pilot now distinguishes two separate observations:

1. `session_revocation_request` is `PASS` **only** when the R2 gateway's
   `DELETE /v1/session` responds with
   `{ "session_status": "REVOKED", "authority_granted": false }`.
2. `revoked_session_denied` is `PASS` **only** when the page subsequently
   sends `GET /v1/status` with the **same old bearer** and reads
   `HTTP 403` with `SESSION_DENIED` and `authority_granted: false`.

A network timeout, TLS error, browser refusal, unexpected response or
missing second check is **not** a pass. These observations remain
`UNATTESTED_BROWSER_CLIENT` claims, not cryptographic runtime or device
attestation. The React page resets its pilot checks when a new pairing
attempt begins so old successes cannot survive a new failed trial.

**Re-run the pilot after updating GitHub Pages.** The old
`superphivessel.gateway.r2.browser-field-report.v0.1` is intentionally
refused by the updated comparator; only `v0.2` with five passing checks
is eligible for `OBSERVED_PENDING_OPERATOR_REVIEW`. It still never
constitutes a physical qualification or a model-routing approval.

Do not share the original pairing code, bearer, TLS private key or raw
browser state. A redacted failure report is useful evidence and should
not be hidden or converted into success.

## C. Compare the two local reports

From the checkout:

```powershell
node packages/vessie-gateway-v0.1/pilots/assess-field.mjs "$env:TEMP\vessie-r2-windows-pilot.json" "$env:USERPROFILE\Downloads\vessie-r2-browser-pilot.json"
```

Result meanings:

- `BLOCKED_FIELD_EVIDENCE`: required observations are missing/failed.
- `OBSERVED_PENDING_OPERATOR_REVIEW`: both local TLS checks and browser read-only flow were reported passing.

Neither result says FIELD_QUALIFIED or enables routing. Browser receipts are untrusted self-reports without independent machine attestation.

## Remaining manual negative controls

Before any later production gate, inspect and document privately:

- Pairing the same code twice must fail.
- After 15 minutes, the original session cannot read models.
- Gateway restart invalidates the original session.
- An untrusted origin must be refused. PowerShell checks explicit wrong-Origin; a distinct browser-origin test remains separate.
- Task execution, model generate/pull, memory reads, paid-provider API calls, BrainC writeback, BudgetGenius authority and P4 promotion remain absent.
- React state is lost on page reload, but any server bearer remains valid until expiry or gateway restart. Browser tab closure is not guaranteed server revocation.
- The reported local inventory agrees with `node packages/vessie-gateway-v0.1/cli.mjs probe`.

## Release boundary

P4 remains shadow-only. Canonical `.54.12` and Physical Observer `.54.13` hold stay untouched.

CI qualifies the harness, not the operator's Windows machine. The operator must review collected evidence before any browser-to-routing integration.

If browser local-network policy blocks this topology, use R1 CLI and pursue a separately reviewed secured relay. Do not disable browser safeguards.
