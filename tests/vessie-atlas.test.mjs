import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAPABILITIES, FAMILIES, JOURNEYS } from "../site/atlas/data.mjs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const html = read("site/atlas/index.html");
const ui = read("site/atlas/atlas.js");
const manualJs = read("site/manual/manual.js");
const manifest = JSON.parse(read("runtime/MANIFEST.json"));
const manualIds = new Set([...manualJs.matchAll(/\{id:'([^']+)'/g)].map(m => m[1]));

test("atlas catalog entries are unique, typed, and pinned to documented sources", () => {
  assert.ok(CAPABILITIES.length >= 25);
  const seen = new Set();
  for (const entry of CAPABILITIES) {
    assert.equal(typeof entry.name, "string");
    assert.ok(entry.name.length > 1);
    assert.ok(!seen.has(entry.id), "duplicate capability " + entry.id);
    seen.add(entry.id);
    assert.ok(FAMILIES.includes(entry.family), "unlisted family " + entry.family);
    assert.ok(["LIVE", "CONDITIONAL", "LOCKED", "UNWIRED"].includes(entry.status));
    assert.ok(entry.boundary.length >= 20, "missing boundary for " + entry.id);
    assert.ok(entry.where && entry.summary && Array.isArray(entry.tags));
    if (entry.source.startsWith("../manual/#")) {
      const id = entry.source.split("#")[1];
      assert.ok(manualIds.has(id), "missing manual source id " + id);
    } else {
      assert.match(entry.source, /^https:\/\/github\.com\/MichaelWave369\/SuperPhiVessel\/blob\/main\//);
    }
  }
  assert.ok(seen.has("soma-hands") && CAPABILITIES.find(c => c.id === "soma-hands").status === "LOCKED");
  assert.ok(seen.has("sfr") && CAPABILITIES.find(c => c.id === "sfr").status === "UNWIRED");
});

test("journey cards link only to source pages and never declare execution", () => {
  assert.deepEqual(Object.keys(JOURNEYS).sort(), ["create", "learn", "local", "research"]);
  for (const [id, item] of Object.entries(JOURNEYS)) {
    assert.ok(item.title && item.description && item.steps.length >= 3, id);
    for (const step of item.steps) {
      assert.ok(step.name && step.detail && step.href, id);
      if (step.href.startsWith("../manual/#")) {
        assert.ok(manualIds.has(step.href.split("#")[1]), "missing journey manual anchor");
      } else {
        assert.match(step.href, /^https:\/\/github\.com\//);
      }
    }
  }
});

test("atlas document uses a local data module and remains explicitly read-only", () => {
  assert.match(html, /<script type="module" src="\.\/atlas\.js"><\/script>/);
  for (const id of ["capSearch", "familyFilters", "capabilities", "journeySelect", "journeySteps", "resultCount"]) {
    assert.ok(html.includes('id="' + id + '"'), "missing control " + id);
  }
  assert.match(html, /Read-only/i);
  assert.match(html, /not a device scan/i);
  assert.doesNotMatch(ui, /\bfetch\s*\(|\bWebSocket\s*\(|\bXMLHttpRequest\s*\(|\blocalStorage\s*\.|\beval\s*\(/);
});

test("atlas and front door distinguish repo version from independently verified deployment", () => {
  const sourceVersion = manifest.runtime.version;
  assert.equal(sourceVersion, "v2.0-alpha.11.0.54.12", "atlas requires source-version review before manifest change");
  assert.ok(html.includes(".54.12 manifest"));
  assert.match(html, /Deployment version not verified/i);
  const home = read("site/index.html");
  const manual = read("site/manual/index.html");
  assert.ok(home.includes('href="./atlas/"'));
  assert.ok(manual.includes('href="../atlas/"'));
  assert.match(home, /PRODUCTION-VERIFIED HOTFIX/);
  assert.match(manual, /manual snapshot/i);
});
