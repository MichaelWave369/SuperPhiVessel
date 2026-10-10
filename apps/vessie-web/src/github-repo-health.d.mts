import type {CompanyPlan} from './company-mode.mjs';
export type GithubHealthRun={
 id:number;workflowId:number;name:string;attempt:number;
 status:'queued'|'in_progress'|'completed'|'waiting'|'requested'|'pending';
 conclusion:'success'|'failure'|'timed_out'|'cancelled'|'action_required'|
  'skipped'|'neutral'|'stale'|'startup_failure'|null;
 createdAt:string;url:string;
};
export type GithubHealthPreview={
 schema:string;repository:string;defaultBranch:string;
 totalRunsReported:number;sampledRuns:number;workflows:GithubHealthRun[];
 provenance:'UNAUTHENTICATED_PUBLIC_GITHUB_SNAPSHOT';
 authenticated:false;signatureVerified:false;ciIndependentlyVerified:false;
 approvalGranted:false;executionAuthorityGranted:false;evidenceTransferred:false;
};
export const HEALTH_SCHEMA:string;
export function publicRepositoryUrl(repo:string):string;
export function publicActionsUrl(repo:string,branch:string):string;
export function parseRepositoryMetadata(json:string,requested:string):{
 repository:string;defaultBranch:string
};
export function previewHealthRuns(json:string,metadata:{repository:string;defaultBranch:string}):GithubHealthPreview;
export function validateHealthPreview(preview:GithubHealthPreview):GithubHealthPreview;
export function readPublicRepositoryHealth(repo:string,requester?:typeof fetch):Promise<GithubHealthPreview>;
export function importHealthInvestigations(plan:CompanyPlan,preview:GithubHealthPreview,ids:number[]):CompanyPlan;
