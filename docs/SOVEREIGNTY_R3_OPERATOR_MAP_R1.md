# Sovereignty R3 R1 · User-controlled source mapping

**Status: offline read-only operator workflow, unqualified for the canonical Vessie Portable Vessel Bundle schema.** Related: [issue #91](https://github.com/MichaelWave369/SuperPhiVessel/issues/91), [R0 portable records](SOVEREIGNTY_R3_PORTABLE_RECORDS_R0.md).

## What this adds

R0 can pack explicitly staged portable records. R1 adds a standalone **shape-only JSON inspector** plus an explicit, exact-source-SHA-bound field mapping tool. This is for a **local copy** of an operator-selected JSON file: it does not browse, upload, fetch, or automatically read Vessie memory. The canonical standalone runtime is >13 MB and its export serializer/field contract has **not** been independently established in this PR. Do not assume the synthetic example represents Vessie's real bundle.

A valid mapping converts approved input fields to R0 JSONL records. A clean, unrelated Node installation can then run `tools/sovereignty-r3/reader.mjs` to verify and render the archive outside SPV. **No runtime rehydration, replacement model, memory write, or identity transfer occurs.**

## Operator-only local steps

From a checkout with Node.js 22+:

1. Obtain your own permitted JSON export file locally. **Never commit private exports, mapping files or generated archives.** Work in an encrypted, access-controlled directory off Git. R1 is capped at 2 MB source and output.
2. Run:
   ```powershell
   node tools/sovereignty-r3/operator-map-cli.mjs inspect C:\private\my-export.json
   ```
   This prints **key names, type labels, collection counts, and source_sha256**, not source field values. **Key names can still be sensitive**; treat the shape report as private and never paste it publicly without reviewing. It is not proof of source origin or that the file uses a supported Vessie export schema.
3. Review the source format **privately**, and write a mapping JSON using only explicitly approved fields. The mapping requires the displayed source_sha256 and your explicitly declared `exported_at` date. The example below applies **only to the synthetic test fixture**.
4. Run:
   ```powershell
   node tools/sovereignty-r3/operator-map-cli.mjs convert C:\private\my-export.json C:\private\mapping.json C:\private\my-portable.jsonl
   node tools/sovereignty-r3/reader.mjs verify C:\private\my-portable.jsonl
   node tools/sovereignty-r3/reader.mjs markdown C:\private\my-portable.jsonl C:\private\my-records.md
   ```
   Output files are created only if they **do not already exist**. Review the Markdown output for confidentiality before moving or sharing it.

## Exact synthetic mapping example

Replace `SOURCE_SHA256_FROM_INSPECT` with the digest from the `inspect` command on `tests/fixtures/sovereignty-r3-operator-source.synthetic.json`:

```json
{
  "schema": "spv.sovereignty.operator-map.v0.1",
  "source_sha256": "SOURCE_SHA256_FROM_INSPECT",
  "exported_at": "2026-11-13T19:00:00Z",
  "collections": [
    {
      "kind": "conversation",
      "source_id": "synthetic-demo-not-runtime",
      "items_path": ["conversations"],
      "parent_kind": null,
      "fields": {
        "id": ["uid"], "title": ["label"], "text": ["body"],
        "created_at": ["first_seen"], "updated_at": ["last_seen"],
        "parent_id": null
      }
    },
    {
      "kind": "message",
      "source_id": "synthetic-demo-not-runtime",
      "items_path": ["messages"],
      "parent_kind": "conversation",
      "fields": {
        "id": ["uid"], "title": ["label"], "text": ["body"],
        "created_at": ["first_seen"], "updated_at": ["last_seen"],
        "parent_id": ["conversation_uid"]
      }
    },
    {
      "kind": "memory",
      "source_id": "synthetic-demo-not-runtime",
      "items_path": ["memories"],
      "parent_kind": null,
      "fields": {
        "id": ["uid"], "title": ["label"], "text": ["body"],
        "created_at": ["first_seen"], "updated_at": ["last_seen"],
        "parent_id": null
      }
    }
  ]
}
```

The mapped IDs become `conversation:conv-one`, `message:msg-one`, etc. Source IDs are **declared only**; the output marks every provenance row `DECLARED_UNVERIFIED`. Non-mapped fields, including the fixture's deliberately secret-shaped `external_settings`, do not enter the portable archive.

## Limits and security requirements

- A shape report contains metadata and **names of fields**, not values. The file still resides on disk locally. Never assume filename, field names, metadata, or source content is safe for disclosure.
- This tool cannot detect secrets inside selected free text or prove that a string is genuinely a memory. Operators must verify and redact content **before** choosing fields. The tool rejects suspicious field names, unknown mapping keys, invalid dates, unexpected types, oversized input, mismatched source SHA and duplicate resulting IDs.
- Nested record arrays and different schema versions require new reviewed mapping protocols. Missing timestamps are refused rather than fabricated. This R1 mapping is **not** an automatic parser for any SuperPhiVessel release.
- Hashes detect accidental substitution/corruption but **do not authenticate** origin or integrity against an adversary who can also edit the mapping and source.
- The R0 portable archive is *plain text*, not encrypted; `mode: 0600` is a best-effort local filesystem permission, not a guarantee on Windows. No deletions or revocations occur on export. Copies are controlled by the operator, not the original application.
- The tool does not infer a valid sender identity, import authority, recover model credentials, enable tool use, or activate a local model.
- DO NOT close issue #91 on merge. The actual canonical export serializer, browser-initiated consent, full-record fidelity, data deletion/revocation, offline provider independence and physical Windows acceptance remain unresolved.

## Tests

```powershell
node --check tools/sovereignty-r3/operator-map.mjs
node --check tools/sovereignty-r3/operator-map-cli.mjs
node --test tests/sovereignty-r3-portable.test.mjs tests/sovereignty-r3-operator-map.test.mjs
```

**No actual user records, credentials, live Vessie memory or model weights are used in the tests.**
