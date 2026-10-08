import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const candidatePath = process.argv[2];
const fixturePath = process.argv[3];
const artifactDir = process.argv[4];
if (!candidatePath || !fixturePath || !artifactDir) {
  throw new Error("CANDIDATE_FIXTURE_AND_ARTIFACT_PATHS_REQUIRED");
}

mkdirSync(artifactDir, { recursive: true });
const fixtures = JSON.parse(readFileSync(fixturePath, "utf8"));
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage", "--no-sandbox"]
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  serviceWorkers: "block"
});

let checks = 0;
function ok(name) {
  checks += 1;
  console.log("PASS B" + String(checks).padStart(2, "0") + " " + name);
}

try {
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));

  await page.goto(pathToFileURL(resolve(candidatePath)).href, {
    waitUntil: "domcontentloaded",
    timeout: 90000
  });

  const host = page.locator("#pv-physical-observer-v03");
  await host.waitFor({ state: "attached", timeout: 30000 });
  assert.equal(await host.count(), 1);
  const launcher = host.locator(".launcher");
  const panel = host.locator(".panel");
  const textarea = host.locator("textarea");
  const review = host.getByRole("button", { name: "Review evidence" });
  const clear = host.getByRole("button", { name: "Clear" });
  const close = host.getByRole("button", { name: "Close" });
  const result = host.locator(".result");

  assert.equal(await panel.isVisible(), false);
  assert.equal(await launcher.isVisible(), true);
  assert.equal(await launcher.getAttribute("aria-expanded"), "false");
  ok("real-chromium-canonical-html-loads-with-hidden-observer-panel");

  await launcher.click();
  assert.equal(await panel.isVisible(), true);
  assert.equal(await launcher.getAttribute("aria-expanded"), "true");
  ok("operator-opens-real-browser-panel");

  await textarea.fill(JSON.stringify(fixtures.valid));
  await review.click();
  await result.getByText("ADVISORY ONLY: NO TOOL OR PHYSICAL AUTHORITY", {
    exact: true
  }).waitFor({ state: "visible", timeout: 20000 });
  assert.ok((await result.innerText()).includes("cpu_temp_c"));
  assert.ok((await result.innerText()).includes("Receipt SHA-256:"));
  assert.ok((await result.innerText()).includes("Evidence IDs:"));
  ok("pinned-nbg-handoff-renders-evidence-questions-and-receipt");

  await page.screenshot({
    path: resolve(artifactDir, "observer-desktop-valid.png"),
    fullPage: false
  });

  await review.click();
  await result.getByText("ADVISORY ONLY: NO TOOL OR PHYSICAL AUTHORITY", {
    exact: true
  }).waitFor({ state: "visible", timeout: 20000 });
  ok("exact-duplicate-handoff-does-not-escalate-or-duplicate-the-view");

  await textarea.fill("{invalid JSON");
  await review.click();
  await result.getByText(/REFUSED/).waitFor({ state: "visible" });
  assert.equal((await result.innerText()).includes("ADVISORY ONLY"), false);
  ok("malformed-json-fails-closed-and-clears-previous-visible-evidence");

  for (const [label, fixture] of [
    ["tool-injection", fixtures.toolInjected],
    ["authority-escalation", fixtures.authorityInjected],
    ["maintenance-promotion", fixtures.maintenanceInjected],
    ["fingerprint-tamper", fixtures.tampered]
  ]) {
    await textarea.fill(JSON.stringify(fixture));
    await review.click();
    await result.getByText(/REFUSED/).waitFor({ state: "visible" });
    assert.equal((await result.innerText()).includes("ADVISORY ONLY"), false);
    ok(label + "-refused-in-real-browser");
  }

  await textarea.fill(JSON.stringify(fixtures.markup));
  await review.click();
  await result.getByText("ADVISORY ONLY: NO TOOL OR PHYSICAL AUTHORITY", {
    exact: true
  }).waitFor({ state: "visible", timeout: 20000 });
  const hostile = '<img src=x onerror="window.__injected=true">';
  assert.ok((await result.innerText()).includes(hostile));
  assert.equal(await host.evaluate((node) => node.shadowRoot.querySelectorAll("img").length), 0);
  assert.equal(await page.evaluate(() => window.__injected === true), false);
  ok("untrusted-source-text-renders-as-text-not-html-script");

  await clear.click();
  assert.equal(await textarea.inputValue(), "");
  await result.getByText(/cleared/).waitFor({ state: "visible" });
  assert.equal((await result.innerText()).includes("ADVISORY ONLY"), false);
  ok("clear-erases-transient-input-and-evidence-display");

  await textarea.fill(JSON.stringify(fixtures.valid));
  await review.click();
  await result.getByText("ADVISORY ONLY: NO TOOL OR PHYSICAL AUTHORITY", {
    exact: true
  }).waitFor({ state: "visible", timeout: 20000 });
  ok("valid-handoff-can-be-reviewed-again-after-clear");

  await close.click();
  assert.equal(await panel.isVisible(), false);
  assert.equal(await launcher.getAttribute("aria-expanded"), "false");
  ok("observer-panel-can-close-without-changing-the-runtime");

  await page.setViewportSize({ width: 390, height: 844 });
  await launcher.click();
  assert.equal(await panel.isVisible(), true);
  const bounds = await panel.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391);
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 845);
  await page.screenshot({
    path: resolve(artifactDir, "observer-mobile-valid.png"),
    fullPage: false
  });
  ok("mobile-viewport-panel-remains-within-visible-browser-window");

  const panelErrors = runtimeErrors.filter((s) =>
    /phibotPhysical|PhysicalObserver|phibot-physical|WEB_CRYPTO_REQUIRED/.test(s)
  );
  assert.deepEqual(panelErrors, []);
  ok("no-physical-observer-specific-unhandled-browser-errors");

  console.log(
    "PhiBot physical observer real-browser qualification: PASS (" +
      checks +
      "/15)"
  );
  console.log(
    "NOTE this is headless Chromium acceptance against generated candidate HTML, not operator review or canonical promotion."
  );
} finally {
  await context.close();
  await browser.close();
}
