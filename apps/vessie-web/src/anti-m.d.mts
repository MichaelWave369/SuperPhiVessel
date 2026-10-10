export type AntiMBundle={
 schema:string;
 events:Array<{seq:number;at:string;type:string;payload:Record<string,unknown>;prevHash:string;hash:string}>;
};
export type AntiMState={
 contract:{id:string;title:string;deliverable:string;criteria:Array<{id:string;description:string}>};
 actions:Array<{id:string;kind:string;description:string;approval:{reviewer:string;sequence:number;authorityGranted:false}|null}>;
 evidence:Array<{criterionId:string;result:'PASS'|'FAIL';method:string;reference:string;summary:string;sequence:number;review:{reviewer:string;decision:'ACCEPT'|'REJECT';sequence:number}|null}>;
 closed:boolean;
 close:{reviewer:string;note:string;sequence:number}|null;
 status:string;
 readiness:{ready:boolean;missing:string[]};
 eventCount:number;
 tailHash:string|null;
 externalExecutionAttested:false;
 authorityGranted:false;
};
export const ANTIM_SCHEMA:string;
export function createBundle(input:{title:string;deliverable:string;criteria:string[]},contractId:string):Promise<AntiMBundle>;
export function appendEvent(bundle:AntiMBundle,type:string,payload:Record<string,unknown>):Promise<AntiMBundle>;
export function inspectBundle(bundle:AntiMBundle):Promise<AntiMState>;
export function importBundle(json:string):Promise<AntiMBundle>;
export function closureReceipt(bundle:AntiMBundle):Promise<Record<string,unknown>>;
