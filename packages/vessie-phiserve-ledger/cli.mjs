#!/usr/bin/env node
/**
 * Offline CLI: ingest one redacted receipt, verify the immutable ledger,
 * or print a non-promoting evidence summary. Never contacts GitHub/models.
 */
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync,lstatSync,rmSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  parseUniqueJSON,makeEntry,validateEntry,summary,jsonLine,
} from './ledger.mjs';

const DEFAULT=resolve(fileURLToPath(new URL('../../ledger/phiserve-acceptance/',import.meta.url)));
const fail=reason=>{throw new Error(reason)};
function readRegular(path){
  const p=resolve(path);
  if(!existsSync(p)||!lstatSync(p).isFile()||lstatSync(p).isSymbolicLink())
    fail('LEDGER_REGULAR_FILE_REQUIRED');
  return readFileSync(p);
}
function argsOf(argv){
  const out={};
  for(let i=0;i<argv.length;i+=2){
    if(!argv[i]?.startsWith('--')||i+1>=argv.length||
       Object.hasOwn(out,argv[i].slice(2)))fail('LEDGER_CLI_ARGS_INVALID');
    out[argv[i].slice(2)]=argv[i+1];
  }
  return out;
}
function exactArgs(args,keys){
  if(Object.keys(args).sort().join(',')!==keys.sort().join(','))
    fail('LEDGER_CLI_ARGUMENT_SET_INVALID');
}
export function loadLedger(root=DEFAULT){
  const entriesDir=join(root,'entries');
  const evidenceDir=join(root,'evidence');
  if(!existsSync(entriesDir)||!existsSync(evidenceDir))
    fail('LEDGER_DIRECTORIES_MISSING');
  const names=readdirSync(entriesDir).sort();
  if(names.some(n=>!/^gha-[1-9][0-9]*\.json$/.test(n)))
    fail('LEDGER_UNEXPECTED_ENTRY_FILE');
  const expectedEvidence=new Set();
  const results=[];
  for(const name of names){
    const stem=basename(name,'.json');
    const receiptFile=join(evidenceDir,stem,'acceptance.json');
    const entry=parseUniqueJSON(readRegular(join(entriesDir,name)));
    const sourceBytes=readRegular(receiptFile);
    if(entry.record_id!==stem ||
       entry.source.workflow_run_id.toString()!==stem.slice(4))
      fail('LEDGER_ENTRY_FILENAME_MISMATCH');
    validateEntry(entry,sourceBytes);
    expectedEvidence.add(stem);
    results.push(entry);
  }
  const actualEvidence=readdirSync(evidenceDir).sort();
  if(actualEvidence.join(',')!==[...expectedEvidence].sort().join(','))
    fail('LEDGER_ORPHANED_OR_UNEXPECTED_EVIDENCE');
  for(const stem of actualEvidence){
    const folder=join(evidenceDir,stem);
    if(!lstatSync(folder).isDirectory()||
       readdirSync(folder).sort().join(',')!=='acceptance.json')
      fail('LEDGER_EVIDENCE_DIRECTORY_INVALID');
  }
  summary(results); // reject duplicate source references
  return results;
}

export function ingest(root,receiptFile,meta){
  const bytes=readRegular(receiptFile);
  const entry=makeEntry(bytes,meta);
  const id=entry.record_id;
  const evidence=join(root,'evidence',id,'acceptance.json');
  const record=join(root,'entries',id+'.json');
  if(existsSync(evidence)||existsSync(record))fail('LEDGER_APPEND_ONLY_DUPLICATE_RUN');
  mkdirSync(join(root,'entries'),{recursive:true});
  mkdirSync(join(root,'evidence',id),{recursive:true});
  try{
    writeFileSync(evidence,bytes,{flag:'wx',mode:0o644});
    writeFileSync(record,jsonLine(entry),{flag:'wx',mode:0o644});
  }catch(error){
    if(!existsSync(record))rmSync(evidence,{force:true});
    throw error;
  }
  return entry;
}

function main(argv){
  const [command,...rest]=argv;
  if(!['ingest','verify','summary'].includes(command))fail('LEDGER_COMMAND_INVALID');
  const options=argsOf(rest);
  if(command==='ingest'){
    exactArgs(options,['root','receipt','run-id','artifact-id','run-created-at']);
    const meta={
      runId:Number(options['run-id']),
      artifactId:Number(options['artifact-id']),
      runCreatedAt:options['run-created-at'],
    };
    const entry=ingest(resolve(options.root),options.receipt,meta);
    console.log('LEDGER_INGESTED '+entry.record_id+
      ' - human review and Git PR required; no authority granted.');
    return;
  }
  exactArgs(options,['root']);
  const entries=loadLedger(resolve(options.root));
  if(command==='verify'){
    console.log('LEDGER_PASS '+entries.length+' immutable self-reported records; no model authority.');
  }else{
    const report=summary(entries);
    console.log(jsonLine(report));
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main(process.argv.slice(2));}
  catch(error){
    // Do not print path contents or untrusted receipt fields.
    const code=typeof error.message==='string'&&/^LEDGER_[A-Z0-9_]+$/.test(error.message)
      ?error.message:'LEDGER_COMMAND_FAILED';
    console.error(code);process.exitCode=1;
  }
}
