# PV-DLAM P2-B — Infinite Porch Carrier Adapter

**Status:** CANDIDATE / EXTRACTED / UNWIRED  
**Depends on:** P2-A signed scoped synchronization  
**Porch contract observed:** Infinite Porch 0.1.2 control API / SDK

P2-B maps the already-qualified P2 application envelopes onto Infinite Porch's existing governed direct-message surface.

It deliberately does **not** create a raw socket, bypass Porch grants, or import Porch's database into PV-DLAM.

## Actual Porch surface used

The adapter matches the current Porch implementation:

- control API is loopback HTTP only;
- outbound carrier uses `message.send`;
- provider-side effect is governed by `message.direct / inbox / send`;
- Porch itself checks active trust and a valid remote grant before accepting the message;
- message IDs are durable/idempotent per sender;
- offline delivery may queue;
- inbox records are exposed as `{id, sender, text, channel, receipt}`;
- Porch message receipts are signed transport evidence.

## Identity mapping

A PV-DLAM P2 peer ID and an Infinite Porch peer ID are **not assumed to be the same identifier**.

The adapter requires an explicit local binding:

```text
P2 peer ID
↔ Porch peer ID
↔ shared scope
```

The binding is not authority. The underlying P2 pairing and Porch trust/grant checks must already exist.

The adapter never calls:

- `peer.approve`
- `grant.issue`
- `grant.import`

on behalf of synchronization.

## Carrier format

A Porch message carries one compact wrapper:

```json
{
  "schema": "superphivessel.dlam.p2.porch-carrier.v0.1",
  "kind": "SYNC_ENVELOPE | SYNC_RECEIPT",
  "payload": {},
  "authority_granted": false
}
```

The payload remains the signed P2 envelope/receipt from P2-A.

Porch transport delivery and PV-DLAM acknowledgment are intentionally separate.

```text
Porch says DELIVERED
        ≠
PV-DLAM outbox ACKED
```

The P2 outbox becomes ACKED only after the remote node returns a valid signed P2 receipt.

## Offline behavior

If Porch returns `QUEUED`, PV-DLAM retains its own pending outbox state.

This preserves an application-level acknowledgment boundary above Porch's transport queue.

## Receive path

Incoming Porch messages are filtered by the P2 carrier schema.

For a sync envelope:

1. Porch sender must match the explicit P2/Porch binding;
2. bound scope must equal signed envelope scope;
3. P2-A verifies recipient, epoch, object hash, signature, object type and authority boundary;
4. PV-DLAM admits or rejects the memory object;
5. a signed P2 receipt is returned over Porch.

For a sync receipt:

1. Porch sender must match the bound remote P2 identity;
2. referenced P2 envelope must exist locally;
3. P2-A verifies the signed receipt;
4. the original P2 outbox record becomes ACKED.

Ordinary Porch chat messages are ignored.

## Security / authority boundary

The adapter is intentionally powerless.

It cannot:

- pair P2 peers;
- approve Porch peers;
- issue/import grants;
- create action authority;
- bypass a revoked binding;
- turn Porch delivery into a memory acknowledgment;
- rewrite P2 signatures;
- promote memory truth.

## Qualification scope

The CI harness uses a deterministic in-process Porch contract double matching the documented 0.1.2 message API.

That proves adapter semantics and negative controls, but it does **not** yet claim live Infinite Porch daemon/network qualification.

The next closeout should run this adapter against real Porch nodes/transport and then exercise restart/partition/revocation freshness across the combined stack.
