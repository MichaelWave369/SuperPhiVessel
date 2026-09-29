# Structured Acceptance Test Contract — SPD-W v0.1.0

Contract ID: `SPDW_V0_1_SATC`

## Boundary

This contract validates deterministic provenance/promotion gating only. It does not validate truth, model quality, semantic correctness, or empirical validity of a claim.

## Acceptance criteria

### SATC-01 — Frozen acceptance vector pass rate
- **METRIC:** acceptance vector pass count
- **OPERATOR:** =
- **TARGET:** 31
- **UNIT:** tests
- **METHOD:** execute `node spdw-v0.1.acceptance.js`; parse `SUMMARY 31/31 PASS`

### SATC-02 — Unknown class fail-closed coverage
- **METRIC:** invalid source/target cases returning `BLOCK`
- **OPERATOR:** =
- **TARGET:** 2
- **UNIT:** cases
- **METHOD:** execute C24 and C30 in frozen acceptance script and verify `FAIL_CLOSED_UNKNOWN_CLASS`

### SATC-03 — Direct observation custody enforcement
- **METRIC:** non-direct/non-observed attempts to reach `OBSERVED` returning `BLOCK`
- **OPERATOR:** =
- **TARGET:** 3
- **UNIT:** cases
- **METHOD:** execute C08, C18, and C29; all must return `BLOCK`

### SATC-04 — Human authority non-delegation
- **METRIC:** authorization attempt without Human Commitment Write returning `BLOCK`
- **OPERATOR:** =
- **TARGET:** 1
- **UNIT:** case
- **METHOD:** execute C22; verify `HUMAN_AUTHORITY_REQUIRED` and `HUMAN_COMMITMENT_WRITE` in missing requirements

### SATC-05 — Valid human authorization path
- **METRIC:** fully gated authorization case returning `ALLOW`
- **OPERATOR:** =
- **TARGET:** 1
- **UNIT:** case
- **METHOD:** execute C23 with `currentState=ACTIONABLE`, acceptance PASS, Reality Gate PASS, and `humanCommitment=true`

### SATC-06 — Deterministic receipt identity
- **METRIC:** repeated identical inputs yielding identical receipt hash
- **OPERATOR:** =
- **TARGET:** true
- **UNIT:** Boolean
- **METHOD:** execute C31; compare two independently evaluated receipt hashes from identical inputs

### SATC-07 — Analogy boundary
- **METRIC:** symbolic/interpreted hypothesis formation allowed without being treated as evidence
- **OPERATOR:** =
- **TARGET:** 2
- **UNIT:** cases
- **METHOD:** execute C02 and C09; both must return `WARN` with rule `HYPOTHESIS_FORMATION`

### SATC-08 — Tested-state evidence requirement
- **METRIC:** non-test-result sources blocked from `TESTED`
- **OPERATOR:** =
- **TARGET:** 2
- **UNIT:** cases
- **METHOD:** execute C05 and C13; both must return `BLOCK`; C14 must return `ALLOW`

## Promotion rules under test

- `BLOCK` => `promotionEligible=false`, promotion decision `BLOCK_PROMOTION`
- `REQUIRE_EVIDENCE` => `promotionEligible=false`, promotion decision `HOLD_CURRENT_STATE`
- `WARN` => promotion may proceed only with the SPD-W receipt attached
- `ALLOW` => SPD-W adds no additional block; existing Promotion Firewall / Reality Gate remain authoritative

## Failure modes

- unknown source or target class => fail closed
- missing provenance => fail closed for any non-symbolic promotion
- semantic classifier assigns wrong source class => outside v0.1; receipt remains deterministic but input classification may be wrong
- FNV-1a collision => receipt identity collision possible; current hash is explicitly non-cryptographic and must not replace custody hashes
