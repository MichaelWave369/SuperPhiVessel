# Physical Observer v0.5: Promotion Dossier and Operator Review Gate

**Status:** QUALIFIED CANDIDATE / EXPLICIT OPERATOR REVIEW PENDING  
**Candidate:** `v2.0-alpha.11.0.54.13`  
**Current canonical:** `v2.0-alpha.11.0.54.12`  
**Browser qualification run:** [37730175204](https://github.com/MichaelWave369/SuperPhiVessel/actions/runs/37730175204)  
**Visual artifact:** [11529263628](https://github.com/MichaelWave369/SuperPhiVessel/actions/runs/37730175204/artifacts/11529263628)

This rung pins the exact candidate and browser-screen evidence from merged PR #33.
It deliberately **does not promote, publish, or install** a new canonical runtime.

## Pinned technical identity

| Artifact | SHA-256 |
|---|---|
| Current canonical `.54.12` | `a9e67b12d1c3622315b6937f1c2405acbd5b2a6bc6d32cf578c67d5178fa7212` |
| Qualified candidate `.54.13` | `8e5de54f8957c5060c3711f7756479811b69b07524de666c442442d936cdc66a` |
| Chromium desktop capture | `b105521e749f575f2eabd95c9c88672511e0853bd502774c58107253c3ebc3db` |
| Chromium mobile capture | `f74d8ed78e971fcef0fa6e6498ca6585b045a7307bfd13acac740fd023370567` |

The candidate is `13,363,622` bytes. Its Git blob SHA-1 is
`4b58af30e821ca1502e636b8166339464175afd9`.

These pins refer to the actual uploaded GitHub Actions artifact from the real
headless Chromium acceptance suite, not synthetic screenshot references.

## Browser qualification

PR #33 passed:

- 15/15 real Chromium browser checks;
- 10/10 generated candidate smoke checks;
- 16/16 observer runtime/replay checks;
- normal repository core-integrity qualification.

The browser check used synthetic physical episode memories created through the
real pinned NBG producer. This **does not** attest to any physical Raspberry Pi
board observation.

## Visual inspection notes, not operator approval

A technical review of the captured images found:

- desktop panel text was legible against the existing Vessie interface;
- mobile 390px panel remained on screen and displayed evidence legibly;
- the open floating panel obscures underlying chat controls by design;
- the pasted JSON takes significant vertical space and the panel scrolls.

No user/operator visual approval has yet been recorded. Visual inspection by an
assistant is **not** a substitute for an operator release decision.

## CI preflight

The preflight workflow regenerates the exact candidate from the pinned canonical
base and downloads the exact past Chromium run artifact. It verifies the candidate,
build receipt, desktop screenshot and mobile screenshot SHA-256 values.

The static promotion dossier always remains:

```text
operatorDecision = PENDING
operatorVisualReviewComplete = false
candidatePromoted = false
```

If someone edits the dossier to claim an approval, turns on hardware authority,
changes the canonical manifest, or swaps a screenshot, the preflight refuses it.

A passing preflight intentionally reports:

```text
HOLD_FOR_EXPLICIT_OPERATOR_REVIEW
canPromote = false
mayUpdateCanonicalManifest = false
mayDeployProduction = false
```

No GitHub Actions job in this rung changes release or deployment state.

## Next separate release rung

After the operator reviews the evidence, a separate release PR can include:

1. the exact candidate HTML bytes under the canonical runtime directory;
2. a matching `runtime/MANIFEST.json` version, size, SHA-256, and Git blob;
3. a `docs/releases/v2.0-alpha.11.0.54.13.md` release note;
4. verification that current BudgetGenius routing, actuator safety, and
   `authorizeExecutor` remain unchanged;
5. explicit human-reviewed deployment authorization.

That PR must be independently reviewable and cannot use a checkbox in this
dossier as a surrogate for actual authorization.

## Known limits

- NBG's FNV fingerprint is a structural integrity check, not a cryptographic
  proof of a trusted physical source.
- Headless Chromium qualification is not live Netlify/production qualification.
- The screenshots are retained temporarily by GitHub Actions and must be
  regenerated under the same gates if the artifact expires.
- No production telemetry, Pi5 dual-board boot, physical action or safety
  qualification is asserted.

```text
candidate qualified != candidate released
screenshot inspected != operator approved
memory evidence != physical authorization
headless browser pass != live hardware qualification
```
