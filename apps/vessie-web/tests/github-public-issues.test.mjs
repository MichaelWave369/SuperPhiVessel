import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPlan,companyProjection,addCompanyNode} from '../src/company-mode.mjs';
import {parsePublicRepo,publicIssueApiUrl,previewPublicIssues,readPublicIssues,
 validatePublicIssuePreview,importPublicIssueTasks} from '../src/github-public-issues.mjs';
const repo='MichaelWave369/reporider';
const base='https://github.com/michaelwave369/reporider/issues/';
const company=()=>createCompanyPlan({name:'Foundry',founder:'Operator',product:'Ship',customer:'People',weeklyGoal:'Review tasks',budgetLimitUsd:0});
const issue=(number,title)=>({number,title,state:'open',html_url:base+number,body:'UNTRUSTED BODY'});
const response=()=>JSON.stringify([
 issue(31,'Milestone: OAuth and real GitHub write-mode readiness'),
 {...issue(104,'PR not an issue'),pull_request:{url:'https://api.github.com/repos/..'}},
 issue(30,'Add generated issue creation guardrails')
]);
test('exactly constrained GitHub public GET, no token, no other host',async()=>{
 assert.equal(parsePublicRepo(repo),'michaelwave369/reporider');
 assert.equal(publicIssueApiUrl(repo),'https://api.github.com/repos/michaelwave369/reporider/issues?state=open&per_page=20&page=1');
 for(const bad of ['https://github.com/owner/repo','evil.com/a','owner/repo/extra','owner/../repo','owner/repo?access_token=abcd','owner/another.git']){
  assert.throws(()=>publicIssueApiUrl(bad),/REPOSITORY/);
 }
 let called=false;
 const out=await readPublicIssues(repo,async(url,options)=>{
  called=true;
  assert.equal(url,publicIssueApiUrl(repo));
  assert.equal(options.method,'GET');
  assert.equal(options.credentials,'omit');
  return {ok:true,headers:{get:()=>null},text:async()=>response()};
 });
 assert.equal(called,true);
 assert.equal(out.issues.length,2);
 assert.equal(out.authenticated,false);
 assert.equal(out.evidenceTransferred,false);
});
test('PR results filtered, issue links kept, node import is explicitly held',()=>{
 const p=previewPublicIssues(response(),repo);
 assert.deepEqual(p.issues.map(x=>x.number),[31,30]);
 assert.equal(JSON.stringify(p).includes('UNTRUSTED BODY'),false);
 const q=importPublicIssueTasks(company(),p,[30]);
 assert.equal(q.nodes.length,1);
 assert.ok(q.nodes[0].check.includes(base+'30'));
 assert.equal(q.nodes[0].actionReview,null);
 assert.equal(q.nodes[0].evidence,null);
 assert.equal(companyProjection(q).nodes[0].status,'ACTION_REVIEW_HELD');
 assert.equal(companyProjection(q).externalExecutionAttested,false);
 assert.throws(()=>importPublicIssueTasks(q,p,[30]),/ALREADY_IMPORTED/);
});
test('refuse cross-repo URL, closed state, malformed response, duplicate numbers',()=>{
 assert.throws(()=>previewPublicIssues(JSON.stringify([issue(30,'T'),issue(30,'Again')]),repo),/DUPLICATE_NUMBER/);
 assert.throws(()=>previewPublicIssues(JSON.stringify([{...issue(30,'T'),state:'closed'}]),repo),/STATE/);
 assert.throws(()=>previewPublicIssues(JSON.stringify([{...issue(30,'T'),html_url:'https://evil.com/issues/30'}]),repo),/ISSUE_URL/);
 assert.throws(()=>previewPublicIssues('{"message":"Forbidden"}',repo),/LIST/);
 assert.throws(()=>previewPublicIssues('{',repo),/JSON/);
 assert.throws(()=>previewPublicIssues('x'.repeat(2097153),repo),/SIZE/);
});
test('selection, overflow, and duplicates fail closed without partial mutation',()=>{
 const p=previewPublicIssues(response(),repo),original=company(),before=JSON.stringify(original);
 assert.throws(()=>importPublicIssueTasks(original,p,[]),/SELECTION/);
 assert.throws(()=>importPublicIssueTasks(original,p,[404]),/SELECTION_UNKNOWN/);
 assert.throws(()=>importPublicIssueTasks(original,p,[30,30]),/SELECTION_NUMBER/);
 assert.equal(JSON.stringify(original),before);
 let full=company();
 for(let i=0;i<11;i++)full=addCompanyNode(full,{
  id:'n'+i,function:'work',output:'task',check:'Manual check '+i,dependsOn:[],risk:'NONE'
 });
 const unchanged=JSON.stringify(full);
 assert.throws(()=>importPublicIssueTasks(full,p,[30,31]),/CAPACITY/);
 assert.equal(JSON.stringify(full),unchanged);
 const prefix=previewPublicIssues(JSON.stringify([issue(3,'Track issue three'),issue(30,'Track issue thirty')]),repo);
 let graph=importPublicIssueTasks(company(),prefix,[30]);
 graph=importPublicIssueTasks(graph,prefix,[3]);
 assert.equal(graph.nodes.length,2,'Issue #3 must not be mistaken for existing #30');
 assert.throws(()=>importPublicIssueTasks(graph,prefix,[3]),/ALREADY_IMPORTED/);
});
test('preview cannot forge authority, URLs, or secret issue title',()=>{
 const p=previewPublicIssues(response(),repo);
 assert.throws(()=>validatePublicIssuePreview({...p,approvalGranted:true}),/PREVIEW_AUTHORITY/);
 assert.throws(()=>validatePublicIssuePreview({...p,extra:'approved'}),/PREVIEW_SHAPE/);
 assert.throws(()=>validatePublicIssuePreview({...p,issues:[{...p.issues[0],url:'https://evil.com'}]}),/PREVIEW_ISSUE/);
 assert.throws(()=>previewPublicIssues(JSON.stringify([issue(99,'ghp_'+ 'a'.repeat(28))]),repo),/SENSITIVE_TITLE/);
});
test('upstream HTTP failure and overlarge header refuse before parsing',async()=>{
 await assert.rejects(readPublicIssues(repo,async()=>({ok:false,status:403,headers:{get:()=>null}})),/HTTP_403/);
 await assert.rejects(readPublicIssues(repo,async()=>({ok:true,headers:{get:()=>''+2097153},text:async()=>response()})),/SIZE/);
});
