import type {CompanyPlan} from './company-mode.mjs';
export type RepoRiderIntakePreview={
 source:'reporider.ride-receipt.v1';
 repositoryUrl:string;
 titles:string[];
 queuedFileCount:number;
 safetyStatus:'pass'|'needs-review';
 sourceProvenance:'SELF_REPORTED_MOCK_EXPORT';
 authenticated:false;
 signatureVerified:false;
 repositoryCreated:false;
 actionAuthorized:false;
 approvalsTransferred:false;
 evidenceTransferred:false;
};
export const REPORIDER_INTAKE_SOURCE:string;
export function previewRepoRiderIntake(raw:string):RepoRiderIntakePreview;
export function applyRepoRiderIntake(plan:CompanyPlan,preview:RepoRiderIntakePreview):CompanyPlan;
