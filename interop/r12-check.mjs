#!/usr/bin/env node
/** SPV R12 passive local governance evaluation. No signing or operator writes. */
import {readFile,stat} from 'node:fs/promises';
import {evaluateGovernance} from './r12-governance.mjs';
async function readLocal(path,limit){
  const s=await stat(path);
  if(!s.isFile()||s.size>limit)throw Error('Unbounded or missing local evidence file.');
  return JSON.parse(await readFile(path,'utf8'));
}
const args=process.argv.slice(2);
if(args.length!==5){
  process.stderr.write('Usage: node interop/r12-check.mjs <signed-passport.json> <R10-pinned-public-trust.json> <R12-operator-pinned-public-trust.json> <governance-ledger.json> <separately-retained-checkpoint.json>\n');
  process.exitCode=2;
}else{
  try{
    const [signed,issuerTrust,operatorTrust,ledger,checkpoint]=await Promise.all([
      readLocal(args[0],320000),readLocal(args[1],16000),
      readLocal(args[2],16000),readLocal(args[3],192000),
      readLocal(args[4],500),
    ]);
    const result=evaluateGovernance(signed,issuerTrust,operatorTrust,ledger,checkpoint);
    const {latestStates:unused,...publicResult}=result;void unused;
    process.stdout.write(JSON.stringify(publicResult,null,2)+'\n');
    process.exitCode=publicResult.reviewApproved?0:1;
  }catch(error){
    process.stderr.write('Inspection denied: '+(error instanceof Error?error.message:String(error))+'\n');
    process.exitCode=1;
  }
}
