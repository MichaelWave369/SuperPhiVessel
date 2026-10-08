import { createHash } from "node:crypto";
import { createCanaryState } from "../budgetgenius-bridge-v0.4/canary-lease.mjs";
import { evaluateCanaryCloseout } from "../budgetgenius-bridge-v0.6/closeout.mjs";

export const RUNTIME_OUTCOME_SCHEMA = "superphivessel.budgetgenius.runtime-outcome.v0.7";
export const RUNTIME_OUTCOME_RECEIPT = "BudgetGeniusCanaryRuntimeOutcomeReceipt";

export function assertRuntimeOutcomeReceipt(receipt) {
  requireObject("runtimeOutcome", receipt);
  if (receipt.schema !== RUNTIME_OUTCOME_SCHEMA || receipt.receiptType !== RUNTIME_OUTCOME_RECEIPT) {
    throw new Error("UNSUPPORTED_RUNTIME_OUTCOME_RECEIPT");
  }
  if (String(receipt.version) !== "0.7") throw new Error("UNSUPPORTED_RUNTIME_OUTCOME_VERSION");
  requireString("outcomeHash", receipt.outcomeHash);

  if (receipt.executionAuthorized !== false
      || receipt.mayDispatch !== false
      || receipt.executorAuthorizationRequired !== true
      || receipt.authorityGranted !== false
      || receipt.paidApprovalGranted !== false
      || receipt.scopeExpansionAllowed !== false
      || receipt.writebackAllowed !== false
      || receipt.verifiedOutcome !== false) {
    throw new Error("RUNTIME_OUTCOME_AUTHORITY_BOUNDARY_VIOLATED");
  }

  const { outcomeHash, ...definition } = receipt;
  if (sha256(canonicalJson(definition)) !== outcomeHash) {
    throw new Error("RUNTIME_OUTCOME_INTEGRITY_FAILURE");
  }

  requireObject("influence", receipt.influence);
  const influence = receipt.influence;
  if (influence.receiptType !== "BudgetGeniusCanaryInfluenceReceipt") {
    throw new Error("RUNTIME_OUTCOME_INFLUENCE_TYPE_INVALID");
  }
  if (influence.leaseId !== receipt.leaseId || influence.leaseHash !== receipt.leaseHash) {
    throw new Error("RUNTIME_OUTCOME_INFLUENCE_LEASE_MISMATCH");
  }
  if (influence.mandateRef !== receipt.mandateRef || influence.budgetPassRef !== receipt.budgetPassRef) {
    throw new Error("RUNTIME_OUTCOME_INFLUENCE_BUDGET_BINDING_MISMATCH");
  }
  if (influence.executionAuthorized !== false
      || influence.mayDispatch !== false
      || influence.executorAuthorizationRequired !== true
      || influence.authorityGranted !== false
      || influence.paidApprovalGranted !== false) {
    throw new Error("RUNTIME_OUTCOME_INFLUENCE_AUTHORITY_BOUNDARY_VIOLATED");
  }

  if (!["COMPLETED", "FAILED"].includes(receipt.executionStatus)) {
    throw new Error("RUNTIME_OUTCOME_EXECUTION_STATUS_INVALID");
  }
  const expectedCloseoutStatus = receipt.executionStatus === "COMPLETED"
    ? "AWAITING_VERIFICATION"
    : "ROLLBACK_REQUIRED";
  if (receipt.closeoutStatus !== expectedCloseoutStatus) {
    throw new Error("RUNTIME_OUTCOME_CLOSEOUT_STATUS_INVALID");
  }
  return true;
}

export function normalizeRuntimeInfluenceReceipt(runtimeOutcome) {
  assertRuntimeOutcomeReceipt(runtimeOutcome);
  return Object.freeze(structuredClone(runtimeOutcome.influence));
}

export function closeRuntimeOutcome({
  lease,
  runtimeOutcome,
  outcome,
  verificationResults,
  verificationPolicy = {},
  baselineEstimatedCostUsd,
  actualUsd = 0,
  attributableCostsUsd = []
}) {
  assertRuntimeOutcomeReceipt(runtimeOutcome);
  if (runtimeOutcome.executionStatus !== "COMPLETED") {
    throw new Error("RUNTIME_OUTCOME_NOT_COMPLETED");
  }
  if (runtimeOutcome.leaseId !== lease?.leaseId || runtimeOutcome.leaseHash !== lease?.leaseHash) {
    throw new Error("RUNTIME_OUTCOME_LEASE_MISMATCH");
  }

  const state = Object.freeze({
    ...createCanaryState(lease),
    decisionsUsed: 1,
    status: "ACTIVE"
  });

  return evaluateCanaryCloseout({
    lease,
    state,
    influenceReceipt: normalizeRuntimeInfluenceReceipt(runtimeOutcome),
    outcome,
    verificationResults,
    verificationPolicy,
    baselineEstimatedCostUsd,
    actualUsd,
    attributableCostsUsd
  });
}

export function runtimeOutcomeRollbackReceipt(runtimeOutcome) {
  assertRuntimeOutcomeReceipt(runtimeOutcome);
  if (runtimeOutcome.executionStatus !== "FAILED") {
    throw new Error("RUNTIME_OUTCOME_NOT_FAILED");
  }
  return Object.freeze({
    receiptType: "BudgetGeniusCanaryRuntimeRollbackReceipt",
    version: "0.7",
    leaseId: runtimeOutcome.leaseId,
    leaseHash: runtimeOutcome.leaseHash,
    runtimeOutcomeHash: runtimeOutcome.outcomeHash,
    reason: "EXECUTION_FAILED",
    errorCode: runtimeOutcome.errorCode ?? "REQUEST_FAILED",
    rollbackRequired: true,
    writebackAllowed: false,
    scopeExpansionAllowed: false,
    authorityGranted: false
  });
}

export function buildRuntimeOutcomeReceiptFixture({
  lease,
  influence,
  executionStatus = "COMPLETED",
  actualExecutor = "ollama::qwen3:8b",
  actualProvider = "ollama",
  actualModel = "qwen3:8b",
  providerReceiptHash = "fixture-provider-receipt",
  outputHash = "fixture-output",
  errorCode = null,
  timestamp = 1
}) {
  const completed = executionStatus === "COMPLETED";
  const definition = {
    schema: RUNTIME_OUTCOME_SCHEMA,
    receiptType: RUNTIME_OUTCOME_RECEIPT,
    version: "0.7",
    leaseId: lease.leaseId,
    leaseHash: lease.leaseHash,
    qualificationId: lease.qualificationId,
    mandateRef: lease.mandateRef,
    budgetPassRef: lease.budgetPassRef,
    runtimeInfluenceReceiptId: influence.influenceId,
    influence: structuredClone(influence),
    executionStatus,
    closeoutStatus: completed ? "AWAITING_VERIFICATION" : "ROLLBACK_REQUIRED",
    actualExecutor,
    actualProvider,
    actualModel,
    fallbackUsed: false,
    providerReceiptHash,
    outputHash: completed ? outputHash : null,
    errorCode: completed ? null : (errorCode ?? "REQUEST_FAILED"),
    verifiedOutcome: false,
    writebackAllowed: false,
    scopeExpansionAllowed: false,
    executionAuthorized: false,
    mayDispatch: false,
    executorAuthorizationRequired: true,
    authorityGranted: false,
    paidApprovalGranted: false,
    timestamp
  };
  return Object.freeze({
    ...definition,
    outcomeHash: sha256(canonicalJson(definition))
  });
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function requireObject(name, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(name + " must be an object");
}

function requireString(name, value) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(name + " is required");
}
