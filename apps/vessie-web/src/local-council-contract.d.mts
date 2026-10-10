export type LocalCouncilMode='council'|'trio'|'audit';
export type LocalCouncilContract={schema:'phi-thinktank-local-council.v0.1';mode:LocalCouncilMode;directive:string;provider:'ollama-local-only';model:string;maxRoleTurns:number;maxSessionSeconds:number;allowRemoteProviders:false;browserAutoRun:false;executionAuthorityGranted:false;externalDoneAttested:false};
export const LOCAL_COUNCIL_SCHEMA:string;
export const LOCAL_COUNCIL_TURNS:Record<LocalCouncilMode,number>;
export function makeLocalCouncilContract(input:{mode:LocalCouncilMode;directive:string;model:string;maxSessionSeconds:number}):LocalCouncilContract;
export function localCouncilContractText(contract:LocalCouncilContract):string;
export function localCouncilSha256(text:string):Promise<string>;
