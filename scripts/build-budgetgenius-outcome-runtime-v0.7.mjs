import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const manifestPath = "runtime/MANIFEST.json";
const blockPath = "packages/budgetgenius-bridge-v0.7/runtime-outcome-block.js.txt";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const OLD_VERSION = "v2.0-alpha.11.0.54.11";
const NEW_VERSION = "v2.0-alpha.11.0.54.12";
const NEW_PATH = "runtime/Super_PhiVessel_v2.0-alpha.11.0.54.12_BudgetGenius_Outcome_Handoff.html";

if (manifest.runtime.version === NEW_VERSION && manifest.runtime.path === NEW_PATH) {
  console.log("BudgetGenius v0.7 runtime candidate already generated.");
  process.exit(0);
}
if (manifest.runtime.version !== OLD_VERSION) {
  throw new Error("EXPECTED_CANONICAL_BASE_" + OLD_VERSION + "_GOT_" + manifest.runtime.version);
}

const sourcePath = manifest.runtime.path;
let html = readFileSync(sourcePath, "utf8");
const outcomeBlock = readFileSync(blockPath, "utf8").trim();

const oldMarker = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.11';";
const newMarker = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.12';";
if (!html.includes(oldMarker)) throw new Error("RUNTIME_VERSION_MARKER_MISSING");
if (!html.includes("BUDGETGENIUS_CANARY_RUNTIME_V0_5_BEGIN")) throw new Error("V0_5_CANARY_RUNTIME_MISSING");
if (!html.includes("function computeBrokerRoute(opts)")) throw new Error("BUDGETCOMPUTE_SEAM_MISSING");
if (!outcomeBlock.includes("BUDGETGENIUS_CANARY_OUTCOME_RUNTIME_V0_7_BEGIN")) throw new Error("V0_7_OUTCOME_BLOCK_BEGIN_MISSING");
if (!outcomeBlock.includes("BUDGETGENIUS_CANARY_OUTCOME_RUNTIME_V0_7_END")) throw new Error("V0_7_OUTCOME_BLOCK_END_MISSING");

html = html.replace(oldMarker, newMarker);
html = html.replace("function computeBrokerRoute(opts)", outcomeBlock + "\nfunction computeBrokerRoute(opts)");

const successAnchor = "computeBrokerRecord(brokerDecision,'COMPLETED',first.receipt,null,runProvider);return first;";
if (!html.includes(successAnchor)) throw new Error("CANARY_SUCCESS_COMPLETION_ANCHOR_MISSING");
html = html.replace(
  successAnchor,
  "computeBrokerRecord(brokerDecision,'COMPLETED',first.receipt,null,runProvider);await budgetGeniusCanaryRuntimeOutcomeHandoff(brokerDecision,first,{status:'COMPLETED',executor:runProvider});return first;"
);

const failureAnchor = "computeBrokerRecord(brokerDecision,'FAILED',firstErr&&firstErr.receipt||null,firstErr,runProvider);const isLocal=";
if (!html.includes(failureAnchor)) throw new Error("CANARY_FAILURE_COMPLETION_ANCHOR_MISSING");
html = html.replace(
  failureAnchor,
  "computeBrokerRecord(brokerDecision,'FAILED',firstErr&&firstErr.receipt||null,firstErr,runProvider);await budgetGeniusCanaryRuntimeOutcomeHandoff(brokerDecision,{receipt:firstErr&&firstErr.receipt||null,code:firstErr&&firstErr.code||'REQUEST_FAILED',message:firstErr&&firstErr.message||'local execution failed'},{status:'FAILED',executor:runProvider});const isLocal="
);

writeFileSync(NEW_PATH, html, "utf8");
const bytes = readFileSync(NEW_PATH);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const gitBlobSha1 = createHash("sha1")
  .update(Buffer.from("blob " + bytes.length + "\0", "utf8"))
  .update(bytes)
  .digest("hex");

manifest.runtime = {
  ...manifest.runtime,
  version: NEW_VERSION,
  name: "BudgetGenius Canonical Outcome Handoff",
  path: NEW_PATH,
  size_bytes: bytes.length,
  sha256,
  git_blob_sha1: gitBlobSha1
};
manifest.recorded_at = "2026-10-07";
manifest.canary_runtime = {
  ...(manifest.canary_runtime ?? {}),
  protocol: "PV-BUDGETGENIUS-CANARY-0.5",
  outcome_handoff_protocol: "PV-BUDGETGENIUS-OUTCOME-0.7",
  outcome_handoff_status: "AUTOMATIC_CAPTURE_AWAITING_INDEPENDENT_VERIFICATION",
  outcome_success_state: "AWAITING_VERIFICATION",
  outcome_failure_state: "ROLLBACK_REQUIRED",
  verified_writeback_authority: false,
  scope_expansion_authority: false
};
manifest.notes = [
  ...(manifest.notes ?? []),
  "v2.0-alpha.11.0.54.12 adds automatic BudgetGenius canary outcome capture at the canonical local executor completion/failure seam.",
  "Successful execution is captured as AWAITING_VERIFICATION, never as verified quality; failed canary execution becomes ROLLBACK_REQUIRED before any remote fallback.",
  "The v0.7 outcome handoff normalizes the canonical v0.5 influence identity for the v0.6 closeout layer without granting writeback, routing, execution, payment, or scope-expansion authority."
];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log("Generated " + NEW_PATH);
console.log("size_bytes=" + bytes.length);
console.log("sha256=" + sha256);
console.log("git_blob_sha1=" + gitBlobSha1);
