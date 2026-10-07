# PV-DLAM P2-C — Live Infinite Porch Loopback Closeout

**Status:** CANDIDATE  
**Protocol:** PV-DLAM-P2-0.1  
**Porch source pin:** `MichaelWave369/Infinite-Porch@5e00f2dfa787331f1c6d03533db4bfd92c53536a`  
**Environment claim:** native hosted loopback only

P2-C integrates the P2-A synchronization contract and P2-B adapter with **real Infinite Porch daemon processes and real encrypted peer transport**.

It is deliberately not presented as physical-LAN or WAN qualification.

## CI topology

The qualification job:

1. checks out the pinned Infinite Porch source;
2. builds `porch-node` from the pinned Cargo lockfile;
3. starts two independent Porch daemon processes;
4. creates persisted Porch identities;
5. forms explicit trust/community state;
6. issues provider-owned `message.direct / inbox / send` grants in both directions;
7. uses actual Porch TCP/Noise loopback transport;
8. runs PV-DLAM P2 envelopes and receipts through the live Porch APIs;
9. restarts a Porch daemon and the receiving P2 service objects;
10. creates an outage, queues a real Porch message, revokes authority before retry, and verifies fail-closed behavior;
11. refreshes transport authority while keeping the original P2 envelope stale;
12. proves fresh Porch transport cannot override the stale PV-DLAM authority epoch;
13. advances the P2 authority epoch and proves new synchronization resumes.

## Authority layers

P2-C deliberately exercises two independent freshness boundaries:

```text
Porch authority
  peer trust + message.direct grant
        ↓
transport may carry bytes
        ↓
PV-DLAM authority
  paired identity + scope + authority_epoch
        ↓
memory may be admitted
```

A fresh Porch grant does not refresh a stale PV-DLAM envelope.

A fresh P2 epoch does not mint a Porch grant.

Neither layer grants action authority.

## Partition / revocation scenario

The critical negative-control sequence is:

```text
A creates signed P2 envelope at epoch 1
        ↓
Porch B goes offline
        ↓
Porch A queues carrier
        ↓
Porch B restarts
        ↓
B revokes old Porch message grant
B advances P2 peer epoch to 2
        ↓
Porch retry => REFUSED by revoked provider grant
        ↓
requester retires stale imported Porch grant copy
fresh Porch message grant issued/imported
        ↓
same old epoch-1 P2 envelope is transported
        ↓
PV-DLAM refuses stale authority epoch
        ↓
sender advances P2 epoch to 2
        ↓
new envelope succeeds
```

This proves that transport recovery does not silently resurrect stale application authority.

## Restart behavior

The live closeout also checks:

- Porch peer identity persists across daemon restart;
- PV-DLAM P2 pairing/binding/replica state persists in SQLite;
- synchronization resumes after both layers restart;
- Porch signed ledger verification remains clean;
- bidirectional synchronization still functions after the fault sequence.

## Qualification boundary

Passing P2-C supports the claim:

> PV-DLAM P2 is qualified for the extracted reference plus live **native-hosted loopback** Infinite Porch integration at the pinned Porch source revision.

It does **not** establish:

- two separate physical machines;
- Wi-Fi/Ethernet LAN qualification;
- mDNS field behavior;
- WAN/NAT traversal;
- native Windows/macOS package evidence;
- resistance to independent adversarial security review;
- production Internet transport.

Those remain P6 / external field qualification work.


## Porch imported-grant freshness note

The live merged-main rerun exposed an important Infinite Porch 0.1.2 behavior:

- provider-side `grant.revoke` correctly rejects use of the revoked grant;
- the requester's previously imported copy is not automatically marked revoked;
- `remote_grant()` chooses the first locally valid imported match, so an old cached grant can be retried even after a fresh grant is imported.

The P2-C harness now models explicit authority refresh honestly:

1. provider revokes the old grant;
2. queued retry is refused by the provider;
3. requester explicitly retires its stale imported copy;
4. provider issues and requester imports fresh transport authority;
5. the old P2 epoch-1 envelope is transported;
6. PV-DLAM independently rejects that stale P2 authority epoch.

The adapter itself still does not issue, import, or revoke Porch grants.
