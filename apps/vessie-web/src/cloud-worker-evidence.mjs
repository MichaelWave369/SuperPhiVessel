/**
 * SPV-CW01: explicitly requested public observation acquisition.
 * Four fixed GitHub GETs. Read-only, in-memory, no tokens or authority.
 * A matching GitHub run is CORRELATION, not a signed measurement attestation.
 */
export const CLOUD_REPO = 'MichaelWave369/FieldCloudWorker';
export const CLOUD_API = 'https://api.github.com/repos/' + CLOUD_REPO;
export const CLOUD_SITE = 'https://michaelwave369.github.io/FieldCloudWorker/';
export const CLOUD_WORKFLOW = '.github/workflows/worker.yml';
const TASKS = ['github_repo_metrics', 'heartbeat', 'repo_layout'];
const TASK_SET = new Set(TASKS);
const EXACT_RESULTS = ['task','kind','status','duration_s'];
const AGE = 8 * 60 * 60 * 1000;

function refuse(ok, why) { if (!ok) throw new Error('CLOUD_EVIDENCE_' + why); }
function obj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function keys(v, fields) {
  return obj(v) && Object.keys(v).sort().join('|') === [...fields].sort().join('|');
}
function timestamp(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return NaN;
  return Date.parse(value);
}
function boundedInt(v) { return Number.isSafeInteger(v) && v >= 0 && v < 1000000000; }
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

async function publicJSON(url, get) {
  const response = await get(url, {
    method: 'GET', redirect: 'error', cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' }
  });
  refuse(response && response.ok === true, 'UPSTREAM_UNAVAILABLE');
  // The caller cannot pick URLs; request targets are frozen in this module.
  const raw = await response.text();
  refuse(encoder.encode(raw).length <= 100000 && raw.length > 0, 'UPSTREAM_TOO_LARGE');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('CLOUD_EVIDENCE_INVALID_API_JSON'); }
  refuse(obj(value), 'INVALID_API_SHAPE');
  return value;
}

async function blobSha(data) {
  const bytes = encoder.encode(data);
  const prefix = encoder.encode('blob ' + bytes.length + '\0');
  const buffer = new Uint8Array(prefix.length + bytes.length);
  buffer.set(prefix); buffer.set(bytes, prefix.length);
  refuse(!!globalThis.crypto?.subtle, 'CRYPTO_UNAVAILABLE');
  const digest = await globalThis.crypto.subtle.digest('SHA-1', buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
}

async function fileAt(path, sha, maxBytes, get) {
  const packet = await publicJSON(CLOUD_API + '/contents/' + path + '?ref=' + sha, get);
  refuse(packet.type === 'file' && packet.path === path &&
    packet.name === path.split('/').at(-1) && packet.encoding === 'base64', 'FILE_IDENTITY');
  refuse(typeof packet.content === 'string' &&
    packet.content.length > 0 && packet.content.length <= maxBytes * 2 + 100, 'ENCODED_LIMIT');
  let bytes;
  try {
    const clean = packet.content.replace(/\s/g, '');
    refuse(/^[A-Za-z0-9+/]*={0,2}$/.test(clean) && clean.length % 4 === 0, 'BASE64_FORMAT');
    const binary = atob(clean);
    bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    refuse(btoa(binary) === clean, 'BASE64_CANONICAL');
  } catch { throw new Error('CLOUD_EVIDENCE_BASE64_REJECTED'); }
  refuse(boundedInt(packet.size) && bytes.length === packet.size &&
    bytes.length > 0 && bytes.length <= maxBytes, 'FILE_SIZE');
  let data;
  try { data = decoder.decode(bytes); } catch { throw new Error('CLOUD_EVIDENCE_UTF8_REJECTED'); }
  refuse(typeof packet.sha === 'string' && /^[0-9a-f]{40}$/.test(packet.sha) &&
    await blobSha(data) === packet.sha, 'GIT_BLOB_MISMATCH');
  return data;
}

function parseStatus(data, now) {
  refuse(keys(data, ['schema','receipt_kind','run_at','run_id','trigger','sha','run_url','overall','results']), 'RECEIPT_FIELDS');
  refuse(data.schema === 'fielddeck.cloud-observation.v1' &&
    data.receipt_kind === 'observation_not_authorization', 'RECEIPT_SCHEMA');
  refuse(typeof data.run_id === 'string' && /^[1-9]\d{0,18}$/.test(data.run_id) &&
    Number.isSafeInteger(Number(data.run_id)), 'RUN_ID');
  refuse(typeof data.sha === 'string' && /^[0-9a-f]{7}$/.test(data.sha), 'COMMIT_PREFIX');
  refuse(['push','schedule','workflow_dispatch'].includes(data.trigger), 'EVENT');
  refuse(data.run_url === 'https://github.com/' + CLOUD_REPO + '/actions/runs/' + data.run_id, 'RUN_URL');
  refuse(['ok','error'].includes(data.overall), 'OUTCOME');
  const at = timestamp(data.run_at);
  refuse(Number.isFinite(at) && at <= now + 300000, 'OBSERVATION_TIME');
  refuse(Array.isArray(data.results) && data.results.length === 3, 'TASK_COUNT');
  const seen = new Set();
  const tasks = [];
  for (const result of data.results) {
    refuse(obj(result) && TASK_SET.has(result.task) && !seen.has(result.task), 'UNKNOWN_TASK');
    seen.add(result.task);
    refuse(result.kind === 'observation' && ['ok','error'].includes(result.status), 'TASK_KIND');
    refuse(typeof result.duration_s === 'number' && Number.isFinite(result.duration_s)
      && result.duration_s >= 0 && result.duration_s <= 600, 'DURATION');
    if (result.status === 'ok') {
      refuse(keys(result, [...EXACT_RESULTS,'output']), 'OUTPUT_FIELDS');
      const o = result.output;
      if (result.task === 'heartbeat') refuse(keys(o,['signal']) && o.signal === 'alive','HEARTBEAT');
      if (result.task === 'repo_layout') refuse(keys(o,['required_files','present_files']) &&
        o.required_files === 3 && o.present_files === 3, 'LAYOUT');
      if (result.task === 'github_repo_metrics') refuse(
        keys(o,['repository','stars','open_issues_and_prs']) && o.repository === CLOUD_REPO &&
        boundedInt(o.stars) && boundedInt(o.open_issues_and_prs), 'METRICS');
    } else {
      refuse(keys(result,[...EXACT_RESULTS,'error_code']) &&
        typeof result.error_code === 'string' &&
        /^[A-Za-z][A-Za-z0-9_]{0,50}$/.test(result.error_code), 'ERROR_FIELDS');
    }
    // Strip ALL original payload and text before projecting into Vessie's UI.
    tasks.push(Object.freeze({ task: result.task, status: result.status }));
  }
  const errors = tasks.filter(x=>x.status==='error').length;
  refuse(data.overall === (errors ? 'error' : 'ok'), 'OUTCOME_INCONSISTENT');
  return {at, errors, tasks: tasks.sort((a,b)=>a.task.localeCompare(b.task))};
}

function parseHistory(raw, status, parsed) {
  refuse(typeof raw === 'string' && encoder.encode(raw).length <= 32768, 'HISTORY_LIMIT');
  const lines = raw.trim().split('\n');
  refuse(lines.length >= 1 && lines.length <= 30, 'HISTORY_COUNT');
  const seen = new Set(); let prior=-Infinity;
  let last;
  for (const line of lines) {
    let item;
    try { item = JSON.parse(line); } catch { throw new Error('CLOUD_EVIDENCE_HISTORY_JSON'); }
    refuse(keys(item,['schema','run_id','run_at','overall','ok_count','error_count']), 'HISTORY_FIELDS');
    refuse(item.schema==='fielddeck.cloud-history.v1' &&
      typeof item.run_id==='string' && /^[1-9]\d{0,18}$/.test(item.run_id) &&
      !seen.has(item.run_id), 'HISTORY_ID');
    seen.add(item.run_id);
    const current = timestamp(item.run_at);
    refuse(Number.isFinite(current) && current >= prior, 'HISTORY_ORDER');
    prior=current;
    refuse(boundedInt(item.ok_count) && boundedInt(item.error_count) &&
      item.ok_count + item.error_count === 3 &&
      item.overall === (item.error_count ? 'error' : 'ok'), 'HISTORY_COUNTS');
    last=item;
  }
  refuse(last.run_id===status.run_id && last.run_at===status.run_at &&
    last.overall===status.overall && last.error_count===parsed.errors, 'HISTORY_LATEST');
  return lines.length;
}

function verifyRun(data, parsed, run) {
  refuse(obj(run) && obj(run.repository) && run.repository.full_name===CLOUD_REPO &&
    run.id===Number(data.run_id) && run.name==='FieldCloudWorker Observation Pilot' &&
    run.path===CLOUD_WORKFLOW && run.head_branch==='main' && run.event===data.trigger, 'RUN_PROVENANCE');
  refuse(typeof run.head_sha==='string' && /^[0-9a-f]{40}$/.test(run.head_sha) &&
    run.head_sha.startsWith(data.sha), 'RUN_SHA');
  refuse(run.status==='completed' && run.conclusion===(data.overall==='ok'?'success':'failure') &&
    run.html_url===data.run_url, 'RUN_CONCLUSION');
  const start=timestamp(run.created_at), end=timestamp(run.updated_at);
  refuse(Number.isFinite(start) && Number.isFinite(end) && start<=end &&
    parsed.at >= start - 300000 && parsed.at <= end + 300000, 'RUN_TIMING');
}

export async function loadCloudObservation(get=fetch, now=Date.now()) {
  // Fetch ONLY after an operator clicks "Inspect Cloud Worker" in the cockpit.
  const branch = await publicJSON(CLOUD_API + '/branches/main', get);
  refuse(branch.name==='main' && obj(branch.commit) &&
    typeof branch.commit.sha==='string' &&
    /^[0-9a-f]{40}$/.test(branch.commit.sha), 'BRANCH_SHA');
  const commit=branch.commit.sha;
  const rawStatus = await fileAt('docs/status.json',commit,16384,get);
  const rawHistory = await fileAt('docs/history.jsonl',commit,32768,get);
  let status;
  try {status=JSON.parse(rawStatus)}catch {throw new Error('CLOUD_EVIDENCE_STATUS_JSON');}
  const parsed = parseStatus(status,now);
  const historyCount = parseHistory(rawHistory,status,parsed);
  const run = await publicJSON(CLOUD_API+'/actions/runs/'+status.run_id,get);
  verifyRun(status,parsed,run);
  const stale = now - parsed.at > AGE;
  return Object.freeze({
    schema: 'superphivessel.cloud_observation.v0.1',
    disposition: stale?'STALE_OBSERVATION':parsed.errors?'TASK_FAILURE_OBSERVED':'UNVERIFIED_PUBLIC_OBSERVATION',
    source_repository: CLOUD_REPO,
    branch_snapshot: commit.slice(0,12),
    run_id: status.run_id,
    run_url: status.run_url,
    observed_at: status.run_at,
    tasks: parsed.tasks,
    history_count: historyCount,
    github_run_metadata_correlated: true,
    independent_prior_pin_verified: false,
    content_authenticity_verified: false,
    authority_granted: false,
    action_executed: false,
    memory_admitted: false,
    routing_influence: 'NONE',
    network_mutation: false,
  });
}

export function makeBrainCShadowCandidate(observation) {
  refuse(obj(observation) &&
    observation.schema === 'superphivessel.cloud_observation.v0.1' &&
    observation.authority_granted === false &&
    observation.memory_admitted === false &&
    observation.routing_influence === 'NONE' &&
    ['STALE_OBSERVATION','TASK_FAILURE_OBSERVED','UNVERIFIED_PUBLIC_OBSERVATION'].includes(observation.disposition) &&
    typeof observation.run_id === 'string' && /^[1-9]\d{0,18}$/.test(observation.run_id) &&
    Array.isArray(observation.tasks) && observation.tasks.length===3 &&
    observation.tasks.every(t=>obj(t) && TASK_SET.has(t.task) && (t.status==='ok'||t.status==='error')) &&
    new Set(observation.tasks.map(t=>t.task)).size===3, 'BRAINC_INPUT');
  return {
    schema: 'superphivessel.brainc.cloud-observation-shadow.v0.1',
    integration_status: 'UNWIRED_REVIEW_CANDIDATE',
    source_kind: 'UNVERIFIED_PUBLIC_OBSERVATION',
    source_run_id: observation.run_id,
    observed_at: observation.observed_at,
    disposition: observation.disposition,
    task_statuses: observation.tasks.map(t=>({task:t.task,status:t.status})),
    prompt_admitted: false,
    memory_admitted: false,
    routing_influence: 'NONE',
    authority_granted: false,
    action_executed: false,
  };
}
