# Vessie R3-F: offline signed-custody batch audit

**Status:** LOCAL-ONLY / READ-ONLY / SIGNATURE-VERIFIED OPERATOR CUSTODY /
RUNTIME SOURCE UNATTESTED / NO LEARNER REWARDS

R3-E (#43) allows operator-signing a redacted R3-C/R3-D projection. R3-F
adds **one batch-wide review** of up to 32 independently verifiable R3-E
packets. This avoids mistaking duplicate signings, repeated redacted
evidence, or conflicting terminal results for independent successes.

## What R3-F establishes

Given a **public key obtained and independently verified outside the
packet**, the offline verifier:

- Validates **each** R3-E packet using the unchanged R3-E signature and
  restricted projection checks. One invalid packet fails the **entire**
  audit, not merely one row.
- Flags exact signed-packet ID replays **within the submitted batch**.
- Flags packet-ID reuse where different contents have been validly
  signed. This does not prove the original runtime caused the collision.
- Flags duplicate redacted projection checksums. Two distinct real
  requests can produce the same redacted summary, so identical
  projection checksums **cannot establish that the requests were the
  same**. Independence of those samples is unproven.
- Flags regressions in *operator-declared signing timestamps*, not a
  verified clock or real execution timeline.
- Preserves `MIXED_TERMINAL_RECORDS_UNRESOLVED` as a review condition.
- Never reports model quality, GA108 competency, real inference success,
  a source-authenticated runtime trace, or learned route promotion.

`OPERATOR_SIGNATURES_VERIFIED_SOURCE_UNATTESTED` is the cleanest
possible outcome here. It means only the signatures and structural
checks passed with no **detected within-batch anomalies**. It is **not**
an operator-approved model execution, R2 field qualification, runtime
attestation, an independent experiment or permission to update P4.

## Quick local usage (Windows PowerShell)

Prerequisite: review the [R3-E operator-key workflow](OPERATOR_ENVELOPE_R3E.md)
and generate operator-signed redacted `r3e-operator-envelope*.json` files.
**Do not include private keys, full run capsules or raw memory.**

Build one local input JSON file with packets copied from R3-E. For example,
within a private local folder:

```powershell
$vault = Join-Path $env:USERPROFILE ".vessie-offline"
$paths = @(
  (Join-Path $vault "r3e-operator-envelope-1.json"),
  (Join-Path $vault "r3e-operator-envelope-2.json")
)
$packets = @($paths | ForEach-Object { Get-Content -Raw -Path $_ | ConvertFrom-Json })
$batch = [ordered]@{
  schema = "superphivessel.gateway.r3f.batch-input.v0.1"
  envelopes = $packets
}
$batch | ConvertTo-Json -Depth 32 |
  Set-Content -Path (Join-Path $vault "r3f-batch.json") -Encoding utf8
```

That creates a file consisting only of already-redacted signed envelopes.
The example does **not** automatically discover files or access Vessie's
private ledger. The operator explicitly chooses the input paths.

Run from the repository root:

```powershell
node packages/vessie-gateway-v0.1/canonical-routes/custody-batch-cli.mjs --input "$vault\r3f-batch.json" --public-key "$vault\operator-public.pem"
```

The verifier never sends traffic or writes any files. It outputs a
generic aggregate report without prompts, full source receipts, model
names, signer private keys, signatures, runtime IDs, raw attempt IDs,
provider credentials, task hashes or Windows device identifiers.

Exit codes: `0` for signature-valid batch with no detected anomalies,
`3` for a signature-valid batch requiring review, `2` for invalid
input, tampering, wrong key, malformed structure, or signature failure.
**Exit 0 is not a live-promotion gate.**

## Safety boundaries

- The assessment is limited to **one provided batch**. It has no disk
  replay registry, shared counter, clock source, non-repudiation identity
  proof, or cross-batch replay protection.
- No signature can establish that Vessie actually ran the task, or that
  an answer was correct. Source data can be wrong even when accurately
  signed by the operator.
- No source-specific retry chains can be recovered: canonical `.54.12`
  has not yet been promoted with a verified, correlated export seam.
- Source duplication and duplicate redacted summaries are not equivalent.
  The latter is reported as **independence unproven** rather than proof
  of replay.
- R2's Windows HTTPS/browser field qualification remains outstanding.
  This PR neither changes browser certificates nor exposes a local
  network endpoint.
- The canonical 13 MB runtime and `runtime/MANIFEST.json` are unchanged.
  BrainC model control, BudgetGenius, Physical Observer `.54.13` hold,
  P4 activation and any paid-provider permissions remain untouched.
- The React public inspector recognizes this **unverified import
  schema**, but cannot run Ed25519 verification or grant authority.

## Acceptance

```powershell
node --test packages/vessie-gateway-v0.1/canonical-routes/tests/custody-batch.test.mjs
node --test packages/vessie-gateway-v0.1/canonical-routes/tests/operator-envelope.test.mjs
npm test --prefix apps/vessie-web
```

All tests use fixtures and ephemeral test signing keys. A green CI job
proves only code behavior, not physical Windows pairing or trustworthy
live execution.

## Next required work

Complete the real [R2 Windows browser field pilot](../pilots/README.md)
and collect operator-reviewed evidence. For genuine live trace
qualification, separately design and review a minimal canonical runtime
export method, cryptographic source binding, and native attempt/retry
correlation. **Do not train or automatically promote routing on these
redacted operator-custody receipts.**

Ledger above ego. Capability ≠ authority.
