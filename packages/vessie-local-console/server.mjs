import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverOllama } from './ollama-probe.mjs';
import {runLocalTrial} from './trial-runner.mjs';
import {exactProtocolMatch} from './ui/trial-protocols.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PORT = 8791;
export const HOST = '127.0.0.1';
const ORIGIN = `http://${HOST}:${PORT}`;
const MAX_API_REQUESTS_PER_MIN = 30;
const STALE_MS = 60_000;
const TRIAL_WINDOW_MS = 60*60*1000;
const MAX_LOCAL_TRIALS_PER_HOUR = 6;
const MAX_TRIAL_INPUT_BYTES = 4096;
const STATIC = new Map([
  ['/app.js', { file: join(HERE, 'ui', 'app.js'), type:'text/javascript; charset=utf-8' }],
  ['/review-evidence.mjs', { file: join(HERE, 'ui', 'review-evidence.mjs'), type:'text/javascript; charset=utf-8' }],
  ['/evidence-bench.mjs', { file: join(HERE, 'ui', 'evidence-bench.mjs'), type:'text/javascript; charset=utf-8' }],
  ['/portable-bench.mjs', { file: join(HERE, 'ui', 'portable-bench.mjs'), type:'text/javascript; charset=utf-8' }],
  ['/trial-protocols.mjs', { file: join(HERE, 'ui', 'trial-protocols.mjs'), type:'text/javascript; charset=utf-8' }],
  ['/protocol-cohorts.mjs', { file: join(HERE, 'ui', 'protocol-cohorts.mjs'), type:'text/javascript; charset=utf-8' }],
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

async function readTrialBody(req) {
  const type=req.headers['content-type'];
  if(typeof type!=='string'||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type))
    throw new Error('INVALID_CONTENT_TYPE');
  const declared=req.headers['content-length'];
  if(declared!==undefined && (!/^\d+$/.test(declared) || Number(declared)>MAX_TRIAL_INPUT_BYTES))
    throw new Error('INVALID_CONTENT_LENGTH');
  const chunks=[];let used=0;
  for await(const chunk of req){
    used+=chunk.length;
    if(used>MAX_TRIAL_INPUT_BYTES) throw new Error('TRIAL_INPUT_TOO_LARGE');
    chunks.push(chunk);
  }
  let data;
  try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw new Error('INVALID_JSON');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('INVALID_JSON');
  const fields=Object.keys(data).sort().join(',');
  if(fields!=='approve_once,max_output_tokens,model,prompt' &&
     fields!=='approve_once,max_output_tokens,model,prompt,protocol_id')
    throw new Error('UNKNOWN_TRIAL_FIELDS');
  if(data.approve_once!==true ||
     typeof data.model!=='string'||data.model.length<1||data.model.length>128||
     /[\u0000-\u001f\u007f]/.test(data.model)||
     typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>2000||
     /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(data.prompt)||
     !Number.isInteger(data.max_output_tokens)||data.max_output_tokens<1||
     data.max_output_tokens>128)throw new Error('INVALID_TRIAL_FIELDS');
  if('protocol_id' in data &&
     !exactProtocolMatch(data.protocol_id,data.prompt,data.max_output_tokens))
    throw new Error('TRIAL_PROTOCOL_MISMATCH');
  return data;
}


export async function createLocalConsole({
  port=PORT,probe=discoverOllama,launchBrowser=null,
  trialEnabled=false,trialRunner=runLocalTrial
}={}) {
  if(typeof trialEnabled!=='boolean')throw new Error('INVALID_TRIAL_MODE');
  if(!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('INVALID_PORT');
  const token = randomBytes(32).toString('hex');
  const page = readFileSync(join(HERE,'ui','index.html'),'utf8');
  if(!page.includes('__LOCAL_SESSION_TOKEN__')) throw new Error('LOCAL_PAGE_CONTRACT_MISSING');
  let readings=[];
  let inFlight=false;
  let trialBusy=false;
  let trialTimes=[];
  const server=createServer(async(req,res)=>{
    try {
      if(req.headers.host!==HOST+':'+server.address().port) return denied(res,'HOST_DENIED');
      if(req.headers['x-forwarded-host'] || req.headers.forwarded ||
         req.headers['x-forwarded-for'] || req.headers.cookie) return denied(res,'PROXY_OR_COOKIE_DENIED');
      if(req.headers.origin && req.headers.origin!==`http://${HOST}:${server.address().port}`)
        return denied(res,'ORIGIN_DENIED');
      if(req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site']))
        return denied(res,'CROSS_SITE_DENIED');
      // The only state-changing API requires a separate operator startup mode
      // AND an affirmative per-prompt decision. It is unavailable by default.
      if(req.url==='/api/local-trial' && req.method==='POST') {
        if(!trialEnabled)return denied(res,'LOCAL_TRIAL_DISABLED');
        if(!constantEq(req.headers.authorization,'Bearer '+token))
          return denied(res,'SESSION_DENIED');
        const now=Date.now();
        trialTimes=trialTimes.filter(t=>now-t<TRIAL_WINDOW_MS);
        if(trialBusy||trialTimes.length>=MAX_LOCAL_TRIALS_PER_HOUR)
          return respond(res,429,{error:'TRIAL_RATE_LIMITED',authority_granted:false});
        let input;
        try { input=await readTrialBody(req); }
        catch { return respond(res,400,{error:'INVALID_TRIAL_REQUEST',authority_granted:false}); }
        trialBusy=true;
        trialTimes.push(now);
        try {
          // Re-check local weights immediately before EACH approved prompt.
          // A stale screen list or cloud alias cannot authorize a model.
          const inventory=await probe();
          if(!inventory || inventory.schema!=='superphivessel.gateway.models.v0.1'||
             inventory.probe_status!=='AVAILABLE'||inventory.authority_granted!==false||
             inventory.can_execute!==false||!Array.isArray(inventory.models)||
             inventory.models.length>256) return denied(res,'TRIAL_INVENTORY_UNAVAILABLE');
          const matching=inventory.models.filter(m=>m.name===input.model);
          if(matching.length!==1 ||
             matching[0].execution_location!=='LOCAL_WEIGHTS_REPORTED'||
             matching[0].classification_basis!=='POSITIVE_SIZE_REPORT')
            return denied(res,'MODEL_NOT_VERIFIED_LOCAL');
          const trial=await trialRunner({
            model:input.model,prompt:input.prompt,
            maxOutputTokens:input.max_output_tokens
          });
          if(!trial||trial.schema!=='superphivessel.local-console.trial.result.v0.1'||
             trial.authority_granted!==false||trial.model_routing_approved!==false||
             trial.can_schedule!==false||typeof trial.response!=='string'||
             trial.response.length>6000||!trial.receipt||
             trial.receipt.schema!=='superphivessel.local-console.trial.receipt.v0.1'||
             trial.receipt.model!==input.model || trial.receipt.authority_granted!==false||
             trial.receipt.private_prompt_included!==false ||
             trial.receipt.generated_text_included!==false)
             return respond(res,503,{error:'TRIAL_CONTRACT_INVALID',authority_granted:false});
          const receipt=trial.receipt;
          const safe=(v)=>Number.isSafeInteger(v)&&v>=0?v:null;
          return respond(res,200,{
            schema:'superphivessel.local-console.trial.result.v0.1',
            response:trial.response,
            receipt:{
              schema:'superphivessel.local-console.trial.receipt.v0.1',
              observation:'LOCAL_OLLAMA_API_RESULT_UNATTESTED',
              timestamp:typeof receipt.timestamp==='string'?receipt.timestamp.slice(0,40):null,
              model:input.model,
              route:'LOCAL_LOOPBACK_FIXED',
              experiment_mode:'OPERATOR_ONE_SHOT',
              max_output_tokens_requested:input.max_output_tokens,
              // The optional identifier is assigned only after verifying
              // the request's exact PUBLIC prompt and output cap. Freeform
              // prompts remain private and get protocol_id:null.
              protocol_id:typeof input.protocol_id==='string'?input.protocol_id:null,
              protocol_evidence:'PUBLIC_FIXED_PROMPT_ONLY_NOT_INDEPENDENT_BENCHMARK',
              elapsed_wall_ms:safe(receipt.elapsed_wall_ms),
              ollama_total_duration_ns:safe(receipt.ollama_total_duration_ns),
              ollama_load_duration_ns:safe(receipt.ollama_load_duration_ns),
              ollama_prompt_tokens:safe(receipt.ollama_prompt_tokens),
              ollama_prompt_eval_duration_ns:safe(receipt.ollama_prompt_eval_duration_ns),
              ollama_generated_tokens:safe(receipt.ollama_generated_tokens),
              ollama_eval_duration_ns:safe(receipt.ollama_eval_duration_ns),
              output_token_cap_reached:receipt.output_token_cap_reached===true,
              ollama_done_reason:['stop','length'].includes(receipt.ollama_done_reason)
                ? receipt.ollama_done_reason : 'UNREPORTED_OR_UNKNOWN',
              generated_text_sha256:typeof receipt.generated_text_sha256==='string'&&
                /^[a-f0-9]{64}$/.test(receipt.generated_text_sha256)
                  ?receipt.generated_text_sha256:null,
              private_prompt_included:false,generated_text_included:false,
              model_routing_approved:false,cloud_execution_approved:false,authority_granted:false
            },
            authority_granted:false,can_schedule:false,model_routing_approved:false
          });
        } catch {
          return respond(res,503,{error:'LOCAL_TRIAL_FAILED',authority_granted:false});
        } finally{trialBusy=false;}
      }
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
          mode:trialEnabled?'OPERATOR_LOCAL_TRIAL_OPT_IN':'LOCAL_READ_ONLY',
          local_trial_enabled:trialEnabled,
          per_prompt_operator_confirmation_required:true,
          trial_max_output_tokens:128,
          trial_max_requests_per_hour:MAX_LOCAL_TRIALS_PER_HOUR,
          model_inventory:'ON_DEMAND',
          cloud_connected:false,brainc_connected:false,
          model_execution_enabled:trialEnabled,model_routing_approved:false,
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
            // Only known classification enums are allowed to cross the API
            // boundary. Missing/foreign values become UNKNOWN, never "local".
            execution_location:['LOCAL_WEIGHTS_REPORTED','CLOUD_REFERENCE'].includes(x.execution_location)
              ? x.execution_location : 'UNKNOWN',
            classification_basis:['REMOTE_METADATA','CLOUD_TAG_HINT','POSITIVE_SIZE_REPORT'].includes(x.classification_basis)
              ? x.classification_basis : 'INSUFFICIENT_METADATA',
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
            classification_counts:{
              local_weights_reported:models.filter(x=>x.execution_location==='LOCAL_WEIGHTS_REPORTED').length,
              cloud_references:models.filter(x=>x.execution_location==='CLOUD_REFERENCE').length,
              unknown:models.filter(x=>x.execution_location==='UNKNOWN').length
            },
            classification_is_advisory:true,
            cloud_execution_approved:false,
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
  server.requestTimeout=5000;
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
    const allowedArgs=process.argv.slice(2);
    if(allowedArgs.some(arg=>arg!=='--enable-local-trial'))
      throw new Error('UNRECOGNIZED_STARTUP_ARGUMENT');
    const enableTrial=allowedArgs.length===1&&allowedArgs[0]==='--enable-local-trial';
    const {port}=await createLocalConsole({
      trialEnabled:enableTrial,
      launchBrowser:url=>{
        if(process.platform==='win32') execFile('cmd.exe',['/c','start','',url],{windowsHide:true},()=>{});
      }
    });
    console.log('SUPERPHIVESSEL LOCAL CONSOLE · '+(enableTrial?'EXPLICIT LOCAL TRIAL MODE':'READ ONLY'));
    console.log(`Open http://${HOST}:${port}/ if your browser did not open.`);
    console.log('The server binds 127.0.0.1 only. Press Ctrl+C to stop.');
    if(enableTrial) console.log('Local inference is enabled ONLY for human-confirmed, size-reported local models (max 128 output tokens; 6 trials/hour).');
    else console.log('No inference is available in the default read-only mode.');
    console.log('No paid provider, private memory, auto routing, or learned routing authority.');
  }catch{
    console.error('LOCAL_CONSOLE_START_BLOCKED: port busy or local files unavailable.');
    process.exitCode=2;
  }
}
