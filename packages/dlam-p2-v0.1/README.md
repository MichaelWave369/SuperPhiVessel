# PV-DLAM P2 v0.1 — Scoped Signed Peer Synchronization

**Status:** P2 QUALIFIED / EXTRACTED + LIVE LOOPBACK INTEGRATION / CANONICAL RUNTIME UNWIRED
**Protocol:** PV-DLAM-P2-0.1
**Transport owner:** future Infinite Porch adapter
**Memory admission owner:** PV-DLAM local memory service

P2 begins the multi-node qualification path without sharing SQLite files and without allowing transport identity to become memory/action authority.

## Boundary

    local P1 memory
       ↓ explicit shared scope
    signed sync envelope
       ↓ replaceable transport
    paired peer
       ↓ signature + scope + epoch check
    local P1 admission

**Evidence transport does not transport authority.**

A valid Ed25519 signature establishes which paired peer signed an envelope. It does not establish factual truth, current action authority, or model authority.

## Crypto ownership

P2 does not own private keys. It accepts signer/verifier callbacks so the eventual Infinite Porch adapter can provide the existing peer identity and transport boundary.

The deterministic CI harness uses Node 22's built-in Ed25519 implementation behind that interface. No home-grown cryptography is introduced.

## What syncs in v0.1

Only two application object types are accepted: MEMORY_ADMIT and MEMORY_TOMBSTONE.

SQLite/WAL files, vectors, embedding caches, context packets, opaque routing matrices, KV caches, hidden model state, action authority, and provider grants are not accepted as canonical sync objects.

## Pairing and scopes

Every peer link pins a peer ID derived from its public key, the public key itself, ACTIVE/REVOKED state, a monotonic authority epoch, and explicit allowed scopes.

An envelope binds source, recipient, scope, epoch, sequence, object hash, and signature. Revocation increments the local epoch and rejects queued or stale envelopes under the old epoch.

## Local-first partitions

A partition does not stop local capture. Outgoing sync objects remain in a durable local outbox until a transport delivers them. No receiver-side state changes merely because an object was queued.

After reconnection, the same signed envelopes can be delivered and acknowledged.

## Replica identity

Remote claims are imported under collision-safe local IDs keyed by source peer, source memory ID, and signed object hash. The shared scope becomes the local replicated namespace.

Two peers may therefore present incompatible claims with the same source-local ID without one overwriting the other. There is no timestamp last-write-wins truth rule.

A same-peer rewrite of an already observed source ID with different content is quarantined rather than silently replacing the earlier claim.

## Tombstone precedence

Remote tombstones create a durable source-peer/source-ID frontier.

A tombstone may arrive before the corresponding older ADMIT object. If it does, the later stale ADMIT is suppressed rather than resurrected.

If the replica already exists, the local P1 tombstone path suppresses it and any locally materialized derived descendants.

## Relations

Remote source-local relation refs are retained in a pending relation table. When both endpoints from the same source peer are present, P2 can materialize evidence, contradiction, supersession, and derivation edges.

Missing relation endpoints remain pending rather than invented.

## Receipts

The receiver returns a signed receipt binding receiver peer, sender peer, envelope ID, import disposition, imported local IDs, and authority_granted=false.

The sender verifies that receipt before marking its outbox item ACKED.

## Infinite Porch relationship

Infinite Porch already provides the intended production-shaped donor boundary: Ed25519 device identities, explicit pairing/trust, bounded grants, encrypted peer transport, replay protection, durable revocation, and signed receipts.

P2 intentionally does not copy Porch networking into SuperPhiVessel. The eventual adapter should map a qualified Porch peer/grant/transport session onto this signer/verifier plus envelope exchange interface while leaving PV-DLAM responsible for memory admission.

## Run

    python3 packages/dlam-p2-v0.1/acceptance.py

The acceptance harness requires Python 3.12+ and Node 22+.

Passing this extracted harness does not prove physical-LAN, WAN-off, independent security review, or production network behavior. Those remain later qualification evidence.


## P2-B — Infinite Porch carrier adapter

P2-B now adds `porch_adapter.py`, which maps P2-A signed envelopes and receipts onto Infinite Porch 0.1.2's existing governed `message.send` surface.

Key properties:

- the Porch control API must be loopback HTTP;
- P2 peer IDs are explicitly bound to Porch peer IDs and a shared scope;
- the adapter never approves peers or issues/imports Porch grants;
- Porch `DELIVERED` or `QUEUED` is transport state only;
- the P2 outbox is ACKED only after a valid signed remote P2 receipt returns;
- ordinary Porch chat is ignored;
- a revoked adapter binding blocks send/receive;
- all adapter receipts remain non-authoritative.

The deterministic adapter harness uses a contract double for the documented Porch 0.1.2 message API. Live Porch daemon/network qualification remains P2-C.


## P2-C — live Infinite Porch closeout

P2-C adds `live_porch_acceptance.py`.

CI checks out the exact Infinite Porch source revision
`5e00f2dfa787331f1c6d03533db4bfd92c53536a`, builds the real `porch-node`
daemon, starts two independent daemon processes, and runs P2 traffic through
actual encrypted TCP/Noise loopback transport.

The closeout exercises:

- live Porch identities and provider-issued message grants;
- real P2 envelope + signed receipt round trips;
- Porch and PV-DLAM restart continuity;
- offline Porch queueing without false P2 acknowledgement;
- grant revocation before reconnect/retry;
- independent P2 authority-epoch advancement;
- stale P2 rejection even after fresh Porch transport authority;
- successful synchronization after both authority layers are refreshed.

This is a **native-hosted loopback** qualification only. Physical LAN, WAN/NAT,
native multi-machine, and independent security evidence remain outside the P2 claim.


## P2 qualification boundary

P2-A, P2-B, and P2-C now pass together in CI.

The qualified claim is intentionally narrow:

> PV-DLAM P2 is qualified for the extracted synchronization reference plus live
> native-hosted loopback integration against pinned Infinite Porch
> `5e00f2dfa787331f1c6d03533db4bfd92c53536a`.

This includes real daemon processes, encrypted/authenticated TCP/Noise loopback,
restart persistence, offline queueing, provider grant revocation, stale P2 epoch
rejection, rejected-carrier quarantine, signed application receipts, and
bidirectional recovery.

It does not establish physical LAN/WAN behavior, separate-machine qualification,
native Windows/macOS field evidence, or independent security review.
