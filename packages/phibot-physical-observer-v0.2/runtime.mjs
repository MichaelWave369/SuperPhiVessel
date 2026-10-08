export const RUNTIME_CONTRACT =
  "spv-phibot-physical-observer-runtime/v0.2";

export const UPSTREAM_HANDOFF_CONTRACT =
  "phibot-physical-experience-handoff/v0.1";

export const UPSTREAM_ADVISOR_CONTRACT =
  "phipie-physical-experience-advisor/v0.1";

export const RECIPIENT_ROLE = "PHIBOT_PHYSICAL_OBSERVER";

export const OBSERVER_EVENT =
  "phibot.physical.observer_view";

export const CLEARED_EVENT =
  "phibot.physical.observer_cleared";

const ALLOWED_PURPOSES = Object.freeze([
  "READ_ONLY_EVIDENCE_REVIEW",
  "FORMULATE_OBSERVATION_QUESTIONS"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        out[key] = stable(value[key]);
        return out;
      }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stable(value));
}

function nbgFingerprint(value) {
  const text = typeof value === "string" ? value : stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "fnv1a32:" + (hash >>> 0).toString(16).padStart(8, "0");
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WEB_CRYPTO_REQUIRED");
  }
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bodyWithoutFingerprint(packet) {
  const { handoffFingerprint: _handoffFingerprint, ...body } = packet;
  return body;
}

function validateAuthority(authority) {
  return (
    authority?.grantsAuthority === false &&
    authority?.actionAuthorized === false &&
    authority?.mayInvokeTools === false &&
    authority?.mayIssueHardwareCommands === false &&
    authority?.requiresIndependentToolAuthorization === true &&
    authority?.safetyPlaneUnaffected === true
  );
}

function validateAdvisor(advisory) {
  const boundaries = advisory?.boundaries;
  if (!boundaries) return false;

  return (
    boundaries.causalClaim === false &&
    boundaries.diagnosticConclusion === false &&
    boundaries.safetyConclusion === false &&
    boundaries.maintenanceRecommendation === false &&
    boundaries.physicalActionRecommendation === false &&
    boundaries.actionAuthorized === false &&
    boundaries.hardwareCommand === null &&
    boundaries.allowedOutput ===
      "READ_ONLY_OBSERVATION_QUESTIONS_AND_EVIDENCE_REVIEW_ONLY"
  );
}

function expectedEvidenceIndex(advisory) {
  const memoryIds = new Set();
  const evidenceIds = new Set();

  (advisory?.prompts ?? []).forEach((prompt) => {
    (prompt.evidenceMemoryIds ?? []).forEach((value) => memoryIds.add(value));
    (prompt.evidenceIds ?? []).forEach((value) => evidenceIds.add(value));
  });

  return {
    memoryIds: [...memoryIds].sort(),
    evidenceIds: [...evidenceIds].sort()
  };
}

export function validateRuntimeHandoff(packet) {
  const errors = [];

  if (!packet || typeof packet !== "object") {
    return ["HANDOFF_OBJECT_REQUIRED"];
  }

  if (packet.contract !== UPSTREAM_HANDOFF_CONTRACT) {
    errors.push("UPSTREAM_HANDOFF_CONTRACT_MISMATCH");
  }

  if (packet.producer?.system !== "NestedBubbleGear") {
    errors.push("UPSTREAM_PRODUCER_MISMATCH");
  }

  if (packet.producer?.sourceAdvisorContract !== UPSTREAM_ADVISOR_CONTRACT) {
    errors.push("UPSTREAM_ADVISOR_CONTRACT_MISMATCH");
  }

  if (packet.recipient?.role !== RECIPIENT_ROLE) {
    errors.push("RECIPIENT_ROLE_MISMATCH");
  }

  if (!validateAuthority(packet.authority)) {
    errors.push("AUTHORITY_BOUNDARY_MISMATCH");
  }

  if (!Array.isArray(packet.toolRequests) || packet.toolRequests.length !== 0) {
    errors.push("TOOL_REQUESTS_MUST_BE_EMPTY");
  }

  if (
    !Array.isArray(packet.physicalCommands) ||
    packet.physicalCommands.length !== 0
  ) {
    errors.push("PHYSICAL_COMMANDS_MUST_BE_EMPTY");
  }

  if (JSON.stringify(packet.purposes) !== JSON.stringify(ALLOWED_PURPOSES)) {
    errors.push("PURPOSES_MISMATCH");
  }

  if (!validateAdvisor(packet.advisory)) {
    errors.push("UNSAFE_ADVISORY_PAYLOAD");
  }

  if (packet.queryMemoryId !== packet.advisory?.queryMemoryId) {
    errors.push("QUERY_MEMORY_ID_MISMATCH");
  }

  if (
    JSON.stringify(packet.evidenceIndex) !==
    JSON.stringify(expectedEvidenceIndex(packet.advisory))
  ) {
    errors.push("EVIDENCE_INDEX_MISMATCH");
  }

  const expectedFingerprint = nbgFingerprint(bodyWithoutFingerprint(packet));
  if (packet.handoffFingerprint !== expectedFingerprint) {
    errors.push("UPSTREAM_HANDOFF_FINGERPRINT_MISMATCH");
  }

  return errors;
}

function buildObserverView(packet) {
  return {
    viewContract: "spv-phibot-physical-observer-view/v0.2",
    queryMemoryId: packet.queryMemoryId,
    historyMatchCount: packet.advisory.historyMatchCount,
    questions: (packet.advisory.prompts ?? []).map((prompt) => ({
      kind: prompt.kind,
      subject: prompt.subject,
      supportCount: prompt.supportCount,
      meanSimilarity: prompt.meanSimilarity,
      question: prompt.question,
      readOnlyObservationSuggestion: prompt.readOnlyObservationSuggestion,
      boundary: prompt.boundary,
      evidenceMemoryIds: [...(prompt.evidenceMemoryIds ?? [])],
      evidenceIds: [...(prompt.evidenceIds ?? [])]
    })),
    uncertainty: [...(packet.advisory.uncertainty ?? [])],
    evidenceIndex: clone(packet.evidenceIndex),
    authorityBanner: "NO_TOOL_OR_PHYSICAL_AUTHORITY",
    allowedInteraction:
      "DISPLAY_AND_REASON_OVER_READ_ONLY_EVIDENCE_QUESTIONS_ONLY"
  };
}

async function runtimeReceipt({
  status,
  handoffId,
  handoffFingerprint,
  viewFingerprint = null,
  reason = null
}) {
  const body = {
    receiptContract:
      "spv-phibot-physical-observer-runtime-receipt/v0.2",
    runtimeContract: RUNTIME_CONTRACT,
    status,
    handoffId,
    handoffFingerprint,
    viewFingerprint,
    reason,
    authorityGranted: false,
    actionAuthorized: false,
    toolInvocationAllowed: false,
    hardwareCommandAllowed: false,
    persistentStorageWritten: false,
    independentAuthorizationStillRequired: true
  };

  return {
    ...body,
    receiptSha256: await sha256(body)
  };
}

export async function verifyRuntimeReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") return false;
  const { receiptSha256, ...body } = receipt;
  return (
    typeof receiptSha256 === "string" &&
    receiptSha256 === await sha256(body) &&
    receipt.authorityGranted === false &&
    receipt.actionAuthorized === false &&
    receipt.toolInvocationAllowed === false &&
    receipt.hardwareCommandAllowed === false &&
    receipt.persistentStorageWritten === false &&
    receipt.independentAuthorizationStillRequired === true
  );
}

function normalizeCallback(value) {
  return typeof value === "function" ? value : () => {};
}

export function createPhysicalObserverRuntime({
  appendReceipt,
  emitEvent
} = {}) {
  const writeReceipt = normalizeCallback(appendReceipt);
  const emit = normalizeCallback(emitEvent);

  const seen = new Map();
  let latest = null;

  async function receive(packet) {
    const errors = validateRuntimeHandoff(packet);

    if (errors.length) {
      return {
        runtimeContract: RUNTIME_CONTRACT,
        status: "REFUSED",
        errors,
        view: null,
        receipt: null,
        authorityGranted: false
      };
    }

    const handoffId = packet.handoffId;
    const priorFingerprint = seen.get(handoffId);

    if (priorFingerprint && priorFingerprint !== packet.handoffFingerprint) {
      const receipt = await runtimeReceipt({
        status: "REFUSED_CONFLICT",
        handoffId,
        handoffFingerprint: packet.handoffFingerprint,
        reason: "HANDOFF_ID_FINGERPRINT_CONFLICT"
      });
      writeReceipt(clone(receipt));
      return {
        runtimeContract: RUNTIME_CONTRACT,
        status: "REFUSED_CONFLICT",
        errors: ["HANDOFF_ID_FINGERPRINT_CONFLICT"],
        view: null,
        receipt,
        authorityGranted: false
      };
    }

    if (priorFingerprint === packet.handoffFingerprint) {
      return {
        runtimeContract: RUNTIME_CONTRACT,
        status: "DUPLICATE",
        errors: [],
        view: latest?.handoffId === handoffId ? clone(latest.view) : null,
        receipt: latest?.handoffId === handoffId ? clone(latest.receipt) : null,
        authorityGranted: false
      };
    }

    const view = buildObserverView(packet);
    const viewFingerprint = await sha256(view);
    const receipt = await runtimeReceipt({
      status: "DISPLAYED_ADVISORY_ONLY",
      handoffId,
      handoffFingerprint: packet.handoffFingerprint,
      viewFingerprint
    });

    seen.set(handoffId, packet.handoffFingerprint);
    latest = {
      handoffId,
      handoffFingerprint: packet.handoffFingerprint,
      view: clone(view),
      receipt: clone(receipt)
    };

    writeReceipt(clone(receipt));
    emit(OBSERVER_EVENT, clone(view));

    return {
      runtimeContract: RUNTIME_CONTRACT,
      status: "DISPLAYED_ADVISORY_ONLY",
      errors: [],
      view: clone(view),
      receipt: clone(receipt),
      authorityGranted: false
    };
  }

  function status() {
    if (!latest) {
      return {
        runtimeContract: RUNTIME_CONTRACT,
        state: "EMPTY",
        handoffId: null,
        handoffFingerprint: null,
        viewFingerprint: null,
        authorityGranted: false
      };
    }

    return {
      runtimeContract: RUNTIME_CONTRACT,
      state: "ADVISORY_VIEW_AVAILABLE",
      handoffId: latest.handoffId,
      handoffFingerprint: latest.handoffFingerprint,
      viewFingerprint: latest.receipt.viewFingerprint,
      authorityGranted: false
    };
  }

  function clear() {
    seen.clear();
    latest = null;
    emit(CLEARED_EVENT, {
      runtimeContract: RUNTIME_CONTRACT,
      authorityGranted: false
    });
    return status();
  }

  return Object.freeze({
    receive,
    status,
    clear
  });
}
