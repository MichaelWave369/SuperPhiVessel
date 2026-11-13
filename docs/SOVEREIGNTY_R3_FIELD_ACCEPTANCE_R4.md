# Sovereignty R3 · R4 Operator Field Acceptance Checklist

**Status: guidance for an unverified physical test.** This change does not modify the canonical Vessie runtime, parser, model provider, or authority boundaries. A green CI run is not a successful user-device export.

## Before testing

- Use your own authorized Vessie instance. Its exact canonical source contract for this pilot is `phivessel.bundle.v1`, `PV-BUNDLE-0.1`, runtime `2.0-alpha.11.0.54.12`.
- The existing Vessie **Export → Vessel bundle** control creates a sensitive plaintext JSON file. Keep that file in a private location under your own control. **Never attach any private bundle or generated JSONL to an issue, PR, CI artifact, or support conversation.**
- The Records Workbench runs a bounded text-only conversion in local browser memory. It requires a secure context with WebCrypto SHA-256 and supports **at most 2 MB input/output and 500 records**. It is deliberately not a complete backup or a replacement for the original Vessel bundle.
- Historical receipts, memory admission state, attachment bytes, provider credentials, identity and execution authority never enter the portable text output. Existing records' text can nevertheless contain private data. The outer bundle SHA-256 seal confirms consistency, **not authenticity of the exporter**.

## Windows field test (actual-user observation required)

1. In Vessie, manually choose **Export → Vessel bundle**. If the export control is unavailable in the deployed runtime, record `BLOCKED: export control unavailable`, not PASS.
2. Without uploading the bundle anywhere, visit the [Records Workbench](https://michaelwave369.github.io/SuperPhiVessel/sovereignty/) in a modern local browser, choose the bundle file and inspect structure. If the file is over 2 MB, the interface must display a size-limit message instead of silently leaving an inactive control.
3. Confirm the source inspection reports only field names, counts and SHA-256, never memory/message *values*.
4. Select the operator approval checkbox and choose **Extract text from verified Vessie Bundle v1**. Do not choose general JSON mapping unless working with a separately reviewed noncanonical source.
5. If conversion succeeds, review visible record counts and download JSONL explicitly. The archive is sensitive plaintext, contains no authority transfer, and may omit whole record classes by policy.
6. Use the independent Node 22+ verifier in a private local directory (no repo upload):
   `node tools/sovereignty-r3/reader.mjs verify C:\\private\\vessie-portable-records.jsonl`
   An independent successful verify is an additional evidence step, not evidence that all original information was preserved.
7. Close the tab and confirm no automatic upload, sync, or re-import was initiated by the workbench code. Keep the original full bundle separately if it is your only full backup.

## Browser/device variations to record

- Windows: supported SHA-256 bundle; oversized bundle; mismatched or tampered bundle; manually cancelled download.
- Mobile: browser file selection, button enablement, downloaded file handling and source size display. A limited file picker or download API is a `BLOCKED` or `UNTESTED` field result, not presumed success.
- A browser without WebCrypto must fail closed with a clear error. A bundle using the canonical runtime's FNV-only fallback is **unsupported** by the pilot.
- No model/provider calls are involved. The test does **not** qualify local model interchangeability or provider-absent operation.

## Share only a redacted field report

Record: device category (Windows/mobile), browser family, result (`PASS`, `FAIL`, `BLOCKED`, or `UNTESTED`), input-size band (`<=2 MB` or `>2 MB`), record-count band (`0`, `1-500`, or `>500/unknown`), visible error category (size, version, seal, schema, permissions, browser/download, other), and whether detached verification ran. **Do not include filenames, local paths, message/memory text, identifiers, user profile fields, raw timestamps, hashes, bundle JSON, generated JSONL, console dumps, or screenshots containing private data.**

## Acceptance boundary

Do not close [issue #91](https://github.com/MichaelWave369/SuperPhiVessel/issues/91) on this checklist alone. Real private-source export, larger archives, attachment and admission-state policy, deletion/revocation, and independent provider operation still need separate grounded acceptance. Keep the unrelated Physical Observer evidence HOLD in place.
