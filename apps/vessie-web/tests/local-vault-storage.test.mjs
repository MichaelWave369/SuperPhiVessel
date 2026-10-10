import test from 'node:test';
import assert from 'node:assert/strict';
import {sealLocalArchive} from '../src/local-vault-crypto.mjs';
import {loadSealedWorkspace,saveSealedWorkspace,deleteSealedWorkspace} from '../src/local-vault-storage.mjs';

function mockIndexedDb(){
 const table=new Map(),counter={opens:0,reads:0,writes:0,deletes:0};
 const db={
  objectStoreNames:{contains:(name)=>name==='encrypted-only'},
  createObjectStore(){throw Error('unexpected upgrade')},
  close(){},
  transaction(name,mode){
   assert.equal(name,'encrypted-only');
   const tx={oncomplete:null,onerror:null,onabort:null,
    objectStore(){
     function act(op,value,key){
      const request={result:undefined,onsuccess:null,onerror:null};
      queueMicrotask(()=>{
       if(op==='get'){counter.reads++;request.result=table.get(value)}
       if(op==='put'){counter.writes++;table.set(key,value)}
       if(op==='delete'){counter.deletes++;table.delete(value)}
       request.onsuccess?.();
       queueMicrotask(()=>tx.oncomplete?.());
      });
      return request
     }
     return {
      get:key=>act('get',key),
      put:(value,key)=>act('put',value,key),
      delete:key=>act('delete',key)
     }
    }
   };
   assert.ok(['readonly','readwrite'].includes(mode));
   return tx
  }
 };
 const factory={
  open(name,version){
   assert.equal(name,'superphivessel-company-local-encrypted-v1');
   assert.equal(version,1);
   counter.opens++;
   const req={result:db,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
   queueMicrotask(()=>req.onsuccess?.());
   return req
  }
 };
 return {factory,table,counter}
}
test('explicit storage read/write/delete and no access before a call',async()=>{
 const db=mockIndexedDb();
 assert.equal(db.counter.opens,0);
 assert.equal(await loadSealedWorkspace(db.factory),null);
 assert.equal(db.counter.reads,1);
 const slot=await sealLocalArchive('{"hello":"sensitive-local-only"}','unique-long-passphrase');
 assert.equal(await saveSealedWorkspace(slot,db.factory),true);
 assert.equal(db.counter.writes,1);
 assert.equal(db.table.size,1);
 const stored=await loadSealedWorkspace(db.factory);
 assert.deepEqual(stored,slot);
 assert.equal(JSON.stringify(db.table.get('workspace')).includes('sensitive-local-only'),false);
 assert.equal(JSON.stringify(db.table.get('workspace')).includes('unique-long-passphrase'),false);
 assert.equal(await deleteSealedWorkspace(db.factory),true);
 assert.equal(db.table.size,0);
 assert.equal(db.counter.deletes,1);
 assert.equal(await loadSealedWorkspace(db.factory),null);
});
test('malformed or unsafe slot never reaches storage write',async()=>{
 const db=mockIndexedDb();
 await assert.rejects(saveSealedWorkspace({cipher:'none'},db.factory),/FIELDS/);
 assert.equal(db.counter.opens,0);
 assert.equal(db.counter.writes,0);
});
test('reading malformed encrypted slot rejects rather than silently treating it as absent',async()=>{
 const db=mockIndexedDb();db.table.set('workspace',{schema:'fake',plaintext:'not encrypted'});
 await assert.rejects(loadSealedWorkspace(db.factory),/FIELDS/);
 assert.equal(db.table.size,1,'failed read must never quietly delete user data');
});
