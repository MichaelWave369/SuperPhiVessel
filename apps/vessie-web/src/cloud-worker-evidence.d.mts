export interface CloudEvidence {
  schema: 'superphivessel.cloud_observation.v0.1';
  disposition: 'STALE_OBSERVATION' | 'TASK_FAILURE_OBSERVED' | 'UNVERIFIED_PUBLIC_OBSERVATION';
  source_repository: string;
  branch_snapshot: string;
  run_id: string;
  run_url: string;
  observed_at: string;
  tasks: ReadonlyArray<{task: string; status: 'ok' | 'error'}>;
  history_count: number;
  github_run_metadata_correlated: boolean;
  independent_prior_pin_verified: false;
  content_authenticity_verified: false;
  authority_granted: false;
  action_executed: false;
  memory_admitted: false;
  routing_influence: 'NONE';
  network_mutation: false;
}
export function loadCloudObservation(get?: typeof fetch, now?: number): Promise<CloudEvidence>;
export function makeBrainCShadowCandidate(observation: CloudEvidence): {
  schema: string;
  integration_status: string;
  source_kind: string;
  source_run_id: string;
  observed_at: string;
  disposition: string;
  task_statuses: Array<{task: string; status: string}>;
  prompt_admitted: false;
  memory_admitted: false;
  routing_influence: 'NONE';
  authority_granted: false;
  action_executed: false;
};
