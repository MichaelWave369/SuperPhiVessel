# PV-DLAM P2 Qualification Summary

**Status:** QUALIFIED EXTRACTED + LIVE NATIVE-HOSTED LOOPBACK REFERENCE  
**Protocol:** PV-DLAM-P2-0.1  
**Date:** 2026-10-07  
**Pinned Infinite Porch:** `5e00f2dfa787331f1c6d03533db4bfd92c53536a`

P2 extends the P1 model-independent continuity substrate across a governed peer transport while preserving independent memory authority.

## Qualified ladder

| Rung | Evidence |
| --- | --- |
| **P2-A** | Ed25519 signed/scoped memory + tombstone envelopes, replay/idempotency, conflict preservation, tombstone precedence, revocation epochs, no transitive authority |
| **P2-B** | Explicit P2↔Porch identity/scope binding onto Porch `message.send`; transport delivery separated from application ACK; adapter cannot mint trust/grants |
| **P2-C** | Real Porch daemon processes, encrypted/authenticated TCP/Noise loopback, restart continuity, outage queueing, provider grant revocation, stale P2 epoch refusal, rejected-carrier quarantine, refreshed recovery |

## Continuity statement

The qualified reference supports:

```text
Machine A local PV-DLAM
        ↓
signed scoped P2 envelope
        ↓
explicit P2 ↔ Porch binding
        ↓
Porch trust + message.direct grant
        ↓
encrypted authenticated peer transport
        ↓
Machine B Porch inbox
        ↓
P2 signature / scope / epoch gate
        ↓
Machine B local PV-DLAM admission
        ↓
signed P2 application receipt
        ↓
Porch return path
        ↓
Machine A P2 outbox ACK
```

## Independent authority layers

P2-C directly tests that transport freshness and application freshness are separate:

```text
fresh Porch grant
    does not
refresh stale P2 epoch

fresh P2 epoch
    does not
mint Porch transport authority
```

The receiver may therefore accept the transport bytes while refusing the memory admission.

## Poison-carrier handling

The first live P2-C run exposed a useful failure mode: a correctly rejected stale carrier remained in the Porch inbox and blocked processing of later valid carriers.

The adapter now records a durable non-authoritative quarantine result for rejected P2 carriers.

This preserves:

- rejection of the stale/invalid message;
- auditability;
- message-ID conflict detection;
- forward progress for later valid carriers;
- `authority_granted=false`.

## Qualification evidence

The final live gate reports:

```text
SUMMARY 16/16 PASS
```

and includes:

- persisted distinct Porch identities;
- encrypted/authenticated live loopback path;
- live P2 envelope and signed-receipt round trips;
- Porch daemon restart identity continuity;
- P2 SQLite pairing/binding/replica continuity;
- real outage queueing;
- provider grant revocation before retry;
- stale P2 epoch rejection after fresh Porch transport authority;
- successful sync after epoch refresh;
- verified Porch ledger chains;
- final bidirectional sync.

## What P2 does not establish

P2 completion does **not** establish:

- two physically separate machines;
- physical Ethernet/Wi-Fi LAN behavior;
- mDNS field qualification;
- WAN/NAT traversal;
- native Windows/macOS package behavior;
- production Internet exposure;
- independent security review;
- canonical monolithic Vessie runtime wiring.

Those remain P6 and later runtime-integration gates.

## Next sequence

The DLAM routing workstream can now proceed to:

1. **P3** — full-roster routing observability + Sparse Frontier shadow evidence;
2. **P4** — bounded learned routing with explicit operator activation and rollback;
3. **P5** — matched-baseline learned NBG evaluation;
4. **P6** — real-machine field pilot and external review.
