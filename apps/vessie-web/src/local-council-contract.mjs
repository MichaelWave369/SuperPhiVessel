/* SPV-COMPANY-17: compose the exact TT-35 operator contract in browser memory.
 * No providers, no auto-run, no repository writes, no stored secrets.
 */
export const LOCAL_COUNCIL_SCHEMA="phi-thinktank-local-council.v0.1";
export const LOCAL_COUNCIL_TURNS={council:5,trio:3,audit:2};
const fail=(c)=>{throw Error("SPV_LOCAL_COUNCIL_"+c)};
export function makeLocalCouncilContract({mode,directive,model,maxSessionSeconds}){
 if(!Object.hasOwn(LOCAL_COUNCIL_TURNS,mode))fail("MODE");
 if(typeof directive!=="string"||directive.trim().length<5||directive.length>1200||
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(directive))fail("DIRECTIVE");
 if(typeof model!=="string"||!(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,89}$/.test(model))||
  model.includes(".."))fail("MODEL");
 if(!Number.isInteger(maxSessionSeconds)||maxSessionSeconds<30||maxSessionSeconds>600)fail("TIME_BUDGET");
 if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bsk-[A-Za-z0-9_-]{25,}\b/i.test(directive))fail("SECRET_PATTERN");
 return {
  schema:LOCAL_COUNCIL_SCHEMA,mode,directive,
  provider:"ollama-local-only",model,
  maxRoleTurns:LOCAL_COUNCIL_TURNS[mode],
  maxSessionSeconds,
  allowRemoteProviders:false,browserAutoRun:false,
  executionAuthorityGranted:false,externalDoneAttested:false
 }
}
export function localCouncilContractText(contract){
 const checked=makeLocalCouncilContract(contract);
 const keys=Object.keys(checked).sort().join("|");
 if(!contract||typeof contract!=="object"||
  Object.keys(contract).sort().join("|")!==keys||
  !Object.entries(checked).every(([key,v])=>contract[key]===v))fail("FIELDS");
 return JSON.stringify(checked,null,2)+"\n"
}
export async function localCouncilSha256(text){
 if(typeof text!=="string"||text.length>8192)fail("SIZE");
 if(!globalThis.crypto?.subtle)fail("CRYPTO_UNAVAILABLE");
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("")
}
