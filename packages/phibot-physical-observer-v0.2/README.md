# PhiBot Physical Observer Runtime Seam v0.2

**Status:** EXPERIMENTAL / DEFAULT-OFF / BROWSER-NATIVE / EPHEMERAL / UNWIRED  
**NestedBubbleGear pin:** `7b5cb309fcd2af409de6f8676cc074c395a666b4`  
**Consumes:** `phibot-physical-experience-handoff/v0.1`  
**Canonical runtime wiring:** false

v0.2 moves the v0.1 reference receiver toward the actual standalone
Super Phi.Vessel browser runtime.

It accepts the same governed NBG physical-experience handoff, but is implemented
without Node-only imports and without browser persistent storage.

## Runtime API

The runtime exposes only:

```text
receive(packet)
status()
clear()
```

It exposes no:

```text
execute
actuate
invokeTool
```

The package therefore provides a display/reasoning seam rather than a tool seam.

## Browser-native integrity

The upstream NBG handoff keeps its existing deterministic NBG fingerprint.

The runtime uses browser Web Crypto SHA-256 for its own display receipt.

No `node:` imports are used in `runtime.mjs`.

## Ephemeral state

The v0.2 seam intentionally writes no:

```text
localStorage
sessionStorage
IndexedDB
```

The latest observer view exists only in the runtime instance and can be cleared
explicitly.

NBG remains the durable memory system. Super Phi.Vessel does not quietly create
a second uncontrolled physical-history database.

## Display path

A valid handoff becomes a sanitized observer view containing:

- query physical-memory ID;
- history match count;
- evidence-linked questions;
- read-only observation suggestions;
- uncertainty markers;
- evidence memory IDs;
- evidence IDs;
- `NO_TOOL_OR_PHYSICAL_AUTHORITY` banner.

The runtime may emit:

```text
phibot.physical.observer_view
phibot.physical.observer_cleared
```

through an injected event callback.

The runtime does not dispatch hardware or tool events.

## Idempotence and conflict handling

For one runtime instance:

- same handoff ID + same fingerprint -> `DUPLICATE`;
- same handoff ID + different fingerprint -> `REFUSED_CONFLICT`.

Conflicting content is never silently last-write-wins.

## Fixed authority boundary

Every runtime receipt fixes:

```text
authorityGranted = false
actionAuthorized = false
toolInvocationAllowed = false
hardwareCommandAllowed = false
persistentStorageWritten = false
independentAuthorizationStillRequired = true
```

Receipt mutation invalidates SHA-256 verification.

## Acceptance

The suite uses the real pinned NBG implementation to construct the upstream
handoff and checks the v0.1 reference receiver and v0.2 browser runtime agree on
its validity.

The 14 checks cover:

1. pinned NBG + v0.1 receiver interoperability;
2. ephemeral observer rendering;
3. sanitized view event emission;
4. Web Crypto receipt integrity;
5. duplicate idempotence;
6. same-ID conflict refusal;
7. tool injection refusal;
8. authority escalation refusal;
9. maintenance-promotion refusal;
10. explicit clear behavior;
11. browser-native / no-persistent-storage source boundary;
12. no execution API surface;
13. deterministic replay;
14. receipt authority-tamper detection.

Expected:

```text
PhiBot physical observer runtime seam v0.2: PASS (14/14)
```

## Non-claims

```text
browser-native package != canonical runtime wired
observer event != tool event
ephemeral view != durable memory
display receipt != action authorization
question != command
memory != permission
```

A later rung may insert this seam into the canonical standalone runtime after
this package contract is green.
