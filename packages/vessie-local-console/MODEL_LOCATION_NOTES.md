# Vessie local console · model location is evidence, not permission

## Why this matters

Ollama's local `GET /api/tags` can list **both** locally stored model
weights and cloud-backed model references. An entry in that list does not
prove that its full model weights exist on the machine or can execute
locally. Showing all entries as **INSTALLED** or displaying cloud entries as
`0.00 GiB` can mislead the operator and downstream capability planning.

The local console therefore reports **advisory** location classes:

| Class | How it is identified | What it means |
| --- | --- | --- |
| `CLOUD_REFERENCE` | Ollama reports a nonempty `remote_host` or `remote_model`, OR the model name ends in `-cloud` / `:cloud` | It is presented as a cloud reference, *not* local GPU weights. A name-based signal is explicitly only a hint. |
| `LOCAL_WEIGHTS_REPORTED` | No remote signal, and Ollama reports a positive on-disk `size` | A local nonzero size was reported; it does not prove working execution, model validity, or VRAM fit. |
| `UNKNOWN` | Neither of the above | Insufficient metadata. Never silently call it local. |

`classification_basis` identifies the specific signal:
`REMOTE_METADATA`, `CLOUD_TAG_HINT`, `POSITIVE_SIZE_REPORT`, or
`INSUFFICIENT_METADATA`. These are strictly allowlisted; raw
`remote_host` and `remote_model` strings are **never emitted** by the
public-facing local API. No cloud provider endpoint is contacted.

**Important:** A local model being loaded or having a reported on-disk
size does not automatically establish GPU memory fit. Mixed CPU/GPU
offloading, context length, KV cache and concurrent loads affect actual
capacity. `size_bytes` is not a benchmark. A cloud tag/reference likewise
does not establish a current account entitlement, model availability,
price, an authenticated remote connection, or user approval to send data.

The local console remains a localhost-only read-only inventory app:
no `POST /api/chat`, no inference, no remote cloud calls, no memory
writeback, no BrainC routing changes, no model admission, no paid-API
authorization. These labels and counts are for **human review only**.

Sources on the upstream model type and /api/tags properties:
- https://docs.ollama.com/cloud
- https://github.com/ollama/ollama/blob/main/docs/openapi.yaml

## Operator action after upgrading

1. Stop the prior local console by closing its window or pressing Ctrl+C.
2. Download and extract the newly deployed ZIP into a fresh directory.
3. Launch `Start-Local-Vessie.cmd` and click **Discover my local models**.
4. Compare the three counts: *local weight-size reports*, *cloud
   references*, *unknown*. Do not treat cloud entries as available for
   local inference.
5. No routing or permission state is changed by this inspection.

Source-test fixtures and GitHub CI do not authenticate the actual
machine. Real workstation behavior remains an operator observation.
