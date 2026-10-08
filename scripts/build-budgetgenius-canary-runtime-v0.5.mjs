import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const manifestPath = "runtime/MANIFEST.json";
const blockPath = "packages/budgetgenius-bridge-v0.5/runtime-canary-block.js.txt";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const OLD_VERSION = "v2.0-alpha.11.0.54.10";
const NEW_VERSION = "v2.0-alpha.11.0.54.11";
const NEW_PATH = "runtime/Super_PhiVessel_v2.0-alpha.11.0.54.11_BudgetGenius_Canary_Seam.html";

if (manifest.runtime.version === NEW_VERSION && manifest.runtime.path === NEW_PATH) {
  console.log("BudgetGenius v0.5 runtime candidate already generated.");
  process.exit(0);
}
if (manifest.runtime.version !== OLD_VERSION) {
  throw new Error("EXPECTED_CANONICAL_BASE_" + OLD_VERSION + "_GOT_" + manifest.runtime.version);
}

const sourcePath = manifest.runtime.path;
let html = readFileSync(sourcePath, "utf8");
const canaryBlock = readFileSync(blockPath, "utf8").trim();

const oldMarker = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.10';";
const newMarker = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.11';";
if (!html.includes(oldMarker)) throw new Error("RUNTIME_VERSION_MARKER_MISSING");
if (!html.includes("function computeBrokerRoute(opts)")) throw new Error("BUDGETCOMPUTE_SEAM_MISSING");
if (!html.includes("function executorAuthorizationDecision(capsule,req)")) throw new Error("EXECUTOR_AUTHORIZATION_SEAM_MISSING");
if (!canaryBlock.includes("BUDGETGENIUS_CANARY_RUNTIME_V0_5_BEGIN")) throw new Error("CANARY_BLOCK_BEGIN_MISSING");
if (!canaryBlock.includes("BUDGETGENIUS_CANARY_RUNTIME_V0_5_END")) throw new Error("CANARY_BLOCK_END_MISSING");

html = html.replace(oldMarker, newMarker);
html = html.replace("function computeBrokerRoute(opts)", canaryBlock + "\nfunction computeBrokerRoute(opts)");

const liveAnchor = "flags:{search:wSearch,imagegen:wImg,code:wCode,agent:wAgent}});try{phiEventEmit('cranefly.route_success'";
if (!html.includes(liveAnchor)) throw new Error("LIVE_BROKER_CALLSITE_ANCHOR_MISSING");
html = html.replace(
  liveAnchor,
  "flags:{search:wSearch,imagegen:wImg,code:wCode,agent:wAgent}});brokerDecision=budgetGeniusCanaryRuntimeInfluence(brokerDecision,{needProxy:needProxy,files:curFiles});try{phiEventEmit('cranefly.route_success'"
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
  name: "BudgetGenius One-Shot Local Canary Seam",
  path: NEW_PATH,
  size_bytes: bytes.length,
  sha256,
  git_blob_sha1: gitBlobSha1
};
manifest.recorded_at = "2026-10-07";
manifest.canary_runtime = {
  protocol: "PV-BUDGETGENIUS-CANARY-0.5",
  status: "EXPERIMENTAL_ONE_SHOT_LOCAL",
  budgetgenius_pin: "44ffc8ccd0f8eafb7130a3051215e536daaa4dce",
  stage: "builder",
  task_class: "code",
  max_decisions: 1,
  max_duration_ms: 300000,
  paid_spend_usd: 0,
  final_executor_authorization_required: true
};
manifest.notes = [
  ...(manifest.notes ?? []),
  "v2.0-alpha.11.0.54.11 adds a default-off, one-shot, local-only BudgetGenius canary route-influence seam after BudgetCompute and before final Executor Authorization.",
  "The live canary requires an SHA-256-valid v0.4 lease, Operator/Steward/Board approvals, an exact RESERVED BudgetPass for the same mandate and route, code/builder scope, one approved local Ollama model, <=5 minutes, one decision, and zero paid spend.",
  "Canary route influence does not authorize execution; authorizeExecutor remains downstream and mandatory."
];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log("Generated " + NEW_PATH);
console.log("size_bytes=" + bytes.length);
console.log("sha256=" + sha256);
console.log("git_blob_sha1=" + gitBlobSha1);
