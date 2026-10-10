import type {CompanyPlan} from './company-mode.mjs';
export type GithubPublicIssue={number:number;title:string;url:string};
export type GithubPublicIssuesPreview={
 schema:string;repository:string;issues:GithubPublicIssue[];
 provenance:'UNAUTHENTICATED_PUBLIC_API_READ';
 authenticated:false;signatureVerified:false;sourceIdentityAuthenticated:false;
 approvalGranted:false;executionAuthorityGranted:false;evidenceTransferred:false;
};
export const GITHUB_ISSUES_PREVIEW:string;
export function parsePublicRepo(raw:string):string;
export function publicIssueApiUrl(repo:string):string;
export function previewPublicIssues(raw:string,repo:string):GithubPublicIssuesPreview;
export function readPublicIssues(repo:string,requester?:typeof fetch):Promise<GithubPublicIssuesPreview>;
export function validatePublicIssuePreview(preview:GithubPublicIssuesPreview):GithubPublicIssuesPreview;
export function importPublicIssueTasks(plan:CompanyPlan,preview:GithubPublicIssuesPreview,numbers:number[]):CompanyPlan;
