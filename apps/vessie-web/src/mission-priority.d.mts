import type {CompanyPlan,CompanyRisk} from './company-mode.mjs';
export type Impact='HIGH'|'MEDIUM'|'LOW';
export type Urgency='NOW'|'SOON'|'LATER';
export type Effort='SMALL'|'MEDIUM'|'LARGE';
export type PriorityReview={
 node:{id:string;function:string;output:string;check:string;dependsOn:string[];risk:CompanyRisk};
 impact:Impact;urgency:Urgency;effort:Effort;blocksRelease:boolean;
 rationale:string;reviewer:string;
};
export type PrioritySet={
 schema:string;
 company:{name:string;founder:string;product:string;customer:string};
 reviews:PriorityReview[];provenance:'OPERATOR_ENTERED_UNATTESTED';
 actionAuthorityGranted:false;evidenceTransferred:false;completionCertified:false;
};
export type PriorityAssessment=Pick<PriorityReview,'impact'|'urgency'|'effort'|'blocksRelease'|'rationale'|'reviewer'>;
export const PRIORITY_SCHEMA:string;
export const IMPACT:Impact[];
export const URGENCY:Urgency[];
export const EFFORT:Effort[];
export function createPriorityReviewSet(plan:CompanyPlan):PrioritySet;
export function validatePriorityReviewSet(plan:CompanyPlan,set:PrioritySet):PrioritySet;
export function recordPriorityReview(plan:CompanyPlan,set:PrioritySet,nodeId:string,assessment:PriorityAssessment):PrioritySet;
export function clearPriorityReview(plan:CompanyPlan,set:PrioritySet,nodeId:string):PrioritySet;
export function importPriorityReviewSet(plan:CompanyPlan,json:string):PrioritySet;
export function priorityScore(review:PriorityReview):number;
export function priorityProjection(plan:CompanyPlan,set:PrioritySet):{
 ranked:Array<{id:string;function:string;output:string;risk:CompanyRisk;
 status:string;review:PriorityReview;score:number}>;
 unranked:Array<{id:string;output:string;status:string}>;
 locallyAccepted:number;candidateCount:number;reviewCount:number;explanation:string;
 advisoryOnly:true;executionAuthorityGranted:false;externalCompletionAttested:false;
};
