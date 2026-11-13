# Sovereignty R3 R2 · Browser-local records workbench

**Status:** Additive, isolated browser research UI. It is **not wired into** canonical SuperPhiVessel, PV-MEM, any provider, browser storage, the executor, or the PhiOS bridge.

Related to issue [#91](https://github.com/MichaelWave369/SuperPhiVessel/issues/91); it does not satisfy that issue's complete acceptance criteria.

## What this proves

The `site/sovereignty/` page can run as a static first-party browser surface. It accepts only **operator-selected** local JSON source and R1 mapping files. It can inspect **structure, never leaf values** (field names and counts can still be private), display an SHA-256 digest of the selected exact source bytes as read into text, enforce an operator review checkbox, and prepare an R0 `spv.sovereignty.records.v0.1` JSONL download.

The pure browser `portable-web.mjs` uses WebCrypto and does not require a back-end server, API key, account, model or credential. A strict Content Security Policy prohibits page scripts from making `fetch`, XHR and WebSocket requests (`connect-src 'none'`). Scripts, CSS and browser shell still load from their hosting site; this is not a promise that the site host learns nothing about *visits*. Selected file contents are not sent to the host by the page code. To minimize that site relationship, users can save this static build locally after verifying its exact files or use the R1 Node CLI.

The generated plaintext JSONL can be opened by the previously merged standalone `reader.mjs` outside Vessie. The parity test requires **byte-for-byte identical** browser and Node R1 mapping outputs for the same synthetic source, map and timestamp. The test also asserts independent R0 verification.

## Operator flow

1. Start at `site/sovereignty/index.html` via an installed static hosting path (or after merge, `/SuperPhiVessel/sovereignty/`). Never paste private records into a GitHub issue or bug report.
2. Use **Select JSON source** and choose a file you own or are authorized to export. Only sources ≤2 MB are handled.
3. Click **Inspect file structure** to display bounded key/type paths and the SHA-256 of the selected file. **Key names themselves may be sensitive.** The workbench never prints the underlying field values in inspection.
4. Create an R1 mapping JSON using the reviewed source schema and exact displayed checksum. The separate [R1 guide](SOVEREIGNTY_R3_OPERATOR_MAP_R1.md) has an example for a synthetic, **noncanonical** export. A mapping does not prove that a field is real user memory.
5. Select the mapping, inspect its field choices on your own machine, and opt in using the checkbox. The **Prepare portable JSONL** button is disabled until inspection, a mapping and explicit approval are all present.
6. If validation passes, inspect the record-count summary and choose **Download**. No download occurs automatically. The browser offers a `Blob` URL and revokes it when a new file/action is chosen or the page is unloaded.
7. Confirm the downloaded JSONL with the independent reader, in a directory outside the SuperPhiVessel checkout if desired:

```powershell
node tools/sovereignty-r3/reader.mjs verify C:\private\vessie-portable-records.jsonl
```

All output is plaintext. The operator owns safe storage and any downstream copies. A returned checksum protects against accidental alteration, not forgery, model truth or source authentication.

## Explicit exclusions

- No automatic browser PV-MEM, LocalStorage, IndexedDB, credential, session or Vessie private bundle reading.
- No automatic mapping, provider discovery, model inference, memory writing, consent spoofing, or action authority.
- The canonical 13 MB runtime bundle serializer has **not** been audited: public source extraction tools do not expose reliable text for the large blob. No claim is made that the sample mapping works with the canonical Vessie export, or that all user-owned records are exported.
- The operator must check selected free-text fields for private information. A named field/path blocklist does not detect secrets embedded inside otherwise ordinary text.
- No portable provider/model implementation or login/account recovery. No file deletion, remote revocation or encryption. No automated field-level data reconstruction.
- The UI uses only in-memory selected file contents while processing and Blob download URLs; runtime browser engines may handle memory/temporary file buffers outside the application's control.
- This PR provides code and deterministic Node tests. **Actual mobile browser, Windows filesystem, private-source review and deployment checks remain field acceptance gates.**

## Verification

Run from a repository checkout using Node.js 22+:

```powershell
node --check site/sovereignty/portable-web.mjs
node --check site/sovereignty/workbench.js
node --test tests/sovereignty-r3-browser-workbench.test.mjs tests/sovereignty-r3-operator-map.test.mjs tests/sovereignty-r3-portable.test.mjs
```

Tests verify conversion parity, secret-shaped fixture field omission, source integrity, malformed input refusal, duplicate-ID/size/date constraints, CSP, and explicit user-interaction gates. Do not confuse passing tests with a successful actual-user browser export.

## Next acceptance gate for issue #91

Obtain trustworthy source-based evidence of the **exact current canonical Portable Vessel Bundle** export schema, with at least one *non-sensitive synthetic* fixture generated by the actual canonical serializer; then map the user-owned record types without borrowing or reconstructing authority. Only after that should a separate, consent-bound live export adapter be proposed. Keep the existing Physical Observer HOLD independent.
