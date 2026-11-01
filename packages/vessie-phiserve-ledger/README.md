# Φ Vessie ↔ PhiServe Acceptance Ledger · Rung 1

**Status:** Git-versioned, privacy-minimized, append-only evidence of hosted CPU integration observations. This ledger is not a trust oracle, live model service, independent attestation system, automatic model promotion gate, or proof of a Windows GPU deployment.

## First retained actual receipt

The ledger begins with the manually dispatched, successful [Vessie–PhiServe hosted CPU run #41271827883](https://github.com/MichaelWave369/SuperPhiVessel/actions/runs/41271827883). The [GitHub Actions artifact #13070145738](https://github.com/MichaelWave369/SuperPhiVessel/actions/runs/41271827883/artifacts/13070145738) contained a redacted acceptance.json. Its **1,378 exact bytes** were recovered from the artifact and retained as an immutable Git-reviewed source copy:

- ledger/phiserve-acceptance/evidence/gha-41271827883/acceptance.json
- ledger/phiserve-acceptance/entries/gha-41271827883.json

The source evidence SHA-256 is ab3a9001d25e5fcb561c45f2fa2fbb01af5347ed1d214ceac016a0d4b88109c6.

Its ledger record also contains the public model alias, GGUF source and SHA-256, output SHA-256, originating source commit, completion time, eight passing transport/security checks, run and artifact IDs, and all authority limitations explicitly ungranted.

GitHub Actions artifacts expire; keeping this *redacted source JSON* in Git ensures the evidence remains reviewable. The run URL and artifact digest are traceability aids; the report remains runner self-report rather than independent hardware attestation.

## Browser-only import (no local checkout required)

After a successful manually approved hosted CPU acceptance workflow run, open **SuperPhiVessel → Actions → Vessie PhiServe Ledger Manual Import PR** in your browser. Choose Run workflow on main, enter the **source run ID**, and check **Approve downloading that redacted artifact and opening an add-only evidence PR**.

The manual importer then checks the actual GitHub run and artifact metadata, fetches that run's `Vessie-PhiServe-Hosted-CPU-Acceptance` artifact, verifies that the source commit agrees with its redacted receipt, runs the same strict offline ledger validation, and opens a **new evidence PR** containing only the new receipt and derived ledger entry. A human still reviews and merges it. It will never trigger by push, PR, schedule, or completed-run event, and never auto-merges or promotes a model.

This workflow uses the repository-scoped GitHub Actions token with write permission **only when manually dispatched**. GitHub repository settings may need **Allow GitHub Actions to create and approve pull requests** enabled for PR creation. If policy denies that action, nothing is merged and the operator can use the offline CLI workflow below. Do not increase permissions on the read-only ledger validation workflow.

**First source run #41271827883 is already in the ledger.** Do not re-import it; duplicate run IDs are refused. On future hosted runs, the import button avoids installing Git, Node, or models on your Windows PC.

## Add future receipts, only after a real hosted run

1. Manually launch Vessie PhiServe Manual Hosted CPU Acceptance in GitHub Actions, explicitly approving the public model download. This does not run automatically during PR CI.
2. Download that run's successful Vessie-PhiServe-Hosted-CPU-Acceptance artifact. Extract only its acceptance.json.
3. In a trusted Git checkout, append the receipt with:

~~~bash
node packages/vessie-phiserve-ledger/cli.mjs ingest \
  --root ledger/phiserve-acceptance \
  --receipt /path/to/acceptance.json \
  --run-id ACTUAL_RUN_ID \
  --artifact-id ACTUAL_ARTIFACT_ID \
  --run-created-at 2026-11-01T04:07:24Z
~~~

Use the **actual** run creation time from GitHub metadata, not the example time. The offline command performs no network requests, downloads, model execution, or Git changes besides creating two new source files in the checkout. It refuses overwrites, duplicate run/artifact metadata and unknown/raw-private fields. Artifact identifiers supplied by the operator are not independently authenticated by this CLI.

4. Open a dedicated PR containing *only* new ledger entries and corresponding redacted evidence. Inspect the linked GitHub run and artifact before merging. Prior entries must not be rewritten or deleted. Any correction should be additive and explicitly annotated in a separate reviewed PR.

To verify all records and view non-promoting trends without model weights:

~~~bash
node packages/vessie-phiserve-ledger/cli.mjs verify --root ledger/phiserve-acceptance
node packages/vessie-phiserve-ledger/cli.mjs summary --root ledger/phiserve-acceptance
~~~

CI runs these commands on Linux and Windows. The recommended online-only path is the manual GitHub importer above; the local CLI remains a reproducible offline option. On PRs, CI also compares the complete prior ledger and evidence bytes to main to block in-place rewriting. This is a repository governance guard, subject to administrator override and branch protection.

## Comparisons and interpretation

- Tracks group by **hosted execution context + model alias + GGUF SHA-256 + source commit**. No cross-model speed/quality ranking is attempted.
- Different response hashes are **observed output variation**, not automatically a quality regression or an exact-output failure. The test's generation seed, prompt fingerprint and runtime load conditions are not independently controlled in this version.
- A GGUF hash change for a previously seen alias is flagged **MODEL_HASH_CHANGED_REVIEW_REQUIRED** and receives a separate track.
- After three earlier comparable observations, a later duration at least 3× the prior median and at least 1,000 ms slower is flagged **LATENCY_VARIATION_REVIEW_REQUIRED**, *advisory only*. One runner's timing is not a reproducible benchmark.
- Invalid/missing security controls, unexpected fields, sensitive material, duplicate JSON keys, tampered evidence, changed classification or attempts to grant tools/model routing authority are **rejected**.
- Only *successful* redacted reports are accepted in R1. A green ledger does not mean every attempted workflow run succeeded. Failed-run tracking can be added separately without calling a failure an accepted result.

## What is deliberately not claimed

This is a hosted Linux CPU integration observation with a real public GGUF. It does **not** certify an RTX 5070, Windows GPU and drivers, real browser clicks, local GUI acceptance, model factual correctness, operator quality review, user memory, independent source authenticity, authorized tool execution, or release/promotion.

No prompts, generated responses, bearer tokens, private paths, or weights are included in the ledger. The CLI is offline. CI uses read-only GitHub permissions and cannot write to main or ingest artifacts automatically. The unrelated Physical Observer draft PR #94 remains on its own evidence HOLD.
