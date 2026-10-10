export const LOCAL_THINKTANK_UI:string;
export const LOCAL_THINKTANK_BRIDGE:string;
export const LOCAL_HANDOFF_SCHEMA:string;
export type LocalThinkTankMode='council'|'debate'|'audit'|'trio'|'build';
export type LocalThinkTankDraft={
 schema:'spv-thinktank-draft.v0.1';kind:'operator-directive-draft';
 source:'vessie-human-composed';directive:string;suggestedMode:LocalThinkTankMode;
 runRequested:false;executionAuthorityGranted:false;providerKeysTransferred:false;
};
export type LocalThinkTankHealth={
 service:'phi-think-tank-provider-bridge';version:string;
 source:'LOCAL_UNAUTHENTICATED_READ_ONLY';
 providerExecutionConfirmed:false;sessionStarted:false;authorityGranted:false;
};
export function inspectOperatorDirective(text:string):string;
export function buildThinkTankLocalDraft(text:string,mode?:LocalThinkTankMode):LocalThinkTankDraft;
export function makeThinkTankLocalHandoffUrl(text:string,mode?:LocalThinkTankMode):string;
export function parseLocalBridgeHealth(json:unknown):LocalThinkTankHealth;
export function checkThinkTankLocalBridge(requester?:typeof fetch,signal?:AbortSignal):Promise<LocalThinkTankHealth>;
