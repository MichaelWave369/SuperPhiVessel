# PV-DLAM-0.1 — Distributed Local-Agent Memory Contract

**Status:** CANDIDATE / P0 CONTRACT  
**Runtime wiring:** UNWIRED  
**Date:** 2026-10-07

PV-DLAM-0.1 freezes the first Super Φ.Vessel contract for model-independent agent continuity, governed context composition, attributable routing outcomes, and local-first peer memory exchange.

This document is a contract and inventory boundary. It does **not** claim that the distributed memory service, learned router, peer synchronization, or NBG learned views are implemented in the canonical runtime.

## Design basis

The immediate design basis is **PHI369-DLAM-ARCH v0.1 Draft**, whose detached checker receipt records SHA-256:

`9d93490e07bc1d44d694c32f10990aff4f358761b777ace97cae7bc4bbafa412`

The contract also preserves current repository canon from Super Φ.Vessel, BrainC, NestedBubbleGear, and related local-memory work without silently declaring any one donor implementation authoritative.

## Core invariants

1. **CAPABILITY ≠ AUTHORITY.**
2. **MEMORY ≠ FACT.**
3. **RETRIEVAL ≠ PROMPT ADMISSION.**
4. **EVIDENCE TRANSPORT DOES NOT TRANSPORT AUTHORITY.**
5. **FORGETTING OUTRANKS RELEVANCE.**
6. **EXACT ADMITTED HISTORY OUTRANKS DERIVED VIEWS.**
7. **A GENIUS IS A ROLE AND CONTINUITY NAMESPACE, NOT A RESERVED MODEL.**
8. **THE MODEL IS A GUEST.**

Routing utility, repetition, model confidence, coalition agreement, or embedding similarity MUST NOT create permissions or factual promotion.

## Ownership model

Each participating machine owns one local memory service and one local database authority.

A node MAY contain many logical Agent and Genius namespaces. The full Genius roster MUST NOT require one database or one resident model per Genius.

A live SQLite/WAL database MUST NOT be replicated by sharing its files over the network. Peers exchange admitted application events and permitted objects through an explicit synchronization protocol.

## State classes

| State | Meaning | Model-swap behavior |
| --- | --- | --- |
| **L — exact admitted ledger** | Durable admitted events, source references, lineage, policy/history receipts | Preserved independently of generator |
| **M_t — working context** | Bounded task packet and unresolved work | Rebuilt and retokenized |
| **Episodic/project memory** | Outcomes, decisions, failures, timelines | Preserved as structured records |
| **Procedural memory** | Recipes, tool contracts, rollback/checklists | Rendered through the new adapter |
| **Retrieval indexes** | FTS, vectors, relation indexes | Rebuildable, separately versioned |
| **Routing state** | Empirical utility and uncertainty | Replaceable; exact changed model starts cold |
| **NBG Θ / learned residue** | Experimental learned projection/compression state | Optional sidecar; never factual or authority-bearing |

NBG relational/temporal projections MAY be derived from exact admitted history. Learned NBG residue remains optional until separately qualified.

## Memory capsule

A portable memory capsule is model-neutral. Its normative minimum structure is frozen in:

- `schemas/memory-capsule.schema.json`

The capsule separates:

- stable memory / namespace / agent / optional Genius identity;
- epistemic origin and source status;
- evidence and derivation parents;
- conflict/supersession relations;
- sensitivity, recipient/purpose restrictions, and retention;
- historical policy receipts from live permission.

A signature or content hash establishes byte identity/provenance only. It does not establish factual truth or current authority.

## Context composition

Retrieval is not prompt admission.

The context composer MUST evaluate current requester, namespace, purpose, recipient model/node, target surface, policy epoch, tombstone frontier, and token budget before model exposure.

The packet format is frozen in:

- `schemas/context-packet.schema.json`

A context packet is temporary, task-scoped, and non-authoritative. Its `action_authority` is fixed to `NONE`.

If critical admitted records do not fit the current model budget, the system MUST return an explicit insufficient-context outcome, choose another already-approved route, or pause. It MUST NOT silently drop critical records and fabricate continuity.

## Learned routing

Routing proceeds in this order:

1. task family and hard requirements;
2. eligible Genius profiles;
3. eligible exact model/recipe identities;
4. resource-feasible node;
5. bounded specialist or approved small coalition;
6. utility selection only inside the eligible set.

Hard eligibility includes policy, recipient/scope restrictions, model approval, modality/tool/schema capability, context fit, authority freshness, node health, resource budget, and deadline.

No predicted score MAY overcome exclusion.

P0 freezes the receipt shape in:

- `schemas/route-decision.schema.json`

Every route decision MUST preserve the candidate set, exclusions, router snapshot/version, selection probability when stochastic, resource state, context/policy/index frontiers, exact profile/model/recipe identities, and `authority_granted=false`.

### Learning lifecycle

The first activation path is:

`STATIC → SHADOW → QUALIFIED CANDIDATE → OPERATOR-ACTIVATED → ROLLBACKABLE`

Missing outcomes are censored, not positive samples. Unchosen routes receive no imaginary reward. Policy breaches are refusal/quarantine events, not costs that a learner may trade against answer quality.

## Model swaps

Generator identity is separate from Genius/agent identity.

A generator change MUST:

1. drain or cancel in-flight generations;
2. persist an explicit task checkpoint;
3. register the exact new model identity;
4. perform capability/schema/resource qualification;
5. rebuild context for the new tokenizer/template/context budget;
6. resume only under existing policy;
7. start fresh empirical routing statistics for the changed exact artifact.

A material change to weights, quantization, adapter, prompt template, or runtime behavior creates a new empirical model identity.

KV caches, hidden activations, and opaque model state do not cross unrelated model families.

## Embedding swaps

Embedding identity is independent from generator identity.

An encoder migration uses:

`REGISTER → DUAL-READ → REINDEX → QUALIFY → CUT OVER → ROLLBACK/PURGE`

Old and new vector spaces MUST NOT be compared directly as though equivalent. FTS/lexical retrieval remains the non-neural floor. Old vectors remain available for governed rollback until explicit purge.

## Peer synchronization

Peers are explicitly paired. Sync exchanges scoped signed events/objects, not live databases, opaque routing matrices, or transferable authority.

Concurrent incompatible claims remain visible. Timestamp last-write-wins MUST NOT resolve evidence disputes, policy, or canon.

Local capture MAY continue during partitions. Shared-sensitive reads/actions MUST pause when current owner authority cannot be established unless a separately qualified bounded offline lease exists.

## Forgetting and invalidation

A source deletion or owner-authorized tombstone MUST suppress every dependent active derivative until rebuilt from still-authorized inputs, including:

- summaries;
- embeddings and indexes;
- context packets/caches;
- routing datasets and snapshots;
- NBG maps/residue;
- exported active views under local control.

A tombstone MUST beat stale relevance and stale peer replay.

## P0 inventory boundary

`inventory.json` records currently identified donor systems and unresolved ownership questions. `ownership-crosswalk.json` and `OWNERSHIP_CROSSWALK.md` freeze the candidate division of responsibility across SuperPhiVessel, PhiOS, BrainC, NBG, Infinite Porch, and related donor work.

P0 is not complete until the canonical Genius roster has stable IDs and the current memory/runtime ownership crosswalk is reviewed. The present contract intentionally records those items as unresolved rather than inventing a count or mapping.

## Failure semantics

Governed operations prefer explicit:

`BLOCKED · HELD · FAILED · INSUFFICIENT · STALE · DEGRADED`

over successful-looking placeholders.

Required fallbacks include:

- lexical retrieval when vector infrastructure fails;
- static routing when learned routing is unavailable or unqualified;
- exact ledger operation when NBG learned views fail;
- local durable capture when permitted peer sync is unavailable;
- held shared-sensitive activation when authority or deletion frontier is stale.

## P0 acceptance

The deterministic P0 harness verifies:

- invariant text remains present;
- schemas remain parseable and require the frozen governance fields;
- route receipts cannot grant authority;
- context packets carry no action authority;
- inventory states runtime wiring as false;
- ownership crosswalk remains unwired and forbids duplicate canonical memory authority;
- transport, view, donor, and implementation-host roles do not inherit memory/action authority;
- unresolved Genius roster mapping remains explicit until completed.

Run:

```bash
node tests/dlam-v0.1.contract.test.js
```

Passing P0 proves only contract consistency. It does not prove runtime correctness, distributed security, useful learned routing, hardware performance, or NBG research success.
