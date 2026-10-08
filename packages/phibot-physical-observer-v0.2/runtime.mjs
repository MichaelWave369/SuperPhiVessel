import {
  receivePhysicalExperienceHandoff,
  verifyPhysicalObserverReceipt
} from "../phibot-physical-observer-v0.1/receiver.mjs";

export const RUNTIME_CONTRACT =
  "spv-phibot-physical-observer-runtime/v0.2";

export const OBSERVER_EVENT =
  "phibot.physical.observer_view";

export const CLEARED_EVENT =
  "phibot.physical.observer_cleared";

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

async function runtimeReceipt({
  status,
  handoffId,
  handoffFingerprint,
  upstreamReceiptSha256,
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
    upstreamReceiptSha256,
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
    const accepted = receivePhysicalExperienceHandoff(packet);

    if (accepted.receiveStatus !== "ACCEPTED_ADVISORY_ONLY") {
      return {
        runtimeContract: RUNTIME_CONTRACT,
        status: "REFUSED",
        errors: [...accepted.errors],
        view: null,
        receipt: null,
        authorityGranted: false
      };
    }

    if (!verifyPhysicalObserverReceipt(accepted.receipt)) {
      return {
        runtimeContract: RUNTIME_CONTRACT,
        status: "REFUSED",
        errors: ["UPSTREAM_RECEIVE_RECEIPT_INVALID"],
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
        upstreamReceiptSha256: accepted.receipt.receiptSha256,
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
        view: latest ? clone(latest.view) : clone(accepted.view),
        receipt: latest ? clone(latest.receipt) : null,
        authorityGranted: false
      };
    }

    const view = clone(accepted.view);
    const viewFingerprint = await sha256(view);
    const receipt = await runtimeReceipt({
      status: "DISPLAYED_ADVISORY_ONLY",
      handoffId,
      handoffFingerprint: packet.handoffFingerprint,
      upstreamReceiptSha256: accepted.receipt.receiptSha256,
      viewFingerprint
    });

    seen.set(handoffId, packet.handoffFingerprint);
    latest = {
      handoffId,
      handoffFingerprint: packet.handoffFingerprint,
      view,
      receipt
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
