# Sovereignty R3 · R3 Canonical PV-BUNDLE-0.1 Text-Only Adapter

**Status: source-audited, read-only text extraction pilot. NOT full-fidelity migration, identity restoration, memory permission migration or provider independence.**

Related: [issue #91](https://github.com/MichaelWave369/SuperPhiVessel/issues/91), [R0 portable records](SOVEREIGNTY_R3_PORTABLE_RECORDS_R0.md), [R1 operator mapping](SOVEREIGNTY_R3_OPERATOR_MAP_R1.md), [R2 workbench](SOVEREIGNTY_R3_BROWSER_WORKBENCH_R2.md).

## Actual canonical source evidence

This adapter was reviewed against:

- `runtime/MANIFEST.json` runtime version **v2.0-alpha.11.0.54.12**, source path `runtime/Super_PhiVessel_v2.0-alpha.11.0.54.12_BudgetGenius_Outcome_Handoff.html`, Git blob SHA-1 `c9dc18eb76be9883d18014de129c07cf78c5a498`. The manifest's SHA-256 applies to the full canonical artifact; no published live Netlify production-version claim is made here.
- Runtime `SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.12'` (note the actual bundle's `sourceRuntime` string lacks a `v` prefix).
- `VESSEL_BUNDLE_SCHEMA='phivessel.bundle.v1'`; `VESSEL_BUNDLE_VERSION='PV-BUNDLE-0.1'`; `VESSEL_MEMORY_SCHEMA='phivessel.memory.v3'`.
- `vesselBundleBuild(input)`: serializes current Vessel, work object, normalized memory, all saved conversations plus active conversation, linked historical receipts, and a seal over recursively key-sorted canonical JSON.
- `vesselBundleCanonical(value)`: excludes both `bundleHash` and `bundleHashAlgorithm` recursively before hashing.
- `vesselBundleVerifyHistoryChain(rows)`: uses a deterministic **non-cryptographic** `fastHash` receipt chain beginning at GENESIS.
- `vesselBundleVerifyIntegrity(bundle)`: checks receipt-chain integrity plus a bundle seal from `pcceDigestForAlgorithm`. The canonical exporter ordinarily uses `digestText` with SHA-256, falling back to FNV1A32 in environments without WebCrypto.
- `exportVesselBundle`: explicitly triggered in the runtime's Export controls. `importVesselBundle` has its own seal/chain and separate new-identity rules; **R3 neither changes nor calls either runtime function**.

The R3 adapter requires a valid **SHA-256 bundle seal**, the exact audited schema/version/runtime, the documented no-authority manifest flags, a matching historical receipt chain with history-only/no-reactivation boundaries, and bounded data. It refuses FNV fallback hashes, unsupported or newer runtime versions and unknown top-level fields. A valid SHA-256 digest **does not authenticate the exporter** if someone can also edit and reseal the file.

## User workflow

1. From a Vessie instance where you are authorized to export data, choose the existing **Export → Vessel bundle** control. Handle the downloaded JSON as **private plaintext**. It can contain substantial personal content, not just the text used by R3.
2. Go to `site/sovereignty/` (after deployment, the GitHub Pages Records Workbench). Select the downloaded JSON and press **Inspect file structure**.
3. Read the warnings, explicitly approve local conversion, then use **Extract text from verified Vessie Bundle v1**. This route needs **no hand-authored R1 mapping**, because it is pinned to a source-reviewed canonical schema.
4. If accepted, see the visible record counts and select **Download JSONL**. The output is plaintext and should be stored securely.
5. Verify it outside Vessie using the independently tested `tools/sovereignty-r3/reader.mjs`.

No source data is uploaded by the workbench code, and CSP sets `connect-src 'none'`. The page's scripts and CSS still load from its hosting domain; the host can observe page visits, not selected source-file contents via any application request.

## Precisely what gets extracted

| Canonical location | Portable kind | Preserved | Deliberately excluded |
|---|---|---|---|
| `conversations[]` | `conversation` | session ID, title and explicit created/updated timestamps | session-specific executable state, provider configuration, workspace controls, archived metadata |
| `conversations[].messages[]` | `message` | message ID, role as title, text `content`, `ts` timestamp and conversation parent ID | attachments, inference artifacts, tool calls, execution diagnostics, media, non-text content |
| `memory.records[]` | `memory` | memory ID, type as title, committed ACTIVE `content` and created/updated timestamps | pinned flag, horizon, allowed chambers, hashes, proposals, cross-Vessel admission/permission state |
| `workObject` | `work_object` | work ID, name, goal/constraints/next-action summary and created/updated timestamps | grants, evidence reference controls, candidates, scope/authority and runtime execution state |
| `historicalReceipts[]` | *none* | receipt-chain verification only | entire original receipt sources, including any sensitive/authority-bearing historical fields |
| `vessel`, `manifest` | *none* | policy/version integrity checks only | identity restoration, ownership claims, profile/creative workspace state, credentials |

**This is a deliberately lossy TEXT-ONLY export**. The result is not a drop-in replacement for the original bundle, does not preserve all user-owned fields, and cannot be imported into a model as an automatic memory with original admission conditions. The WorkObject text labels are a readable summary, not a binary-identical serialization.

If any selected records have unsupported roles, missing timestamps/IDs, unexpected memory statuses, limits exceeded, changed hashes, or a different runtime, the **entire extraction is refused**, not silently truncated. This prototype currently limits source and resulting archive to 2 MB and no more than 500 text records. Large real-world bundles will need a separate authenticated, streaming design rather than raising caps without review.

## Security and model independence

- No automatic localStorage, IndexedDB, private PV-MEM API, session, network, cloud or provider access.
- SHA-256 checksum verifies bundle self-consistency, **not author authenticity, factual truth or user consent to share individual messages**.
- Historical receipts are inspected only for chain/boundary consistency and never re-exported; `grants` and `proposals` are omitted.
- Selected message and memory text is **not redacted**. Users must review data and destination before sharing. Do not upload real bundles to GitHub.
- The workbench prepares a download only after an explicit user action; no automatic save, deletion or remote revocation.
- The adapter is only an *exit* format for readable records; it does not restore Vessie identity, recreate provider connections, execute agents, or cover local model interchangeability.

## Verification

```bash
node --check site/sovereignty/canonical-v1.mjs
node --test tests/sovereignty-r3-canonical-v1.test.mjs tests/sovereignty-r3-browser-workbench.test.mjs tests/sovereignty-r3-operator-map.test.mjs tests/sovereignty-r3-portable.test.mjs
```

The tests create entirely synthetic, version-shaped bundles, independently compute their SHA-256 seal, validate exact source constants from the canonical runtime, check R0 JSONL roundtrip, and reject altered/resealed false authority, runtime drift, unsupported role/status and timestamp omissions. **No actual user data or field acceptance has been tested.**

## Further acceptance gates

1. Physical **Windows and mobile browser** user-initiated export, including empty/large archives, disabled WebCrypto, hosted-origin constraints, and download behavior.
2. A reviewed extension for larger/user-owned attachment data, archived records, memory horizons and deletion/tombstone semantics without restoring authority.
3. More than one Vessie runtime generation, with separate versioned adapters and no silent cross-version assumptions.
4. Independent verification of model-provider absence, manual selection and visible degradation under issue #91.
5. Security review for confidential exports, access controls and explicit deletion/revocation limitations.

Keep issue #91 **open**. Keep unrelated Physical Observer PR #94 **HOLD** until its independent evidence gate is satisfied.
