export interface ScoutHandoffReview {
  schema:'superphivessel.scout-handoff-review.v0.1';
  display_status:'OPERATOR_PASTED_SELF_REPORTED_PASS';
  local_model:string;
  source_run_id:string;
  qualified_at:string;
  source_expires_at:string;
  source_freshness_at_review:
    'CURRENT_WITHIN_SOURCE_WINDOW'|'HISTORICAL_EXPIRED_OR_NOT_YET_CURRENT';
  source_freshness_when_exported:
    'CURRENT_WITHIN_SOURCE_WINDOW'|'HISTORICAL_EXPIRED_OR_NOT_YET_CURRENT';
  receipt_digest_prefix:string;
  digest_verified_in_browser:false;
  source_authenticated:false;
  operator_identity_verified:false;
  local_execution_independently_attested:false;
  integration:'UNWIRED_REVIEW_ONLY';
  vessie_connected:false;
  model_started_by_cockpit:false;
  routing_influence:'NONE';
  authority_granted:false;
  memory_admitted:false;
  tools_executed:false;
  agent_spawned:false;
}
export function inspectScoutHandoff(input:string,now?:number):ScoutHandoffReview;
