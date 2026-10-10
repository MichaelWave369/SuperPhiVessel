import type {CompanyPlan,CompanyRisk} from './company-mode.mjs';
export type ThinkTankDecisionPreview={
 schema:'superphivessel.thinktank-dossier-preview.v0.1';
 source:'OPERATOR_SUPPLIED_THINKTANK_EXPORT';
 dossier:{
  id:string;sessionId:string;decisionSeq:number;mode:string;
  executionSource:'live-provider'|'simulation-fixture'|'governed-system';
  outcome:'completed'|'withheld';outputLabel:string;actionAllowedWithinThinkTank:boolean;
  basisFingerprint:string;fingerprintRecomputed:true;signatureVerified:false;
  operatorPrompt:string;governanceReason:string;
  gateScore:number;gateThreshold:number;
  claimPolicyPassed:boolean;argumentPolicyPassed:boolean;
  counts:{claims:number;evidence:number;contradictions:number;claimReviews:number;draftArguments:number};
 };
 claims:Array<{id:string;text:string}>;
 notes:string[];
 operatorOverrideRecorded:boolean;
 provenanceArtifactsPresent:string[];
 evidenceVerifiedIndependently:false;
 cryptographicSealVerified:false;
 actionAuthorityTransferred:false;taskApproved:false;completionCertified:false;
};
export const THINKTANK_BRIDGE_SCHEMA:string;
export function thinkTankFingerprint(basis:Record<string,unknown>):string;
export function inspectThinkTankPackage(json:string):ThinkTankDecisionPreview;
export function addThinkTankTaskProposal(plan:CompanyPlan,preview:ThinkTankDecisionPreview,
 sourceFocus:string,operatorTask:{
 id:string;function:string;output:string;check:string;risk:CompanyRisk;reviewAcknowledged:true
}):CompanyPlan;
