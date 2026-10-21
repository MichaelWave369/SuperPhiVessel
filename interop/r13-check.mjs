#!/usr/bin/env node
/** SuperPhiVessel R13 passive local witness check. Does NOT affect Vessie or permissions. */
import {readFile,stat} from 'node:fs/promises';
import {verifyWitness} from './r13-witness.mjs';
const bounded=async(file,max)=>{
  const s=await stat(file);
  if(!s.isFile()||s.size>max)throw Error('Input must be a bounded local file.');
  return JSON.parse(await readFile(file,'utf8'));
};
const a=process.argv.slice(2);
if(a.length!==5){
  process.stderr.write('Usage: node interop/r13-check.mjs <R12-ledger.json> <operator-pins.json> <witness-pins.json> <signed-witness.json> <independently-retained-minimum-event-count>\n');
  process.exitCode=2;
}else{
  try{
    if(!/^(0|[1-9][0-9]{0,2})$/.test(a[4])||Number(a[4])>128)
      throw Error('Invalid bounded receiver-protected minimum event count.');
    const report=verifyWitness(
      await bounded(a[0],192000),await bounded(a[1],16000),
      await bounded(a[3],3000),await bounded(a[2],14000),Number(a[4]));
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    process.exitCode=report.witnessValid?0:1;
  }catch(error){
    process.stderr.write('R13 refused: '+(error instanceof Error?error.message:String(error))+'\n');
    process.exitCode=1;
  }
}
