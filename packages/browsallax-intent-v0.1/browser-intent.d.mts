export interface ExplicitBrowserIntent {
  url: string;
  goal: string;
  constraints?: string[];
  successCriteria?: string[];
  acceptance?: unknown[];
  maxSteps?: number;
  maxDurationMs?: number;
  completeOnInitialAcceptance?: boolean;
  plannerRegistry?: Record<string, unknown>;
}
export interface BrowserTaskSummary {
  taskId: string | null;
  status: string;
  stepCount: number | null;
  error: string | null;
  heldReason: string | null;
  failureDiagnostics: {
    provider: string | null;
    model: string | null;
    validationError: string | null;
    selectionBasis: string | null;
  } | null;
}
export interface BrowserIntentOutcome {
  ok: boolean;
  disposition: string;
  route: string;
  version: string;
  reason?: string;
  taskId: string | null;
  authority: string;
  task?: BrowserTaskSummary;
}
export const BROWSER_INTENT_VERSION: string;
export function normalizeExplicitBrowserIntent(input: ExplicitBrowserIntent): ExplicitBrowserIntent;
export function dispatchExplicitBrowserIntent(
  input: ExplicitBrowserIntent,
  options?: { operator?: unknown }
): Promise<BrowserIntentOutcome>;
export function inspectExplicitBrowserTask(
  taskId: string,
  options?: { operator?: unknown }
): Promise<BrowserIntentOutcome>;
export function controlExplicitBrowserTask(
  taskId: string,
  action: 'RESUME' | 'CANCEL',
  options?: { operator?: unknown }
): Promise<BrowserIntentOutcome>;
