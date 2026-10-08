const session = document.querySelector('meta[name="vessie-readonly-token"]')?.content ?? '';
const button = document.getElementById('scan');
const status = document.getElementById('status');
const count = document.getElementById('count');
const breakdown = document.getElementById('breakdown');
const empty = document.getElementById('empty');
const modelsRoot = document.getElementById('models');

function bytes(size) {
  return Number.isSafeInteger(size) && size >= 0
    ? (size / (1024*1024*1024)).toFixed(2)+' GiB'
    : 'Size unreported';
}
function render(items) {
  modelsRoot.replaceChildren();
  for(const item of items) {
    const card = document.createElement('article');
    card.className = 'model';
    const body = document.createElement('div');
    const title = document.createElement('div');
    title.className='name';
    title.textContent=item.name;
    const detail = document.createElement('div');
    detail.className='detail';
    const location = item.execution_location;
    const cloud = location === 'CLOUD_REFERENCE';
    const local = location === 'LOCAL_WEIGHTS_REPORTED';
    const sizeLabel = cloud ? 'Cloud reference (not locally stored weights)'
      : local ? bytes(item.size_bytes) + ' size reported locally'
      : 'Weight location unverified';
    detail.textContent=`${item.parameter_size} · ${item.quantization} · ${sizeLabel}` +
      (item.loaded ? ` · Active in Ollama report; VRAM: ${bytes(item.runtime_vram_bytes)}` : '');
    body.append(title,detail);
    const badge = document.createElement('span');
    badge.className='state'+(cloud?' cloud':item.loaded?' live':'');
    badge.textContent=cloud?'CLOUD REF':local?(item.loaded?'LOCAL ACTIVE':'LOCAL FILE'):'UNKNOWN';
    card.append(body,badge);
    modelsRoot.append(card);
  }
  modelsRoot.hidden=items.length===0;
  empty.hidden=items.length>0;
  empty.textContent=items.length===0?'No Ollama models were reported locally. No models were installed or started.':'';
  const localCount=items.filter(x=>x.execution_location==='LOCAL_WEIGHTS_REPORTED').length;
  const cloudCount=items.filter(x=>x.execution_location==='CLOUD_REFERENCE').length;
  const unknownCount=items.length-localCount-cloudCount;
  count.textContent=items.length+' discovered, none authorized';
  breakdown.textContent=`${localCount} local weight-size reports · ${cloudCount} cloud references · ${unknownCount} unknown. Names/sizes are metadata, not proof of execution or local GPU fit. No cloud calls initiated.`;
}
async function scan() {
  button.disabled=true;
  status.textContent='Checking local Ollama (read only)…';
  try {
    const response=await fetch('/api/models',{
      method:'GET',mode:'same-origin',cache:'no-store',
      redirect:'error',credentials:'omit',
      headers:{Authorization:'Bearer '+session},
      signal:AbortSignal.timeout(6500)
    });
    if(!response.ok) throw new Error('REFUSED_OR_UNAVAILABLE');
    const data=await response.json();
    if(data.schema!=='superphivessel.local-console.models.v0.1' ||
       data.authority_granted!==false ||data.can_execute!==false ||
       !Array.isArray(data.models)||data.models.length>256)throw new Error('INVALID_READONLY_CONTRACT');
    const models=data.models.filter(item=>item && typeof item.name==='string' && item.name.length<=128);
    render(models);
    status.textContent=data.probe_status==='AVAILABLE'
      ? `Local Ollama responded. ${models.length} models discovered, no routing approval granted.`
      : 'Ollama not available on 127.0.0.1:11434. The local dashboard remains usable.';
  } catch {
    status.textContent='The local read-only check failed or was refused. Check whether Ollama is running. No change was made.';
    modelsRoot.replaceChildren();modelsRoot.hidden=true;empty.hidden=false;
    empty.textContent='No verified local model inventory available.';
    count.textContent='Not available';
    breakdown.textContent='Classification unavailable. No local or cloud execution attempted.';
  } finally {button.disabled=false;}
}
button.addEventListener('click',scan);
