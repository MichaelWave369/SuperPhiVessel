export type SealedWorkspaceSlot={
 schema:'superphivessel.local-encrypted-workspace.v0.1';
 cipher:'AES-256-GCM';kdf:'PBKDF2-SHA-256';iterations:310000;
 salt:string;iv:string;ciphertext:string;
 provenance:'USER_OPT_IN_BROWSER_ENCRYPTION';
 authenticatedExternalDone:false;executionAuthorityGranted:false;automaticSyncEnabled:false;
};
export const SEALED_SCHEMA:string;
export const MIN_PASSPHRASE_CHARS:number;
export const PBKDF2_ITERATIONS:number;
export function sealLocalArchive(archiveJson:string,pass:string,cryptoApi?:Crypto):Promise<SealedWorkspaceSlot>;
export function validateSealedSlot(slot:SealedWorkspaceSlot):SealedWorkspaceSlot;
export function unsealLocalArchive(slot:SealedWorkspaceSlot,pass:string,cryptoApi?:Crypto):Promise<string>;
