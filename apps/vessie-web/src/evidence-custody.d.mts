import type {EvidenceContext,EvidenceProposal,EvidenceVerdict} from './evidence-gate.mjs';

export type CustodyRecord={
  sourceId:string;
  adapterId:string;
  capturedAt:string;
  signature:string|null;
};
export type CustodyInput={
  proposal:EvidenceProposal;
  context:EvidenceContext;
  custody:{schema:string;records:CustodyRecord[]};
};
export type CustodyVerdict={
  schema:string;policyVersion:string;gatePolicyVersion:string;
  decision:'REJECT_CUSTODY'|'REJECT_POLICY'|'ALLOW_ASSESSMENT_ONLY';
  custodyViolations:string[];
  gateVerdict:EvidenceVerdict|null;
  trustScope:'ENROLLED_KEY_SIGNATURE_OR_OPERATOR_REPORT_ONLY';
  signatureConfirmsSourceTruth:false;
  persistentLedgerWritten:false;
  closureGranted:false;
  executionAuthorityGranted:false;
};
export type ShadowReceipt={
  schema:string;
  asOf:string;
  input:CustodyInput;
  result:CustodyVerdict;
  receiptIntegrity:'UNSIGNED_SHA256_LOCAL_REPLAY_ONLY';
  persistentLedgerWritten:false;
  closureGranted:false;
  executionAuthorityGranted:false;
  sha256:string;
};
export const CUSTODY_SCHEMA:string;
export const CUSTODY_RECEIPT_SCHEMA:string;
export const CUSTODY_POLICY:string;
export function adapterMessage(source:EvidenceContext['sources'][number],adapterId:string,capturedAt:string):string;
export function assessCustodiedProposal(input:CustodyInput,asOf:string,trustKeys?:Record<string,string>):Promise<CustodyVerdict>;
export function createShadowReceipt(input:CustodyInput,asOf:string,trustKeys?:Record<string,string>):Promise<ShadowReceipt>;
export function replayShadowReceipt(receipt:ShadowReceipt,trustKeys?:Record<string,string>,
  currentAsOf?:string|null):Promise<{
    historical:CustodyVerdict;current:CustodyVerdict|null;
    hashVerified:true;externalAuthenticityProven:false;
    closureGranted:false;executionAuthorityGranted:false;
  }>;
