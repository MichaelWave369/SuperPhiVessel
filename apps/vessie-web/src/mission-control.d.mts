import type {CompanyPlan} from './company-mode.mjs';
import type {GithubPublicIssuesPreview} from './github-public-issues.mjs';
import type {GithubHealthPreview} from './github-repo-health.mjs';
export type MissionSource={
 repository:string;issues:GithubPublicIssuesPreview|null;health:GithubHealthPreview|null;
 issueStatus:'ok'|'unavailable';healthStatus:'ok'|'unavailable';
};
export type MissionSnapshot={
 schema:string;repositories:MissionSource[];
 provenance:'UNAUTHENTICATED_PUBLIC_GITHUB_SNAPSHOT';
 authenticated:false;executionAuthorityGranted:false;approvalTransferred:false;
 evidenceTransferred:false;externalExecutionAttested:false;
};
export type MissionCandidate={
 key:string;repository:string;type:'CI_INVESTIGATION'|'OPEN_ISSUE';
 number:number;title:string;sourceUrl:string;description:string;
};
export type MissionRepoSummary={
 repository:string;issueStatus:'ok'|'unavailable';healthStatus:'ok'|'unavailable';
 openIssuesSeen:number|null;workflowsSeen:number|null;
 latestFailedOrTimedOut:number;latestInProgress:number;latestSuccess:number;
 coverage:'FIRST_PAGE_SNAPSHOT_NOT_EXHAUSTIVE';
};
export const MISSION_SCHEMA:string;
export function parseMissionRepositories(raw:string):string[];
export function validateMissionSnapshot(snapshot:MissionSnapshot):MissionSnapshot;
export function scanMissionRepositories(repos:string[],requester?:typeof fetch):Promise<MissionSnapshot>;
export function missionCandidates(snapshot:MissionSnapshot):MissionCandidate[];
export function missionSummary(snapshot:MissionSnapshot):MissionRepoSummary[];
export function importMissionCandidates(plan:CompanyPlan,snapshot:MissionSnapshot,keys:string[]):CompanyPlan;
