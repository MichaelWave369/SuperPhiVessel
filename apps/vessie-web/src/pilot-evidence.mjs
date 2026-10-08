const STATES = new Set(['PASS','FAIL','NOT_RUN']);
const CHECKS = [
  'browser_https_pair',
  'browser_status_read',
  'browser_model_inventory',
  'session_revocation_request',
  'revoked_session_denied',
];
export function makeR2BrowserReceipt(input = {}, options = {}) {
  const checks = {};
  for (const key of CHECKS) {
    const status = input[key];
    checks[key] = STATES.has(status) ? status : 'NOT_RUN';
  }
  const count = Number.isSafeInteger(options.modelCount) && options.modelCount >= 0 &&
    options.modelCount <= 256 ? options.modelCount : null;
  const observed = Object.values(checks).filter(x => x === 'PASS').length;
  return {
    schema: 'superphivessel.gateway.r2.browser-field-report.v0.2',
    observation_source: 'UNATTESTED_BROWSER_CLIENT',
    generated_at_utc: new Date().toISOString(),
    scope: 'READ_ONLY_HTTPS_MODEL_DISCOVERY',
    revocation_proof_scope: 'BROWSER_OBSERVED_DENIAL_NOT_MACHINE_ATTESTED',
    checks,
    passed_checks: observed,
    model_count_observed: count,
    status: 'OPERATOR_REVIEW_REQUIRED',
    field_qualified: false,
    installed_models_approved: false,
    browser_restrictions_bypassed: false,
    secrets_included: false,
    credentials_included: false,
    model_names_included: false,
    host_identity_included: false,
    authority_granted: false,
  };
}
