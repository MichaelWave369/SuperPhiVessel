import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const manifestPath = "runtime/MANIFEST.json";
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

const oldMarker = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.10';";
const newMarker = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.11';";
if (!html.includes(oldMarker)) throw new Error("RUNTIME_VERSION_MARKER_MISSING");
if (!html.includes("function computeBrokerRoute(opts)")) throw new Error("BUDGETCOMPUTE_SEAM_MISSING");
if (!html.includes("function executorAuthorizationDecision(capsule,req)")) throw new Error("EXECUTOR_AUTHORIZATION_SEAM_MISSING");

html = html.replace(oldMarker, newMarker);

const canaryBlock = String.raw