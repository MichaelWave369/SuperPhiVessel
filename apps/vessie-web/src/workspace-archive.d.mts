import type {CompanyPlan} from './company-mode.mjs';
import type {PrioritySet} from './mission-priority.mjs';
import type {CompletionLink} from './completion-dashboard.mjs';
import type {AntiMBundle} from './anti-m.mjs';
export type WorkspaceJournalSource={nodeId:string;ledger:string};
export type WorkspaceArchive={
 schema:'superphivessel.company-workspace-archive.v0.1';
 exportedAt:string;
 payload:{plan:CompanyPlan;priorityReviews:PrioritySet;antiMJournals:Array<{nodeId:string;bundle:AntiMBundle}>};
 integrity:{method:'SHA-256-LOCAL_CONSISTENCY_NOT_SIGNATURE';sha256:string};
 provenance:'OPERATOR_EXPORTED_EDITABLE_LOCAL_FILE';
 operatorIdentityAuthenticated:false;externalExecutionAttested:false;
 executionAuthorityGranted:false;completionPromoted:false;automaticSyncEnabled:false;
};
export type ValidatedWorkspace={
 plan:CompanyPlan;priorities:PrioritySet;
 journals:Array<{nodeId:string;bundle:AntiMBundle}>;
 links:CompletionLink[];exportedAt:string;archiveSha256:string;
 provenance:'UNTRUSTED_LOCAL_ARCHIVE_REPLAYED';
 externallyAttested:false;authorityGranted:false;
};
export const WORKSPACE_ARCHIVE_SCHEMA:string;
export function createWorkspaceArchive(plan:CompanyPlan,priorities:PrioritySet|null,
 sources:WorkspaceJournalSource[],now?:string):Promise<WorkspaceArchive>;
export function importWorkspaceArchive(raw:string):Promise<ValidatedWorkspace>;
