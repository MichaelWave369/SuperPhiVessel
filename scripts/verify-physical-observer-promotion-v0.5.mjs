import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export const PROMOTION_GATE_CONTRACT =
  "spv-physical-observer-promotion-preflight/v0.5";

function digest(data) {
  return createHash("sha256").update(data).digest("hex");
}

function blobDigest(data) {
  return createHash("sha1")
    .update(Buffer.from("blob " + data.length + "\0", "utf8"))
    .update(data)
    .digest("hex");
}

export function evaluatePhysicalObserverPromotionEvidence({
  dossier,
  manifest,
  build,
  baseBytes,
  candidateBytes,
  desktopBytes,
  mobileBytes
}) {
  const errors = [];

  const expect = (condition, code) => {
    if (!condition) errors.push(code);
  };

  expect(
    dossier?.contract === "spv-physical-observer-promotion-dossier/v0.5",
    "DOSSIER_CONTRACT_MISMATCH"
  );
  expect(
    dossier?.status === "QUALIFIED_CANDIDATE_OPERATOR_REVIEW_PENDING",
    "DOSSIER_STATE_UNSUPPORTED"
  );

  const source = dossier?.source ?? {};
  const qualification = dossier?.qualification ?? {};
  const review = dossier?.review ?? {};
  const boundaries = dossier?.boundaries ?? {};

  const baseSha = digest(baseBytes);
  const candidateSha = digest(candidateBytes);
  const candidateBlob = blobDigest(candidateBytes);

  expect(
    manifest?.runtime?.version === source.canonicalBaseVersion &&
      manifest?.runtime?.sha256 === source.canonicalBaseSha256 &&
      manifest?.runtime?.size_bytes === baseBytes.length &&
      baseSha === source.canonicalBaseSha256,
    "PINNED_CANONICAL_BASE_MISMATCH"
  );
  expect(
    source.canonicalBaseVersion === "v2.0-alpha.11.0.54.12",
    "UNEXPECTED_CANONICAL_BASE"
  );
  expect(
    source.candidateVersion === "v2.0-alpha.11.0.54.13",
    "UNEXPECTED_CANDIDATE_VERSION"
  );
  expect(
    candidateSha === source.candidateSha256 &&
      candidateBlob === source.candidateGitBlobSha1 &&
      candidateBytes.length === source.candidateSizeBytes,
    "CANDIDATE_HASH_OR_SIZE_MISMATCH"
  );
  expect(
    build?.contract === "spv-physical-observer-candidate-build/v0.3" &&
      build?.status === "CANDIDATE_ONLY_NOT_CANONICAL" &&
      build?.candidateSha256 === candidateSha &&
      build?.candidateGitBlobSha1 === candidateBlob &&
      build?.candidateSizeBytes === candidateBytes.length &&
      build?.baseSha256 === baseSha &&
      build?.canonicalManifestChanged === false &&
      build?.authorityGranted === false &&
      build?.finalExecutorAuthorizationUnchanged === true,
    "BUILDER_RECEIPT_MISMATCH"
  );

  const candidate = candidateBytes.toString("utf8");
  const base = baseBytes.toString("utf8");
  const begin = "<!-- PHIBOT_PHYSICAL_OBSERVER_CANONICAL_V0_3_BEGIN -->";
  const end = "<!-- PHIBOT_PHYSICAL_OBSERVER_CANONICAL_V0_3_END -->";
  const startAt = candidate.indexOf(begin);
  const endAt = candidate.indexOf(end);
  const oldVersion = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.12';";
  const newVersion = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.13';";

  if (
    startAt < 0 ||
    endAt < startAt ||
    candidate.lastIndexOf(begin) !== startAt ||
    candidate.lastIndexOf(end) !== endAt
  ) {
    errors.push("OBSERVER_MODULE_MARKER_MISMATCH");
  } else {
    const injection = candidate.slice(startAt, endAt + end.length) + "\n";
    const reversed = candidate.replace(injection, "").replace(newVersion, oldVersion);
    expect(reversed === base, "UNEXPECTED_CANONICAL_RUNTIME_MODIFICATION");
  }
  expect(
    candidate.split(newVersion).length === 2,
    "CANDIDATE_VERSION_NOT_UNIQUE"
  );
  expect(
    candidate.includes("authorizeExecutor(ACTIVE_RUN_CAPSULE") &&
      candidate.includes("BUDGETGENIUS_CANARY_OUTCOME_RUNTIME_V0_7_BEGIN"),
    "EXECUTOR_OR_CANARY_INVARIANT_MISSING"
  );

  expect(
    qualification.browserRunId === 37730175204 &&
      qualification.browserRunConclusion === "success" &&
      qualification.browserChecksPassed === 15 &&
      qualification.candidateSmokeChecksPassed === 10 &&
      qualification.observerRuntimeChecksPassed === 16 &&
      qualification.artifactId === 11529263628,
    "PINNED_QUALIFICATION_METADATA_MISMATCH"
  );
  expect(
    digest(desktopBytes) === qualification.desktopScreenshotSha256,
    "DESKTOP_SCREENSHOT_HASH_MISMATCH"
  );
  expect(
    digest(mobileBytes) === qualification.mobileScreenshotSha256,
    "MOBILE_SCREENSHOT_HASH_MISMATCH"
  );

  expect(
    review.operatorDecision === "PENDING" &&
      review.operatorReviewer === null &&
      review.operatorReviewTimestamp === null &&
      review.operatorVisualReviewComplete === false &&
      review.candidatePromoted === false,
    "UNVERIFIED_OPERATOR_APPROVAL_IN_STATIC_DOSSIER"
  );

  expect(
    boundaries.toolAuthorizationGranted === false &&
      boundaries.physicalAuthorityGranted === false &&
      boundaries.execAuthorizationUnchanged === true &&
      boundaries.runtimeManifestUpdated === false &&
      boundaries.productionDeploymentAuthorized === false,
    "AUTHORITY_OR_RELEASE_PROMOTION_ATTEMPT"
  );

  return {
    contract: PROMOTION_GATE_CONTRACT,
    status: errors.length
      ? "REFUSED_INTEGRITY_OR_BOUNDARY_FAILURE"
      : "HOLD_FOR_EXPLICIT_OPERATOR_REVIEW",
    errors,
    candidateVersion: source.candidateVersion ?? null,
    candidateSha256: candidateSha,
    artifactId: qualification.artifactId ?? null,
    canPromote: false,
    mayUpdateCanonicalManifest: false,
    mayDeployProduction: false,
    toolAuthorityGranted: false,
    physicalAuthorityGranted: false,
    operatorReviewComplete: false,
    requiredNextGate:
      "OPERATOR_SCREENSHOT_REVIEW_AND_SEPARATE_CANONICAL_RELEASE_PR"
  };
}

if (process.argv[1] &&
    import.meta.url === new URL("file://" + process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 6) {
    throw new Error(
      "USAGE: node verify-physical-observer-promotion-v0.5.mjs CANDIDATE BUILD_JSON DESKTOP_PNG MOBILE_PNG REPORT_JSON DOSSIER_JSON"
    );
  }

  const [candidatePath, buildPath, desktopPath, mobilePath, reportPath, dossierPath] = args;
  const result = evaluatePhysicalObserverPromotionEvidence({
    dossier: JSON.parse(readFileSync(dossierPath, "utf8")),
    manifest: JSON.parse(readFileSync("runtime/MANIFEST.json", "utf8")),
    build: JSON.parse(readFileSync(buildPath, "utf8")),
    baseBytes: readFileSync(
      JSON.parse(readFileSync("runtime/MANIFEST.json", "utf8")).runtime.path
    ),
    candidateBytes: readFileSync(candidatePath),
    desktopBytes: readFileSync(desktopPath),
    mobileBytes: readFileSync(mobilePath)
  });
  writeFileSync(reportPath, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
