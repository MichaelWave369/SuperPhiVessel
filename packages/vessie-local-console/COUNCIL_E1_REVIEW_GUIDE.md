# Vessie Research Council E1-C · Offline governance-review panel

**Status:** browser-only, read-only, public synthetic data only. **SIMULATED · AUTHORITY NONE · SOURCE NOT AUTHENTICATED.** This is the third separately implemented receiver for [NBGPocketMesh E1](https://github.com/MichaelWave369/NBGPocketMesh/blob/main/docs/FLEET_COUNCIL_E1.md), following ThinkTank and PocketBrain.

## Location and operator use

The **Research Council · Vessie governance review** panel is served by Vessie's existing fixed-loopback Local Console (`127.0.0.1:8791`) in **all modes**, including the default read-only launch. It is also included in the Windows portable allowlist. The feature is not part of the hosted React cockpit or canonical Vessie runtime.

1. Open the local console normally using `Start-Local-Vessie.cmd` or the source checkout.
2. In the Research Council section, choose one **public synthetic E1** JSON exported from the PocketMesh E1 experiment. Maximum 64 KiB.
3. Click **Inspect selected Council receipt**. A successful inspection displays only the case identifier, categorical Keyhole-review suggestion, three declared roles, abbreviated declared Git commit SHAs, and an abbreviated exchange digest.
4. Click **Clear review** or close/reload the tab to discard the preview. Imported raw JSON is never stored or exported by this panel.

The browser reads operator-selected bytes using File API. It recomputes inner and outer SHA-256 using Web Crypto and the upstream sorted-key serialization. **No model, provider, cloud, local inference service, memory, network request, database, sync, bridge, tool, or execution authority is touched by importing the file.** Existing PhiServe Model Desk and Human Review are unaffected.

## What is verified

- Exact E1 v0.1 schema/epoch and public synthetic, untrusted, no-authority provenance flags.
- Exactly three fixed ordered seats: ThinkTank (hypothesis), PocketBrain (observer), Vessie (review hold).
- Per-seat role/repository/claim tier, declared full 40-character hexadecimal source SHA, no model execution or approval.
- All three seats reference the same E0 parent digest.
- Consistent coarse-versus-detailed Keyhole action pair.
- Per-seat and envelope SHA-256 digests, with no unknown fields or private/raw prompt payloads.
- Inspection returns `HELD_UNTRUSTED_REVIEW_ONLY` even when all self-consistency checks pass.

## What is NOT verified

**An arbitrary person can fabricate a complete, self-consistent packet and recompute every hash.** This adapter cannot attest that NBGPocketMesh, ThinkTank or PocketBrain really generated the packet; source revisions are **DECLARED_UNVERIFIED**. It cannot independently prove a measured model result, physical observation, rare particle decay, scientific truth, provenance independence, or human approval.

A Keyhole action pair labeled `CHALLENGE_AGGREGATE_EQUIVALENCE` is a *fixture suggestion*, not an independently reconstructed E0 evaluation. It does not create a Vessie Decision Dossier, signed governance ledger entry, inference plan, council approval, model-routing permission, software merge, or release. Integration with PhiKernel/PhiMada/Agentora remains a separately gated project.

## Negative controls and CI

```sh
node --test packages/vessie-local-console/tests/council-review.test.mjs
node --check packages/vessie-local-console/ui/council-review.mjs
node --check packages/vessie-local-console/ui/council-review-ui.mjs
```

Dedicated test cases cover positive and null synthetic fixtures; hash corruption; forged approval, source authentication, execution and scientific claim flags even when rehashed; participant/repository mismatches; malformed source SHA; parent drift; unknown schema/roles; inconsistent Keyhole actions; private prompt smuggling; and deliberate self-consistent fabrication. A static contract test verifies the local console's HTML, server's exact same-origin script allowlist and portable Windows ZIP allowlist include the modules.

**Real desktop/browser acceptance remains manual.** The new CI fixture tests cannot prove that a packaged Windows ZIP was launched on the operator's actual machine or that every interactive UI control works in a physical browser.

## Future integration

An independently generated public-synthetic PocketMesh fixture and its producing commit should be pinned in a follow-up PR and imported through all three receiving implementations. Actual source attestation, protected transport, physical data, decisions and approvals must be independently designed and explicitly authorized first.

**Capability ≠ authority. Ledger above ego.**
