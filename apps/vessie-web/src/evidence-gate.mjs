/* SPV-AM Evidence Gate V3: deterministic, non-authoritative incident policy.
 * Caller must construct source records independently of model output.
 * A VERIFIED label and URL are assertions, not independently authenticated facts.
 * The gate has no side effects and cannot close Anti-M contracts.
 */
export const EVIDENCE_GATE_CONTEXT_SCHEMA = 'superphivessel.evidence-gate.context.v0.1';
export const EVIDENCE_GATE_RESULT_SCHEMA = 'superphivessel.evidence-gate.assessment.v0.1';
export const EVIDENCE_GATE_POLICY = 'SPV-AM-EG-V3.0';
const RISKS = ['undetermined', 'low', 'medium', 'high', 'critical'];
const STATUSES = ['reported', 'verified_down', 'healthy', 'unknown'];
const CONFIDENCES = ['low', 'medium', 'high'];
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const REF = /^(https:\/\/[^\s\u0000-\u001f]{4,292}|sha256:[0-9a-f]{64})$/;

function refuse(ok, code) { if (!ok) throw new Error('EVIDENCE_GATE_' + code); }
function object(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function exact(x, keys) {
  refuse(object(x) && Object.keys(x).sort().join('|') === [...keys].sort().join('|'), 'FIELDS');
}
function text(x, max) {
  return typeof x === 'string' && x.trim().length > 0 && x.length <= max &&
    !/[\u0000-\u001f\u007f]/.test(x);
}

function inspectContext(context) {
  exact(context, ['schema', 'sources']);
  refuse(context.schema === EVIDENCE_GATE_CONTEXT_SCHEMA, 'SCHEMA');
  refuse(Array.isArray(context.sources) && context.sources.length >= 1 &&
    context.sources.length <= 24, 'SOURCE_LIMIT');
  const ids = new Set();
  for (const source of context.sources) {
    exact(source, ['id', 'kind', 'provenance', 'statement', 'reference',
      'riskLevel', 'observedConnectivity']);
    refuse(typeof source.id === 'string' && ID.test(source.id) && !ids.has(source.id),
      'SOURCE_ID');
    ids.add(source.id);
    refuse(text(source.statement, 300), 'SOURCE_TEXT');
    if (source.kind === 'REPORT') {
      refuse(source.provenance === 'REPORTED' && source.reference === null &&
        source.riskLevel === null && source.observedConnectivity === null, 'REPORT_SHAPE');
    } else if (source.kind === 'IMPACT') {
      refuse(source.provenance === 'VERIFIED' && typeof source.reference === 'string' &&
        REF.test(source.reference) && RISKS.slice(1).includes(source.riskLevel) &&
        source.observedConnectivity === null, 'IMPACT_SHAPE');
    } else if (source.kind === 'CONNECTIVITY') {
      refuse(source.provenance === 'VERIFIED' && typeof source.reference === 'string' &&
        REF.test(source.reference) && source.riskLevel === null &&
        ['UP', 'DOWN'].includes(source.observedConnectivity), 'CONNECTIVITY_SHAPE');
    } else {
      refuse(false, 'SOURCE_KIND');
    }
  }
  return context.sources;
}

function inspectProposal(proposal) {
  exact(proposal, ['status', 'risk', 'confidence', 'evidence', 'action']);
  refuse(STATUSES.includes(proposal.status), 'STATUS');
  refuse(RISKS.includes(proposal.risk), 'RISK');
  refuse(CONFIDENCES.includes(proposal.confidence), 'CONFIDENCE');
  refuse(text(proposal.action, 500), 'ACTION');
  refuse(Array.isArray(proposal.evidence) && proposal.evidence.length <= 24 &&
    proposal.evidence.every(x => typeof x === 'string' && ID.test(x)) &&
    new Set(proposal.evidence).size === proposal.evidence.length, 'EVIDENCE_IDS');
}

/** Evaluate an untrusted model proposal against caller-provided, source-custodied facts.
 * Never call this with a context assembled or "verified" by the proposing model.
 * Result ALLOW means "meets this narrow assessment rule", not action approval.
 */
export function evaluateEvidenceGate(proposal, context) {
  inspectProposal(proposal);
  const sources = inspectContext(context);
  const byId = new Map(sources.map(s => [s.id, s]));
  const violations = [];
  const add = code => { if (!violations.includes(code)) violations.push(code); };
  const cited = proposal.evidence.map(id => {
    const source = byId.get(id);
    if (!source) add('UNKNOWN_EVIDENCE_ID');
    return source;
  }).filter(Boolean);
  const anyReport = sources.some(s => s.kind === 'REPORT');
  if (anyReport && !cited.some(s => s.kind === 'REPORT')) add('REPORT_NOT_CITED');

  const connectivity = sources.filter(s => s.kind === 'CONNECTIVITY');
  const citedDown = cited.some(s => s.kind === 'CONNECTIVITY' &&
    s.observedConnectivity === 'DOWN');
  const citedUp = cited.some(s => s.kind === 'CONNECTIVITY' &&
    s.observedConnectivity === 'UP');
  if (connectivity.some(s => s.observedConnectivity === 'UP') &&
    connectivity.some(s => s.observedConnectivity === 'DOWN')) add('CONTRADICTORY_CONNECTIVITY');
  if (proposal.status === 'reported' && !cited.some(s => s.kind === 'REPORT')) {
    add('REPORTED_STATUS_NOT_SOURCED');
  }
  if (proposal.status === 'verified_down' && !citedDown) add('DOWN_NOT_VERIFIED');
  if (proposal.status === 'healthy' && !citedUp) add('HEALTH_NOT_VERIFIED');

  const impact = sources.filter(s => s.kind === 'IMPACT');
  const levels = new Set(impact.map(s => s.riskLevel));
  if (levels.size > 1) add('CONTRADICTORY_IMPACT');
  if (impact.length === 0 && proposal.risk !== 'undetermined') {
    add('UNSUPPORTED_SEVERITY');
  }
  if (impact.length > 0 && proposal.risk !== 'undetermined') {
    if (levels.size !== 1 || !levels.has(proposal.risk)) add('SEVERITY_MISMATCH');
    if (!cited.some(s => s.kind === 'IMPACT' && s.riskLevel === proposal.risk)) {
      add('IMPACT_NOT_CITED');
    }
  }
  if (!citedDown && !citedUp && proposal.confidence !== 'low') {
    add('UNSUPPORTED_DIAGNOSTIC_CONFIDENCE');
  }
  return {
    schema: EVIDENCE_GATE_RESULT_SCHEMA,
    policyVersion: EVIDENCE_GATE_POLICY,
    decision: violations.length ? 'REJECT' : 'ALLOW_ASSESSMENT_ONLY',
    violations,
    proposal: {
      status: proposal.status, risk: proposal.risk,
      confidence: proposal.confidence, evidence: [...proposal.evidence],
      action: proposal.action
    },
    sourceIds: sources.map(s => s.id),
    trustScope: 'CALLER_SUPPLIED_SOURCES_NOT_INDEPENDENTLY_ATTESTED',
    persistentLedgerWritten: false,
    closureGranted: false,
    executionAuthorityGranted: false
  };
}
