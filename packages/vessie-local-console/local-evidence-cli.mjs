#!/usr/bin/env node
/* Explicit local CLI only. No listener, cloud calls, Ollama inference or autostart.
 * Keys are stored outside the repository; private PEM never enters JSON or browser.
 */
import {generateKeyPairSync,createPublicKey} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,statSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureLocalOllamaEvidence,verifyLocalOllamaEvidence} from './local-evidence-bridge.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
function blocked(code){throw new Error('LOCAL_EVIDENCE_'+code);}
function outsideRepo(p){
  if(typeof p!=='string'||!isAbsolute(p))blocked('ABSOLUTE_PATH_REQUIRED');
  const resolved=resolve(p);
  const rel=relative(ROOT,resolved);
  if(rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel)))
    blocked('REPOSITORY_PATH_DENIED');
  return resolved;
}
function file(p){return readFileSync(outsideRepo(p),'utf8');}
function dir(p){
  const target=outsideRepo(p);
  if(!existsSync(target))mkdirSync(target,{recursive:true,mode:0o700});
  if(lstatSync(target).isSymbolicLink())blocked('SYMLINK_DIRECTORY_DENIED');
  const real=outsideRepo(realpathSync(target));
  if(!statSync(real).isDirectory())blocked('KEY_DIRECTORY_INVALID');
  return real;
}
function parseArgs(args){
  const [action,...flags]=args;
  const expected=action==='enroll'?['--key-dir']:
    action==='capture'?['--key-dir','--out']:
    action==='verify'?['--public-key','--receipt']:null;
  if(!expected||flags.length!==expected.length*2)blocked('USAGE');
  const inputs=Object.create(null);
  for(let i=0;i<flags.length;i+=2){
    const key=flags[i],value=flags[i+1];
    if(!expected.includes(key)||Object.hasOwn(inputs,key)||
      typeof value!=='string'||value.length===0||value.startsWith('--'))blocked('USAGE');
    inputs[key]=value;
  }
  if(expected.some(k=>!Object.hasOwn(inputs,k)))blocked('USAGE');
  return {action,inputs};
}
async function main(){
  const {action,inputs}=parseArgs(process.argv.slice(2));
  if(action==='enroll'){
    const target=dir(inputs['--key-dir']);
    const privateFile=join(target,'private.pem'), publicFile=join(target,'public.pem');
    if(existsSync(privateFile)||existsSync(publicFile))blocked('EXISTING_KEY_REFUSED');
    const {privateKey,publicKey}=generateKeyPairSync('ed25519');
    writeFileSync(privateFile,privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});
    writeFileSync(publicFile,publicKey.export({type:'spki',format:'pem'}),{flag:'wx',mode:0o600});
    console.log('LOCAL_EVIDENCE_ENROLLED_NO_AUTHORITY');
    console.log('Private key: '+privateFile);
    console.log('Public key: '+publicFile);
    console.log('Never publish or paste the private key; review directory ACLs on Windows.');
    return;
  }
  if(action==='capture'){
    const target=dir(inputs['--key-dir']);
    const privateFile=join(target,'private.pem');
    const publicFile=join(target,'public.pem');
    if(!existsSync(privateFile)||!existsSync(publicFile))blocked('ENROLLMENT_REQUIRED');
    if(lstatSync(privateFile).isSymbolicLink()||lstatSync(publicFile).isSymbolicLink())
      blocked('KEY_SYMLINK_DENIED');
    if(process.platform!=='win32'&&(statSync(privateFile).mode&0o077)!==0)
      blocked('PRIVATE_KEY_PERMISSIONS');
    const privateKeyPem=readFileSync(privateFile,'utf8');
    const publicKeyPem=readFileSync(publicFile,'utf8');
    const receipt=await captureLocalOllamaEvidence({privateKeyPem});
    const verified=verifyLocalOllamaEvidence(receipt,{publicKeyPem});
    if(!verified.signatureValid)blocked('SELF_CHECK_FAILED');
    const output=outsideRepo(inputs['--out']);
    if(output===privateFile||output===publicFile)blocked('OUTPUT_KEY_PATH_DENIED');
    writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('LOCAL_EVIDENCE_CAPTURED_NO_AUTHORITY');
    console.log('Probe: '+receipt.snapshot.inventory.probeStatus);
    console.log('Model count: '+verified.modelCount);
    console.log('Receipt: '+output);
    return;
  }
  const publicKeyPem=file(inputs['--public-key']);
  const raw=file(inputs['--receipt']);
  if(Buffer.byteLength(raw,'utf8')>65536)blocked('RECEIPT_TOO_LARGE');
  const receipt=JSON.parse(raw);
  const result=verifyLocalOllamaEvidence(receipt,{publicKeyPem});
  console.log(JSON.stringify(result,null,2));
  if(result.freshness!=='FRESH')process.exitCode=3;
}
try{await main();}
catch(error){
  // Do not expose paths, PEM contents, transport errors or response data.
  const safe=error instanceof Error&&/^LOCAL_EVIDENCE_[A-Z_]+$/.test(error.message)
    ?error.message:'LOCAL_EVIDENCE_OPERATION_REFUSED';
  console.error(safe);
  process.exitCode=2;
}
