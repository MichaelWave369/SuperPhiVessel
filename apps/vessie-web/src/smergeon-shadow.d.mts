export type SmergeonShadowResult =
  | {
    outcome:'REJECT'; reason:string;trust:'UNSIGNED_UNVERIFIED';
    acceptedAsSignedEvidence:false;verifiedWorkerRun:false;antiMCompletion:false;
    executionAuthority:false;mergeAuthority:false;
  }
  | {
    outcome:'REVIEW_ONLY';reason:string;trust:'UNSIGNED_UNVERIFIED';
    checksumMatches:true;externallyPinned:boolean;
    event:'STAGED_ONLY'|'DRAFT_CREATED';
    repository:string;sourcePullRequest:number;headSha:string;
    planFingerprint:string;operationFingerprint:string;filePath:string;
    draftPullRequest:number|null;draftUrl:string|null;
    acceptedAsSignedEvidence:false;verifiedWorkerRun:false;antiMCompletion:false;
    executionAuthority:false;mergeAuthority:false;
  };
export const SCHEMA:string;
export function inspectSmergeonReceipt(
  receipt:unknown,options?:{expectedChecksum?:string|null}
):Promise<SmergeonShadowResult>;
