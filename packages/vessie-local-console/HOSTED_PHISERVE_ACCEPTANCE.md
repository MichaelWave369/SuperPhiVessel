# Vessie and PhiServe: hosted CPU acceptance with zero local installs

This is an on-demand GitHub Actions experiment, not a permanently hosted model, a Windows field run, or proof of the user's RTX GPU.

## How to run online

1. After review and merge, open SuperPhiVessel in GitHub, select Actions and choose Vessie PhiServe Manual Hosted CPU Acceptance.
2. Click Run workflow, choose main, and check the option approving a public Apache-2.0 model download and a temporary CPU test.
3. Follow the resulting GitHub Actions job. After a green run, download the Vessie-PhiServe-Hosted-CPU-Acceptance artifact and inspect its redacted acceptance.json report.

No downloads or installations happen on your Windows PC. The workflow does not run on pushes, pull requests, schedules, or deployments. It needs an intentional Run workflow click and approval checkbox.

## What the temporary GitHub runner does

- Builds CPU-only llama.cpp from tag b10921 and verified commit 3f5e94d7c2ab2267fe39852051777fe30c1f49ef.
- Downloads a public Apache-2.0 SmolLM2-135M-Instruct Q4_K_M GGUF of about 105 MB from https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF onto the temporary runner.
- Uses PhiServe source commit d4746e74cfcc72550c32e95a96f0056d07ce9adb and the current Vessie source.
- Starts private-token-protected PhiServe at 127.0.0.1:11435 and the real Vessie Node localhost console at 127.0.0.1:8791 on the runner. Neither address is made externally reachable.
- Checks session authentication, registered model discovery, cross-origin denial and missing approval refusal before sending one harmless fixed public prompt.
- Generates text through an actual local CPU-backed llama-server, then checks the completed Vessie reply and its SHA-256 receipt with the existing Model Desk reviewer.
- Opens a separate read-only Vessie server to verify that the unapproved inference mode still returns 403.
- On success, uploads one minimal redacted report containing SHA-256 hashes, result flags, runtime classification and explicit nonclaims. No generated text, prompt, private token, model weights, or full logs are uploaded. A failed run cannot emit a successful acceptance artifact.

## Important limitations

This checks hosted Linux CPU transport, not the RTX 5070, Windows DLL/driver readiness, Windows portable launcher, browser UI clicks, hardware provenance, model correctness, VR integration, or real user memory access. Hash parity is a consistency check, not independent provenance. The report is runner self-report and cannot grant model-routing or agent permissions.

The GGUF comes from a third-party repository. The report stores its observed SHA-256, but this first smoke does not pin the GGUF revision. Repeatable scientific evaluation would require a separately reviewed revision and digest.

The workflow has read-only repository permissions and no external provider API keys. All model data and a temporary private bearer token stay on the GitHub-hosted runner, which is cleaned up at job completion. Public repo runner compute is generally included subject to GitHub Actions availability and policies.

The physical Windows/RTX acceptance checklist remains pending until the operator wants to test locally.
