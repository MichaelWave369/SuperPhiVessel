import assert from "node:assert/strict";
import { EVALUATION_SCHEMA, qualifyShadowEconomics } from "./qualification.mjs";

let passed = 0;
function ok(id, name) {
  passed += 1;
  console.log("PASS " + id + " " + name);
}

function makePack({ evidenceClass = "SYNTHETIC_QUALIFICATION_FIXTURE", count = 400 } = {}) {
  const observations = [];
  const taskClasses = ["code", "research", "translation", "build"];
  for (let i = 0; i < count; i += 1) {
    observations.push({
      observationId: "eval-" + i,
      sourceObservationId: "source-" + i,
      seed: "seed-" + (i % 5),
      taskClass: taskClasses[i % taskClasses.length],
      split: "HELD_OUT",
      routeQualified: true,
      live: {
        effectiveEconomicCostUsd: 1.00,
        qualityPass: true,
        evidenceScore: 0.97,
        latencyMs: 100,
        criticalMiss: false,
        governanceViolation: false
      },
      shadow: {
        effectiveEconomicCostUsd: 0.90,
        qualityPass: true,
        evidenceScore: 0.97,
        latencyMs: 102,
        criticalMiss: false,
        governanceViolation: false
      },
      receipt: {
        receiptType: "BudgetGeniusShadowEconomicReceipt",
        version: "0.2",
        selectionIsLive: false,
        mayChangeLiveRoute: false,
        authorityGranted: false,
        actionAuthority: "NONE",
        executorAuthorizationRequired: true
      }
    });
  }
  return {
    schema: EVALUATION_SCHEMA,
    qualificationId: "bgq-test-vector",
    evidenceClass,
    source: {
      bridgeVersion: "0.2",
      p3QualificationDisposition: evidenceClass === "SYNTHETIC_QUALIFICATION_FIXTURE"
        ? "STRUCTURAL_PASS_SYNTHETIC_ONLY"
        : "READY_FOR_P4_EVALUATION",
      evidenceManifestRefs: evidenceClass === "SYNTHETIC_QUALIFICATION_FIXTURE"
        ? []
        : ["manifest:test-only"]
    },
    trainingObservationIds: [],
    observations
  };
}

const synthetic = qualifyShadowEconomics(makePack());
assert.equal(synthetic.metrics.cases, 400);
assert.equal(synthetic.metrics.seeds, 5);
assert.equal(synthetic.metrics.taskClasses, 4);
assert.equal(synthetic.metrics.relativeUtilityImprovement, 0.1);
assert.ok(synthetic.metrics.relativeUtilityCiLower95 > 0);
ok("C01", "technical-metrics-close-over-400-paired-held-out-cases");

assert.equal(synthetic.disposition, "STRUCTURAL_PASS_SYNTHETIC_ONLY");
assert.equal(synthetic.mayRequestCanaryLease, false);
assert.equal(synthetic.activationAllowed, false);
ok("C02", "synthetic-evidence-cannot-promote-itself");

const empiricalVector = qualifyShadowEconomics(makePack({ evidenceClass: "REPLAY_BENCHMARK" }));
assert.equal(empiricalVector.disposition, "EMPIRICAL_QUALIFIED_CANDIDATE");
assert.equal(empiricalVector.mayRequestCanaryLease, true);
assert.equal(empiricalVector.activationAllowed, false);
assert.equal(empiricalVector.mayChangeLiveRoute, false);
assert.equal(empiricalVector.authorityGranted, false);
ok("C03", "qualified-candidate-still-requires-explicit-canary-lease");

const tooSmall = makePack({ evidenceClass: "REPLAY_BENCHMARK", count: 399 });
assert.equal(qualifyShadowEconomics(tooSmall).gates.find((g) => g.id === "G01").pass, false);
ok("C04", "minimum-case-floor-is-enforced");

const tooFewSeeds = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
tooFewSeeds.observations.forEach((x, i) => { x.seed = "seed-" + (i % 4); });
assert.equal(qualifyShadowEconomics(tooFewSeeds).gates.find((g) => g.id === "G02").pass, false);
ok("C05", "minimum-seed-floor-is-enforced");

const thinSeed = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
thinSeed.observations.forEach((x, i) => { x.seed = i < 49 ? "thin-seed" : "seed-" + (1 + (i % 4)); });
assert.equal(qualifyShadowEconomics(thinSeed).gates.find((g) => g.id === "G03").pass, false);
ok("C06", "minimum-cases-per-seed-is-enforced");

const leakage = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
leakage.trainingObservationIds = [leakage.observations[0].sourceObservationId];
assert.equal(qualifyShadowEconomics(leakage).gates.find((g) => g.id === "G06").pass, false);
ok("C07", "train-test-leakage-blocks-qualification");

const duplicate = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
duplicate.observations[1].sourceObservationId = duplicate.observations[0].sourceObservationId;
assert.equal(qualifyShadowEconomics(duplicate).gates.find((g) => g.id === "G07").pass, false);
ok("C08", "duplicate-evidence-identity-blocks-qualification");

const ineligible = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
ineligible.observations[0].routeQualified = false;
assert.equal(qualifyShadowEconomics(ineligible).gates.find((g) => g.id === "G08").pass, false);
ok("C09", "unqualified-route-cannot-enter-economic-promotion");

const weakSavings = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
weakSavings.observations.forEach((x) => { x.shadow.effectiveEconomicCostUsd = 0.97; });
assert.equal(qualifyShadowEconomics(weakSavings).gates.find((g) => g.id === "G09").pass, false);
ok("C10", "five-percent-economic-improvement-floor-is-enforced");

const noisySavings = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
noisySavings.observations.forEach((x, i) => {
  x.shadow.effectiveEconomicCostUsd = i < 200 ? 0.10 : 1.78;
});
const noisyResult = qualifyShadowEconomics(noisySavings);
assert.ok(noisyResult.metrics.relativeUtilityImprovement >= 0.05);
assert.equal(noisyResult.gates.find((g) => g.id === "G10").pass, false);
ok("C11", "positive-mean-with-negative-confidence-bound-is-rejected");

const qualityRegression = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
for (let i = 0; i < 8; i += 1) qualityRegression.observations[i].shadow.qualityPass = false;
assert.equal(qualifyShadowEconomics(qualityRegression).gates.find((g) => g.id === "G11").pass, false);
ok("C12", "quality-regression-is-non-tradable");

const evidenceRegression = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
evidenceRegression.observations.forEach((x) => { x.shadow.evidenceScore = 0.94; });
assert.equal(qualifyShadowEconomics(evidenceRegression).gates.find((g) => g.id === "G12").pass, false);
ok("C13", "evidence-regression-is-bounded");

const latencyRegression = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
latencyRegression.observations.forEach((x) => { x.shadow.latencyMs = 120; });
assert.equal(qualifyShadowEconomics(latencyRegression).gates.find((g) => g.id === "G13").pass, false);
ok("C14", "latency-regression-is-bounded");

const criticalRegression = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
criticalRegression.observations[0].shadow.criticalMiss = true;
assert.equal(qualifyShadowEconomics(criticalRegression).gates.find((g) => g.id === "G14").pass, false);
ok("C15", "critical-miss-regression-is-non-tradable");

const governanceBreach = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
governanceBreach.observations[0].shadow.governanceViolation = true;
assert.equal(qualifyShadowEconomics(governanceBreach).gates.find((g) => g.id === "G15").pass, false);
ok("C16", "governance-violation-is-non-tradable");

const authorityPromotion = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
authorityPromotion.observations[0].receipt.mayChangeLiveRoute = true;
assert.equal(qualifyShadowEconomics(authorityPromotion).gates.find((g) => g.id === "G16").pass, false);
ok("C17", "shadow-receipt-authority-promotion-is-rejected");

const missingManifest = makePack({ evidenceClass: "REPLAY_BENCHMARK" });
missingManifest.source.evidenceManifestRefs = [];
assert.equal(qualifyShadowEconomics(missingManifest).gates.find((g) => g.id === "G17").pass, false);
ok("C18", "empirical-label-without-manifest-cannot-promote");

const wrongP3 = makePack({ evidenceClass: "FIELD_OBSERVED" });
wrongP3.source.p3QualificationDisposition = "STRUCTURAL_PASS_SYNTHETIC_ONLY";
assert.equal(qualifyShadowEconomics(wrongP3).gates.find((g) => g.id === "G17").pass, false);
ok("C19", "p3-source-must-be-ready-for-p4-evaluation");

assert.equal(empiricalVector.activationAllowed, false);
assert.equal(empiricalVector.canaryLeaseAuthority, "OPERATOR_STEWARD_BOARD_REVIEW");
ok("C20", "qualification-output-does-not-contain-an-activation-path");

console.log("BudgetGenius shadow-economic qualification v0.3: PASS (" + passed + "/20)");
console.log("NOTE acceptance uses deterministic test vectors only; it is not an empirical qualification result.");
