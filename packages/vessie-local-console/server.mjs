import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverOllama } from './ollama-probe.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PORT = 8791;
export const HOST = '127.0.0.1';
const ORIGIN = `http://${HOST}:${PORT}`;
const MAX_API_REQUESTS_PER_MIN = 30;
const STALE_MS = 60_000;
const STATIC = new Map([
  ['/app.js', { file: join(HERE, 'ui', 'app.js'), type:'text/javascript; charset=utf-8' }],
  ['/style.css', { file: join(HERE, 'ui', 'style.css'), type:'text/css; charset=utf-8' }]
]);

const digest = input => createHash('sha256').update(input).digest();
function constantEq(a,b) {
  return typeof a === 'string' && typeof b === 'string' &&
    a.length <= 256 && b.length <= 256 &&
    timingSafeEqual(digest(a),digest(b));
}
function headers(type = 'application/json; charset=utf-8') {
  return {
    'Content-Type':type,
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Cross-Origin-Resource-Policy':'same-origin',
    'Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
  };
}
function respond(res, code, data, type) {
  res.writeHead(code, headers(type));
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}
const denied = (res,code='REFUSED') => respond(res,403,{error:code,authority_granted:false});

export async function createLocalConsole({port=PORT,probe=discoverOllama,launchBrowser=null}={}) {
  if(!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('INVALID_PORT');
  const token = randomBytes(32).toString('hex');
  const page = readFileSync(join(HERE,'ui','index.html'),'utf8');
  if(!page.includes('__LOCAL_SESSION_TOKEN__')) throw new Error('LOCAL_PAGE_CONTRACT_MISSING');
  let readings=[];
  let inFlight=false;
  const server=createServer(async(req,res)=>{
    try {
      if(req.headers.host!==HOST+':'+server.address().port) return denied(res,'HOST_DENIED');
      if(req.headers['x-forwarded-host'] || req.headers.forwarded ||
         req.headers['x-forwarded-for'] || req.headers.cookie) return denied(res,'PROXY_OR_COOKIE_DENIED');
      if(req.headers.origin && req.headers.origin!==`http://${HOST}:${server.address().port}`)
        return denied(res,'ORIGIN_DENIED');
      if(req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site']))
        return denied(res,'CROSS_SITE_DENIED');
      if(req.method!=='GET' || typeof req.url!=='string' || req.url.includes('?'))
        return respond(res,405,{error:'METHOD_OR_PATH_DENIED',authority_granted:false});
      if(req.url==='/' || req.url==='/index.html') {
        const document=page.replace('__LOCAL_SESSION_TOKEN__',token);
        return respond(res,200,document,'text/html; charset=utf-8');
      }
      if(STATIC.has(req.url)){
        const item=STATIC.get(req.url);
        return respond(res,200,readFileSync(item.file,'utf8'),item.type);
      }
      if(req.url==='/api/status'||req.url==='/api/models') {
        const auth=req.headers.authorization;
        if(!constantEq(auth,'Bearer '+token)) return denied(res,'SESSION_DENIED');
        const now=Date.now();
        readings=readings.filter(time=>now-time<STALE_MS);
        if(readings.length>=MAX_API_REQUESTS_PER_MIN || inFlight)
          return respond(res,429,{error:'RATE_LIMITED',authority_granted:false});
        readings.push(now);
        if(req.url==='/api/status') return respond(res,200,{
          schema:'superphivessel.local-console.status.v0.1',
          mode:'LOCAL_READ_ONLY',model_inventory:'ON_DEMAND',
          cloud_connected:false,brainc_connected:false,
          model_execution_enabled:false,model_routing_approved:false,
          field_qualified:false,authority_granted:false
        });
        inFlight=true;
        try {
          const local = await probe();
          if(!local || local.schema!=='superphivessel.gateway.models.v0.1' ||
            !['AVAILABLE','UNAVAILABLE'].includes(local.probe_status) ||
            !Array.isArray(local.models) || local.models.length>256 ||
            local.authority_granted!==false || local.can_execute!==false) {
            return respond(res,503,{error:'INVALID_PROBE_CONTRACT',authority_granted:false});
          }
          // Explicit projection instead of blindly relaying future upstream fields.
          const models = local.models.map(x=>({
            name:typeof x.name==='string'?x.name.slice(0,128):'',
            loaded:x.loaded===true,
            quantization:typeof x.quantization==='string'?x.quantization.slice(0,48):'Unreported',
            parameter_size:typeof x.parameter_size==='string'?x.parameter_size.slice(0,48):'Unreported',
            size_bytes:Number.isSafeInteger(x.size_bytes)&&x.size_bytes>=0?x.size_bytes:null,
            runtime_vram_bytes:Number.isSafeInteger(x.runtime_vram_bytes)&&x.runtime_vram_bytes>=0?x.runtime_vram_bytes:null,
            execution_authorized:false,routing_approved:false
          })).filter(x=>x.name);
          return respond(res,200,{
            schema:'superphivessel.local-console.models.v0.1',
            probe_status:local.probe_status,model_count:models.length,models,
            no_cloud_upload:true,authority_granted:false,can_execute:false
          });
        } finally {inFlight=false;}
      }
      return respond(res,404,{error:'NOT_AVAILABLE',authority_granted:false});
    } catch {
      if(!res.headersSent) respond(res,503,{error:'LOCAL_CONSOLE_UNAVAILABLE',authority_granted:false});
      else res.end();
    }
  });
  server.requestTimeout=4000;
  server.headersTimeout=3000;
  server.maxHeadersCount=32;
  server.listen(port,HOST);
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  if(launchBrowser) {
    try {launchBrowser(`http://${HOST}:${server.address().port}/`);} catch {/* browser manual fallback */}
  }
  return {server,port:server.address().port};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const {execFile} = await import('node:child_process');
    const {port}=await createLocalConsole({
      launchBrowser:url=>{
        if(process.platform==='win32') execFile('cmd.exe',['/c','start','',url],{windowsHide:true},()=>{});
      }
    });
    console.log('SUPERPHIVESSEL LOCAL CONSOLE · READ ONLY');
    console.log(`Open http://${HOST}:${port}/ if your browser did not open.`);
    console.log('The server binds 127.0.0.1 only. Press Ctrl+C to stop.');
    console.log('No model execution, paid provider, private memory, or learned routing authority.');
  }catch{
    console.error('LOCAL_CONSOLE_START_BLOCKED: port busy or local files unavailable.');
    process.exitCode=2;
  }
}
