export type ReleaseEvidenceGrade='PUBLIC_RELEASE_OBSERVED'|'PAGES_NOT_SUCCESS'|'NO_MATCHING_SMOKE_IN_SAMPLE'|'SMOKE_NOT_SUCCESS';
export type ReleaseEvidenceSnapshot={
 schema:'superphivessel.public-release-evidence.v0.1';
 repository:'MichaelWave369/SuperPhiVessel';
 revision:string;
 pages:{id:number;conclusion:string|null;url:string};
 smoke:{id:number;conclusion:string|null;url:string}|null;
 sampledSmokeRuns:number;
 grade:ReleaseEvidenceGrade;
 publicSourcesAligned:boolean;
 exactWorkflowParentIndependentlyProven:false;
 provenance:'UNAUTHENTICATED_PUBLIC_PAGES_AND_GITHUB_GET';
 signatureVerified:false;independentlyAttestedExternalDone:false;
 approvalGranted:false;executionAuthorityGranted:false;evidenceTransferred:false;
};
export const RELEASE_SCHEMA:string;
export const publicReleaseUrls:{pages:string;smokeRuns:string};
export function parsePublicPagesReceipt(json:string):{sha:string;runId:number};
export function parsePublicPagesRun(json:string,receipt:{sha:string;runId:number}):{
 id:number;sha:string;status:string;conclusion:string|null;createdAt:string;updatedAt:string;url:string;event:string;
};
export function parsePublicSmokeRuns(json:string,receipt:{sha:string;runId:number},pagesRun:{
 id:number;sha:string;status:string;conclusion:string|null;createdAt:string;updatedAt:string;url:string;event:string;
}):{sampledCount:number;reportedCount:number;latest:null|{id:number;sha:string;status:string;conclusion:string|null;createdAt:string;updatedAt:string;url:string;event:string}};
export function releaseEvidenceProjection(receipt:{sha:string;runId:number},pagesRun:ReturnType<typeof parsePublicPagesRun>,smokeSample:ReturnType<typeof parsePublicSmokeRuns>):ReleaseEvidenceSnapshot;
export function validateReleaseEvidence(snapshot:ReleaseEvidenceSnapshot):ReleaseEvidenceSnapshot;
export function releaseEvidenceSummary(snapshot:ReleaseEvidenceSnapshot):string;
export function readPublicReleaseEvidence(requester?:typeof fetch):Promise<ReleaseEvidenceSnapshot>;
