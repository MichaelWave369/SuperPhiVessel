export type EvidenceStatus = 'reported'|'verified_down'|'healthy'|'unknown';
export type EvidenceRisk = 'undetermined'|'low'|'medium'|'high'|'critical';
export type EvidenceConfidence = 'low'|'medium'|'high';
export type EvidenceSource = {
  id:string;
  kind:'REPORT'|'CONNECTIVITY'|'IMPACT';
  provenance:'REPORTED'|'VERIFIED';
  statement:string;
  reference:string|null;
  riskLevel:Exclude<EvidenceRisk,'undetermined'>|null;
  observedConnectivity:'UP'|'DOWN'|null;
};
export type EvidenceContext = {
  schema:string;
  sources:EvidenceSource[];
};
export type EvidenceProposal = {
  status:EvidenceStatus;
  risk:EvidenceRisk;
  confidence:EvidenceConfidence;
  evidence:string[];
  action:string;
};
export type EvidenceVerdict = {
  schema:string;
  policyVersion:string;
  decision:'REJECT'|'ALLOW_ASSESSMENT_ONLY';
  violations:string[];
  proposal:EvidenceProposal;
  sourceIds:string[];
  trustScope:'CALLER_SUPPLIED_SOURCES_NOT_INDEPENDENTLY_ATTESTED';
  persistentLedgerWritten:false;
  closureGranted:false;
  executionAuthorityGranted:false;
};
export const EVIDENCE_GATE_CONTEXT_SCHEMA:string;
export const EVIDENCE_GATE_RESULT_SCHEMA:string;
export const EVIDENCE_GATE_POLICY:string;
export function evaluateEvidenceGate(proposal:EvidenceProposal,context:EvidenceContext):EvidenceVerdict;
