import crypto from "node:crypto";

export const RECEIVER_CONTRACT =
  "spv-phibot-physical-observer-receiver/v0.1";

export const UPSTREAM_HANDOFF_CONTRACT =
  "phibot-physical-experience-handoff/v0.1";

export const UPSTREAM_ADVISOR_CONTRACT =
  "phipie-physical-experience-advisor/v0.1";

export const RECIPIENT_ROLE = "PHIBOT_PHYSICAL_OBSERVER";

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

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
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

export function validatePhysicalObserverHandoff(packet) {
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

  if (
    !Array.isArray(packet.toolRequests) ||
    packet.toolRequests.length !== 0
  ) {
    errors.push("TOOL_REQUESTS_MUST_BE_EMPTY");
  }

  if (
    !Array.isArray(packet.physicalCommands) ||
    packet.physicalCommands.length !== 0
  ) {
    errors.push("PHYSICAL_COMMANDS_MUST_BE_EMPTY");
  }

  if (
    JSON.stringify(packet.purposes) !== JSON.stringify(ALLOWED_PURPOSES)
  ) {
    errors.push("PURPOSES_MISMATCH");
  }

  if (!validateAdvisor(packet.advisory)) {
    errors.push("UNSAFE_ADVISORY_PAYLOAD");
  }

  const expectedFingerprint = nbgFingerprint(bodyWithoutFingerprint(packet));
  if (packet.handoffFingerprint !== expectedFingerprint) {
    errors.push("UPSTREAM_HANDOFF_FINGERPRINT_MISMATCH");
  }

  return errors;
}

function buildObserverView(packet) {
  return {
    viewContract: "spv-phibot-physical-observer-view/v0.1",
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

function makeReceipt(packet, view) {
  const body = {
    receiptContract: "spv-phibot-physical-observer-receipt/v0.1",
    upstreamHandoffId: packet.handoffId,
    upstreamHandoffFingerprint: packet.handoffFingerprint,
    queryMemoryId: packet.queryMemoryId,
    viewFingerprint: sha256(view),
    receiveStatus: "ACCEPTED_ADVISORY_ONLY",
    authorityGranted: false,
    actionAuthorized: false,
    toolInvocationAllowed: false,
    hardwareCommandAllowed: false,
    independentAuthorizationStillRequired: true
  };

  return {
    ...body,
    receiptSha256: sha256(body)
  };
}

export function verifyPhysicalObserverReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") return false;
  const { receiptSha256, ...body } = receipt;
  return (
    typeof receiptSha256 === "string" &&
    receiptSha256 === sha256(body) &&
    receipt.authorityGranted === false &&
    receipt.actionAuthorized === false &&
    receipt.toolInvocationAllowed === false &&
    receipt.hardwareCommandAllowed === false &&
    receipt.independentAuthorizationStillRequired === true
  );
}

export function receivePhysicalExperienceHandoff(packet) {
  const errors = validatePhysicalObserverHandoff(packet);
  if (errors.length) {
    return {
      receiverContract: RECEIVER_CONTRACT,
      receiveStatus: "REFUSED",
      errors,
      view: null,
      receipt: null,
      authorityGranted: false
    };
  }

  const view = buildObserverView(packet);
  const receipt = makeReceipt(packet, view);

  return {
    receiverContract: RECEIVER_CONTRACT,
    receiveStatus: "ACCEPTED_ADVISORY_ONLY",
    errors: [],
    view,
    receipt,
    authorityGranted: false
  };
}
