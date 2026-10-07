# SCM v0.8 Source Mapping for PV-DLAM-0.1

**Status:** P0 SOURCE IDENTITY FROZEN  
**Source bytes mirrored here:** NO  
**Date:** 2026-10-07

PV-DLAM-0.1 inherited several retrieval and context-composition boundaries from **Sovereign Continuity Memory v0.8**. P0 originally left its exact source/repository mapping unresolved rather than guessing which later memory repository represented that document.

The exact source artifact has now been located and byte-identified.

## Source identity

- **File:** `Sovereign_Continuity_Memory_Master_Spec_v0_8.docx`
- **Title:** Sovereign Continuity Memory Master Spec v0.8 — Retrieval, Compression & Resonance Routing
- **Status in source:** internal master spec / architectural mapping
- **Modified:** 2026-05-14
- **Size:** 597,280 bytes
- **SHA-256:** `cf55a10e16772e302464b7d9a4630c7d2d795bb48e727f59cea06543d6b7a7d3`

The source bytes are intentionally **not** committed to this public repository. This mapping freezes identity and design lineage without publishing an internal source document.

## Repository mapping result

No canonical GitHub repository implementation is established by the v0.8 source document or the current source inventory.

Therefore:

- `sovereign-memory-lattice` remains a **related design donor**;
- it MUST NOT be relabeled as “the SCM v0.8 implementation” without new evidence;
- PV-DLAM inherits only the explicitly mapped architectural boundaries, not an implementation claim.

## Inherited v0.8 boundaries

The source defines memory activation as policy-aware retrieval rather than volume recall. The following boundaries are carried into PV-DLAM:

1. **Policy and forgetting gate before ranking.** High relevance cannot revive forbidden or tombstoned material.
2. **Context packets are temporary views.** A task/surface-specific packet is not the memory store and is not reusable across targets without re-admission.
3. **Compression preserves provenance.** Claim class, source refs, contradiction markers, and forgetting constraints survive compression.
4. **Bridge targets receive filtered packets.** PhiOS, Vessel, BrainC, and other targets do not receive raw memory merely because it exists.
5. **Ranking is not truth.** Resonance/utility scores influence activation only inside the permitted set.
6. **Receipts bind the activation path.** Query, routing, filtering, ranking, compression, and final packet composition remain inspectable.

## P0 conclusion

With:

- the PV-DLAM contract and schemas frozen;
- the ownership/migration crosswalk merged;
- the canonical GA108 roster exported with stable identities;
- the SCM v0.8 source artifact byte-identified and repository ambiguity preserved rather than invented;

**PV-DLAM P0 is complete.**

This does not mean the runtime is implemented. It means the contract/inventory phase has enough identity and ownership discipline to begin **P1 — one-node continuity**.

Remaining open items move forward as implementation gates:

- Vessie ↔ BrainC ↔ PhiOS bridge authentication/origin policy before live bridge wiring;
- exact model/embedding qualification against real local hardware;
- P1 durability, retrieval, context, model-swap, forgetting, and recovery evidence.

