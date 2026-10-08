// Client-side only. Human review never contacts the inference API and
// never forwards or stores the prompt or generated answer.
// This is a subjective operator self-report, NOT model quality attestation.
export const HELPfulness = Object.freeze(['1','2','3','4','5','NOT_ASSESSED']);
export const COMPLETENESS = Object.freeze(['APPEARS_COMPLETE','POSSIBLY_CUT_OFF','UNSURE']);
export const VERIFICATION = Object.freeze(['NOT_CHECKED','OPERATOR_CHECKED_SUPPORTED','OPERATOR_CHECKED_CONTRADICTED']);

function oneOf(value, allowed, code) {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(code);
  return value;
}

export function makeHumanReview({
  performanceReceipt,
  helpfulness,
  completeness,
  verification,
  reviewedAt = new Date().toISOString()
}={}) {
  if (!performanceReceipt || typeof performanceReceipt !== 'object' ||
      Array.isArray(performanceReceipt) ||
      performanceReceipt.schema !== 'superphivessel.local-console.trial.receipt.v0.1' ||
      performanceReceipt.authority_granted !== false ||
      performanceReceipt.generated_text_included !== false ||
      performanceReceipt.private_prompt_included !== false)
    throw new Error('NO_VERIFIED_LOCAL_TRIAL_RECEIPT');
  const model=performanceReceipt.model;
  const outputHash=performanceReceipt.generated_text_sha256;
  if(typeof model!=='string' || model.length<1 || model.length>128 ||
     /[\u0000-\u001f\u007f]/.test(model) ||
     typeof outputHash!=='string' || !/^[a-f0-9]{64}$/.test(outputHash))
    throw new Error('INVALID_TRIAL_REFERENCE');
  if(typeof reviewedAt!=='string' || reviewedAt.length>40 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(reviewedAt))
    throw new Error('INVALID_REVIEW_TIME');
  const ratings={
    helpfulness:oneOf(helpfulness,HELPfulness,'INVALID_HELPFULNESS'),
    completeness:oneOf(completeness,COMPLETENESS,'INVALID_COMPLETENESS'),
    verification:oneOf(verification,VERIFICATION,'INVALID_VERIFICATION')
  };
  // Explicitly construct an allowlisted document. Never copy upstream
  // performance receipt objects, unknown fields, model output or prompt.
  return Object.freeze({
    schema:'superphivessel.local-console.human-review.v0.1',
    review_kind:'OPERATOR_SELF_REPORT',
    evidence_level:'HUMAN_RATING_NOT_INDEPENDENTLY_VERIFIED',
    reviewed_at:reviewedAt,
    model,
    source_output_sha256:outputHash,
    source_trial_receipt_schema:'superphivessel.local-console.trial.receipt.v0.1',
    ...ratings,
    prompt_included:false,
    generated_text_included:false,
    free_text_notes_included:false,
    inference_performed_by_review:false,
    cloud_execution_approved:false,
    model_routing_approved:false,
    quality_gate_approved:false,
    authority_granted:false
  });
}
