# PV-DLAM P1-C — Static Genius/Model Routing and Swap Continuity

**Status:** CANDIDATE / EXTRACTED / UNWIRED  
**Protocol:** PV-DLAM-0.1  
**Phase:** P1-C of P1 one-node continuity

P1-C makes the central Free Models architecture executable:

> **A Genius is a stable role and continuity namespace. A model is a replaceable execution artifact.**

The full GA108 roster remains fixed at 108 logical profiles. P1-C does not reserve one model process per Genius.

## Exact model identity

A model artifact identity includes:

- provider;
- runtime + runtime version;
- weights digest;
- quantization;
- adapter digest;
- prompt-template digest;
- tokenizer identity;
- context window;
- declared capabilities;
- locality;
- measured/declared VRAM requirement.

The model reference is derived from a canonical hash of that exact identity.

Changing quantization, prompt template, adapter, runtime behavior identity, tokenizer, or weights creates a **different empirical model identity**.

Qualification status and static priority may change without rewriting the artifact identity; they are deployment observations/policy, not weights.

## Static routing only

P1-C deliberately does not learn a route.

The router:

1. validates the frozen GA108 profile;
2. checks current external authority status;
3. filters exact model artifacts by:
   - qualification status;
   - local/remote policy;
   - required capability set;
   - context-window minimum;
   - VRAM budget;
   - optional explicit model allowlist;
   - presence of the exact tokenizer adapter;
4. sorts the eligible set deterministically by:
   - preferred capability matches;
   - explicit static priority;
   - lower VRAM requirement;
   - exact model reference.

No learned utility score may overcome an exclusion.

## Route receipt

A successful route is finalized only **after** P1-B composes a READY context packet.

The receipt binds:

- task;
- GA108 profile;
- exact model;
- recipe;
- eligible and excluded candidate sets;
- static router snapshot;
- deterministic selection probability = 1.0;
- resource state;
- exact context packet hash;
- policy frontier;
- lexical index frontier;
- exact-model routing-statistics key;
- prior attributable outcome count;
- `authority_granted=false`.

This avoids a circular lie where a “route receipt” claims a context manifest that did not yet exist.

## Task checkpoints

A checkpoint stores model-neutral work continuity:

- task ID;
- GA108 profile;
- memory namespace;
- route receipt;
- context packet hash;
- memory/index/policy frontiers;
- request envelope;
- structured work state;
- checkpoint chain.

It explicitly does **not** transfer:

- KV caches;
- hidden states;
- activations;
- logits;
- opaque model state.

Known opaque-state keys fail closed.

## Model swap

A swap requires:

1. an existing durable task checkpoint;
2. a different exact replacement model identity;
3. replacement qualification;
4. normal hard-eligibility checks;
5. the replacement tokenizer adapter;
6. complete P1-B context recomposition;
7. a new static route receipt;
8. a new checkpoint chained to the previous checkpoint.

The Genius profile, memory namespace, task identity, admitted memory, and structured work state survive. Opaque model state does not.

## Routing observations

P1-C may record attributable static-route outcomes:

```text
decision_id
model_ref
success
latency_ms
```

They are **observations only**. No learner consumes them in P1-C.

Every exact model identity has a separate `routing_stats_key`. A changed model artifact therefore starts with zero prior observations rather than inheriting another artifact's history.

## Run

```bash
python3 packages/dlam-p1-v0.1/p1c_acceptance.py
```

Expected:

```text
SUMMARY 22/22 PASS
```

## Still deferred

P1-D remains the final one-node qualification rung:

- crash injection;
- durable acknowledgement / WAL recovery checks;
- disk-full / write-failure behavior;
- managed backup and restore;
- deletion/rebuild verification;
- complete P1 evidence report.

P2 peer synchronization, P3 full-roster routing observability, P4 learned routing, and P5 learned NBG views remain later work.
