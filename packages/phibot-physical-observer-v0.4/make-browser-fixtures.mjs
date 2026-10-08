import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const outputDir = process.argv[2];
const nbgRoot = process.env.NBG_ROOT;
if (!outputDir || !nbgRoot) {
  throw new Error("OUTPUT_DIR_AND_NBG_ROOT_REQUIRED");
}

const provenance = await import(
  pathToFileURL(resolve(nbgRoot, "src/epistemicProvenance.js")).href
);
const physicalMemory = await import(
  pathToFileURL(resolve(nbgRoot, "src/phipiePhysicalMemory.js")).href
);
const handoff = await import(
  pathToFileURL(resolve(nbgRoot, "src/phibotPhysicalHandoff.js")).href
);

const compat =
  physicalMemory.PHIPIE_BRIDGE_COMPAT["phipie-nbg-memory-bridge/v0.1"];

function episode(id, signals, host = "host-test-a") {
  const hash = createHash("sha256").update(id).digest("hex");
  return provenance.createEpistemicMemory({
    memoryId: "phipie:host-health:" + id,
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
        start_sequence: 1,
        end_sequence: 5,
        peak_classification: "notable",
        signals,
        new_flags: ["under_voltage_now"],
        close_reason: "stable_recovery",
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
    evidence: [{
      evidenceId: "evidence-" + hash.slice(0, 16),
      kind: "OBSERVATION",
      source: {
        system: "PhiPie",
        journalContract: "phi-host-health-journal/v0.1",
        episodeContract: "phi-host-health-episode/v0.1",
        journalRecordHash: hash
      },
      knownTime: null,
      validTime: {
        basis: "phipie_host_sequence",
        startSequence: 1,
        endSequence: 5
      },
      details: {
        episodeId: id,
        sourceRole: "derived_from_read_only_host_telemetry"
      }
    }],
    authority: {
      retainable: true,
      reasoningUsable: true,
      actionAuthorized: false
    },
    validTime: {
      basis: "phipie_host_sequence",
      startSequence: 1,
      endSequence: 5
    },
    knownTime: null,
    tags: ["evidence","host-health","inferred","phipie","physical-episode"]
  });
}

function packet(suffix, signal = "cpu_temp_c") {
  const q = episode("browser-query-" + suffix, [signal, "load_1m"]);
  const p = episode("browser-prior-" + suffix, [signal, "load_1m"]);
  return handoff.createPhiBotPhysicalHandoff(q, [p], {
    handoffId: "browser-observer-" + suffix,
    knownTime: null
  });
}

const hostileString = '<img src=x onerror="window.__injected=true">';
const valid = packet("valid");
const markup = packet("markup", hostileString);
const toolInjected = structuredClone(valid);
toolInjected.toolRequests.push({ tool: "gpio.write", value: 1 });
const authorityInjected = structuredClone(valid);
authorityInjected.authority.mayInvokeTools = true;
const maintenanceInjected = structuredClone(valid);
maintenanceInjected.advisory.boundaries.maintenanceRecommendation = true;
const tampered = structuredClone(valid);
tampered.advisory.prompts[0].question = "This was altered after signing";

for (const safe of [valid, markup]) {
  if (handoff.validatePhiBotPhysicalHandoff(safe).length) {
    throw new Error("PINNED_NBG_FIXTURE_INVALID");
  }
}

const fixtures = {
  valid,
  markup,
  toolInjected,
  authorityInjected,
  maintenanceInjected,
  tampered
};
mkdirSync(resolve(outputDir), { recursive: true });
writeFileSync(
  resolve(outputDir, "observer-browser-fixtures.json"),
  JSON.stringify(fixtures, null, 2) + "\n"
);
console.log("PASS real pinned NBG produced valid, markup, and hostile browser fixtures");
