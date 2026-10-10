/* SPV-COMPANY-10: opt-in passphrase-encrypted, browser-local workspace slot.
 * No default auto-save or auto-load; no remote calls, sync or key persistence.
 * Browser crypto is for confidentiality at rest, NOT external-source attestation.
 */
export const SEALED_SCHEMA='superphivessel.local-encrypted-workspace.v0.1';
export const MIN_PASSPHRASE_CHARS=12;
export const PBKDF2_ITERATIONS=310000;
const MAX_ARCHIVE=1800000,MAX_SLOT=2700000;
const fail=(yes,code)=>{if(!yes)throw Error('LOCAL_VAULT_'+code)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(o,keys)=>fail(obj(o)&&Object.keys(o).sort().join('|')===keys.slice().sort().join('|'),'FIELDS');
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const aad=enc.encode('SPV_COMPANY_LOCAL_VAULT_V0_1|PORTABLE_ARCHIVE');
const asBase64=bytes=>{
 let value='';
 for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(value)
};
function fromBase64(value,max){
 fail(typeof value==='string'&&value.length>0&&value.length<=Math.ceil(max/3)*4+4&&
  /^[A-Za-z0-9+/]*={0,2}$/.test(value)&&value.length%4===0,'BASE64');
 let raw;try{raw=atob(value)}catch{throw Error('LOCAL_VAULT_BASE64')}
 fail(raw.length<=max,'SIZE');
 const bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 fail(asBase64(bytes)===value,'BASE64_CANONICAL');
 return bytes
}
function cryptoProvider(cryptoApi){
 fail(cryptoApi&&cryptoApi.subtle&&typeof cryptoApi.getRandomValues==='function','WEB_CRYPTO_REQUIRED');
 return cryptoApi
}
function checkPassphrase(pass){
 fail(typeof pass==='string'&&pass.length>=MIN_PASSPHRASE_CHARS&&pass.length<=512&&
  !/[\u0000-\u001f\u007f]/.test(pass),'PASSPHRASE');
 return pass
}
async function derive(pass,salt,cryptoApi){
 const origin=await cryptoApi.subtle.importKey('raw',enc.encode(checkPassphrase(pass)),'PBKDF2',false,['deriveKey']);
 return cryptoApi.subtle.deriveKey({name:'PBKDF2',salt,iterations:PBKDF2_ITERATIONS,hash:'SHA-256'},
  origin,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function sealLocalArchive(archiveJson,pass,cryptoApi=globalThis.crypto){
 const c=cryptoProvider(cryptoApi);
 checkPassphrase(pass);
 fail(typeof archiveJson==='string'&&enc.encode(archiveJson).length<=MAX_ARCHIVE,'ARCHIVE_SIZE');
 const salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12));
 const key=await derive(pass,salt,c);
 const encrypted=await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},
  key,enc.encode(archiveJson));
 const slot={
  schema:SEALED_SCHEMA,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA-256',iterations:PBKDF2_ITERATIONS,
  salt:asBase64(salt),iv:asBase64(iv),ciphertext:asBase64(new Uint8Array(encrypted)),
  provenance:'USER_OPT_IN_BROWSER_ENCRYPTION',authenticatedExternalDone:false,
  executionAuthorityGranted:false,automaticSyncEnabled:false
 };
 return validateSealedSlot(slot)
}
export function validateSealedSlot(slot){
 exact(slot,['schema','cipher','kdf','iterations','salt','iv','ciphertext','provenance',
  'authenticatedExternalDone','executionAuthorityGranted','automaticSyncEnabled']);
 fail(slot.schema===SEALED_SCHEMA&&slot.cipher==='AES-256-GCM'&&
  slot.kdf==='PBKDF2-SHA-256'&&slot.iterations===PBKDF2_ITERATIONS&&
  slot.provenance==='USER_OPT_IN_BROWSER_ENCRYPTION','SCHEMA');
 fail(slot.authenticatedExternalDone===false&&slot.executionAuthorityGranted===false&&
  slot.automaticSyncEnabled===false,'AUTHORITY');
 fail(new TextEncoder().encode(JSON.stringify(slot)).length<=MAX_SLOT,'SIZE');
 fail(fromBase64(slot.salt,16).length===16&&fromBase64(slot.iv,12).length===12,'IV_OR_SALT');
 fail(fromBase64(slot.ciphertext,MAX_ARCHIVE+16).length>=16,'CIPHERTEXT');
 return slot
}
export async function unsealLocalArchive(slot,pass,cryptoApi=globalThis.crypto){
 const c=cryptoProvider(cryptoApi);
 checkPassphrase(pass);validateSealedSlot(slot);
 try{
  const key=await derive(pass,fromBase64(slot.salt,16),c);
  const plaintext=await c.subtle.decrypt({name:'AES-GCM',iv:fromBase64(slot.iv,12),
   additionalData:aad,tagLength:128},key,fromBase64(slot.ciphertext,MAX_ARCHIVE+16));
  const data=dec.decode(plaintext);
  fail(enc.encode(data).length<=MAX_ARCHIVE,'ARCHIVE_SIZE');
  return data
 }catch(e){
  if(e instanceof Error&&/^LOCAL_VAULT_(?:SIZE|ARCHIVE_SIZE)$/.test(e.message))throw e;
  throw Error('LOCAL_VAULT_DECRYPT_REFUSED')
 }
}
