import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";

const output = process.argv[2];
if (!output) throw new Error("CANDIDATE_PATH_REQUIRED");

const manifest = JSON.parse(readFileSync("runtime/MANIFEST.json", "utf8"));
const base = readFileSync(manifest.runtime.path, "utf8");
const html = readFileSync(output, "utf8");
const report = JSON.parse(readFileSync(output + ".build.json", "utf8"));

let checks = 0;
function ok(name) {
  checks += 1;
  console.log("PASS C" + String(checks).padStart(2, "0") + " " + name);
}

assert.equal(manifest.runtime.version, "v2.0-alpha.11.0.54.12");
assert.equal(
  createHash("sha256").update(base).digest("hex"),
  manifest.runtime.sha256
);
assert.equal(report.canonicalManifestChanged, false);
assert.equal(report.status, "CANDIDATE_ONLY_NOT_CANONICAL");
ok("canonical-runtime-bytes-and-manifest-remain-unmodified");

assert.equal(
  createHash("sha256").update(html).digest("hex"),
  report.candidateSha256
);
assert.equal(report.candidateVersion, "v2.0-alpha.11.0.54.13");
assert.ok(html.includes("const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.13';"));
ok("candidate-has-separate-integrity-bound-version");

assert.ok(html.includes("function computeBrokerRoute(opts)"));
assert.ok(html.includes("function authorizeExecutor(capsule,req)"));
assert.ok(html.includes("authorizeExecutor(ACTIVE_RUN_CAPSULE"));
assert.ok(html.includes("BUDGETGENIUS_CANARY_OUTCOME_RUNTIME_V0_7_BEGIN"));
ok("existing-budgetgenius-and-executor-seams-retained");

const start = "<!-- PHIBOT_PHYSICAL_OBSERVER_CANONICAL_V0_3_BEGIN -->";
const end = "<!-- PHIBOT_PHYSICAL_OBSERVER_CANONICAL_V0_3_END -->";
assert.equal(html.split(start).length, 2);
assert.equal(html.split(end).length, 2);
const injection = html.slice(
  html.indexOf(start),
  html.indexOf(end) + end.length
);
assert.ok(injection.includes("type=\"module\""));
assert.ok(injection.includes("PHIBOT_PHYSICAL_OBSERVER_PANEL_V0_3_BEGIN"));
assert.ok(injection.includes("createPhysicalObserverRuntime"));
ok("candidate-includes-one-isolated-physical-observer-panel");

const reverted = html
  .replace(injection + "\n", "")
  .replace(
    "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.13';",
    "const SUPER_PHIVESSEL_VERSION='2.0-alpha.11.0.54.12';"
  );
assert.equal(reverted, base);
ok("every-non-observer-runtime-byte-preserved-exactly");

const scriptMatch = injection.match(
  /<script type="module" id="pv-phibot-physical-observer-v03">([\s\S]*?)<\/script>/
);
assert.ok(scriptMatch);
const bundled = scriptMatch[1];
new Function(bundled);
assert.equal(bundled.includes("node:"), false);
assert.equal(bundled.includes("localStorage"), false);
assert.equal(bundled.includes("sessionStorage"), false);
assert.equal(bundled.includes("indexedDB"), false);
ok("injected-module-parses-and-does-not-write-persistent-state");

class MockElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.hidden = false;
    this.value = "";
    this.disabled = false;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }
  replaceChildren(...children) {
    this.children = [...children];
  }
  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }
  attachShadow() {
    this.shadow = new MockElement("shadow");
    return this.shadow;
  }
}

const elements = [];
const body = new MockElement("body");
const document = {
  readyState: "complete",
  body,
  createElement: (tag) => {
    const element = new MockElement(tag);
    elements.push(element);
    return element;
  },
  getElementById: (id) => elements.find((item) => item.id === id) ?? null,
  addEventListener: () => {
    throw new Error("unexpected late DOM event registration");
  }
};
const context = vm.createContext({
  document,
  crypto: webcrypto,
  TextEncoder,
  Uint8Array,
  console
});
vm.runInContext(bundled, context, { timeout: 5000 });
assert.equal(body.children.length, 1);
const host = body.children[0];
assert.equal(host.id, "pv-physical-observer-v03");
const launcher = elements.find((e) => e.textContent === "Physical Observer");
const panel = elements.find((e) => e.tagName === "section");
assert.ok(launcher);
assert.ok(panel);
assert.equal(panel.hidden, true);
launcher.listeners.get("click")();
assert.equal(panel.hidden, false);
ok("observer-panel-is-operator-opened-and-hidden-by-default");

const input = elements.find((e) => e.tagName === "textarea");
const review = elements.find((e) => e.textContent === "Review evidence");
const result = elements.find((e) => e.className === "result");
input.value = "{not-json";
await review.listeners.get("click")();
assert.ok(result.children.some((e) => String(e.textContent).includes("REFUSED")));
ok("invalid-import-remains-visible-refusal-with-no-authority");

const clear = elements.find((e) => e.textContent === "Clear");
clear.listeners.get("click")();
assert.equal(input.value, "");
assert.ok(result.children.some((e) => String(e.textContent).includes("cleared")));
ok("operator-clears-ephemeral-view-and-import-buffer");

const close = elements.find((e) => e.textContent === "Close");
close.listeners.get("click")();
assert.equal(panel.hidden, true);
ok("operator-closes-observer-panel");

console.log(
  "Physical observer canonical candidate v0.3: PASS (" + checks + "/10)"
);
console.log(
  "NOTE candidate only; canonical manifest and production deployments are unchanged."
);
