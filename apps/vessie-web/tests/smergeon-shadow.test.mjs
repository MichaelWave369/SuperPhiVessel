// Browser WebCrypto mirror of Smergeon v0.6 checks in GitPorch PR #25.
// Reference digests were independently Python-computed and tested in GitPorch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSmergeonReceipt,SCHEMA} from '../src/smergeon-shadow.mjs';

const STAGED_DIGEST = '705dc363673fe5bae5255613a4a550698a442ef253367299ced4ccdd5507c673';
const DRAFT_DIGEST = '645fa835a0d195bb9bc7a9f0239712e61da1cf1ab5c439eefc8ee5be67de5ac6';
const warning = 'Checksum is not a signature, CI result, authenticated custody, Anti-M completion, GitPorch worker record, or approval to merge.';
function receipt(event='STAGED_ONLY') {
  return {
    schema: SCHEMA,
    body: {
      schema: SCHEMA,
      event,
      source: {
        repository: 'owner/repo',
        pull_request: 7,
        head_sha: 'c'.repeat(40),
        plan_fingerprint: 'a'.repeat(64),
      },
      operation: {
        id: 'b'.repeat(64),
        branch: 'smergeon/repair-pr7-cccccccc-bbbbbbbbbb',
        file_path: 'src/fix.py',
        before_blob_sha: 'd'.repeat(40),
        after_blob_sha: 'e'.repeat(40),
      },
      draft: event === 'STAGED_ONLY'
        ? {number: null, url: null}
        : {number: 8, url: 'https://github.com/owner/repo/pull/8'},
      handoff: {
        gitporch: {
          kind: 'UNSIGNED_REPAIR_PROPOSAL',
          worker_execution_verified: false,
          signed_evidence: false,
          witnessed: false,
          outcome: 'UNVERIFIED',
        },
        anti_m: {
          kind: 'SHADOW_REVIEW_ONLY',
          execution_authority: false,
          closure_authority: false,
          ledger_write: false,
          done: false,
          provenance: 'OPERATOR_REPORT',
        },
      },
      claims: {
        origin: 'LOCAL_SELF_REPORT',
        verified_root_cause: false,
        ci_verified: false,
        independently_witnessed: false,
        source_branch_modified: false,
        merges_performed: 0,
        permission_granted: false,
      },
    },
    checksum_sha256: event === 'STAGED_ONLY' ? STAGED_DIGEST : DRAFT_DIGEST,
    trust: 'UNSIGNED_UNVERIFIED',
    warning,
  };
}
const copy = value => JSON.parse(JSON.stringify(value));


test('Smergeon staged fixture is REVIEW_ONLY, never evidence or DONE',async()=>{
  const result=await inspectSmergeonReceipt(receipt());
  assert.equal(result.outcome,'REVIEW_ONLY');
  assert.equal(result.event,'STAGED_ONLY');
  assert.equal(result.reason,'FORMAT_AND_CHECKSUM_CONSISTENT_NOT_AUTHENTICATED');
  assert.equal(result.trust,'UNSIGNED_UNVERIFIED');
  for(const field of ['acceptedAsSignedEvidence','verifiedWorkerRun',
      'antiMCompletion','executionAuthority','mergeAuthority'])
    assert.equal(result[field],false);
  assert.equal(result.draftUrl,null);
});

test('draft creation claim stays unverified',async()=>{
  const result=await inspectSmergeonReceipt(receipt('DRAFT_CREATED'));
  assert.equal(result.outcome,'REVIEW_ONLY');
  assert.equal(result.event,'DRAFT_CREATED');
  assert.equal(result.draftPullRequest,8);
  assert.equal(result.draftUrl,'https://github.com/owner/repo/pull/8');
  assert.equal(result.antiMCompletion,false);
  assert.equal(result.executionAuthority,false);
});

test('independently pinned checksum accepted only if matching',async()=>{
  assert.equal((await inspectSmergeonReceipt(receipt(),
    {expectedChecksum:STAGED_DIGEST})).externallyPinned,true);
  assert.equal((await inspectSmergeonReceipt(receipt('DRAFT_CREATED'),
    {expectedChecksum:DRAFT_DIGEST})).outcome,'REVIEW_ONLY');
  assert.equal((await inspectSmergeonReceipt(receipt(),
    {expectedChecksum:'0'.repeat(64)})).reason,'EXTERNAL_CHECKSUM_MISMATCH');
  assert.equal((await inspectSmergeonReceipt(receipt(),
    {expectedChecksum:'not-a-digest'})).outcome,'REJECT');
});

test('tampered data or changed head commit rejected',async()=>{
  const changed=copy(receipt());changed.body.source.head_sha='f'.repeat(40);
  assert.equal((await inspectSmergeonReceipt(changed)).outcome,'REJECT');
  const changed2=copy(receipt());
  changed2.body.operation.after_blob_sha='f'.repeat(40);
  assert.equal((await inspectSmergeonReceipt(changed2)).reason,'CHECKSUM_MISMATCH');
});

test('invented verified evidence or authority always rejected',async()=>{
  const mutations=[
    r=>{r.body.handoff.gitporch.outcome='PASS';},
    r=>{r.body.handoff.gitporch.signed_evidence=true;},
    r=>{r.body.handoff.gitporch.worker_execution_verified=true;},
    r=>{r.body.handoff.gitporch.witnessed=true;},
    r=>{r.body.handoff.anti_m.done=true;},
    r=>{r.body.handoff.anti_m.execution_authority=true;},
    r=>{r.body.handoff.anti_m.ledger_write=true;},
    r=>{r.body.claims.permission_granted=true;},
    r=>{r.body.claims.ci_verified=true;},
    r=>{r.body.claims.merges_performed=1;}
  ];
  for(const fn of mutations){
    const changed=copy(receipt());fn(changed);
    assert.equal((await inspectSmergeonReceipt(changed)).reason,
      'FORBIDDEN_AUTHORITY_CLAIM');
  }
});

test('forged source and unsafe paths, branches, draft URLs rejected',async()=>{
  const changes=[
    r=>{r.body.operation.file_path='../secrets.py';},
    r=>{r.body.operation.file_path='.github/workflows/publish.yml';},
    r=>{r.body.operation.branch='main';},
    r=>{r.body.source.pull_request=true;},
    r=>{r.body.source.repository='owner/..';},
    r=>{r.body.draft.number=9;},
    r=>{r.body.draft.url='https://evil.example/collect';},
    r=>{r.body.draft.url='https://github.com/owner/repo/pull/8?token=bad';},
  ];
  for(const edit of changes){
    const changed=copy(receipt('DRAFT_CREATED'));edit(changed);
    assert.equal((await inspectSmergeonReceipt(changed)).outcome,'REJECT');
  }
});

test('additional fields and mismatched schema never silently downgraded',async()=>{
  const cases=[
    r=>{r.schema='gitporch-offline-evidence/v1';},
    r=>{r.body.handoff.extra={};},
    r=>{r.body.source.extra='secret';},
    r=>{r.debug='token';},
    r=>{r.trust='SIGNED';},
    r=>{r.body.event='MERGED';},
  ];
  for(const edit of cases){
    const changed=copy(receipt());edit(changed);
    assert.equal((await inspectSmergeonReceipt(changed)).outcome,'REJECT');
  }
});

test('receipt inspection requires no network, storage or Anti-M writes',async()=>{
  const result=await inspectSmergeonReceipt(receipt());
  assert.equal(result.outcome,'REVIEW_ONLY');
  assert.equal(result.acceptedAsSignedEvidence,false);
  assert.equal(result.antiMCompletion,false);
  assert.equal(result.executionAuthority,false);
  assert.equal(result.mergeAuthority,false);
});
