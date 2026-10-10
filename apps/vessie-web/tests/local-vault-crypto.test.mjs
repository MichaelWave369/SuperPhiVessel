import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan} from '../src/company-mode.mjs';
import {createWorkspaceArchive,importWorkspaceArchive} from '../src/workspace-archive.mjs';
import {sealLocalArchive,unsealLocalArchive,validateSealedSlot,SEALED_SCHEMA,PBKDF2_ITERATIONS} from '../src/local-vault-crypto.mjs';
const plan=()=>createCompanyPlan({name:'Lab',founder:'Owner',product:'Tools',
 customer:'People',weeklyGoal:'Ship',budgetLimitUsd:0});
test('encrypts a valid replayable archive, roundtrips, exposes no plaintext or passphrase',async()=>{
 const archive=JSON.stringify(await createWorkspaceArchive(plan(),null,[]));
 const sealed=await sealLocalArchive(archive,'more-than-twelve-characters');
 assert.equal(sealed.schema,SEALED_SCHEMA);
 assert.equal(sealed.iterations,PBKDF2_ITERATIONS);
 assert.equal(sealed.cipher,'AES-256-GCM');
 assert.equal(sealed.executionAuthorityGranted,false);
 assert.equal(sealed.automaticSyncEnabled,false);
 assert.equal(JSON.stringify(sealed).includes('Lab'),false);
 assert.equal(JSON.stringify(sealed).includes('more-than-twelve-characters'),false);
 assert.equal(await unsealLocalArchive(sealed,'more-than-twelve-characters'),archive);
 const restored=await importWorkspaceArchive(await unsealLocalArchive(sealed,'more-than-twelve-characters'));
 assert.equal(restored.plan.company.name,'Lab');
 assert.equal(restored.authorityGranted,false);
});
test('new salt and nonce generate different ciphertext for identical input and passphrase',async()=>{
 const payload=JSON.stringify(await createWorkspaceArchive(plan(),null,[]));
 const [a,b]=await Promise.all([
  sealLocalArchive(payload,'some-longer-passphrase'),
  sealLocalArchive(payload,'some-longer-passphrase')
 ]);
 assert.notEqual(a.salt,b.salt);
 assert.notEqual(a.iv,b.iv);
 assert.notEqual(a.ciphertext,b.ciphertext);
});
test('wrong passphrase and modified ciphertext fail with no plaintext return',async()=>{
 const encrypted=await sealLocalArchive('{"demo":"opaque"}','super-long-test-passphrase');
 await assert.rejects(unsealLocalArchive(encrypted,'wrong-password-12345'),/DECRYPT_REFUSED/);
 const bad=structuredClone(encrypted);
 bad.ciphertext=(bad.ciphertext[0]==='A'?'B':'A')+bad.ciphertext.slice(1);
 await assert.rejects(unsealLocalArchive(bad,'super-long-test-passphrase'),/DECRYPT_REFUSED/);
});
test('rejects downgrade, fabricated authority, malformed IV/salt, unsafe passphrase and extra fields',async()=>{
 const sealed=await sealLocalArchive('{"content":"value"}','super-long-test-passphrase');
 assert.throws(()=>validateSealedSlot({...sealed,executionAuthorityGranted:true}),/AUTHORITY/);
 assert.throws(()=>validateSealedSlot({...sealed,automaticSyncEnabled:true}),/AUTHORITY/);
 assert.throws(()=>validateSealedSlot({...sealed,cipher:'AES-128-CBC'}),/SCHEMA/);
 assert.throws(()=>validateSealedSlot({...sealed,iterations:1000}),/SCHEMA/);
 assert.throws(()=>validateSealedSlot({...sealed,extra:true}),/FIELDS/);
 assert.throws(()=>validateSealedSlot({...sealed,iv:'Zg=='}),/IV_OR_SALT/);
 await assert.rejects(sealLocalArchive('x','short'),/PASSPHRASE/);
 await assert.rejects(unsealLocalArchive(sealed,'short'),/PASSPHRASE/);
 await assert.rejects(sealLocalArchive('x'.repeat(1800001),'super-long-test-passphrase'),/ARCHIVE_SIZE/);
});
test('encrypting a workspace never promotes operator-reported DONE into attestation',async()=>{
 const p=plan();
 const archive=JSON.stringify(await createWorkspaceArchive(p,null,[]));
 const sealed=await sealLocalArchive(archive,'backup-protected-passphrase');
 const recovered=await importWorkspaceArchive(await unsealLocalArchive(sealed,'backup-protected-passphrase'));
 assert.equal(recovered.externallyAttested,false);
 assert.equal(recovered.links.length,0);
 assert.equal(recovered.plan.nodes.length,0);
});
