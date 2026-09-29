/*
 * Integration sketch only.
 * SPD-W is UNWIRED in the canonical .54.7 runtime.
 * Deterministic software remains authoritative; models may propose classes
 * but must not decide their own promotion.
 */

function evaluateSpdwBeforePromotion(candidate){
  const receipt = SuperPhiSPDW.evaluate({
    claimId: candidate.claimId,
    sourceRef: candidate.sourceRef,
    sourceClass: candidate.sourceClass,
    targetState: candidate.requestedTargetState,

    hasProvenance: Boolean(candidate.sourceCustodyId && candidate.sourceRef),
    claimExplicit: Boolean(candidate.claimText),
    assumptionsDeclared: Array.isArray(candidate.assumptions),

    hasTestContract: Boolean(candidate.acceptanceContractHash),
    negativePredictionDefined: Boolean(candidate.negativePrediction),
    testExecuted: Boolean(candidate.testResultHash),
    independentConfirmations: Number(candidate.independentConfirmations || 0),
    directObservation: Boolean(candidate.directObservation),

    acceptancePassed: candidate.acceptanceStatus === 'PASS',
    realityGateStatus: candidate.realityGateStatus,
    riskClass: candidate.riskClass || 'UNKNOWN',
    currentState: candidate.currentState,
    humanCommitment: Boolean(candidate.humanCommitmentWrite)
  });

  if (receipt.disposition === 'BLOCK') {
    return {
      promotionEligible:false,
      promotionDecision:'BLOCK_PROMOTION',
      spdwReceipt:receipt,
      spdwReceiptText:SuperPhiSPDW.receiptText(receipt)
    };
  }

  if (receipt.disposition === 'REQUIRE_EVIDENCE') {
    return {
      promotionEligible:false,
      promotionDecision:'HOLD_CURRENT_STATE',
      spdwReceipt:receipt,
      spdwReceiptText:SuperPhiSPDW.receiptText(receipt)
    };
  }

  return {
    promotionEligible:true,
    promotionDecision:receipt.disposition === 'WARN' ? 'ALLOW_WITH_SPDW_WARNING' : 'ALLOW_PROMOTION',
    spdwReceipt:receipt,
    spdwReceiptText:SuperPhiSPDW.receiptText(receipt)
  };
}
