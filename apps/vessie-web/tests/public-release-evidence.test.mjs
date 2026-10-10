import test from 'node:test';
import assert from 'node:assert/strict';
import {
 publicReleaseUrls,parsePublicPagesReceipt,parsePublicPagesRun,parsePublicSmokeRuns,
 releaseEvidenceProjection,validateReleaseEvidence,readPublicReleaseEvidence,releaseEvidenceSummary
} from '../src/public-release-evidence.mjs';
const SHA='74263a13464358790a98815be68bd82a095e62c0';
const REPO='MichaelWave369/SuperPhiVessel';
const ID=38078303780;
const PAGES='https://github.com/'+REPO+'/actions/runs/';
const receipt=()=>({
 schema:'superphivessel.pages-deploy-provenance.v0.1',repo:REPO,commitSha:SHA,
 workflowRunId:String(ID),cockpitPath:'/SuperPhiVessel/vessie/',
 provenance:'GITHUB_ACTIONS_REPORTED_BUILD_REVISION',
 deployedBrowserVerified:false,independentlyAttestedExternalDone:false
});
const ghRun=(id,name,event,conclusion,createdAt='2026-10-10T19:05:11Z',updatedAt='2026-10-10T19:05:45Z')=>({
 id,name,event,status:conclusion===null?'in_progress':'completed',
 conclusion,head_sha:SHA,head_branch:'main',head_repository:{full_name:REPO},
 created_at:createdAt,updated_at:updatedAt,html_url:PAGES+id
});
const pages=()=>ghRun(ID,'github-pages','push','success','2026-10-10T19:03:57Z','2026-10-10T19:05:09Z');
const smoke=(id=38078387755,conclusion='success',at='2026-10-10T19:05:11Z')=>ghRun(id,'vessie-deployed-site-smoke','workflow_run',conclusion,at,'2026-10-10T19:05:55Z');
const list=(runs)=>({total_count:runs.length,workflow_runs:runs});
const response=text=>({ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(text)});
async function snapshot(runs=[smoke()],requesterOverride=null){
 const body={
  [publicReleaseUrls.pages]:receipt(),
  ['https://api.github.com/repos/'+REPO+'/actions/runs/'+ID]:pages(),
  [publicReleaseUrls.smokeRuns]:list(runs)
 };
 const requested=[];
 const fetched=await readPublicReleaseEvidence(requesterOverride||((url,opts)=>{
  requested.push([url,opts]);assert.ok(url in body);return Promise.resolve(response(body[url]))
 }));
 return {fetched,requested}
}
test('explicit three public GETs reconcile the real deployment SHA without any grant',async()=>{
 const {fetched,requested}=await snapshot();
 assert.deepEqual(requested.map(x=>x[0]),[
  publicReleaseUrls.pages,
  'https://api.github.com/repos/'+REPO+'/actions/runs/'+ID,
  publicReleaseUrls.smokeRuns
 ]);
 assert.ok(requested.every(x=>x[1].method==='GET'&&x[1].credentials==='omit'&&x[1].redirect==='error'));
 assert.equal(fetched.revision,SHA);
 assert.equal(fetched.pages.id,ID);
 assert.equal(fetched.smoke.id,38078387755);
 assert.equal(fetched.grade,'PUBLIC_RELEASE_OBSERVED');
 assert.equal(fetched.publicSourcesAligned,true);
 assert.equal(fetched.exactWorkflowParentIndependentlyProven,false);
 assert.equal(fetched.signatureVerified,false);
 assert.equal(fetched.evidenceTransferred,false);
 assert.equal(fetched.executionAuthorityGranted,false);
 assert.equal(fetched.independentlyAttestedExternalDone,false);
 assert.match(releaseEvidenceSummary(fetched),/NOT EXTERNAL DONE/);
});
test('newer failed smoke wins over an old green run for same SHA',async()=>{
 const older=smoke(1000,'success','2026-10-10T19:05:12Z');
 const newer=smoke(1001,'failure','2026-10-10T19:05:30Z');
 const {fetched}=await snapshot([older,newer]);
 assert.equal(fetched.grade,'SMOKE_NOT_SUCCESS');
 assert.equal(fetched.publicSourcesAligned,false);
 assert.equal(fetched.smoke.id,1001);
});
test('not found in first page is explicit inconclusive, never green',async()=>{
 const {fetched}=await snapshot([smoke(2000,'success','2026-10-10T19:04:59Z')]);
 assert.equal(fetched.grade,'NO_MATCHING_SMOKE_IN_SAMPLE');
 assert.equal(fetched.smoke,null);
 assert.equal(fetched.sampledSmokeRuns,1);
});
test('a smoke workflow still in progress cannot imply passing release',async()=>{
 const {fetched}=await snapshot([smoke(3000,null)]);
 assert.equal(fetched.grade,'SMOKE_NOT_SUCCESS');
 assert.equal(fetched.smoke.conclusion,null);
});
test('successful smoke cannot override failed Pages workflow',async()=>{
 const bad=pages();bad.conclusion='failure';
 const r=parsePublicPagesReceipt(JSON.stringify(receipt()));
 const p=parsePublicPagesRun(JSON.stringify(bad),r);
 const sample=parsePublicSmokeRuns(JSON.stringify(list([smoke()])),r,p);
 assert.equal(releaseEvidenceProjection(r,p,sample).grade,'PAGES_NOT_SUCCESS');
});
test('forged receipt, private repository, mismatched SHA and URL are rejected',()=>{
 const copy=receipt();
 assert.throws(()=>parsePublicPagesReceipt(JSON.stringify({...copy,deployedBrowserVerified:true})),/AUTHORITY/);
 assert.throws(()=>parsePublicPagesReceipt(JSON.stringify({...copy,independentlyAttestedExternalDone:true})),/AUTHORITY/);
 assert.throws(()=>parsePublicPagesReceipt(JSON.stringify({...copy,extra:true})),/FIELDS/);
 assert.throws(()=>parsePublicPagesReceipt(JSON.stringify({...copy,commitSha:'a'.repeat(40),workflowRunId:'-1'})),/REVISION/);
 const p=parsePublicPagesReceipt(JSON.stringify(copy));
 assert.throws(()=>parsePublicPagesRun(JSON.stringify({...pages(),head_sha:'a'.repeat(40)}),p),/DEPLOY_MISMATCH/);
 assert.throws(()=>parsePublicPagesRun(JSON.stringify({...pages(),head_repository:{full_name:'evil/repo'}}),p),/GITHUB_RUN/);
 assert.throws(()=>parsePublicPagesRun(JSON.stringify({...pages(),html_url:'https://evil.invalid'}),p),/GITHUB_RUN/);
 assert.throws(()=>parsePublicPagesRun(JSON.stringify({...pages(),event:'pull_request'}),p),/DEPLOY_MISMATCH/);
});
test('fake public smoke status, forged flags and changed source URLs refuse',async()=>{
 const {fetched}=await snapshot();
 assert.throws(()=>validateReleaseEvidence({...fetched,approvalGranted:true}),/AUTHORITY/);
 assert.throws(()=>validateReleaseEvidence({...fetched,evidenceTransferred:true}),/AUTHORITY/);
 assert.throws(()=>validateReleaseEvidence({...fetched,publicSourcesAligned:false}),/GRADE/);
 assert.throws(()=>validateReleaseEvidence({...fetched,grade:'VERIFIED_DONE'}),/GRADE/);
 assert.throws(()=>validateReleaseEvidence({...fetched,smoke:{...fetched.smoke,url:'https://attacker.test'}}),/SMOKE/);
 assert.throws(()=>validateReleaseEvidence({...fetched,extra:4}),/FIELDS/);
 const r=parsePublicPagesReceipt(JSON.stringify(receipt())),p=parsePublicPagesRun(JSON.stringify(pages()),r);
 assert.throws(()=>parsePublicSmokeRuns(JSON.stringify(list([{...smoke(),head_repository:{full_name:'bad/repo'}}])),r,p),/GITHUB_RUN/);
});
test('HTTP refusal, oversize source, malformed JSON and no silent grant',async()=>{
 await assert.rejects(readPublicReleaseEvidence(async()=>({ok:false,status:403,headers:{get:()=>null}})),/HTTP_403/);
 await assert.rejects(readPublicReleaseEvidence(async()=>({ok:true,headers:{get:()=>''+1048577}})),/SIZE/);
 await assert.rejects(readPublicReleaseEvidence(async()=>({ok:true,headers:{get:()=>null},text:async()=>'{'})),/JSON/);
 const r=parsePublicPagesReceipt(JSON.stringify(receipt())),p=parsePublicPagesRun(JSON.stringify(pages()),r);
 assert.throws(()=>parsePublicSmokeRuns(JSON.stringify({workflow_runs:[]}),r,p),/RUN_LIST/);
 assert.throws(()=>parsePublicSmokeRuns(JSON.stringify(list(Array.from({length:21},(_,i)=>smoke(100+i)))),r,p),/RUN_LIST/);
});
