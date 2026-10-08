export type PilotChecks = {
  browser_https_pair: 'PASS' | 'FAIL' | 'NOT_RUN';
  browser_status_read: 'PASS' | 'FAIL' | 'NOT_RUN';
  browser_model_inventory: 'PASS' | 'FAIL' | 'NOT_RUN';
  session_revocation_request: 'PASS' | 'FAIL' | 'NOT_RUN';
  revoked_session_denied: 'PASS' | 'FAIL' | 'NOT_RUN';
};
export function makeR2BrowserReceipt(checks?:Partial<PilotChecks>,options?:{modelCount:number|null}):Record<string,unknown>;
