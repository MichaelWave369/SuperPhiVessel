# Vessie local and free-API model audit · 2026-10-08

**Scope:** hardware/routing shortlist. Not a device inspection, installation proof, provider credential check, or free-tier entitlement verification.

## Hardware baseline

Primary workstation reported as RTX 5070 12 GB VRAM and 32 GB RAM. Weight size is only a floor for residency, not a promise of usable context at that size; KV cache, runtime buffers and OS contention must be measured.

## Local candidates

| Role | Candidate | Indicative download size | Recommendation |
| --- | --- | --- | --- |
| Fast utility / routing scaffolding | `granite4.2:3b` | 2.2 GB | Test for JSON, tools, exact latency before permanent residency |
| General local assistant | `granite4.2:8b` | 5.3 GB | Main 12 GB benchmark challenger, not pre-approved |
| Multimodal | `gemma4:e4b` | Verify actual Ollama tag | Measure GPU fit and visual accuracy separately |
| Heavy coding/reasoning | `qwen3.8:27b` | 18 GB | Only optional hybrid CPU/GPU offload; do not assume full VRAM residency |

Sources: [Granite tags](https://ollama.com/library/granite4.2/tags), [Qwen3.8](https://ollama.com/library/qwen3.8), [Gemma 4](https://ollama.com/library/gemma4).

First check installed tags and benchmark known current models; only download if a candidate measurably improves quality/resource balance. Never auto-install from the model catalog.

## Zero-budget hosted candidate providers

| Provider | Public free allocation | Priority | Boundaries |
| --- | --- | --- | --- |
| [GroqCloud](https://console.groq.com/docs/rate-limits) | Free plan, model-specific RPM/RPD/TPM | High | Suitable fast OpenAI GPT-OSS/Qwen candidates; actual key and limits must be queried |
| [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) | 10,000 free neurons per day | High | Certain large models require a paid billing method, including GLM 5.3 Flash; do not accidentally select them |
| [Google Gemini API](https://ai.google.dev/gemini-api/docs/pricing) | Free tier only for selected model/tier combos | High | Free-tier data may be used to improve products; do not export restricted memory automatically |
| [OpenRouter](https://openrouter.ai/pricing) | Basic free plan currently lists 50 requests/day | Medium | Free model selection changes; must revalidate model ID, provider, policy and quotas |
| [Cerebras Inference](https://inference-docs.cerebras.ai/support/pricing) | Free tier with constrained context/rate | Medium | Query per-account actual limits and model availability |
| [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers/pricing) | $0.10 monthly free credits, subject to change | Low | Useful testing, not sustained free inference |

**Never claim unlimited or guaranteed zero-cost access.** A provider can refuse, throttle or remove models; error responses remain explicit.

## Route eligibility tiers

Local-first means local is **preferred when qualified**, not local even when unsafe or clearly incapable.
Use deterministic code for deterministic tasks. Use a fast local model for cheap judgments, measured local generalists for ordinary work, sparse specialists/frontier only when safety/evidence/quality require it, and a remote call only when authorized for the exact content recipient.

## Benchmark before selection

Track quality and error cases by task class; structured JSON/tool use; cold/warm latency; tokens/s; VRAM/RAM peak; context admission; private disclosure; real provider tokens/cost; routing success and user corrections; fallback events. Store source receipts.

## Current model status

All entries in `protocols/routing-v2/model-candidates.json` are **CANDIDATES_ONLY**. Actual device state, API keys, quota balance, billing mode and online provider connection are all UNKNOWN until the gateway performs a scoped authenticated probe.
