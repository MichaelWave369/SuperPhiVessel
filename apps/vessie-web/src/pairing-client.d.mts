export type GatewayModel = {
  name:string;
  loaded:boolean;
  quantization:string;
  size_bytes:number|null;
  runtime_vram_bytes:number|null;
  routing_approved:false;
  execution_authorized:false;
};
export const LOCAL_GATEWAY:string;
export function pairGateway(code:string):Promise<string>;
export function gatewayStatus(session:string):Promise<{
  schema:string;gateway_status:string;browser_origin:string;session_expires_in_seconds:number;
  authority_granted:false;
}>;
export function gatewayModels(session:string):Promise<{count:number;models:GatewayModel[];probe_status:string}>;
export function revokeGateway(session:string):Promise<void>;
export function confirmRevokedGateway(session:string):Promise<{
  confirmed:true;source:'HTTP_403_SESSION_DENIED';authority_granted:false
}>;

export function gatewayScoutHandoff(session:string):Promise<unknown>;
