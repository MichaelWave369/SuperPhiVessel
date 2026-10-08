import {readFileSync,statSync} from 'node:fs';
import {auditOperatorCustodyBatch} from './custody-batch.mjs';

const USAGE='Usage: node custody-batch-cli.mjs --input <local-redacted-batch.json> --public-key <independently-trusted-ed25519-public.pem>';
const MAX_BATCH_BYTES=1048576,MAX_KEY_BYTES=16384;
function bounded(path,limit) {
  if (statSync(path).size > limit) throw new Error('INPUT_TOO_LARGE');
  const bytes=readFileSync(path);
  if (bytes.length>limit) throw new Error('INPUT_TOO_LARGE');
  return bytes.toString('utf8');
}
try {
  const args=process.argv.slice(2);
  if(args.length!==4||args[0]!=='--input'||args[2]!=='--public-key'||
    args[1].startsWith('--')||args[3].startsWith('--'))throw new Error('BAD_ARGUMENT');
  const batch=JSON.parse(bounded(args[1],MAX_BATCH_BYTES));
  if(!batch || typeof batch!=='object'||Array.isArray(batch)||
    Object.keys(batch).length!==2||
    batch.schema!=='superphivessel.gateway.r3f.batch-input.v0.1'||
    !Array.isArray(batch.envelopes))throw new Error('BATCH_FORMAT_INVALID');
  const result=auditOperatorCustodyBatch(
    batch.envelopes,bounded(args[3],MAX_KEY_BYTES));
  console.log(JSON.stringify(result,null,2));
  // A successfully verified but review-flagged batch has a nonzero exit
  // code. Do not silently promote review-required packets in automation.
  if(result.status==='REVIEW_REQUIRED')process.exitCode=3;
} catch(e) {
  const code=e instanceof Error && /^[A-Z_]+$/.test(e.message)?e.message:'OFFLINE_BATCH_REJECTED';
  console.error(code+'\n'+USAGE);
  process.exitCode=2;
}
