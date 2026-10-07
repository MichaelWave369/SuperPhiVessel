# Super Φ.Vessel ↔ BudgetGenius Bridge v0.1

**Status:** EXPERIMENTAL / EXTRACTED / CANONICAL RUNTIME UNWIRED  
**BudgetGenius pin:** `44ffc8ccd0f8eafb7130a3051215e536daaa4dce`  
**Date:** 2026-10-07

This package is the first explicit integration seam between Super Φ.Vessel and BudgetGenius.

It does **not** replace PV-DLAM routing, Sparse Frontier Routing, BrainC, NBG, Reality Gate, or the canonical Super Φ.Vessel runtime. It translates already-governed Super Φ.Vessel evidence into BudgetGenius-compatible economic inputs and proves the two repositories can interoperate against a pinned BudgetGenius commit.

## Ownership boundary

~~~text
Super Φ.Vessel / PV-DLAM
  exact memory/context/routing evidence
            |
            v
BudgetGenius bridge
  translation only, no authority minting
            |
            v
BudgetGenius
  cognitive economics / grants / accounting / policy
            |
            v
Super Φ.Vessel governed execution boundary
~~~

The bridge follows the existing Super Φ.Vessel rules:

- **CAPABILITY ≠ AUTHORITY**
- **RETRIEVAL ≠ PROMPT ADMISSION**
- **EVIDENCE TRANSPORT DOES NOT TRANSPORT AUTHORITY**
- **PROPOSAL ≠ EXECUTION**

## v0.1 mappings

### 1. PV-DLAM context packet → BudgetPacket input

A READY, CURRENT PV-DLAM context packet can be translated into a BudgetGenius typed packet.

- PV-DLAM policy/authority/frontier metadata becomes a `LOCKED` governance segment.
- Exact admitted memory items become `LOSSLESS` segments.
- the bridge exports an empty BudgetGenius authority scope because a PV-DLAM context packet has `action_authority=NONE`.
- ledger + policy frontiers become cache/freshness state.
- model/surface/index identity becomes environment state.

The bridge does not re-run retrieval and does not weaken PV-DLAM admission.

### 2. P3 routing observation + verified audit receipt → BudgetGenius calibration sample

P3 remains the source of Super Φ.Vessel routing observations.

The bridge will only emit a calibration sample when:

- P3 is still shadow-only,
- `may_change_live_route=false`,
- `authority_granted=false`,
- the BudgetGenius audit outcome is verified,
- causal cost is present.

A governance violation, critical miss, failed evidence requirement, or failed route becomes a negative learning sample.

This avoids creating a second competing routing observatory.

### 3. Sparse Frontier escalation → Cognitive Grant request

Sparse Frontier remains the uncertainty/escalation detector.

When SFR says `ESCALATE_INVESTIGATION`, the bridge emits a **grant request**, not a provider call.

BudgetGenius may then decide whether the bounded investigation is worth funding and which qualified route should perform it.

The translated request keeps:

- trigger reasons,
- bounded evidence/memory region,
- recommended Genius refs,
- frontier token budget,
- authority decision ref/status,
- `actionAuthority=NONE`.

## Cross-repository acceptance

CI checks out the pinned BudgetGenius commit, runs its own test suite, then runs this bridge acceptance harness.

The acceptance proves that:

1. a governed DLAM packet constructs a real BudgetGenius `BudgetPacket`;
2. no action authority appears during translation;
3. exact-cache scope remains freshness-bound;
4. verified P3 observations can populate BudgetGenius route calibration;
5. SFR escalation becomes a bounded Cognitive Grant request rather than direct frontier authority.

## Non-claims

Passing v0.1 does **not** mean:

- the canonical standalone runtime calls BudgetGenius,
- BudgetGenius owns Super Φ.Vessel routing,
- P3 learned routing is activated,
- Sparse Frontier thresholds are learned,
- BrainC is rewired,
- NBG learned residue is production-qualified,
- Reality Gate is already registered as a BudgetGenius verifier.

Those are later integration steps.
