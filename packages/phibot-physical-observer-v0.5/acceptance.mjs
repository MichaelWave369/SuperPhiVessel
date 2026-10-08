import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluatePhysicalObserverPromotionEvidence } from
  "../../scripts/verify-physical-observer-promotion-v0.5.mjs";

const args = process.argv.slice(2);
if (args.length !== 4) {
  throw new Error("USAGE: node acceptance.mjs CANDIDATE BUILD_JSON DESKTOP_PNG MOBILE_PNG");
}
const [candidatePath, buildPath, desktopPath, mobilePath] = args;
const manifest = JSON.parse(readFileSync("runtime/MANIFEST.json", "utf8"));
const dossier = JSON.parse(readFileSync(
  "docs/physical-observer/PROMOTION_DOSSIER_54_13.json", "utf8"
));
const evidence = {
  dossier,
  manifest,
  build: JSON.parse(readFileSync(buildPath, "utf8")),
  baseBytes: readFileSync(manifest.runtime.path),
  candidateBytes: readFileSync(candidatePath),
  desktopBytes: readFileSync(desktopPath),
  mobileBytes: readFileSync(mobilePath)
};
const clone = structuredClone;
let checks = 0;

function check(name, f) {
  f();
  checks += 1;
  console.log("PASS P" + String(checks).padStart(2, "0") + " " + name);
}

function mutated(patch) {
  return evaluatePhysicalObserverPromotionEvidence({
    ...evidence,
    ...patch
  });
}

check("exact-generated-runtime-plus-artifact-is-held-for-review", () => {
  const result = mutated({});
  assert.equal(result.status, "HOLD_FOR_EXPLICIT_OPERATOR_REVIEW");
  assert.deepEqual(result.errors, []);
  assert.equal(result.canPromote, false);
  assert.equal(result.mayDeployProduction, false);
  assert.equal(result.mayUpdateCanonicalManifest, false);
});

check("correct-candidate-hash-and-size-bound-to-dossier", () => {
  const result = mutated({});
  assert.equal(result.candidateSha256, dossier.source.candidateSha256);
  assert.equal(evidence.candidateBytes.length, dossier.source.candidateSizeBytes);
});

check("candidate-byte-mutation-is-refused", () => {
  const bytes = Buffer.from(evidence.candidateBytes);
  bytes[120] ^= 1;
  const result = mutated({ candidateBytes: bytes });
  assert.ok(result.errors.includes("CANDIDATE_HASH_OR_SIZE_MISMATCH"));
  assert.equal(result.canPromote, false);
});

check("screenshot-substitution-is-refused", () => {
  const bytes = Buffer.from(evidence.desktopBytes);
  bytes[100] ^= 1;
  const result = mutated({ desktopBytes: bytes });
  assert.ok(result.errors.includes("DESKTOP_SCREENSHOT_HASH_MISMATCH"));
});

check("mobile-screenshot-substitution-is-refused", () => {
  const bytes = Buffer.from(evidence.mobileBytes);
  bytes[100] ^= 1;
  const result = mutated({ mobileBytes: bytes });
  assert.ok(result.errors.includes("MOBILE_SCREENSHOT_HASH_MISMATCH"));
});

check("canonical-base-substitution-is-refused", () => {
  const fake = clone(manifest);
  fake.runtime.version = "v2.0-alpha.11.0.54.13";
  const result = mutated({ manifest: fake });
  assert.ok(result.errors.includes("PINNED_CANONICAL_BASE_MISMATCH"));
});

check("builder-receipt-spoof-is-refused", () => {
  const fake = clone(evidence.build);
  fake.authorityGranted = true;
  const result = mutated({ build: fake });
  assert.ok(result.errors.includes("BUILDER_RECEIPT_MISMATCH"));
});

check("operator-approval-edit-without-authorization-is-refused", () => {
  const fake = clone(dossier);
  fake.review.operatorDecision = "APPROVE";
  fake.review.operatorReviewer = "operator";
  fake.review.operatorVisualReviewComplete = true;
  const result = mutated({ dossier: fake });
  assert.ok(result.errors.includes("UNVERIFIED_OPERATOR_APPROVAL_IN_STATIC_DOSSIER"));
  assert.equal(result.canPromote, false);
});

check("runtime-manifest-promotion-is-refused", () => {
  const fake = clone(dossier);
  fake.boundaries.runtimeManifestUpdated = true;
  const result = mutated({ dossier: fake });
  assert.ok(result.errors.includes("AUTHORITY_OR_RELEASE_PROMOTION_ATTEMPT"));
});

check("physical-authority-promotion-is-refused", () => {
  const fake = clone(dossier);
  fake.boundaries.physicalAuthorityGranted = true;
  const result = mutated({ dossier: fake });
  assert.ok(result.errors.includes("AUTHORITY_OR_RELEASE_PROMOTION_ATTEMPT"));
});

check("wrong-Chromium-qualification-id-is-refused", () => {
  const fake = clone(dossier);
  fake.qualification.browserRunId = 1;
  const result = mutated({ dossier: fake });
  assert.ok(result.errors.includes("PINNED_QUALIFICATION_METADATA_MISMATCH"));
});

check("operator-pending-status-cannot-grant-any-release-authorization", () => {
  const result = mutated({});
  assert.equal(result.toolAuthorityGranted, false);
  assert.equal(result.physicalAuthorityGranted, false);
  assert.equal(result.operatorReviewComplete, false);
  assert.equal(result.mayDeployProduction, false);
  assert.equal(
    result.requiredNextGate,
    "OPERATOR_SCREENSHOT_REVIEW_AND_SEPARATE_CANONICAL_RELEASE_PR"
  );
});

console.log("Physical Observer promotion preflight: PASS (" + checks + "/12)");
console.log("NOTE pinned candidate validated; release remains HELD for explicit operator approval.");
