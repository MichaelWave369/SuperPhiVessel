# Sovereignty R3 · Portable Records R0 (offline interoperability pilot)

**Status: isolated, additive, synthetic/operator-staged research. Not connected to canonical Vessie, browser storage, PV-MEM, external providers, or PhiOS.**

Related tracking: [SuperPhiVessel issue #91](https://github.com/MichaelWave369/SuperPhiVessel/issues/91).

## Purpose

Make a first small part of the exit path testable: a person can take four kinds of **explicitly staged** text records out of this repository as ordinary JSONL, verify accidental modification, and open/render them using a standalone Node.js 22+ reader copied to an unrelated directory.

This does **not** prove that current users can yet export all their real SuperPhiVessel data. The existing **Portable Vessel Bundle** is a separate runtime feature. Its private schema, permission boundaries, and actual browser export behavior have *not* been inspected or wired into this pilot. A future bridge must be read-only, user-initiated, carefully reviewed, and separately tested on its exact source version.

## Quickstart (no provider, account, credentials, network or npm install)

From repository checkout:

```powershell
node --test tests/sovereignty-r3-portable.test.mjs
New-Item -ItemType Directory -Force .\local-private | Out-Null
node tools/sovereignty-r3/pack-cli.mjs pack tests/fixtures/sovereignty-r3-synthetic-staging.json .\local-private\synthetic.jsonl
node tools/sovereignty-r3/reader.mjs verify .\local-private\synthetic.jsonl
node tools/sovereignty-r3/reader.mjs markdown .\local-private\synthetic.jsonl .\local-private\synthetic.md
```

Every output path must be a **new file**. The tools refuse to overwrite an existing archive or Markdown file. Keep any real exports out of Git. Outputs contain plaintext data; local file permissions are requested but cannot replace disk encryption or operator access controls.

To demonstrate independent import, copy only `reader.mjs` and the generated `synthetic.jsonl` to a new directory outside the SuperPhiVessel checkout, then execute `node reader.mjs verify synthetic.jsonl` or `node reader.mjs markdown synthetic.jsonl recovered.md`. The reader has no imports from SuperPhiVessel or its shared libraries. It does not import into a model or rehydrate a Vessie identity.

## Staged input schema

`spv.sovereignty.staging.v0.1` is a deliberately small, manually supplied JSON envelope:

- `schema`: exactly `spv.sovereignty.staging.v0.1`.
- `exported_at`: declared ISO UTC date string.
- `records`: up to 500 bounded entries of type `memory`, `conversation`, `message`, or `work_object`.
- Each record requires `kind`, stable `id`, `created_at`, `updated_at`, single-line `title`, `text`, nullable `parent_id`, and `provenance`.
- `provenance` declares `source`, `source_id`, and status `DECLARED_UNVERIFIED`. Only `synthetic_fixture`, `operator_staged`, and `runtime_adapter_unverified` source labels are recognized.
- Unknown record/manifest fields are rejected, including credentials, grants, active sessions, permissions and embedded authority structures. **The code cannot identify secrets typed into ordinary text**: operators must review staged content before packaging.
- A record's text/title must not both be blank. Message-to-conversation parent references are carried but not yet cross-validated against a complete canonical runtime dataset.

The packed `spv.sovereignty.records.v0.1` JSONL begins with a manifest that declares the record count, a SHA-256 checksum over the canonical record lines, and `authority: NONE`. Each following line includes a per-record checksum. This provides **accidental corruption detection and internal consistency**, not sender authentication, immutable custody, encryption, causal independence or trusted provenance. A malicious party can fabricate a new valid checksum.

## Data ownership and exclusions

| Category | Proposed export treatment | This R0 implementation |
| --- | --- | --- |
| User-written conversations/messages | User-owned text with timestamps, source and parent pointers | Supported only when explicitly staged |
| Committed user memory | Text and provenance, without background authority | Supported only when explicitly staged |
| User WorkObject | User-owned text/context, not grants | Supported only when explicitly staged |
| Derived indexes, embeddings, caches | Rebuildable and often provider-specific | Not included |
| Browser session, temporary perception, live model context | Ephemeral/runtime-specific | Not included |
| Provider credentials, access tokens, private keys, leases | Never bundle; reauthorize separately | Unknown fields rejected, embedded text not automatically scrubbed |
| Model weights or hosted provider artifacts | Separate licenses/storage and operator-controlled movement | Not bundled, not downloaded |
| Real PV-MEM/runtime export adapter | Must map actual documented source schema without silent scope change | Not implemented |

## Failure and governance boundaries

- No browser reads, memory mutations, network calls, model inference, dynamic imports, shell-controlled plugins or hosted Φ requirements.
- Read-only detached reader; the Markdown command writes only to a new operator-specified path.
- No source revision or checksum can prove that original data was genuine.
- No imported record grants execution, restores a credential, reactivates a session, changes identity or adjusts model routing.
- No exporter automatically deletes the original data. Deletion/revocation semantics and real-user browser acceptance remain required acceptance steps in issue #91.
- No evidence here establishes substitute model-provider compatibility, local Ollama freedom or user-visible provider degradation.

## Next gates (not performed)

1. Audit the exact current canonical Portable Vessel Bundle serializer and its stable field schema, including blank-state controls, without reading anyone's real private data.
2. Build a separately reviewed, human-approved browser-side **export adapter** that maps only allowlisted user-owned records to staged JSON; run byte-level tests with synthetic fixtures.
3. Test a fresh, outside-SPV read and lossless record roundtrip in two independent execution environments, including Windows.
4. Assess provider absent/manual local model paths and visible feature degradation independently.
5. Preserve a human-visible, non-destructive deletion/revocation flow; explicitly state that exported copies cannot be remotely revoked.
6. Only after independent and field testing, consider whether any runtime integration should be proposed.

**Capability to remember is not permission to ship memory.** This pilot deliberately keeps that invariant unchanged.
