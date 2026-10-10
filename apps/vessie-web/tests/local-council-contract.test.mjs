import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {
 makeLocalCouncilContract,localCouncilContractText,localCouncilSha256,LOCAL_COUNCIL_TURNS
} from '../src/local-council-contract.mjs';
const input=()=>({
 mode:'council',directive:'Investigate and challenge unsupported release-completion claims.',
 model:'gemma3:12b',maxSessionSeconds:180
});
test('makes matching ThinkTank 35 local-only immutable shape with no grants',async()=>{
 const contract=makeLocalCouncilContract(input());
 assert.deepEqual(Object.keys(contract),[
  'schema','mode','directive','provider','model','maxRoleTurns','maxSessionSeconds',
  'allowRemoteProviders','browserAutoRun','executionAuthorityGranted','externalDoneAttested'
 ]);
 assert.equal(contract.maxRoleTurns,5);
 assert.equal(contract.allowRemoteProviders,false);
 assert.equal(contract.browserAutoRun,false);
 assert.equal(contract.executionAuthorityGranted,false);
 assert.equal(contract.externalDoneAttested,false);
 const content=localCouncilContractText(contract);
 const sha=await localCouncilSha256(content);
 assert.equal(sha,createHash('sha256').update(content).digest('hex'));
 assert.match(sha,/^[0-9a-f]{64}$/);
});
test('each approved mode has exact bounded role turns',()=>{
 assert.deepEqual(LOCAL_COUNCIL_TURNS,{council:5,trio:3,audit:2});
 for(const [mode,count] of Object.entries(LOCAL_COUNCIL_TURNS)){
  const contract=makeLocalCouncilContract({...input(),mode});
  assert.equal(contract.maxRoleTurns,count);
  assert.equal(JSON.parse(localCouncilContractText(contract)).maxRoleTurns,count);
 }
});
test('rejects invalid input and obvious keys without preparing contract',()=>{
 const x=input();
 assert.throws(()=>makeLocalCouncilContract({...x,mode:'freerun'}),/MODE/);
 assert.throws(()=>makeLocalCouncilContract({...x,maxSessionSeconds:1500}),/TIME_BUDGET/);
 assert.throws(()=>makeLocalCouncilContract({...x,model:'../../remote'}),/MODEL/);
 assert.throws(()=>makeLocalCouncilContract({...x,directive:' ' }),/DIRECTIVE/);
 assert.throws(()=>makeLocalCouncilContract({...x,directive:'x'.repeat(1201)}),/DIRECTIVE/);
 assert.throws(()=>makeLocalCouncilContract({...x,directive:'secret github_pat_abcdefghijklmnopqrstuvwxyz0123456789'}),/SECRET_PATTERN/);
 const valid=makeLocalCouncilContract(x);
 assert.throws(()=>localCouncilContractText({...valid,browserAutoRun:true}),/FIELDS/);
 assert.throws(()=>localCouncilContractText({...valid,allowRemoteProviders:true}),/FIELDS/);
 assert.throws(()=>localCouncilContractText({...valid,executionAuthorityGranted:true}),/FIELDS/);
 assert.throws(()=>localCouncilContractText({...valid,externalDoneAttested:true}),/FIELDS/);
 assert.throws(()=>localCouncilContractText({...valid,remoteUrl:'https://api.example.com'}),/FIELDS/);
});
