import type {SealedWorkspaceSlot} from './local-vault-crypto.mjs';
export const DATABASE_NAME:string;
export function loadSealedWorkspace(indexedDBApi?:IDBFactory):Promise<SealedWorkspaceSlot|null>;
export function saveSealedWorkspace(slot:SealedWorkspaceSlot,indexedDBApi?:IDBFactory):Promise<true>;
export function deleteSealedWorkspace(indexedDBApi?:IDBFactory):Promise<true>;
