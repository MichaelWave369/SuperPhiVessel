export type CompanyRisk='NONE'|'REPO_WRITE'|'DEPLOY'|'EXTERNAL_POST'|'SPEND'|'CREDENTIAL_USE'|'OTHER_EFFECT';
export type CompanyMethod='CI_RUN'|'HUMAN_TEST'|'ARTIFACT_HASH'|'OTHER';
export type CompanyEvidence={
 result:'PASS'|'FAIL';method:CompanyMethod;reference:string;summary:string;
 review:{reviewer:string;decision:'ACCEPT'|'REJECT'}|null;
};
export type CompanyNode={
 id:string;function:string;output:string;check:string;dependsOn:string[];risk:CompanyRisk;
 actionReview:{reviewer:string}|null;evidence:CompanyEvidence|null;
};
export type CompanyPlan={
 schema:string;
 company:{name:string;founder:string;product:string;customer:string;weeklyGoal:string;budgetLimitUsd:number};
 nodes:CompanyNode[];
};
export type CompanyNodeProjection=CompanyNode&{status:string};
export type CompanyProjection={
 nodes:CompanyNodeProjection[];complete:boolean;accepted:number;ready:string[];
 provenance:'OPERATOR_ENTERED_UNATTESTED';executionAuthorityGranted:false;externalExecutionAttested:false;integrityProtected:false;
};
export const COMPANY_SCHEMA:string;
export const COMPANY_RISKS:CompanyRisk[];
export const COMPANY_METHODS:CompanyMethod[];
export function inspectCompanyPlan(p:CompanyPlan):CompanyPlan;
export function createCompanyPlan(company:CompanyPlan['company']):CompanyPlan;
export function addCompanyNode(p:CompanyPlan,node:Pick<CompanyNode,'id'|'function'|'output'|'check'|'dependsOn'|'risk'>):CompanyPlan;
export function recordActionReview(p:CompanyPlan,id:string,reviewer:string):CompanyPlan;
export function recordCompanyEvidence(p:CompanyPlan,id:string,evidence:Pick<CompanyEvidence,'result'|'method'|'reference'|'summary'>):CompanyPlan;
export function reviewCompanyEvidence(p:CompanyPlan,id:string,reviewer:string,decision:'ACCEPT'|'REJECT'):CompanyPlan;
export function companyProjection(p:CompanyPlan):CompanyProjection;
export function importCompanyPlan(json:string):CompanyPlan;
