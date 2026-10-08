import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectR2OperatorPreflight} from './preflight.mjs';

const NOW=Date.parse('2026-10-08T20:00:00Z');
const base=()=>({
 platform:'win32',nodeVersion:'22.23.3',
 repoRoot:'/workspace/SuperPhiVessel',
 certPath:'/operator/certs/vessie-public.crt',
 keyPath:'/operator/keys/vessie-private.key'
});
const regular={size:1200,isFile:()=>true,isSymbolicLink:()=>false};
const symlink={size:1200,isFile:()=>false,isSymbolicLink:()=>true};
const keyRegular={size:300,isFile:()=>true,isSymbolicLink:()=>false};
function successDeps() {
 const reads=[];
 return {
   reads,
   deps:{
     lstat:path=>path.endsWith('.key')?keyRegular:regular,
     readCert:path=>{reads.push(path);return Buffer.from('PUBLIC_CRT_FIXTURE');},
     parseCert:()=>({
       checkIP:ip=>ip==='127.0.0.1'?'127.0.0.1':undefined,
       validFrom:'2026-01-01T00:00:00Z',
       validTo:'2027-01-01T00:00:00Z'
     }),
     now:()=>NOW
   }
 };
}
const run=(o=base(),override={})=>{
 const {deps,reads}=successDeps();
 return {result:inspectR2OperatorPreflight(o,{...deps,...override}),reads};
};
const check=(r,name)=>r.checks.find(x=>x.check===name)?.result;

test('R2PRE01 success qualifies only SOURCE preflight, never machine TLS trust',()=>{
 const {result,reads}=run();
 assert.equal(result.status,'LOCAL_SOURCE_PREFLIGHT_READY_FIELD_TEST_REQUIRED');
 assert.equal(result.check_count,10);
 assert.equal(result.passed_check_count,10);
 assert.equal(result.private_key_contents_read,false);
 assert.equal(result.certificate_trust_validated_by_windows,false);
 assert.equal(result.browser_tls_trust_validated,false);
 assert.equal(result.browser_private_network_qualified,false);
 assert.equal(result.gateway_connection_tested,false);
 assert.equal(result.physically_qualified,false);
 assert.equal(result.authority_granted,false);
 assert.deepEqual(reads,['/operator/certs/vessie-public.crt']);
});
test('R2PRE02 Linux fixture never looks like a qualified Windows machine',()=>{
 const {result}=run({...base(),platform:'linux'});
 assert.equal(check(result,'WINDOWS_PLATFORM'),'BLOCKED');
 assert.equal(result.status,'BLOCKED_OPERATOR_PREFLIGHT');
});
test('R2PRE03 unsupported Node 20 blocks even with otherwise valid files',()=>{
 const {result}=run({...base(),nodeVersion:'20.20.0'});
 assert.equal(check(result,'NODE_22_OR_NEWER'),'BLOCKED');
});
test('R2PRE04 missing public certificate env blocks without leaking paths',()=>{
 const {result}=run({...base(),certPath:undefined});
 assert.equal(check(result,'TLS_CERT_CONFIGURED'),'BLOCKED');
 assert.equal(check(result,'TLS_CERT_PUBLIC_FILE'),'BLOCKED');
 assert.equal(check(result,'TLS_CERT_IP_SAN_LOOPBACK'),'BLOCKED');
 assert.equal(check(result,'TLS_CERT_TIME_VALID'),'BLOCKED');
});
test('R2PRE05 missing TLS private-key env blocks without reading any key',()=>{
 const {result,reads}=run({...base(),keyPath:undefined});
 assert.equal(check(result,'TLS_KEY_CONFIGURED'),'BLOCKED');
 assert.equal(check(result,'TLS_KEY_FILE_EXISTS'),'BLOCKED');
 assert.equal(result.private_key_contents_read,false);
 assert.equal(reads.length,1);
});
test('R2PRE06 private key located in repository is refused',()=>{
 const {result}=run({...base(),keyPath:'/workspace/SuperPhiVessel/secrets/key.key'});
 assert.equal(check(result,'TLS_KEY_OUTSIDE_REPOSITORY'),'BLOCKED');
});
test('R2PRE07 repository root as key file path is refused',()=>{
 const {result}=run({...base(),keyPath:'/workspace/SuperPhiVessel'});
 assert.equal(check(result,'TLS_KEY_OUTSIDE_REPOSITORY'),'BLOCKED');
});
test('R2PRE08 public cert and private key cannot be same path',()=>{
 const options=base();options.keyPath=options.certPath;
 const {result}=run(options);
 assert.equal(check(result,'TLS_CERT_AND_KEY_DIFFERENT_FILES'),'BLOCKED');
});
test('R2PRE09 key file missing is blocked without path disclosure',()=>{
 const {result}=run(base(),{
   lstat:p=>{if(p.endsWith('.key'))throw new Error('SECRET_WINDOWS_PATH_NOT_FOUND');return regular;}
 });
 assert.equal(check(result,'TLS_KEY_FILE_EXISTS'),'BLOCKED');
 assert.equal(JSON.stringify(result).includes('SECRET_WINDOWS_PATH_NOT_FOUND'),false);
});
test('R2PRE10 symlinked private key rejected before content access',()=>{
 const {result,reads}=run(base(),{
   lstat:p=>p.endsWith('.key')?symlink:regular
 });
 assert.equal(check(result,'TLS_KEY_FILE_EXISTS'),'BLOCKED');
 assert.equal(reads.length,1);
});
test('R2PRE11 symlinked public certificate rejected',()=>{
 let called=0;
 const {result}=run(base(),{
   lstat:p=>p.endsWith('.key')?keyRegular:symlink,
   readCert:()=>{called++;throw new Error('SHOULD_NOT_BE_CALLED');}
 });
 assert.equal(check(result,'TLS_CERT_PUBLIC_FILE'),'BLOCKED');
 assert.equal(called,0);
});
test('R2PRE12 oversized public cert is not loaded into memory',()=>{
 let called=0;
 const {result}=run(base(),{
   lstat:p=>p.endsWith('.key')?keyRegular:{...regular,size:65537},
   readCert:()=>{called++;throw new Error('SHOULD_NOT_BE_CALLED');}
 });
 assert.equal(check(result,'TLS_CERT_PUBLIC_FILE'),'BLOCKED');
 assert.equal(called,0);
});
test('R2PRE13 cert SAN must include IP 127.0.0.1, DNS is not enough',()=>{
 const {result}=run(base(),{
   parseCert:()=>({
     checkIP:()=>undefined,
     validFrom:'2026-01-01T00:00:00Z',validTo:'2027-01-01T00:00:00Z'
   })
 });
 assert.equal(check(result,'TLS_CERT_IP_SAN_LOOPBACK'),'BLOCKED');
});
test('R2PRE14 expired certificate is blocked',()=>{
 const {result}=run(base(),{
   parseCert:()=>({
     checkIP:()=> '127.0.0.1',
     validFrom:'2020-01-01T00:00:00Z',validTo:'2025-01-01T00:00:00Z'
   })
 });
 assert.equal(check(result,'TLS_CERT_TIME_VALID'),'BLOCKED');
});
test('R2PRE15 not-yet-valid certificate is blocked',()=>{
 const {result}=run(base(),{
   parseCert:()=>({
     checkIP:()=> '127.0.0.1',
     validFrom:'2027-01-01T00:00:00Z',validTo:'2028-01-01T00:00:00Z'
   })
 });
 assert.equal(check(result,'TLS_CERT_TIME_VALID'),'BLOCKED');
});
test('R2PRE16 invalid certificate parse is safe refusal with no key reads',()=>{
 const {result,reads}=run(base(),{
   parseCert:()=>{throw new Error('ABSOLUTE_PATH_AND_PRIVATE_KEY_METADATA');}
 });
 assert.equal(check(result,'TLS_CERT_IP_SAN_LOOPBACK'),'BLOCKED');
 assert.equal(check(result,'TLS_CERT_TIME_VALID'),'BLOCKED');
 assert.equal(result.private_key_contents_read,false);
 assert.equal(JSON.stringify(result).includes('ABSOLUTE_PATH_AND_PRIVATE_KEY_METADATA'),false);
 assert.equal(reads.length,1);
});
test('R2PRE17 all output is allowlisted, no secret or absolute file paths',()=>{
 const options={...base(),keyPath:'/operator/keys/PRIVATE_KEY_SHOULD_NOT_LEAK.key'};
 const {result}=run(options);
 const out=JSON.stringify(result);
 assert.ok(!out.includes('PRIVATE_KEY_SHOULD_NOT_LEAK'));
 assert.ok(!out.includes('/operator/'));
 assert.ok(!out.includes('PUBLIC_CRT_FIXTURE'));
 assert.ok(!out.includes('BEGIN PRIVATE KEY'));
 assert.equal(result.device_paths_included,false);
 assert.equal(result.browser_session_tokens_included,false);
 assert.equal(result.credentials_included,false);
});
