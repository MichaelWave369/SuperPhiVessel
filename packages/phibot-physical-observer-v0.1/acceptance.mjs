import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as receiverModule from "./receiver.mjs";
import {
  receivePhysicalExperienceHandoff,
  validatePhysicalObserverHandoff,
  verifyPhysicalObserverReceipt
} from "./receiver.mjs";

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

function makePacket() {
  const query = makeMemory({
    id: "query",
    signals: ["cpu_temp_c", "load_1m"],
    flags: ["under_voltage_now"],
    peak: "notable"
  });
  const prior = makeMemory({
    id: "prior",
    signals: ["cpu_temp_c", "load_1m"],
    flags: ["under_voltage_now"],
    peak: "notable"
  });

  return physicalHandoff.createPhiBotPhysicalHandoff(query, [prior], {
    handoffId: "spv-acceptance-handoff-001",
    knownTime: { basis: "acceptance", sequence: 1 }
  });
}

const packet = makePacket();
assert.deepEqual(physicalHandoff.validatePhiBotPhysicalHandoff(packet), []);
assert.deepEqual(validatePhysicalObserverHandoff(packet), []);
ok("C01", "real-pinned-nbg-handoff-validates-at-spv-receiver");

const received = receivePhysicalExperienceHandoff(packet);
assert.equal(received.receiveStatus, "ACCEPTED_ADVISORY_ONLY");
assert.equal(received.authorityGranted, false);
assert.equal(received.view.authorityBanner, "NO_TOOL_OR_PHYSICAL_AUTHORITY");
assert.ok(received.view.questions.length >= 1);
ok("C02", "valid-handoff-becomes-read-only-observer-view");

assert.deepEqual(received.view.evidenceIndex, packet.evidenceIndex);
assert.ok(
  received.view.questions.every(
    (row) =>
      Array.isArray(row.evidenceIds) &&
      Array.isArray(row.evidenceMemoryIds)
  )
);
ok("C03", "observer-view-preserves-evidence-references");

assert.equal(verifyPhysicalObserverReceipt(received.receipt), true);
assert.equal(received.receipt.authorityGranted, false);
assert.equal(received.receipt.toolInvocationAllowed, false);
assert.equal(received.receipt.hardwareCommandAllowed, false);
assert.equal(received.receipt.independentAuthorizationStillRequired, true);
ok("C04", "receive-receipt-is-sha256-bound-and-non-authorizing");

const tamperedReceipt = {
  ...received.receipt,
  actionAuthorized: true
};
assert.equal(verifyPhysicalObserverReceipt(tamperedReceipt), false);
ok("C05", "receipt-authority-tamper-fails-integrity");

const tamperedPayload = structuredClone(packet);
tamperedPayload.advisory.uncertainty.push("INVENTED");
const payloadResult = receivePhysicalExperienceHandoff(tamperedPayload);
assert.equal(payloadResult.receiveStatus, "REFUSED");
assert.ok(
  payloadResult.errors.includes("UPSTREAM_HANDOFF_FINGERPRINT_MISMATCH")
);
ok("C06", "upstream-payload-tamper-is-refused");

const toolInjected = structuredClone(packet);
toolInjected.toolRequests.push({ tool: "gpio.write", value: 1 });
const toolResult = receivePhysicalExperienceHandoff(toolInjected);
assert.equal(toolResult.receiveStatus, "REFUSED");
assert.ok(toolResult.errors.includes("TOOL_REQUESTS_MUST_BE_EMPTY"));
ok("C07", "tool-request-injection-is-refused");

const commandInjected = structuredClone(packet);
commandInjected.physicalCommands.push("relay.on");
const commandResult = receivePhysicalExperienceHandoff(commandInjected);
assert.equal(commandResult.receiveStatus, "REFUSED");
assert.ok(commandResult.errors.includes("PHYSICAL_COMMANDS_MUST_BE_EMPTY"));
ok("C08", "physical-command-injection-is-refused");

const escalated = structuredClone(packet);
escalated.authority.mayInvokeTools = true;
const escalatedResult = receivePhysicalExperienceHandoff(escalated);
assert.equal(escalatedResult.receiveStatus, "REFUSED");
assert.ok(escalatedResult.errors.includes("AUTHORITY_BOUNDARY_MISMATCH"));
ok("C09", "authority-escalation-is-refused");

const unsafeAdvice = structuredClone(packet);
unsafeAdvice.advisory.boundaries.maintenanceRecommendation = true;
const unsafeResult = receivePhysicalExperienceHandoff(unsafeAdvice);
assert.equal(unsafeResult.receiveStatus, "REFUSED");
assert.ok(unsafeResult.errors.includes("UNSAFE_ADVISORY_PAYLOAD"));
ok("C10", "maintenance-promotion-is-refused");

const wrongRole = structuredClone(packet);
wrongRole.recipient.role = "PHIBOT_ACTUATOR";
const roleResult = receivePhysicalExperienceHandoff(wrongRole);
assert.equal(roleResult.receiveStatus, "REFUSED");
assert.ok(roleResult.errors.includes("RECIPIENT_ROLE_MISMATCH"));
ok("C11", "recipient-role-substitution-is-refused");

const exported = Object.keys(receiverModule);
assert.equal(exported.includes("execute"), false);
assert.equal(exported.includes("actuate"), false);
assert.equal(exported.includes("invokeTool"), false);
ok("C12", "receiver-package-exposes-no-execution-surface");

const second = receivePhysicalExperienceHandoff(makePacket());
assert.deepEqual(second, received);
ok("C13", "identical-pinned-input-produces-deterministic-receive-result");

console.log(
  "PhiBot physical observer receiver v0.1: PASS (" + passed + "/13)"
);
console.log(
  "NOTE receiver accepts advisory evidence only; tool and physical authority remain external."
);
