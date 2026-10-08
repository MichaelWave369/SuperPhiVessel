# PhiBot Physical Observer Receiver v0.1

**Status:** EXPERIMENTAL / UNWIRED / ADVISORY-ONLY  
**NestedBubbleGear pin:** `7b5cb309fcd2af409de6f8676cc074c395a666b4`  
**Consumes:** `phibot-physical-experience-handoff/v0.1`  
**Runtime wiring:** false

This package is the Super Φ.Vessel / PhiBot-side receiver for the governed
physical-experience handoff produced by NestedBubbleGear.

Its job is deliberately narrow:

> Accept a valid advisory-only physical-experience packet, render an inspectable
> observer view, and preserve the fact that the packet grants zero tool or
> physical authority.

## End-to-end seam

```text
PhiPie telemetry
      |
      v
health baseline + episode
      |
      v
NBG epistemic memory
      |
      v
recall + explanation + advisor
      |
      v
NBG PhiBot handoff
      |
      v
Super Phi.Vessel observer receiver
      |
      v
read-only evidence/questions
```

The seam stops there.

It does not cross into hardware execution.

## Accepted upstream contract

The receiver accepts only:

```text
contract = phibot-physical-experience-handoff/v0.1
recipient.role = PHIBOT_PHYSICAL_OBSERVER
producer.system = NestedBubbleGear
producer.sourceAdvisorContract = phipie-physical-experience-advisor/v0.1
```

The upstream NBG handoff fingerprint must verify exactly.

## Authority boundary

The packet must preserve:

```text
grantsAuthority = false
actionAuthorized = false
mayInvokeTools = false
mayIssueHardwareCommands = false
requiresIndependentToolAuthorization = true
safetyPlaneUnaffected = true
```

Both of these must remain empty:

```text
toolRequests = []
physicalCommands = []
```

If any of those fields change, the receiver refuses the packet.

## Observer view

A valid handoff is reduced to a read-only PhiBot-facing view containing:

- query physical-memory ID;
- history-match count;
- evidence-linked questions;
- read-only observation suggestions;
- uncertainty markers;
- evidence memory IDs;
- evidence IDs;
- explicit `NO_TOOL_OR_PHYSICAL_AUTHORITY` banner.

The view does not expose an execution method.

## Receive receipt

Every accepted packet produces a SHA-256-bound receive receipt with:

```text
receiveStatus = ACCEPTED_ADVISORY_ONLY
authorityGranted = false
actionAuthorized = false
toolInvocationAllowed = false
hardwareCommandAllowed = false
independentAuthorizationStillRequired = true
```

Changing those fields invalidates receipt verification.

## Independent authorization

A future PhiBot runtime may separately possess an authorized read-only telemetry
tool. That is outside this package.

If the agent later wants to collect another observation, it must create a new
request and pass the normal PhiOS/runtime authority boundary.

The handoff itself cannot supply that authority.

```text
memory -> question
question -> possible future request

but

memory != permission
question != tool grant
handoff != hardware command
```

## Acceptance

The acceptance suite uses the **real pinned NestedBubbleGear implementation** to
construct the upstream packet before handing it to this receiver.

It checks:

1. real pinned NBG handoff interoperability;
2. advisory-only observer rendering;
3. evidence reference preservation;
4. SHA-256 receive-receipt integrity;
5. receipt authority-tamper detection;
6. upstream packet-tamper refusal;
7. tool-request injection refusal;
8. physical-command injection refusal;
9. authority-escalation refusal;
10. maintenance-promotion refusal;
11. recipient-role substitution refusal;
12. absence of an execution surface;
13. deterministic replay.

Expected:

```text
PhiBot physical observer receiver v0.1: PASS (13/13)
```

## Non-claims

```text
receiver installed != runtime wired
observer view != diagnosis
question != maintenance instruction
evidence != causal proof
handoff != tool authorization
PhiBot receiver != safety controller
```

This package is intentionally **UNWIRED**. Canonical Super Φ.Vessel runtime
integration should be a separate rung after this interoperability contract is
green.
