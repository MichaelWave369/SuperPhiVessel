import { useMemo, useState } from 'react';
import roster from '../../../protocols/dlam-v0.1/genius-roster.json';
import runtimeManifest from '../../../runtime/MANIFEST.json';
import catalog from '../../../protocols/routing-v2/model-candidates.json';
import { inspectReceipt } from './inspector.mjs';
import PairingPanel from './PairingPanel';
import CloudEvidencePanel from './CloudEvidencePanel';
import ScoutHandoffPanel from './ScoutHandoffPanel';

type View = 'overview' | 'atlas' | 'routing' | 'models' | 'evidence' | 'cloud' | 'scout';
type Inspection = ReturnType<typeof inspectReceipt>;
const PAGES = [
  ['overview','OVERVIEW','01'],
  ['atlas','GA108 ATLAS','02'],
  ['routing','ROUTING','03'],
  ['models','MODEL FABRIC','04'],
  ['evidence','RECEIPT INSPECTOR','05'],
  ['cloud','CLOUD EVIDENCE','06'],
  ['scout','SCOUT HANDOFF','07'],
] as const;
const MODELS = [
  ...catalog.local_candidates.map((x)=>({
    model:x.id,role:x.role,tier:'LOCAL',fit:x.benchmark,state:x.status
  })),
  ...catalog.remote_candidates.map((x)=>({
    model:x.id,role:x.use,tier:x.tier,fit:x.data_policy.replaceAll('_',' '),state:x.status
  })),
];
const LANES = [
 {name:'AUTHORITY + CONTEXT',detail:'Operator grant → policy and purpose admission → bounded context',tag:'GATE'},
 {name:'CRANE FLY / BRAINC',detail:'Exact model discovery, fitness, local-first hard eligibility',tag:'LIVE/CONDITIONAL'},
 {name:'SPARSE FRONTIER',detail:'Uncertainty, contradiction, consequence → bounded investigation',tag:'EXTRACTED'},
 {name:'GA108 + PV-DLAM',detail:'108 persistent dormant identities, provenance, snapshot continuity',tag:'EXTRACTED'},
 {name:'P4 LEARNER',detail:'24-feature shadow-only candidate; no authority to dispatch',tag:'SHADOW'},
 {name:'BUDGETGENIUS',detail:'One-decision, zero-paid-spend canary with downstream executor gate',tag:'BOUNDED'},
 {name:'REALITY GATE + LEDGER',detail:'Verification, execution decision, receipts, source custody',tag:'GOVERNED'},
] as const;

function App() {
  const [view,setView]=useState<View>('overview');
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('ALL');
  const [selectedId,setSelectedId]=useState('ga108:001');
  const [receiptText,setReceiptText]=useState('');
  const [inspection,setInspection]=useState<Inspection|null>(null);
  const [inspectionError,setInspectionError]=useState('');
  const categories=roster.category_order;
  const geniuses=useMemo(()=>roster.entries.filter((entry)=>{
    const q=search.trim().toLowerCase();
    const matches=!q || [entry.label,entry.profileId,entry.category,entry.routingEmphasis,
      entry.lineage,entry.nodeType].some((v)=>v.toLowerCase().includes(q));
    return matches && (category==='ALL'|| entry.category===category);
  }),[search,category]);
  const selected=roster.entries.find((g)=>g.profileId===selectedId) ?? roster.entries[0];
  const inspect=()=>{
    try {
      setInspection(inspectReceipt(receiptText));
      setInspectionError('');
    } catch(e) {
      setInspection(null);
      setInspectionError(e instanceof Error ? e.message : 'Inspection failed');
    }
  };
  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />
      <header className="masthead">
        <a className="wordmark" href="/SuperPhiVessel/" aria-label="Super Phi Vessel project home">
          <span className="phi">Φ</span>
          <span><strong>SUPER Φ.VESSEL</strong><small>VESSIE / MODULAR COCKPIT</small></span>
        </a>
        <div className="headright">
          <span className="statusDot" aria-hidden="true"/>
          <span>COCKPIT PREVIEW · OPTIONAL LOCAL READ-ONLY PAIRING</span>
          <a href="https://superphivessel.netlify.app/" target="_blank" rel="noopener noreferrer">LAUNCH CLASSIC ↗</a>
        </div>
      </header>
      <div className="shell">
        <aside className="sidebar" aria-label="Cockpit navigation">
          <p className="railLabel">VESSEL SURFACES</p>
          <nav>{PAGES.map(([id,label,num])=><button key={id}
            className={view===id?'navItem active':'navItem'}
            onClick={()=>setView(id as View)}
            aria-current={view===id?'page':undefined}>
            <span className="navNum">{num}</span><span>{label}</span><span className="navArrow">↗</span>
          </button>)}</nav>
          <div className="railFoot">
            <p>CANONICAL SOURCE</p>
            <strong>{runtimeManifest.runtime.version}</strong>
            <small>Legacy production baseline, preserved byte-for-byte.</small>
            <div className="rule"/>
            <strong>CAPABILITY ≠ AUTHORITY</strong>
            <small>The UI cannot grant permissions or execute tools. Optional discovery is read-only.</small>
          </div>
        </aside>
        <main className="main">
          {view==='overview'&&<section>
            <div className="eyebrow">PV / OPERATIONS / EXPERIMENTAL WEB SURFACE</div>
            <h1>Vessie, without<br/><em>the monolith.</em></h1>
            <p className="lede">A new React cockpit above the existing governed cognition. The 108 Geniuses persist as identities. Models are replaceable compute. Memory and authority belong to their own systems.</p>
            <div className="metricGrid">
              <div className="metric"><b>{roster.entries.length}</b><span>Genius identities</span></div>
              <div className="metric"><b>{categories.length}</b><span>Specialist categories</span></div>
              <div className="metric"><b>0</b><span>Models started by this UI</span></div>
              <div className="metric"><b>0</b><span>Authority grants</span></div>
            </div>
            <div className="sectionHead"><h2>System surfaces</h2><span>STATUS IS EVIDENCE-BOUNDED</span></div>
            <div className="flowGrid">{LANES.map((lane,i)=><div className="lane" key={lane.name}>
              <div className="laneTop"><span>0{i+1} / {lane.name}</span><span className="laneTag">{lane.tag}</span></div>
              <p>{lane.detail}</p>
            </div>)}</div>
            <div className="notice"><strong>Migration rule</strong><p>The static React cockpit does not replace, embed, or secretly execute the canonical HTML runtime. The actual connected chat requires an authenticated governed gateway, explicit runtime adapter qualification, and operator review.</p></div>
          </section>}
          {view==='atlas'&&<section>
            <div className="eyebrow">PERSISTENT IDENTITIES / GA108</div>
            <h1>Genius <em>Atlas.</em></h1>
            <p className="lede">All 108 profiles come directly from the repository's canonical GA108 JSON. One Genius is not one constantly loaded model.</p>
            <div className="filterbar">
              <label><span>SEARCH</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Identity, domain, lineage..." /></label>
              <label><span>CATEGORY</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="ALL">All 18 categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
              <span className="resultCount">{geniuses.length} / 108</span>
            </div>
            <div className="atlasLayout">
              <div className="roster" role="list">{geniuses.map(g=><button key={g.profileId} role="listitem"
                className={selectedId===g.profileId?'genius active':'genius'}
                onClick={()=>setSelectedId(g.profileId)}>
                <span className="geniusNum">{g.gaId}</span>
                <span><strong>{g.label}</strong><small>{g.category}</small></span>
                <span className="geniusArrow">→</span>
              </button>)}</div>
              <div className="profile">
                <p className="eyebrow">SELECTED PERSISTENT PROFILE</p>
                <h2>{selected.label}</h2>
                <p className="profileCategory">{selected.category} · {selected.nodeType}</p>
                <dl>
                  <dt>Stable identity</dt><dd>{selected.profileId}</dd>
                  <dt>Memory namespace</dt><dd>{selected.memoryNamespace}</dd>
                  <dt>Lineage</dt><dd>{selected.lineage}</dd>
                  <dt>Routing emphasis</dt><dd>{selected.routingEmphasis}</dd>
                  <dt>Model binding</dt><dd>None. Assigned dynamically.</dd>
                  <dt>Action authority</dt><dd>NONE</dd>
                </dl>
                <p className="profileNote">Identity may persist across a model swap. This cockpit neither wakes nor impersonates this specialist.</p>
              </div>
            </div>
          </section>}
          {view==='routing'&&<section>
            <div className="eyebrow">BRAIN C / CRANE FLY / SFR / P4</div>
            <h1>Routing <em>Fabric.</em></h1>
            <p className="lede">A single governed decision pipeline, not four independent routers competing to select a model. Current production routing remains the canonical runtime; newer extracted components are qualified separately.</p>
            <div className="routingStack">{LANES.map((lane,i)=><div className="routingRow" key={lane.name}>
              <div className="routingIndex">{String(i+1).padStart(2,'0')}</div>
              <div><strong>{lane.name}</strong><p>{lane.detail}</p></div>
              <span className="routingStatus">{lane.tag}</span>
            </div>)}</div>
            <div className="notice"><strong>Shadow does not equal live</strong><p>P4's learned weights cannot override P1-C eligibility or BudgetGenius's approved one-shot scope. SFR escalation does not authorize an expensive API call. All consequential action stays behind the existing executor boundary.</p></div>
            <div className="textLinks"><a href="https://github.com/MichaelWave369/SuperPhiVessel/blob/main/docs/ARCHITECTURE.md">Architecture source ↗</a><a href="https://github.com/MichaelWave369/SuperPhiVessel/blob/main/docs/ROADMAP.md">Qualification roadmap ↗</a></div>
          </section>}
          {view==='models'&&<section>
            <div className="eyebrow">LOCAL FIRST / DISCOVERY BEFORE ADOPTION</div>
            <h1>Model <em>Fabric.</em></h1>
            <p className="lede">A routing shortlist for benchmarking, not an installed-model list. The candidate catalog stays independent of your installed models. Optional local HTTPS pairing can read the actual Ollama inventory without approving or executing a model.</p>
            <div className="notice"><strong>Discovery is not model approval</strong><p>Only a separately started, operator-controlled HTTPS gateway can report live Ollama model metadata. BrainC, memory access, execution and remote provider keys remain disconnected. Pairing never grants any of those permissions.</p></div>
            <PairingPanel />
            <div className="modelTableWrap"><table className="modelTable"><thead><tr><th>Candidate</th><th>Responsibility</th><th>Tier</th><th>Constraint</th><th>Status</th></tr></thead>
              <tbody>{MODELS.map(m=><tr key={m.model}><td><strong>{m.model}</strong></td><td>{m.role}</td><td>{m.tier}</td><td>{m.fit}</td><td><span className="smallPill">{m.state}</span></td></tr>)}</tbody></table></div>
            <p className="smallNote">Cloud free tiers are conditional and can change. Provider access requires account verification, acceptable data-sharing policy, remaining quota and explicit operator approval.</p>
            <div className="textLinks"><a href="https://ollama.com/library">Ollama model library ↗</a><a href="https://console.groq.com/docs/rate-limits">Groq limits ↗</a><a href="https://openrouter.ai/pricing">OpenRouter limits ↗</a><a href="https://developers.cloudflare.com/workers-ai/platform/pricing/">Workers AI pricing ↗</a></div>
          </section>}
          {view==='cloud'&&<section>
            <div className="eyebrow">UNVERIFIED PUBLIC OBSERVATIONS / OPERATOR REVIEW</div>
            <h1>Cloud <em>Evidence.</em></h1>
            <p className="lede">Read the actual FieldCloudWorker status from GitHub, compare with the associated run and inspect a metadata-only projection. None of this starts a model or grants action authority.</p>
            <CloudEvidencePanel />
          </section>}
          {view==='scout'&&<section>
            <div className="eyebrow">LOCAL SCOUT / HUMAN IMPORT / NO LIVE AUTHORITY</div>
            <h1>Scout <em>Handoff.</em></h1>
            <p className="lede">Display an operator-copied PhiBot Scout qualification as self-reported evidence. No model routing, memory, action authority or live bot connection is enabled.</p>
            <ScoutHandoffPanel />
          </section>}
          {view==='evidence'&&<section>
            <div className="eyebrow">LOCAL INSPECTION / NO UPLOAD</div>
            <h1>Receipt <em>Inspector.</em></h1>
            <p className="lede">Paste one bounded JSON receipt. Parsing happens inside your browser; the inspector does not upload it or pretend a parsed hash is a verified signature.</p>
            <label className="receiptLabel" htmlFor="receipt-input">PASTE JSON RECEIPT · MAXIMUM 128 KiB</label>
            <textarea id="receipt-input" className="receiptInput" spellCheck={false}
              placeholder={'{"schema":"superphivessel.dlam.route-decision.p1c.v0.1","authority_granted":false}'}
              value={receiptText} onChange={e=>{setReceiptText(e.target.value);setInspection(null);setInspectionError('');}} />
            <div className="inspectActions"><button className="primaryButton" onClick={inspect}>INSPECT LOCALLY →</button>
              <button className="secondaryButton" onClick={()=>{setReceiptText('');setInspection(null);setInspectionError('');}}>CLEAR</button></div>
            {inspectionError&&<div className="error" role="alert">{inspectionError}</div>}
            {inspection&&<div className="inspectResult" role="status">
              <div className="laneTop"><strong>{inspection.label}</strong><span className="laneTag">{inspection.recognized?'KNOWN FORMAT':'UNKNOWN FORMAT'}</span></div>
              <p>Schema: <code>{inspection.schema}</code></p>
              {inspection.issues.map(issue=><p key={issue} className="errorLine">{issue}</p>)}
              <dl>{Object.entries(inspection.fields).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>
              <p className="smallNote">Cryptographic verification: NO · Execution permission: NO · Source authenticity: UNVERIFIED.</p>
            </div>}
          </section>}
        </main>
      </div>
      <footer className="footer"><span>SUPER Φ.VESSEL / VESSIE WEB v0.1 · REVIEW-ONLY</span><span>OPTIONAL READ-ONLY LOCAL DISCOVERY · NO MODEL EXECUTION · LEDGER ABOVE EGO</span></footer>
    </div>
  );
}
export default App;
