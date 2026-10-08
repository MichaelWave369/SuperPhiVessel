# PhiBot Physical Observer Canonical Candidate v0.3

**Status:** EXPERIMENTAL / CANDIDATE ONLY / OPERATOR-TRIGGERED / DEFAULT-OFF  
**Canonical base:** `v2.0-alpha.11.0.54.12`  
**Base SHA-256:** `a9e67b12d1c3622315b6937f1c2405acbd5b2a6bc6d32cf578c67d5178fa7212`  
**Candidate version:** `v2.0-alpha.11.0.54.13`  
**Canonical promotion:** **NOT performed by this PR**

This candidate is the first proposed physical-observer interface inside the actual standalone
Super Phi.Vessel HTML. It adds a physically isolated, operator-opened observer panel.

The currently published runtime, canonical manifest, deployment, and release records remain
unchanged until a separate promotion.

## What the operator can do

1. Open the floating **Physical Observer** control.
2. Paste an NBG `phibot-physical-experience-handoff/v0.1` JSON packet.
3. Select **Review evidence**.
4. Read the approved advisory-only questions, evidence references, uncertainty, and receipt.
5. Clear the in-memory view and import buffer.

Nothing listens for messages in the background. There is no autonomous
networking, hardware access, polling, or tool invocation.

The panel uses a closed Shadow DOM to avoid inheriting the enormous monolithic
runtime's CSS. Untrusted text is rendered with `textContent`, not `innerHTML`.

## Integrity and authority

The browser-native v0.2 receiver is embedded exactly as source with its module
`export` declarations stripped. Its NBG fingerprint gate, no-tool boundary, and
Web Crypto display receipts remain in place.

**Important limitation:** NBG FNV fingerprints are not cryptographic signatures.
A structurally valid imported packet is not proof that it came from a trusted device,
and a source journal digest in an evidence reference is not independent source verification.
The UI warns about this explicitly. No physical authority is conveyed.

The panel shows only:

- read-only investigation questions;
- read-only observation suggestions;
- evidence memory IDs and evidence IDs;
- uncertainty markers;
- a no-authority banner;
- receipt SHA-256.

It does not present a root-cause diagnosis or maintenance instruction.

## Reproducible candidate build

On a checkout containing the pinned canonical base:

```bash
node scripts/build-phibot-physical-observer-candidate-v0.3.mjs /tmp/PhiVessel_54_13_Physical_Observer_Candidate.html
node packages/phibot-physical-observer-v0.3/acceptance.mjs /tmp/PhiVessel_54_13_Physical_Observer_Candidate.html
```

The builder refuses any canonical base other than the pinned `.54.12` bytes.
It inserts exactly one module script immediately before `</body>` and updates only the runtime version marker.

Then it reverses those two edits in memory and demands an exact equality match
against the original 13 MB HTML. Any unexpected change fails the build.

The output is an HTML candidate and a `.build.json` checksum report.
Neither is written into the canonical runtime directory by this PR.

## CI artifact

The dedicated GitHub Actions workflow:

- verifies the real pinned NBG + v0.2 receiver integration;
- builds the HTML candidate from canonical source;
- performs ten candidate smoke checks;
- uploads the candidate and checksum report as a review-only CI artifact.

The smoke harness verifies that the panel is hidden until the operator opens it,
invalid JSON visibly refuses, and clearing the panel erases transient input.

This is an early UI smoke test, **not** full browser or live production qualification.

## Replay isolation repair

This rung also repairs a v0.2 receiver-state bug:

- clearing a view now clears the per-instance replay cache;
- replay of an older handoff ID cannot return the latest *different* handoff's view.

Dedicated regression checks extend v0.2 acceptance from 14 to 16 cases.

## Promotion gate

Do not promote the candidate merely because the CI builder is green.

A later gated PR must verify the complete generated HTML, visually exercise it
in a real browser, confirm the canonical manifest digests and release records,
and then explicitly promote the candidate.

In particular, adding this viewer does not establish that any real Raspberry Pi
telemetry has been captured or that real Pi5 field qualification is complete.

## Nonclaims

```text
candidate built != canonical release
panel present != autonomous agent runtime
import accepted != authenticated producer
evidence reference != verified source
observer view != diagnosis
advisory != hardware permission
```
