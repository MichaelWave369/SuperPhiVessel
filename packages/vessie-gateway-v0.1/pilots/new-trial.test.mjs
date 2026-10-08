import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli=fileURLToPath(new URL('./new-trial.mjs',import.meta.url));
const run=()=>execFileSync(process.execPath,[cli],{
  encoding:'utf8',timeout:3000,maxBuffer:8192
});
test('R2T01 pilot ID generator emits one bounded lowercase non-secret label',()=>{
 const output=run();
 const matches=output.match(/\b[a-f0-9]{32}\b/g)||[];
 assert.equal(matches.length,1);
 assert.ok(output.includes('not a secret'));
 assert.ok(!output.includes('PRIVATE KEY'));
 assert.ok(!output.includes('PAIRING SECRET'));
});
test('R2T02 successive field trials have fresh labels',()=>{
 const a=run().match(/\b[a-f0-9]{32}\b/g)?.[0];
 const b=run().match(/\b[a-f0-9]{32}\b/g)?.[0];
 assert.match(a,/^[a-f0-9]{32}$/);
 assert.match(b,/^[a-f0-9]{32}$/);
 assert.notEqual(a,b);
});
