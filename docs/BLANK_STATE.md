# Blank-State Release Contract

Status: **LOCKED release requirement**

Super Φ.Vessel public releases MUST start from a clean operator state.

## Required initial state

A fresh public runtime MUST contain **zero user-derived records** in each of these domains:

- chat / conversation history
- Dreamer prompts, dreams, continuations, or generated dream history
- persistent memory records or recalled operator memory
- pinned outputs, saved canvases, scratchpads, drafts, or temporary work products
- prior model responses, routing traces, benchmark sessions, or operator-specific session state
- imported files, private receipts, browser-derived observations, or personal provenance records
- provider credentials, tokens, API keys, private endpoints, or locally persisted secrets

Architecture, schemas, empty stores, deterministic test fixtures, and explicitly synthetic examples are allowed. They MUST NOT contain prior operator-derived content.

## Persistence behavior

Persistence capability may exist, but a public release must distinguish:

1. **schema** — the shape of a store;
2. **empty initial state** — the state shipped with the release;
3. **runtime-created state** — data created only after the current operator begins using the runtime.

No build step may silently promote runtime-created state into shipped initial state.

## Public-release data epoch

Before the first public deployment is declared clean, the runtime must establish a new public data epoch.

On first boot into that epoch, Vessie must clear or ignore legacy user-state namespaces owned by earlier Super Φ.Vessel builds before loading chat, dream, memory, pin, scratchpad, or session state.

The reset must be scoped to Vessie-owned keys/databases. It must not indiscriminately clear unrelated browser storage on the same origin.

## Verification requirement

A release is not marked blank-state verified until all of the following are true:

- the canonical runtime bytes have been audited;
- known Vessie persistence namespaces have been enumerated;
- shipped seed/default state for operator-derived domains is empty;
- a fresh-browser smoke test renders with no prior user content;
- a legacy-state migration test proves the public data epoch does not resurrect pre-release state;
- CI enforces the blank-state checks.

## Governance rule

**Capability to remember is not permission to ship memory.**

Memory features may remain present. Their stores must begin empty unless a future release explicitly ships synthetic fixtures that are clearly labeled as test/demo data and cannot be mistaken for operator history.
