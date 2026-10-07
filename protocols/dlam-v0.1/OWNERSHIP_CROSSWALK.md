# PV-DLAM-0.1 Ownership and Migration Crosswalk

**Status:** CANDIDATE FOR REVIEW  
**Runtime wiring:** UNWIRED  
**Date:** 2026-10-07

This crosswalk answers a deceptively dangerous question: **which project owns which responsibility once the memory architecture is integrated?**

Without this boundary, Super Φ.Vessel, BrainC, PhiOS, NBG, Infinite Porch, and older memory work could each grow a second "canonical" memory or authority path. That would make continuity look impressive right up until two stores disagree and both insist they are reality.

The machine-readable form is `ownership-crosswalk.json`.

## Target ownership

| Concern | Target owner | Role | Does not inherit |
| --- | --- | --- | --- |
| Operator orchestration + Genius registry | **SuperPhiVessel** | Genius profiles, Crane Fly/BrainC request surfaces, context requests, receipts/UI | canonical memory DB, peer transport, execution authority |
| Governed memory + integrated execution revalidation | **PhiOS** | target canonical memory/admission contract, evidence/authority separation, Reality Ledger/execution boundary | Genius definition, peer transport, automatic routing authority |
| P1 reference memory service | **BrainC** | FastAPI/SQLite/Ollama implementation donor and likely first service host | final policy authority merely because it hosts code |
| Epistemic/temporal/relational views | **NestedBubbleGear** | provenance vocabulary, temporal lineage, deterministic NBG projections, optional Θ research | source-of-truth ledger, permission authority, required baseline dependency |
| Scoped peer transport | **Infinite-Porch** | identity/pairing/transport candidate for later sync | memory truth, factual authority, transferable application authority |
| Related design donor | **sovereign-memory-lattice** | packet, role-cognition, council/adjudication reference | production PV-DLAM authority; identity with unresolved SCM v0.8 |

## One canonical truth target

For a given PV-DLAM namespace/frontier, there is exactly **one writable canonical admitted-history target**.

Legacy stores may remain readable during migration. They may even disagree. They do not become co-equal writable truths.

```text
legacy Vessie memory ─┐
BrainC memory ────────┼──> versioned import/admission ──> one canonical PV-DLAM target
PhiOS memory ─────────┤
NBG experiment data ──┤
other donor stores ───┘
```

Every import keeps source-system identity and an import receipt. Migration is not factual promotion.

## BrainC versus PhiOS

There is an important distinction rather than a conflict:

- **BrainC** is the strongest current donor for the first P1 local service because it already has FastAPI, Ollama, SQLite memory, migrations, backup, auth, queues, and model switching.
- **PhiOS** already states that canonical governed memory belongs to PhiOS and separates canonical records from current context admissibility.

Therefore P1 may be implemented beside BrainC **without declaring BrainC the final authority owner**. The service contract must remain portable so the integrated stack can land behind the PhiOS governed-memory/authority boundary without changing memory IDs or inventing a second ledger.

This is a migration architecture, not a claim that the integration already exists.

## SuperPhiVessel

SuperPhiVessel owns the operator-facing cognitive composition:

```text
operator
  ↓
Genius profile / task / chamber
  ↓
context request
  ↓
BrainC route request
  ↓
bounded model capability
  ↓
receipt / review
```

Its Genius Atlas and Crane Fly surfaces can become the logical registry and routing UX, but they do not own the canonical database simply because they can request or display memories.

## NBG

NBG has two distinct roles:

1. **deterministic structural/temporal projections** over admitted history;
2. **learned Θ/residue**, which remains an optional research sidecar.

The first can become a production candidate. The second cannot become a dependency for baseline memory, governance, deletion, or recall until separately qualified.

If learned NBG views disappear, the exact admitted ledger and ordinary retrieval path must still operate.

## Infinite Porch

Infinite Porch is a strong future candidate for the peer-transport layer because it already has explicit peer identity, pairing, bounded grants, local-first behavior, signed receipts, and qualified network transports.

But the DLAM seam is deliberately narrow:

```text
PV-DLAM memory service
        ↓ scoped export
Porch transport
        ↓ scoped delivery
remote PV-DLAM admission
```

Transport authorization is not factual promotion. A peer relationship or Porch grant does not become a PV-DLAM/PhiOS memory or action grant simply because bytes arrived successfully.

## Migration rules

1. P1 can begin beside BrainC but uses PV-DLAM IDs, capsules, packets, receipts, and migration manifests.
2. Existing stores are donors until explicitly imported.
3. Import retains source identity, epistemic origin, lineage, restrictions, and a migration receipt.
4. Multiple readable legacy sources are allowed temporarily; two writable canonical targets for the same namespace/frontier are not.
5. Peer sync through Infinite Porch remains future/conditional until adapter and security qualification.
6. No migration may silently turn historical permissions into live authority.
7. No migration may collapse contradictory claims merely to make stores converge.

## Remaining P0 blockers

This crosswalk resolves the **shape** of system ownership, but P0 still cannot close because:

- the canonical full Genius roster still needs a stable-ID export;
- the exact SCM v0.8 source artifact/repository mapping remains unresolved;
- bridge authentication/origin ownership must be frozen before P1 wiring.

The contract should prefer an explicit unresolved item over assigning authority to whichever repository happens to have the most convenient SQLite file this week.
