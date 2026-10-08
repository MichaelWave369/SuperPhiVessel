# Vessie R3-E · Operator-Signed Offline Evidence Envelope

**Status:** OFFLINE / OPERATOR-CUSTODY ONLY / NO CANONICAL EXPORT SEAM / NO LIVE TELEMETRY

## Purpose

After R3-C (#41) and R3-D (#42), Vessie can safely distinguish
configured/selected, authorized, attempted, and *recorded but unverified*
completion/failure evidence. R3-E lets an operator sign a **redacted R3-C
projection** with a local Ed25519 private key. A separate reviewer can check
that signature against an **independently trusted public key**.

This is chain-of-custody evidence **from the signer forward**. It is not proof
that source records originated in the real Vessie runtime, that the signer
was physically present, that a model performed inference, or that any output
was correct. An operator can sign inaccurate or fabricated input. There is
no cryptographic runtime-origin attestation or replay-prevention registry.

No existing production HTML, canonical manifest, BrainC, model route, paid
provider, memory storage, session, browser gateway, P4 learner, BudgetGenius,
or Physical Observer authority is changed.

## What is signed

The local CLI:
1. Reads at most 256 KiB of **already legitimately exported** native receipt
   JSON from a path provided explicitly by the operator. R3-E does not scrape
   browser storage, discover private ledgers, or create an export endpoint.
2. Requires `--operator-reviewed` to acknowledge a human local review. This
   switch is a recorded declaration, **not proof of informed consent**.
3. Runs the **same R3-C projector** with `operatorNames:false` and checks its
   exact 42-field projection allowlist, safe flags, terminal consistency,
   and self-checksum.
4. Adds a fresh packet ID and timestamp and signs the packet plus signer
   metadata with local Ed25519.
5. Writes a new file exclusively. It refuses to overwrite an existing file.
   The private key never enters the packet.

A signed packet has **no embedded public key**. The verifier requires the
public key to be supplied separately; otherwise an attacker could simply
create their own key and packet and claim that self-verification equals trust.

The signature covers a purpose-separated UTF-8 serialization of the exact
signed packet and signer metadata. Packet normalization or reordering by other
tools can invalidate the signature. The signature does **not** make the
underlying `fastHash` fields authentic; the projector's SHA-256 remains a
self-checksum and the operator's signature is only an operator-custody claim.

## Operator-local Windows workflow

Requires Node 22+ and a local SuperPhiVessel checkout. Keep the key and raw
receipts outside Git, GitHub Pages, cloud backups without suitable security,
issues, screenshots, and chats.

### 1. Create a private keypair

PowerShell (example folder in the operator's Windows profile):

```powershell
$vault = Join-Path $env:USERPROFILE ".vessie-offline"
New-Item -ItemType Directory -Force -Path $vault | Out-Null
$private = Join-Path $vault "operator-private.pem"
$public  = Join-Path $vault "operator-public.pem"
node -e 'const fs=require("node:fs");const c=require("node:crypto");const k=c.generateKeyPairSync("ed25519");fs.writeFileSync(process.argv[1],k.privateKey.export({type:"pkcs8",format:"pem"}),{flag:"wx",mode:0o600});fs.writeFileSync(process.argv[2],k.publicKey.export({type:"spki",format:"pem"}),{flag:"wx",mode:0o600})' "$private" "$public"
```

This creates an **unencrypted PEM private key**. POSIX `0600` does not
replace proper Windows NTFS ACLs. Review the private key file's permissions
and protect the user profile; use full-disk encryption when possible. Never
commit the key. The public key can be shared with a verifier using an
independent trusted channel. If either key file already exists the command
refuses to overwrite it.

### 2. Obtain source input through an explicitly approved local method

R3-E does **not** provide one. If there is no approved native receipt-export
path yet, **stop here**. Do not paste browser localStorage, private Vessie
memory, user prompts, credentials, or whole raw ledgers into a terminal
command, repository, issue, or chat. R2 Windows browser-pairing qualification
remains outstanding.

Expected source fields match [R3-C](README.md): `runCapsule`, optional
`brainRoute`, optional `authorization`, optional `attempts`, and optional
`budgetGeniusInfluence`.

### 3. Sign a local redacted evidence packet

After reviewing the source locally, run:

```powershell
node packages/vessie-gateway-v0.1/canonical-routes/operator-envelope-cli.mjs pack --input "$vault\approved-routing-input.json" --private-key "$private" --output "$vault\r3e-operator-envelope.json" --operator-reviewed
```

This creates only the redacted envelope; raw receipt input is **not**
deleted automatically. You must manage its retention yourself. The command
prints only bounded custody metadata and never prints private material.

### 4. Verify with independently trusted public key

On a second local checkout, with a public key whose fingerprint you have
confirmed out-of-band:

```powershell
node packages/vessie-gateway-v0.1/canonical-routes/operator-envelope-cli.mjs verify --input "$vault\r3e-operator-envelope.json" --public-key "$public"
```

The verifier prints a redacted report:

```text
operator_signature_verified = true
trusted_operator_key_matched = true
runtime_origin_verified = false
source_authenticity_attested = false
independent_execution_confirmation = false
independently_verified_answer_quality = false
live_trace_export_connected = false
can_execute = false
may_change_live_route = false
authority_granted = false
```

An invalid, mismatched, non-Ed25519, modified, or untrusted signing key is
refused. A **valid signature does not mean** trusted runtime source or
model success. Do not use the packet as a P4 reward, production routing
promotion, BudgetGenius quality signal or executor authorization.

### 5. Optional browser inspector

The GitHub Pages React receipt inspector recognizes the R3-E schema when
pasted, but **does not cryptographically verify the signature**, nor display
raw nested data. It stays `UNVERIFIED_IMPORT` or `REVIEW_REQUIRED`.

## Acceptance and next gate

```powershell
node --test packages/vessie-gateway-v0.1/canonical-routes/tests/operator-envelope.test.mjs
node --test packages/vessie-gateway-v0.1/canonical-routes/tests/projector.test.mjs
npm test --prefix apps/vessie-web
```

All tests are synthetic. CI proves implementation behavior, **not** that a
Windows browser can connect to HTTPS localhost or that a physical export
came from the canonical runtime. No new network listener was added.

For a later R3-F candidate, first complete R2 physical field evidence,
specify an operator-approved export mechanism at the real canonical runtime
boundary, bind attempt/retry lineage to stable per-request IDs, and
independently review source trust and redaction. Until those gates are met,
R3-E is only an optional local custody wrapper around existing offline
projections.

**Ledger above ego. Capability is not authority.**
