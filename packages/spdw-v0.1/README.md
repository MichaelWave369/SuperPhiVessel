# SPD-W v0.1.0

**Status: EXPERIMENTAL / UNWIRED**

Source Provenance Differential Weighting (SPD-W) is a deterministic pre-promotion gate candidate for the Super Φ.Vessel Promotion Firewall / Reality Ledger path.

It is preserved here as a tested standalone package. **Presence in this repository does not mean it is integrated into the canonical v2.0-alpha.11.0.54.7 runtime.**

## Verification

Frozen acceptance command:

```bash
node spdw-v0.1.acceptance.js
```

Expected result:

```text
SUMMARY 31/31 PASS
```

The imported harness was independently re-run during repository normalization on 2026-09-29 and produced `31/31 PASS`.

## Files

- `spdw-v0.1.js` — deterministic SPD-W engine
- `spdw-v0.1.acceptance.js` — frozen Node acceptance harness
- `SPD-W_v0.1_SPEC.md` — design boundary and proposed runtime seam
- `SPD-W_v0.1_ACCEPTANCE_CONTRACT.md` — structured acceptance contract
- `spdw-integration-snippet.js` — **integration sketch only**
- `test-vectors.json` — frozen acceptance metadata
- `VERIFICATION.md` — repository import/verification record

## Integration boundary

Deterministic software owns promotion eligibility. Model prose may propose source classes or claims but must not override an SPD-W `BLOCK` or `REQUIRE_EVIDENCE` result.

Before SPD-W can move from **UNWIRED** to **LIVE**, it must be deliberately bound into the current Promotion Firewall and covered by runtime-level regressions.
