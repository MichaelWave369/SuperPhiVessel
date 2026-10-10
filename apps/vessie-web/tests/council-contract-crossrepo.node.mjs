/* SPV-COMPANY-18: Actual UI-authored bytes → actual ThinkTank CLI → actual
 * Vessie dossier intake and held Company task. The only provider is an
 * isolated, synthetic HTTP mock bound to 127.0.0.1:3691 in this CI process.
 *
 * NEVER run this acceptance against a real Ollama or bridge service. Do not
 * publish synthetic dossier output as proof of any actual provider response.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,rm,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 inspectThinkTankPackage,addThinkTankTaskProposal
} from '../src/thinktank-decision-bridge.mjs';
import {createCompanyPlan,companyProjection} from '../src/company-mode.mjs';

const HERE=dirname(fileURLToPath(import.meta.url));
const APP=resolve(HERE,'..');
const ROOT=resolve(APP,'../..');
const THINKTANK=resolve(ROOT,'think-tank');
const ARTIFACTS=resolve(APP,'test-results','council-contract-crossrepo');
const CONTRACT=resolve(ARTIFACTS,'contract.json');
const RECEIPT=resolve(ARTIFACTS,'ui-receipt.json');
const CLI=resolve(THINKTANK,'.generated-local-council','local-council-entry.js');

async function callCLI(args){
 return await new Promise((resolveCall,rejectCall)=>{
  const child=spawn(process.execPath,[CLI,...args],{
   cwd:THINKTANK,
   env:{
    ...process.env,
    OPENAI_API_KEY:'',KIMI_API_KEY:'',OPENAI_MODEL:'',KIMI_MODEL:'',
    // Synthetic-only runner; does not expose credentials to ThinkTank.
    OLLAMA_BASE_URL:'http://127.0.0.1:9'
   },
   stdio:['ignore','pipe','pipe']
  });
  let stdout='',stderr='';
  const timer=setTimeout(()=>{
   child.kill('SIGKILL');
  },20000);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{
   stdout+=chunk;
   if(stdout.length>2_000_000)child.kill('SIGKILL');
  });
  child.stderr.on('data',chunk=>{
   stderr+=chunk;
   if(stderr.length>2_000_000)child.kill('SIGKILL');
  });
  child.once('error',e=>{clearTimeout(timer);rejectCall(e)});
  child.once('close',(code,signal)=>{clearTimeout(timer);resolveCall({code,signal,stdout,stderr})})
 });
}
function outputPath(stdout,label){
 const line=stdout.split(/\r?\n/).find(x=>x.startsWith(label+'='));
 assert.ok(line,'Missing '+label+' in CLI output');
 const path=line.slice(label.length+1).trim();
 assert.notEqual(path,'NOT_PRODUCED','CLI did not reach a dossier decision');
 // Limit test cleanup and read-back to the dedicated ThinkTank ignored path.
 const absolute=resolve(THINKTANK,path);
 assert.ok(absolute.startsWith(resolve(THINKTANK,'local-council-artifacts')+'/'),
  'CLI output escapes ignored local artifact folder');
 return absolute
}
test('UI byte-SHA consent → ThinkTank terminal → synthetic local 5-role council → replay → Vessie held proposal',async()=>{
 const file=await readFile(CONTRACT);
 const receipt=JSON.parse(await readFile(RECEIPT,'utf8'));
 const sha=createHash('sha256').update(file).digest('hex');
 assert.equal(receipt.schema,'spv-council-contract-ci-fixture.v0.1');
 assert.equal(receipt.source,'SYNTHETIC_TEST_BROWSER');
 assert.equal(sha,receipt.sha256DisplayedByUI,'UI hash does not match actual exported bytes');
 assert.equal(receipt.generatedWithoutProviderNetwork,true);
 assert.equal(receipt.noApprovalOrExecution,true);
 const contract=JSON.parse(file.toString('utf8'));
 assert.equal(contract.provider,'ollama-local-only');
 assert.equal(contract.mode,'council');
 assert.equal(contract.model,'gemma3:12b');
 assert.equal(contract.maxRoleTurns,5);
 assert.equal(contract.allowRemoteProviders,false);
 assert.equal(contract.browserAutoRun,false);
 assert.equal(contract.executionAuthorityGranted,false);
 assert.equal(contract.externalDoneAttested,false);
 await stat(CLI);
 const inspect=await callCLI(['inspect',CONTRACT]);
 assert.equal(inspect.code,0,inspect.stderr);
 const inspection=JSON.parse(inspect.stdout);
 assert.equal(inspection.sha256,sha);
 assert.equal(inspection.executionTriggered,false);
 assert.equal(inspection.independentDone,false);
 assert.deepEqual(inspection.roleTurns,['dreamer','builder','challenger','archivist','vessie']);
 const calls=[];
 const paths=[];
 let listenStarted=false;
 const server=http.createServer(async(req,res)=>{
  const send=(status,record)=>{
   res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify(record))
  };
  const url=req.url||'';
  assert.equal(req.headers.host,'127.0.0.1:3691','Mock must be addressed only over loopback');
  if(req.method==='GET'&&url==='/providers/status'){
   return send(200,{ok:true,bridgeVersion:'0.15.0',
    seats:[{seatId:'local',state:'connected',models:['gemma3:12b']}]
   });
  }
  if(req.method==='POST'&&url==='/providers/invoke'){
   let body='';
   for await(const chunk of req){
    body+=chunk.toString();
    if(body.length>500_000){send(413,{ok:false});return}
   }
   const payload=JSON.parse(body);
   assert.deepEqual(Object.keys(payload).sort(),['messages','model','roleId','seatId']);
   assert.equal(payload.seatId,'local');
   assert.equal(payload.model,contract.model);
   assert.ok(Array.isArray(payload.messages));
   assert.ok(['dreamer','builder','challenger','archivist','vessie'].includes(payload.roleId));
   calls.push({role:payload.roleId,model:payload.model});
   return send(200,{ok:true,seatId:'local',provider:'Ollama',model:contract.model,
    text:'SYNTHETIC MOCK ADAPTER OUTPUT. No external evidence was retrieved or independently verified.',
    latencyMs:1,requestId:'synthetic-ci-'+calls.length
   });
  }
  return send(404,{ok:false,error:{code:'MOCK_NO_SUCH_ROUTE'}});
 });
 try{
  server.listen(3691,'127.0.0.1');
  await once(server,'listening');listenStarted=true;
  const wrong=await callCLI(['run',CONTRACT,
   '--approve-sha256='+'0'.repeat(64),'--confirm-local-model-inference']);
  assert.equal(wrong.code,1,'A forged approval must fail');
  assert.match(wrong.stderr,/EXPLICIT_SHA_APPROVAL_REQUIRED/);
  assert.equal(calls.length,0,'No provider called on wrong approval SHA');
  const missingFlag=await callCLI(['run',CONTRACT,'--approve-sha256='+sha]);
  assert.equal(missingFlag.code,1);
  assert.match(missingFlag.stderr,/EXPLICIT_SHA_APPROVAL_REQUIRED/);
  assert.equal(calls.length,0);
  const approved=await callCLI(['run',CONTRACT,'--approve-sha256='+sha,
   '--confirm-local-model-inference']);
  assert.equal(approved.code,0,approved.stdout+'\n'+approved.stderr);
  assert.deepEqual(calls.map(c=>c.role),['dreamer','builder','challenger','archivist','vessie']);
  assert.ok(calls.every(c=>c.model==='gemma3:12b'));
  const ledgerPath=outputPath(approved.stdout,'LOCAL_COUNCIL_LEDGER');
  const dossierPath=outputPath(approved.stdout,'LOCAL_COUNCIL_DOSSIER');
  paths.push(ledgerPath,dossierPath);
  const ledger=JSON.parse(await readFile(ledgerPath,'utf8'));
  const exported=await readFile(dossierPath,'utf8');
  const rawDossier=JSON.parse(exported);
  assert.equal(ledger.schema,'phi-thinktank-local-council-result.v0.1');
  assert.equal(ledger.contractSha256,sha);
  assert.equal(ledger.summary.mode,'council');
  assert.equal(ledger.summary.turnsInvoked,5);
  assert.equal(ledger.summary.completed,true);
  assert.equal(ledger.replay.valid,true);
  assert.equal(ledger.replay.exact,true);
  assert.equal(ledger.authority.executionAuthorityGranted,false);
  assert.equal(ledger.authority.externalDoneAttested,false);
  assert.equal(ledger.authority.independentEvidenceVerified,false);
  assert.ok(ledger.events.some(x=>x.kind==='challenge.raised'&&x.source==='provider'));
  assert.equal(rawDossier.dossier.executionSource,'live-provider');
  assert.equal(rawDossier.dossier.operatorPrompt,contract.directive);
  assert.equal(rawDossier.dossier.outcome,'withheld');
  assert.deepEqual(rawDossier.seals,[]);
  // This is a real CLI-provider event but a FAKE adapter: the dossier's
  // "live-provider" field does NOT mean genuine installed Ollama inference.
  const preview=inspectThinkTankPackage(exported);
  assert.equal(preview.source,'OPERATOR_SUPPLIED_THINKTANK_EXPORT');
  assert.equal(preview.dossier.fingerprintRecomputed,true);
  assert.equal(preview.dossier.signatureVerified,false);
  assert.equal(preview.dossier.executionSource,'live-provider');
  assert.equal(preview.dossier.outcome,'withheld');
  assert.equal(preview.cryptographicSealVerified,false);
  assert.equal(preview.actionAuthorityTransferred,false);
  assert.equal(preview.evidenceVerifiedIndependently,false);
  assert.equal(preview.completionCertified,false);
  const company=createCompanyPlan({
   name:'CI-only Founder Lab',founder:'CI Synthetic Operator',product:'Crossrepo acceptance',
   customer:'Fixture',weeklyGoal:'Verify held proposals',budgetLimitUsd:0
  });
  assert.equal(company.nodes.length,0,'Import inspection cannot add a task');
  assert.throws(()=>addThinkTankTaskProposal(company,preview,'operatorPrompt',{
   id:'ci-council-review',function:'Independently inspect release evidence',
   output:'Human verification notes',check:'Check the exact source provenance',
   risk:'REPO_WRITE',reviewAcknowledged:false
  }),/HUMAN_REVIEW/);
  const next=addThinkTankTaskProposal(company,preview,'operatorPrompt',{
   id:'ci-council-review',function:'Independently inspect release evidence',
   output:'Human verification notes',check:'Check the exact source provenance',
   risk:'REPO_WRITE',reviewAcknowledged:true
  });
  assert.equal(company.nodes.length,0);
  assert.equal(next.nodes.length,1);
  assert.equal(next.nodes[0].actionReview,null);
  assert.equal(next.nodes[0].evidence,null);
  assert.deepEqual(next.nodes[0].dependsOn,[]);
  assert.equal(companyProjection(next).nodes[0].status,'ACTION_REVIEW_HELD');
  assert.equal(companyProjection(next).externalExecutionAttested,false);
  console.log('PASS SYNTHETIC_CI_ONLY UI_SHA_MATCH, CLI_INSPECTION, WRONG_SHA_REFUSED, 5_MOCK_LOCAL_ROLES, LEDGER_REPLAY_EXACT, DOSSIER_WITHHELD, COMPANY_ACTION_REVIEW_HELD');
 }finally{
  if(listenStarted)await new Promise(resolveClose=>server.close(resolveClose));
  else server.close();
  for(const p of paths)await rm(p,{force:true});
 }
});
