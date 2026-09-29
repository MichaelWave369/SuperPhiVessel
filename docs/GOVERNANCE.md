# Governance Model

Super Φ.Vessel treats model intelligence and operational authority as separate dimensions.

## 1. Human authority

The operator is the source of authority for actions that require permission. Model output may propose, explain, plan, compare, or request capability, but it cannot manufacture operator consent.

## 2. Capability is descriptive

A provider, model, bridge, browser, filesystem adapter, local runtime, or tool may expose a capability.

Availability answers:

> Can this system perform this class of operation?

It does not answer:

> Is this operation authorized now?

## 3. Authority is explicit and scoped

Authority should be:

- explicit
- narrow
- time/session bounded when appropriate
- tied to an operation or capability class
- non-transferable by ordinary data movement
- observable through a receipt or runtime state

## 4. Provenance is monotonic

A source artifact does not silently change claim class.

Derived artifacts may cite earlier material plus new evidence, but speculative, inferred, observed, verified, and executed states must remain distinguishable.

## 5. Evidence does not self-promote

Browser pages, model generations, memory records, imported artifacts, and tool outputs do not become trusted truth merely because they entered the system.

Promotion requires the relevant governed path.

## 6. Proposal and execution remain distinct

A proposal may describe an effect. It is not the effect.

Execution requires the appropriate authority boundary and should produce a receipt representing what actually occurred.

## 7. Fail closed

When authorization, provenance, evidence integrity, or execution state cannot be established, governed paths should prefer explicit BLOCKED / HELD / FAILED / INSUFFICIENT outcomes over invented success.

## 8. Human review stays meaningful

Benchmarks, Chamber Fitness, model scouting, and challenger comparisons may produce evidence for review. They must not silently replace role incumbents, install models, spend money, or expand authority.
