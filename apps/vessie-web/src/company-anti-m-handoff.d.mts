import type {CompanyPlan,CompanyRisk} from './company-mode.mjs';
export type AntiMProposal={
 schema:string;
 source:{company:string;founder:string;nodeId:string;dependencies:string[];risk:CompanyRisk};
 draft:{title:string;deliverable:string;criteria:string[]};
 provenance:'OPERATOR_ENTERED_UNATTESTED';
 evidenceTransferred:false;
 approvalTransferred:false;
 executionAuthorityGranted:false;
};
export const ANTIM_PROPOSAL_SCHEMA:string;
export function validateAntiMProposal(p:AntiMProposal):AntiMProposal;
export function proposeAntiMFromCompany(plan:CompanyPlan,nodeId:string):AntiMProposal;
