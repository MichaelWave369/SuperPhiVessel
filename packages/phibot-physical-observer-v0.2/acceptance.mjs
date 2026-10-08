import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createPhysicalObserverRuntime,
  validateRuntimeHandoff,
  verifyRuntimeReceipt
} from "./runtime.mjs";
import {
  validatePhysicalObserverHandoff
} from "../phibot-physical-observer-v0.1/receiver.mjs";

const nbgRoot = process.env.NBG_ROOT;
if (!nbgRoot) throw new Error("NBG_ROOT is required");

const provenance = await import(
  pathToFileURL(resolve(nbgRoot, "src/epistemicProvenance.js")).href
);
const physicalMemory = await import(
  pathToFileURL(resolve(nbgRoot, "src/phipiePhysicalMemory.js")).href
);
const physicalHandoff = await import(
  pathToFileURL(resolve(nbgRoot, "src/phibotPhysicalHandoff.js")).href
);

const compat =
  physicalMemory.PHIPIE_BRIDGE_COMPAT["phipie-nbg-memory-bridge/v0.1"];

let passed = 0;
function ok(id, name) {
  passed += 1;
  console.log("PASS " + id + " " + name);
}

function makeMemory({
  id,
  host = "host-a",
  signals = ["cpu_temp_c"],
  flags = [],
  peak = "watch",
  closeReason = "stable_recovery",
  start = 1,
  end = 4
} = {}) {
  const memoryId = "phipie:host-health:" + id;
  const journalHash = createHash("sha256").update(id).digest("hex");

  return provenance.createEpistemicMemory({
    memoryId,
    content: {
      kind: "PHIPIE_HOST_HEALTH_EPISODE",
      episode: {
        contract: "phi-host-memory-envelope/v0.1",
        kind: "host_health_episode",
        episode_id: id,
        host_identity: {
          board_serial_sha256: host,
          machine_id_sha256: host + "-machine"
        },
        start_sequence: start,
        end_sequence: end,
        peak_classification: peak,
        signals,
        new_flags: flags,
        close_reason: closeReason,
        suggested_memory_role: "evidence",
        authority_effect: "none"
      },
      producer: {
        system: "PhiPie",
        bridgeContract: "phipie-nbg-memory-bridge/v0.1",
        nbgSchemaSource: compat.schemaSource,
        nbgSchemaBlobSha: compat.schemaBlobSha
      },
      semanticBoundary: {
        episodeIsFault: false,
        stableMeansSafe: false,
        actionAuthorityGranted: false
      }
    },
    origin: "INFERRED",
    confidence: 0.5,
    evidence: [
      {
        evidenceId: "evidence-" + journalHash.slice(0, 16),
        kind: "OBSERVATION",
        source: {
          system: "PhiPie",
          journalContract: "phi-host-health-journal/v0.1",
          episodeContract: "phi-host-health-episode/v0.1",
          journalRecordHash: journalHash
        },
        knownTime: null,
        validTime: {
          basis: "phipie_host_sequence",
          startSequence: start,
          endSequence: end
        },
        details: {
          episodeId: id,
          sourceRole: "derived_from_read_only_host_telemetry"
        }
      }
    ],
    authority: {
      retainable: true,
      reasoningUsable: true,
      actionAuthorized: false
    },
    validTime: {
      basis: "phipie_host_sequence",
      startSequence: start,
      endSequence: end
    },
    knownTime: null,
    tags: [
      "evidence",
      "host-health",
      "inferred",
      "phipie",
      "physical-episode"
    ]
  });
}

function makePacket({
  handoffId = "spv-runtime-handoff-001",
  signal = "cpu_temp_c"
} = {}) {
  const query = makeMemory({
    id: "query-" + signal,
    signals: [signal, "load_1m"],
    flags: ["under_voltage_now"],
    peak: "notable"
  });
  const prior = makeMemory({
    id: "prior-" + signal,
    signals: [signal, "load_1m"],
    flags: ["under_voltage_now"],
    peak: "notable"
  });

  return physicalHandoff.createPhiBotPhysicalHandoff(query, [prior], {
    handoffId,
    knownTime: { basis: "acceptance", sequence: 2 }
  });
}

const packet = makePacket();
assert.deepEqual(physicalHandoff.validatePhiBotPhysicalHandoff(packet), []);
assert.deepEqual(validatePhysicalObserverHandoff(packet), []);
assert.deepEqual(validateRuntimeHandoff(packet), []);
ok("C01", "browser-runtime-validator-agrees-with-pinned-nbg-and-v01-receiver");

const receipts = [];
const events = [];
const runtime = createPhysicalObserverRuntime({
  appendReceipt: (receipt) => receipts.push(structuredClone(receipt)),
  emitEvent: (name, payload) =>
    events.push({ name, payload: structuredClone(payload) })
});

const first = await runtime.receive(packet);
assert.equal(first.status, "DISPLAYED_ADVISORY_ONLY");
assert.equal(first.authorityGranted, false);
assert.equal(first.view.authorityBanner, "NO_TOOL_OR_PHYSICAL_AUTHORITY");
assert.ok(first.view.questions.length >= 1);
ok("C02", "valid-handoff-enters-ephemeral-read-only-runtime-view");

assert.equal(receipts.length, 1);
assert.equal(events.length, 1);
assert.equal(events[0].name, "phibot.physical.observer_view");
assert.deepEqual(events[0].payload, first.view);
ok("C03", "runtime-emits-only-the-sanitized-observer-view");

assert.equal(await verifyRuntimeReceipt(first.receipt), true);
assert.equal(first.receipt.authorityGranted, false);
assert.equal(first.receipt.toolInvocationAllowed, false);
assert.equal(first.receipt.hardwareCommandAllowed, false);
assert.equal(first.receipt.persistentStorageWritten, false);
ok("C04", "browser-webcrypto-receipt-is-valid-and-non-authorizing");

const duplicate = await runtime.receive(packet);
assert.equal(duplicate.status, "DUPLICATE");
assert.equal(receipts.length, 1);
assert.equal(events.length, 1);
ok("C05", "identical-handoff-replay-is-idempotent");

const conflicting = makePacket({
  handoffId: packet.handoffId,
  signal: "memory_available_ratio"
});
const conflict = await runtime.receive(conflicting);
assert.equal(conflict.status, "REFUSED_CONFLICT");
assert.ok(conflict.errors.includes("HANDOFF_ID_FINGERPRINT_CONFLICT"));
assert.equal(receipts.length, 2);
assert.equal(events.length, 1);
assert.equal(await verifyRuntimeReceipt(conflict.receipt), true);
ok("C06", "same-handoff-id-different-fingerprint-fails-closed");

const toolInjected = structuredClone(makePacket({ handoffId: "tool-injected" }));
toolInjected.toolRequests.push({ tool: "gpio.write", value: 1 });
const toolResult = await runtime.receive(toolInjected);
assert.equal(toolResult.status, "REFUSED");
assert.ok(toolResult.errors.includes("TOOL_REQUESTS_MUST_BE_EMPTY"));
ok("C07", "tool-request-injection-never-enters-runtime-view");

const authorityInjected = structuredClone(
  makePacket({ handoffId: "authority-injected" })
);
authorityInjected.authority.mayInvokeTools = true;
const authorityResult = await runtime.receive(authorityInjected);
assert.equal(authorityResult.status, "REFUSED");
assert.ok(authorityResult.errors.includes("AUTHORITY_BOUNDARY_MISMATCH"));
ok("C08", "authority-escalation-never-enters-runtime-view");

const maintenanceInjected = structuredClone(
  makePacket({ handoffId: "maintenance-injected" })
);
maintenanceInjected.advisory.boundaries.maintenanceRecommendation = true;
const maintenanceResult = await runtime.receive(maintenanceInjected);
assert.equal(maintenanceResult.status, "REFUSED");
assert.ok(maintenanceResult.errors.includes("UNSAFE_ADVISORY_PAYLOAD"));
ok("C09", "maintenance-promotion-never-enters-runtime-view");

assert.equal(runtime.status().state, "ADVISORY_VIEW_AVAILABLE");
const cleared = runtime.clear();
assert.equal(cleared.state, "EMPTY");
assert.equal(events.at(-1).name, "phibot.physical.observer_cleared");
ok("C10", "observer-view-state-is-explicitly-clearable");

const runtimeSource = readFileSync(
  "packages/phibot-physical-observer-v0.2/runtime.mjs",
  "utf8"
);
assert.equal(runtimeSource.includes("node:"), false);
assert.equal(runtimeSource.includes("localStorage"), false);
assert.equal(runtimeSource.includes("sessionStorage"), false);
assert.equal(runtimeSource.includes("indexedDB"), false);
ok("C11", "runtime-seam-is-browser-native-and-writes-no-browser-persistent-storage");

const api = createPhysicalObserverRuntime();
assert.deepEqual(Object.keys(api).sort(), ["clear", "receive", "status"]);
assert.equal("execute" in api, false);
assert.equal("actuate" in api, false);
assert.equal("invokeTool" in api, false);
ok("C12", "runtime-api-exposes-no-execution-or-tool-surface");

const deterministicA = createPhysicalObserverRuntime();
const deterministicB = createPhysicalObserverRuntime();
const packetA = makePacket({ handoffId: "deterministic" });
const a = await deterministicA.receive(packetA);
const b = await deterministicB.receive(packetA);
assert.deepEqual(a, b);
ok("C13", "identical-input-produces-deterministic-runtime-result");

const tamperedReceipt = {
  ...a.receipt,
  actionAuthorized: true
};
assert.equal(await verifyRuntimeReceipt(tamperedReceipt), false);
ok("C14", "runtime-receipt-authority-tamper-fails-integrity");

console.log(
  "PhiBot physical observer runtime seam v0.2: PASS (" + passed + "/14)"
);
console.log(
  "NOTE v0.2 is ephemeral, browser-native, default-unwired, and exposes no tool or physical action surface."
);
