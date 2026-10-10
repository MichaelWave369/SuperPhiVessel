import type {CompanyPlan,CompanyRisk} from './company-mode.mjs';
import type {PrioritySet} from './mission-priority.mjs';
export type CompletionLink={
 schema:'superphivessel.company-completion-dashboard.v0.1';
 node:{id:string;function:string;output:string;check:string};
 contractId:string;antiMStatus:'EVIDENCE_PENDING'|'APPROVAL_HELD'|'READY_TO_CLOSE'|'VERIFIED_DONE_LOCAL';
 ledgerTailSha256:string;eventCount:number;
 localHashChainInspected:true;provenance:'SELF_REPORTED_LOCAL_HASH_CHAIN';
 humanIdentityAuthenticated:false;externalExecutionAttested:false;
 authorityGranted:false;companyEvidenceTransferred:false;
};
export type CompletionRow={
 id:string;function:string;output:string;status:string;risk:CompanyRisk;dependsOn:string[];
 hasActionReview:boolean;evidenceResult:'PASS'|'FAIL'|null;
 evidenceReviewed:'ACCEPT'|'REJECT'|null;evidenceReference:string|null;
 manualNextStep:string;priorityRank:number|null;priorityScore:number|null;triaged:boolean;
 antiMJournal:{status:CompletionLink['antiMStatus'];contractId:string;tailHash:string;
 eventCount:number;checkedAtImport:true;independentlyAttested:false}|null;
};
export type CompletionProjection={
 rows:CompletionRow[];counts:Record<string,number>;
 graphTotal:number;locallyAccepted:number;withCompanyEvidence:number;
 antiMLedgersChecked:number;antiMLocallyClosed:number;prioritized:number;unreviewedPriority:number;
 companyAllLocalReviewsAccepted:boolean;separatelyAttestedExternalDone:false;
 executionAuthorityGranted:false;advisoryOnly:true;warning:string;
};
export const COMPLETION_SCHEMA:string;
export function inspectAntiMForCompany(plan:CompanyPlan,nodeId:string,json:string):Promise<CompletionLink>;
export function validateCompletionLink(plan:CompanyPlan,link:CompletionLink):CompletionLink;
export function completionDashboard(plan:CompanyPlan,prioritySet:PrioritySet|null,links?:CompletionLink[]):CompletionProjection;
