import { createServer } from 'node:https';
import { X509Certificate, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { discoverOllama } from './ollama-probe.mjs';

export const PAIRED_ORIGIN = 'https://michaelwave369.github.io';
export const LOOPBACK = '127.0.0.1';
const SESSION_MS = 15 * 60 * 1000;
const BAD_PAIR_LIMIT = 5;
const MAX_REQUEST_BYTES = 1024;
const MAX_MODEL_READS = 15;

const digest = value => createHash('sha256').update(value).digest();
function constantTimeEq(a,b) {
  if(typeof a!=='string' || typeof b!=='string' || a.length>160 || b.length>160) return false;
  return timingSafeEqual(digest(a),digest(b));
}
const isHexSecret = value => typeof value==='string' && /^[a-f0-9]{64}$/i.test(value);
const freshSecret = () => randomBytes(32).toString('hex');
const errorBody = (code) => ({error:code,authority_granted:false});

function parseCert(certPem) {
  const parsed=new X509Certificate(certPem);
  if(!parsed.checkIP(LOOPBACK)) throw new Error('TLS cert must include IP SAN 127.0.0.1');
  if(Date.parse(parsed.validFrom)>Date.now() || Date.parse(parsed.validTo)<=Date.now()) {
    throw new Error('TLS certificate is not currently valid');
  }
  return parsed;
}

export async function startBrowserGateway({
  tlsKey, tlsCert, port=8790, pairCode=freshSecret(), probe=discoverOllama,
  scoutRead=null, now=()=>Date.now(),
} = {}) {
  if(!tlsKey || !tlsCert) throw new Error('Locally trusted TLS certificate and key required');
  if(scoutRead!==null && typeof scoutRead!=='function') throw new Error('Scout must be an optional local read function');
  parseCert(tlsCert);
  if(!isHexSecret(pairCode)) throw new Error('Pairing secret must contain 64 hex characters');
  if(!Number.isInteger(port) || port<0 || port>65535) throw new Error('Invalid gateway port');
  const pairedSecretHash=digest(pairCode);
  let used=false;
  let session=null; // ephemeral and process-local; never persisted to disk
  let expiry=0;
  const failures=[];
  let modelReads=[];
  let probeInProgress=false;
  let scoutReads=[];
  let scoutBusy=false;

  function headers(origin=null,extra={}) {
    return {
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store, private',
      'Pragma':'no-cache',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer',
      'Cross-Origin-Resource-Policy':'cross-origin',
      'Content-Security-Policy':"default-src 'none'",
      'Vary':'Origin',
      ...(origin===PAIRED_ORIGIN ? {
        'Access-Control-Allow-Origin':PAIRED_ORIGIN,
        'Access-Control-Allow-Credentials':'false',
      }:{}),
      ...extra,
    };
  }
  function send(res,status,body,origin=null,extra={}) {
    res.writeHead(status,headers(origin,extra));
    res.end(JSON.stringify(body));
  }
  function allowed(req,res) {
    if(req.headers.origin!==PAIRED_ORIGIN) { send(res,403,errorBody('ORIGIN_DENIED'));return false; }
    const forbidden=['forwarded','x-forwarded-for','x-forwarded-host','proxy-authorization'];
    if(forbidden.some(k=>req.headers[k])) {send(res,403,errorBody('PROXY_DENIED'));return false;}
    const expectedHost=LOOPBACK+':'+server.address().port;
    if(req.headers.host!==expectedHost){send(res,403,errorBody('HOST_DENIED'));return false;}
    const duplicates=req.rawHeaders.filter((x,i)=>i%2===0 && x.toLowerCase()==='authorization');
    if(duplicates.length>1){send(res,403,errorBody('DUPLICATE_AUTH'));return false;}
    const ref=req.headers.referer;
    if(ref && !ref.startsWith(PAIRED_ORIGIN+'/SuperPhiVessel/vessie/')){
      send(res,403,errorBody('REFERRER_DENIED'));return false;
    }
    return true;
  }
  function authenticated(req,res) {
    const auth=req.headers.authorization;
    if(!session||now()>=expiry || !auth?.startsWith('Bearer ') ||
       !constantTimeEq(auth.slice(7),session)){
      send(res,403,errorBody('SESSION_DENIED'),PAIRED_ORIGIN);return false;
    }
    return true;
  }
  const server=createServer({key:tlsKey,cert:tlsCert,minVersion:'TLSv1.2'},async(req,res)=>{
    try {
      if(!allowed(req,res)) return;
      if(req.headers.cookie || req.headers['transfer-encoding']){
        send(res,403,errorBody('REQUEST_DENIED'),PAIRED_ORIGIN);return;
      }
      const route=req.url;
      if(req.method==='OPTIONS') {
        const method=req.headers['access-control-request-method'];
        const asked=(req.headers['access-control-request-headers']||'').toLowerCase()
          .split(',').map(x=>x.trim()).filter(Boolean);
        if(!['POST','GET','DELETE'].includes(method) || asked.some(x=>!['content-type','authorization'].includes(x)) ||
           !['/v1/pair','/v1/status','/v1/models','/v1/session',
             ...(scoutRead?['/v1/scout']:[])].includes(route)) {
          send(res,403,errorBody('PREFLIGHT_DENIED'),PAIRED_ORIGIN);return;
        }
        res.writeHead(204,{
          'Access-Control-Allow-Origin':PAIRED_ORIGIN,
          'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers':'Authorization, Content-Type',
          'Access-Control-Max-Age':'0',
          ...(req.headers['access-control-request-private-network']==='true'?
            {'Access-Control-Allow-Private-Network':'true'}:{}),
          'Vary':'Origin',
          'Cache-Control':'no-store'
        });
        res.end();return;
      }
      if(route==='/v1/pair' && req.method==='POST'){
        if(req.headers.authorization || !String(req.headers['content-type']||'').startsWith('application/json') ||
           (req.headers['content-length'] && Number(req.headers['content-length'])>MAX_REQUEST_BYTES)){
          send(res,403,errorBody('PAIR_DENIED'),PAIRED_ORIGIN);return;
        }
        let length=0, chunks=[];
        for await (const chunk of req) {
          length+=chunk.length;
          if(length>MAX_REQUEST_BYTES){send(res,413,errorBody('PAIR_TOO_LARGE'),PAIRED_ORIGIN);return;}
          chunks.push(chunk);
        }
        let body;
        try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
        catch{send(res,400,errorBody('PAIR_MALFORMED'),PAIRED_ORIGIN);return;}
        const recent=failures.filter(t=>now()-t<60000);
        failures.length=0;failures.push(...recent);
        if(used || failures.length>=BAD_PAIR_LIMIT || !body || typeof body!=='object' ||
          Array.isArray(body) || !isHexSecret(body.code) ||
          !timingSafeEqual(digest(body.code),pairedSecretHash)){
          failures.push(now());
          send(res,403,errorBody('PAIR_DENIED'),PAIRED_ORIGIN);return;
        }
        used=true;
        session=freshSecret();
        expiry=now()+SESSION_MS;
        send(res,200,{
          schema:'superphivessel.gateway.browser-session.v0.1',
          session_token:session,expires_in_seconds:SESSION_MS/1000,
          capabilities:['models.read','gateway.status.read',...(scoutRead?['scout.receipt.read']:[])],
          scope:'LOCAL_MODEL_DISCOVERY_ONLY',
          authority_granted:false,
          can_execute:false,
          can_read_memory:false,
        },PAIRED_ORIGIN);
        return;
      }
      if(route==='/v1/pair'){send(res,405,errorBody('METHOD_DENIED'),PAIRED_ORIGIN);return;}
      if(route==='/v1/session' && req.method==='DELETE'){
        if(!authenticated(req,res))return;
        session=null;expiry=0;
        send(res,200,{session_status:'REVOKED',authority_granted:false},PAIRED_ORIGIN);return;
      }
      if(route==='/v1/status' && req.method==='GET'){
        if(!authenticated(req,res))return;
        send(res,200,{
          schema:'superphivessel.gateway.status.v0.2',
          gateway_status:'HTTPS_PAIR_READ_ONLY',
          connection:'LOCAL_TLS_BROWSER_PAIR',
          browser_origin:PAIRED_ORIGIN,
          session_expires_in_seconds:Math.max(0,Math.floor((expiry-now())/1000)),
          model_probe_mode:'ON_DEMAND',
          cloud_providers_connected:false,
          brainc_connected:false,
          memory_connected:false,
          canonical_runtime_connected:false,
          action_authority:'NONE',
          authority_granted:false,
        },PAIRED_ORIGIN);
        return;
      }
      if(route==='/v1/models' && req.method==='GET'){
        if(!authenticated(req,res))return;
        modelReads=modelReads.filter(t=>now()-t<60000);
        if(modelReads.length>=MAX_MODEL_READS || probeInProgress){
          send(res,429,errorBody('RATE_LIMITED'),PAIRED_ORIGIN);return;
        }
        modelReads.push(now());
        probeInProgress=true;
        try{
          const data=await probe();
          if(!data || data.schema!=='superphivessel.gateway.models.v0.1' ||
             !['AVAILABLE','UNAVAILABLE'].includes(data.probe_status)){
            send(res,503,errorBody('PROBE_INVALID'),PAIRED_ORIGIN);return;
          }
          send(res,data.probe_status==='AVAILABLE'?200:503,data,PAIRED_ORIGIN);
        }finally{probeInProgress=false;}
        return;
      }
      if(route==='/v1/scout' && scoutRead && req.method==='GET'){
        if(!authenticated(req,res))return;
        scoutReads=scoutReads.filter(t=>now()-t<60000);
        if(scoutBusy||scoutReads.length>=6){
          send(res,429,errorBody('SCOUT_RATE_LIMITED'),PAIRED_ORIGIN);return;
        }
        scoutReads.push(now());scoutBusy=true;
        try{
          const data=await scoutRead();
          // Whitelist a complete *unprivileged* self-reported handoff schema.
          // Revalidate even an injected callback: no arbitrary output bytes.
          if(!data || typeof data!=='object' || Array.isArray(data) ||
            Object.keys(data).sort().join('|')!==[
              'schema','evidence_class','mode','qualification_result','source_run_id',
              'source_mission_id','local_model','qualified_at','source_expires_at',
              'review_freshness','receipt_digest_sha256','integrity',
              'public_source_authenticated','identity_authenticated','signer_authenticated',
              'independent_execution_attested','reality_gate_granted',
              'tool_calls_authorized','memory_admitted','agent_spawned',
              'phios_isolation_qualified','vessie_connected','routing_influence',
            ].sort().join('|') ||
            data.schema!=='phibot.scout-vessie-handoff.v0.1' ||
            data.evidence_class!=='LOCAL_SELF_REPORTED_FORMAT_AND_DIGEST_ONLY' ||
            data.mode!=='MANUAL_OPERATOR_COPY_ONLY' ||
            data.qualification_result!=='PASS_LOCAL_SCOUT_SHADOW' ||
            data.source_mission_id!=='phibot.scout.public-repo-health.v1' ||
            data.routing_influence!=='NONE' ||
            data.integrity!=='DOMAIN_SEPARATED_DIGEST_MATCH' ||
            !['CURRENT_WITHIN_SOURCE_WINDOW','HISTORICAL_EXPIRED_OR_NOT_YET_CURRENT'].includes(data.review_freshness) ||
            !/^[1-9][0-9]{0,18}$/.test(data.source_run_id) ||
            !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,79}$/.test(data.local_model) ||
            !/^[a-f0-9]{64}$/.test(data.receipt_digest_sha256) ||
            !['public_source_authenticated','identity_authenticated','signer_authenticated',
              'independent_execution_attested','reality_gate_granted',
              'tool_calls_authorized','memory_admitted','agent_spawned',
              'phios_isolation_qualified','vessie_connected'].every(k=>data[k]===false)){
            send(res,503,errorBody('SCOUT_INVALID'),PAIRED_ORIGIN);return;
          }
          send(res,200,data,PAIRED_ORIGIN);
        }catch{
          send(res,503,errorBody('SCOUT_UNAVAILABLE'),PAIRED_ORIGIN);
        }finally{scoutBusy=false;}
        return;
      }
      if(['/v1/status','/v1/models','/v1/session','/v1/scout'].includes(route)){
        send(res,405,errorBody('METHOD_DENIED'),PAIRED_ORIGIN);return;
      }
      send(res,404,errorBody('NOT_AVAILABLE'),PAIRED_ORIGIN);
    }catch{
      if(!res.headersSent) send(res,503,errorBody('GATEWAY_UNAVAILABLE'),null);
      else res.end();
    }
  });
  server.requestTimeout=4000;
  server.headersTimeout=2500;
  server.maxHeadersCount=32;
  server.maxRequestsPerSocket=24;
  server.listen(port,LOOPBACK);
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  return {server,port:server.address().port,pairCode,origin:PAIRED_ORIGIN};
}

export function loadTlsFiles(keyPath,certPath) {
  if(!keyPath||!certPath)throw new Error('VESSIE_TLS_KEY_FILE and VESSIE_TLS_CERT_FILE are required');
  return {tlsKey:readFileSync(keyPath),tlsCert:readFileSync(certPath)};
}
