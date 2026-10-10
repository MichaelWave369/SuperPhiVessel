/* SPV-COMPANY-10: IndexedDB adapter. Only the encrypted envelope is stored.
 * All calls must originate from deliberate operator actions in the UI.
 * No localStorage, cookies, remote endpoints, background sync or plaintext.
 */
import {validateSealedSlot} from './local-vault-crypto.mjs';
export const DATABASE_NAME='superphivessel-company-local-encrypted-v1';
const STORE='encrypted-only',KEY='workspace';
const fail=(yes,why)=>{if(!yes)throw Error('LOCAL_VAULT_'+why)};
function openDatabase(indexedDBApi=globalThis.indexedDB){
 fail(indexedDBApi&&typeof indexedDBApi.open==='function','STORAGE_UNAVAILABLE');
 return new Promise((resolve,reject)=>{
  const request=indexedDBApi.open(DATABASE_NAME,1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)
  };
  request.onerror=()=>reject(Error('LOCAL_VAULT_DB_OPEN'));
  request.onblocked=()=>reject(Error('LOCAL_VAULT_DB_BLOCKED'));
  request.onsuccess=()=>resolve(request.result)
 })
}
async function transaction(mode,action,indexedDBApi){
 const db=await openDatabase(indexedDBApi);
 try{
  return await new Promise((resolve,reject)=>{
   let tx,request;
   try{tx=db.transaction(STORE,mode);request=action(tx.objectStore(STORE))}
   catch{reject(Error('LOCAL_VAULT_DB_TRANSACTION'));return}
   let value;
   request.onsuccess=()=>{value=request.result};
   request.onerror=()=>reject(Error('LOCAL_VAULT_DB_REQUEST'));
   tx.oncomplete=()=>resolve(value);
   tx.onerror=()=>reject(Error('LOCAL_VAULT_DB_TRANSACTION'));
   tx.onabort=()=>reject(Error('LOCAL_VAULT_DB_ABORT'));
  });
 }finally{db.close()}
}
export async function loadSealedWorkspace(indexedDBApi){
 const slot=await transaction('readonly',store=>store.get(KEY),indexedDBApi);
 if(slot===undefined)return null;
 return validateSealedSlot(slot)
}
export async function saveSealedWorkspace(slot,indexedDBApi){
 validateSealedSlot(slot);
 await transaction('readwrite',store=>store.put(slot,KEY),indexedDBApi);
 return true
}
export async function deleteSealedWorkspace(indexedDBApi){
 await transaction('readwrite',store=>store.delete(KEY),indexedDBApi);
 return true
}
