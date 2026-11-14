// PV-BROWSER-INTENT-0.1: explicit, provider-independent task dispatch.
// This module is not wired into the canonical Vessie runtime.
export const BROWSER_INTENT_VERSION = 'PV-BROWSER-INTENT-0.1';
const MAX_GOAL = 4000;
const MAX_NOTE = 300;
const MAX_LIST = 30;
const TERMINAL = new Set(['COMPLETE', 'FAILED', 'CANCELLED']);

function hold(reason) {
  return {
    ok: false,
    disposition: 'HELD',
    route: 'BROWSALLAX_TRUSTED_PAGE',
    version: BROWSER_INTENT_VERSION,
    reason,
    taskId: null,
    authority: 'NONE'
  };
}

function boundedList(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST)
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, MAX_NOTE))
    .filter(Boolean);
}

function boundedTask(task) {
  if (!task || typeof task !== 'object') return null;
  const state = String(task.status || 'UNKNOWN');
  const diagnostics = task.failureDiagnostics;
  return {
    taskId: String(task.id || '').slice(0, 128) || null,
    status: ['QUEUED', 'RUNNING', 'HELD', ...TERMINAL].includes(state) ? state : 'UNKNOWN',
    stepCount: Number.isInteger(task.stepCount) && task.stepCount >= 0 ? task.stepCount : null,
    error: typeof task.error === 'string' ? task.error.slice(0, 200) : null,
    heldReason: typeof task.held?.reason === 'string' ? task.held.reason.slice(0, 200) : null,
    // Bounded provenance only; no prompt, page content, credentials or raw model output.
    failureDiagnostics: diagnostics && typeof diagnostics === 'object' ? {
      provider: typeof diagnostics.provider === 'string' ? diagnostics.provider.slice(0, 64) : null,
      model: typeof diagnostics.model === 'string' ? diagnostics.model.slice(0, 128) : null,
      validationError: typeof diagnostics.validationError === 'string'
        ? diagnostics.validationError.slice(0, 200) : null,
      selectionBasis: typeof diagnostics.brainRegistryRoute?.selectionBasis === 'string'
        ? diagnostics.brainRegistryRoute.selectionBasis.slice(0, 128) : null
    } : null
  };
}

export function normalizeExplicitBrowserIntent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('BROWSER_INTENT_OBJECT_REQUIRED');
  }
  if (typeof input.url !== 'string' || !input.url.trim()) {
    throw new Error('BROWSER_INTENT_URL_REQUIRED');
  }
  let url;
  try {
    url = new URL(input.url);
  } catch {
    throw new Error('BROWSER_INTENT_URL_INVALID');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('BROWSER_INTENT_URL_NOT_ALLOWED');
  }
  if (typeof input.goal !== 'string' || !input.goal.trim()) {
    throw new Error('BROWSER_INTENT_GOAL_REQUIRED');
  }
  const goal = input.goal.trim();
  if (goal.length > MAX_GOAL) throw new Error('BROWSER_INTENT_GOAL_TOO_LONG');

  const spec = {
    url: url.toString(),
    goal,
    constraints: boundedList(input.constraints),
    successCriteria: boundedList(input.successCriteria),
    // The Browsallax main process validates these untrusted advisory inputs again.
    maxSteps: Number.isInteger(input.maxSteps) ? Math.max(1, Math.min(40, input.maxSteps)) : 20,
    maxDurationMs: Number.isInteger(input.maxDurationMs)
      ? Math.max(10000, Math.min(600000, input.maxDurationMs))
      : 180000
  };
  if (Array.isArray(input.acceptance)) spec.acceptance = input.acceptance.slice(0, 20);
  if (input.completeOnInitialAcceptance === true) spec.completeOnInitialAcceptance = true;
  if (input.plannerRegistry && typeof input.plannerRegistry === 'object' &&
      !Array.isArray(input.plannerRegistry)) {
    spec.plannerRegistry = input.plannerRegistry;
  }
  return spec;
}

// Does not call Vessie's normal provider/BrainC/hosted text-completion pipeline.
// Only the trusted Browsallax page bridge can create the governed task.
export async function dispatchExplicitBrowserIntent(input, options = {}) {
  let spec;
  try {
    spec = normalizeExplicitBrowserIntent(input);
  } catch (error) {
    return hold(error.message);
  }
  const operator = options.operator ?? globalThis.browsallaxOperator;
  if (typeof operator?.manifest !== 'function' || typeof operator?.startTask !== 'function') {
    return hold('BROWSALLAX_DESKTOP_BRIDGE_UNAVAILABLE');
  }

  let manifest;
  try {
    manifest = await operator.manifest();
  } catch {
    return hold('BROWSALLAX_MANIFEST_FAILED');
  }
  if (manifest?.schema !== 'browsallax.trusted-page-bridge.manifest.v1' ||
      manifest.capability !== 'DEDICATED_BROWSER_TASK' ||
      manifest.authority?.pageCanGrantAuthority !== false ||
      manifest.authority?.arbitraryTabAccess !== false ||
      manifest.authority?.bearerTokenExposed !== false) {
    return hold('BROWSALLAX_MANIFEST_NOT_TRUSTED');
  }
  if (manifest.connected !== true) return hold('BROWSALLAX_OPERATOR_OFFLINE');

  try {
    const response = await operator.startTask(spec);
    const task = boundedTask(response?.task);
    if (response?.ok !== true || !task?.taskId || task.status === 'UNKNOWN') {
      return hold('BROWSALLAX_TASK_CREATION_UNCONFIRMED');
    }
    return {
      ok: true,
      disposition: 'SUBMITTED',
      route: 'BROWSALLAX_TRUSTED_PAGE',
      version: BROWSER_INTENT_VERSION,
      taskId: task.taskId,
      task,
      authority: 'BROWSALLAX_POLICY_ENFORCED'
    };
  } catch {
    // An IPC failure may mean the task was created. No automatic retry.
    return hold('BROWSALLAX_TASK_OUTCOME_UNKNOWN_NO_RETRY');
  }
}

export async function inspectExplicitBrowserTask(taskId, options = {}) {
  if (typeof taskId !== 'string' || !/^[a-z0-9-]{1,128}$/i.test(taskId)) {
    return hold('BROWSALLAX_TASK_ID_INVALID');
  }
  const operator = options.operator ?? globalThis.browsallaxOperator;
  if (typeof operator?.getTask !== 'function') {
    return hold('BROWSALLAX_DESKTOP_BRIDGE_UNAVAILABLE');
  }
  try {
    const response = await operator.getTask(taskId);
    const task = boundedTask(response?.task);
    if (response?.ok !== true || task?.taskId !== taskId) {
      return hold('BROWSALLAX_TASK_LOOKUP_UNCONFIRMED');
    }
    return {
      ok: true,
      disposition: task.status,
      route: 'BROWSALLAX_TRUSTED_PAGE',
      version: BROWSER_INTENT_VERSION,
      taskId,
      task,
      authority: 'NONE'
    };
  } catch {
    return hold('BROWSALLAX_TASK_LOOKUP_FAILED');
  }
}


// Task control remains a direct, explicit human UI action. The native bridge
// checks caller ownership, and native policy still enforces interactive grants.
export async function controlExplicitBrowserTask(taskId, action, options = {}) {
  if (typeof taskId !== 'string' || !/^[a-z0-9-]{1,128}$/i.test(taskId)) {
    return hold('BROWSALLAX_TASK_ID_INVALID');
  }
  if (action !== 'RESUME' && action !== 'CANCEL') {
    return hold('BROWSALLAX_CONTROL_ACTION_NOT_ALLOWED');
  }
  const operator = options.operator ?? globalThis.browsallaxOperator;
  const method = action === 'RESUME' ? 'resumeTask' : 'cancelTask';
  if (typeof operator?.[method] !== 'function') {
    return hold('BROWSALLAX_DESKTOP_BRIDGE_UNAVAILABLE');
  }
  try {
    const response = action === 'CANCEL'
      ? await operator.cancelTask(taskId, 'VESSIE_EXPLICIT_CANCELLED')
      : await operator.resumeTask(taskId);
    const task = boundedTask(response?.task);
    if (response?.ok !== true || task?.taskId !== taskId || task.status === 'UNKNOWN') {
      return hold('BROWSALLAX_CONTROL_UNCONFIRMED_NO_RETRY');
    }
    return {
      ok: true,
      disposition: task.status,
      route: 'BROWSALLAX_TRUSTED_PAGE',
      version: BROWSER_INTENT_VERSION,
      taskId,
      task,
      authority: 'BROWSALLAX_POLICY_ENFORCED'
    };
  } catch {
    return hold('BROWSALLAX_CONTROL_OUTCOME_UNKNOWN_NO_RETRY');
  }
}
