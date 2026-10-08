import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

const BASE_VERSION = "v2.0-alpha.11.0.54.12";
const CANDIDATE_VERSION = "v2.0-alpha.11.0.54.13";
const BASE_DIGEST =
  "a9e67b12d1c3622315b6937f1c2405acbd5b2a6bc6d32cf578c67d5178fa7212";
const oldMarker = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.12';";
const newMarker = "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.13';";
const START = "<!-- PHIBOT_PHYSICAL_OBSERVER_CANONICAL_V0_3_BEGIN -->";
const END = "<!-- PHIBOT_PHYSICAL_OBSERVER_CANONICAL_V0_3_END -->";

const target = process.argv[2];
if (!target) {
  throw new Error("OUTPUT_PATH_REQUIRED: provide a candidate HTML output path");
}

const manifest = JSON.parse(readFileSync("runtime/MANIFEST.json", "utf8"));
if (manifest.runtime.version !== BASE_VERSION) {
  throw new Error("UNEXPECTED_CANONICAL_BASE_VERSION");
}
if (manifest.runtime.sha256 !== BASE_DIGEST) {
  throw new Error("UNEXPECTED_CANONICAL_MANIFEST_HASH");
}
const bytes = readFileSync(manifest.runtime.path);
const baseDigest = createHash("sha256").update(bytes).digest("hex");
if (baseDigest !== BASE_DIGEST || bytes.length !== manifest.runtime.size_bytes) {
  throw new Error("CANONICAL_BASE_INTEGRITY_FAILURE");
}

const html = bytes.toString("utf8");
if (html.split(oldMarker).length !== 2) {
  throw new Error("BASE_RUNTIME_VERSION_MARKER_NOT_UNIQUE");
}
if (!html.includes("authorizeExecutor(ACTIVE_RUN_CAPSULE")) {
  throw new Error("FINAL_EXECUTOR_AUTHORIZATION_ANCHOR_MISSING");
}
if (!html.includes("BUDGETGENIUS_CANARY_OUTCOME_RUNTIME_V0_7_BEGIN")) {
  throw new Error("BUDGETGENIUS_OUTCOME_ANCHOR_MISSING");
}

const bodyCloses = [...html.matchAll(/<\/body\s*>/gi)];
const htmlCloses = [...html.matchAll(/<\/html\s*>/gi)];
const lastBodyClose = bodyCloses.at(-1);
const lastHtmlClose = htmlCloses.at(-1);
const insertionAnchor =
  lastBodyClose && (!lastHtmlClose || lastBodyClose.index < lastHtmlClose.index)
    ? lastBodyClose
    : lastHtmlClose;
if (!insertionAnchor && !html.includes("</script>")) {
  throw new Error("NO_SAFE_DOCUMENT_INSERTION_POINT");
}
const insertionIndex = insertionAnchor ? insertionAnchor.index : html.length;
if (html.includes(START) || html.includes(END)) {
  throw new Error("PHYSICAL_OBSERVER_ALREADY_INSERTED");
}

const modulePath = "packages/phibot-physical-observer-v0.2/runtime.mjs";
const panelPath = "packages/phibot-physical-observer-v0.3/panel.js.txt";
const moduleSource = readFileSync(modulePath, "utf8");
const panelSource = readFileSync(panelPath, "utf8");

if (/^\s*import\s/m.test(moduleSource)) {
  throw new Error("MODULE_IMPORTS_NOT_SUPPORTED_IN_STANDALONE_CANDIDATE");
}
if (!moduleSource.includes("createPhysicalObserverRuntime")) {
  throw new Error("PHYSICAL_OBSERVER_RUNTIME_EXPORT_MISSING");
}
if (!panelSource.includes("PHIBOT_PHYSICAL_OBSERVER_PANEL_V0_3_BEGIN")) {
  throw new Error("OBSERVER_PANEL_MARKER_MISSING");
}
if (/<\/script\s*>/i.test(moduleSource + panelSource)) {
  throw new Error("UNEXPECTED_SCRIPT_CLOSE_IN_INLINE_MODULE");
}

const strippedModule = moduleSource.replace(/^export\s+/gm, "");
new Function(strippedModule + "\n" + panelSource);

const injection = [
  START,
  "<script type=\"module\" id=\"pv-phibot-physical-observer-v03\">",
  strippedModule,
  panelSource,
  "</script>",
  END
].join("\n") + "\n";

let candidate = html.replace(oldMarker, newMarker);
candidate =
  candidate.slice(0, insertionIndex) +
  injection +
  candidate.slice(insertionIndex);

if (!candidate.includes(newMarker) || candidate.includes(oldMarker)) {
  throw new Error("CANDIDATE_VERSION_PATCH_FAILED");
}
const reversed = candidate
  .replace(injection, "")
  .replace(newMarker, oldMarker);
if (reversed !== html) {
  throw new Error("CANDIDATE_MODIFIED_UNRELATED_RUNTIME_BYTES");
}

const output = resolve(target);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, candidate, "utf8");
const candidateBytes = readFileSync(output);
const candidateSha256 = createHash("sha256")
  .update(candidateBytes)
  .digest("hex");
const gitBlobSha1 = createHash("sha1")
  .update(Buffer.from("blob " + candidateBytes.length + "\0", "utf8"))
  .update(candidateBytes)
  .digest("hex");

const report = {
  contract: "spv-physical-observer-candidate-build/v0.3",
  status: "CANDIDATE_ONLY_NOT_CANONICAL",
  baseVersion: BASE_VERSION,
  baseSha256: BASE_DIGEST,
  candidateVersion: CANDIDATE_VERSION,
  insertionAnchor: insertionAnchor ? insertionAnchor[0].toLowerCase() : "APPEND_AFTER_SOURCE",
  candidatePath: output,
  candidateSizeBytes: candidateBytes.length,
  candidateSha256,
  candidateGitBlobSha1: gitBlobSha1,
  canonicalManifestChanged: false,
  operatorTriggered: true,
  authorityGranted: false,
  finalExecutorAuthorizationUnchanged: true
};

writeFileSync(output + ".build.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
