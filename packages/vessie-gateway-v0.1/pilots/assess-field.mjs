import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECT_WINDOWS=['WINDOWS_OS_TLS_TRUST','UNAUTHORIZED_REFUSAL','WRONG_ORIGIN_REFUSAL'];
const EXPECT_BROWSER=['browser_https_pair','browser_status_read','browser_model_inventory','session_revocation_request','revoked_session_denied'];

export function assessFieldReceipts(windows, browser) {
  const problems=[];
  if(!windows||windows.schema!=='superphivessel.gateway.r2.windows-pilot.v0.1' ||
     windows.observation_source!=='OPERATOR_WINDOWS_POWERSHELL_LOCAL_TEST' ||
     windows.fixture!==false || windows.platform!=='WINDOWS' ||
     windows.gateway_target!=='HTTPS_LOOPBACK' ||
     windows.browser_pairing_qualified!==false ||
     windows.operator_promotion_approved!==false ||
     windows.authority_granted!==false || !Array.isArray(windows.checks)){
    problems.push('WINDOWS_RECEIPT_INVALID');
  }
  if(!browser||browser.schema!=='superphivessel.gateway.r2.browser-field-report.v0.2' ||
     browser.observation_source!=='UNATTESTED_BROWSER_CLIENT' ||
     browser.revocation_proof_scope!=='BROWSER_OBSERVED_DENIAL_NOT_MACHINE_ATTESTED'){
    problems.push('BROWSER_RECEIPT_INVALID');
  }
  if(problems.length===0){
    for(const check of EXPECT_WINDOWS){
      const matches=windows.checks.filter(item=>item&&item.check===check);
      if(matches.length!==1||matches[0].result!=='PASS')problems.push('WINDOWS_CHECK_INCOMPLETE_'+check);
    }
    if(windows.check_count!==EXPECT_WINDOWS.length)
      problems.push('WINDOWS_CHECK_COUNT_INVALID');
    if(windows.result!=='LOCAL_TLS_AND_REFUSAL_PASS_BROWSER_PENDING')problems.push('WINDOWS_TLS_NOT_READY');
    for(const check of EXPECT_BROWSER){
      if(browser.checks?.[check]!=='PASS')problems.push('BROWSER_CHECK_INCOMPLETE_'+check);
    }
    if(browser.passed_checks!==EXPECT_BROWSER.length)
      problems.push('BROWSER_CHECK_COUNT_INVALID');
    if(browser.model_count_observed===null ||
      !Number.isInteger(browser.model_count_observed)||browser.model_count_observed<0 ||
      browser.model_count_observed>256)problems.push('BROWSER_MODEL_COUNT_UNCONFIRMED');
    if(browser.status!=='OPERATOR_REVIEW_REQUIRED' ||
      browser.field_qualified!==false || browser.authority_granted!==false ||
      browser.secrets_included!==false || browser.credentials_included!==false ||
      browser.model_names_included!==false || browser.host_identity_included!==false ||
      browser.browser_restrictions_bypassed!==false ||
      browser.installed_models_approved!==false){
      problems.push('BROWSER_PRIVACY_OR_AUTHORITY_BOUNDARY_BROKEN');
    }
    // Only structurally compare receipt dates. Cannot authenticate client clocks.
    for(const [kind,receipt] of [['WINDOWS',windows],['BROWSER',browser]]){
      const t=Date.parse(receipt.generated_at_utc);
      if(!Number.isFinite(t))problems.push(kind+'_TIMESTAMP_INVALID');
    }
  }
  return {
    schema:'superphivessel.gateway.r2.field-assessment.v0.1',
    assessment:'R2_LOCAL_CONNECTION_OBSERVED_CLAIM_UNATTESTED',
    status:problems.length?'BLOCKED_FIELD_EVIDENCE':'OBSERVED_PENDING_OPERATOR_REVIEW',
    issues:problems,
    windows_check_count:problems.includes('WINDOWS_RECEIPT_INVALID')?0:EXPECT_WINDOWS.length,
    browser_check_count:problems.includes('BROWSER_RECEIPT_INVALID')?0:EXPECT_BROWSER.length,
    browser_field_receipt_authenticity_verified:false,
    machine_identity_authenticated:false,
    physically_qualified:false,
    model_routing_approved:false,
    operator_activation_approved:false,
    authority_granted:false,
    input_secrets_echoed:false,
  };
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [windowsPath,browserPath]=process.argv.slice(2);
  if(!windowsPath||!browserPath){
    console.error('Usage: node assess-field.mjs <windows-receipt.json> <browser-receipt.json>');
    process.exitCode=2;
  }else{
    try{
      const limitedRead=path=>{
        const data=readFileSync(path);
        if(data.length>32768)throw new Error('RECEIPT_TOO_LARGE');
        return JSON.parse(data.toString('utf8'));
      };
      const result=assessFieldReceipts(limitedRead(windowsPath),limitedRead(browserPath));
      console.log(JSON.stringify(result,null,2));
      if(result.status!=='OBSERVED_PENDING_OPERATOR_REVIEW')process.exitCode=2;
    }catch{
      console.error('Could not inspect one or both receipts. No source content was printed.');
      process.exitCode=2;
    }
  }
}
