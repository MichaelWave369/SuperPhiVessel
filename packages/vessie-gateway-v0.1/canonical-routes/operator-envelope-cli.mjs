import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { createOperatorEnvelope, verifyOperatorEnvelope } from './operator-envelope.mjs';

const USAGE = [
  'Operator-local only; never put private keys or raw receipts in this repository.',
  'pack:   node operator-envelope-cli.mjs pack --input <local-raw.json> --private-key <operator-private.pem> --output <local-envelope.json> --operator-reviewed',
  'verify: node operator-envelope-cli.mjs verify --input <local-envelope.json> --public-key <independently-trusted-operator-public.pem>'
].join('\n');
const MAX_INPUT = 262144;
const MAX_PACKET = 131072;
const MAX_KEY = 16384;
function readBounded(path, limit) {
  if (statSync(path).size > limit) throw new Error('INPUT_TOO_LARGE');
  const b = readFileSync(path);
  if (b.length > limit) throw new Error('INPUT_TOO_LARGE');
  return b.toString('utf8');
}
function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!['pack','verify'].includes(cmd)) throw new Error('BAD_COMMAND');
  const opts = {};
  const accepted = cmd === 'pack'
    ? new Set(['--input','--private-key','--output','--operator-reviewed'])
    : new Set(['--input','--public-key']);
  for (let i=0;i<rest.length;i++) {
    const k=rest[i];
    if (!accepted.has(k) || Object.hasOwn(opts,k)) throw new Error('BAD_ARGUMENT');
    if (k==='--operator-reviewed') opts[k]=true;
    else {
      if (i+1>=rest.length || rest[i+1].startsWith('--')) throw new Error('MISSING_ARGUMENT');
      opts[k]=rest[++i];
    }
  }
  const keys=cmd==='pack'
    ? ['--input','--private-key','--output','--operator-reviewed']
    : ['--input','--public-key'];
  if (!keys.every(k=>Object.hasOwn(opts,k))) throw new Error('MISSING_ARGUMENT');
  return {cmd,opts};
}
try {
  const {cmd,opts}=parseArgs(process.argv.slice(2));
  if (cmd==='pack') {
    const raw=JSON.parse(readBounded(opts['--input'],MAX_INPUT));
    const key=readBounded(opts['--private-key'],MAX_KEY);
    const packet=createOperatorEnvelope(raw,key,{operatorReviewed:true});
    const result=JSON.stringify(packet,null,2)+'\n';
    if (Buffer.byteLength(result)>MAX_PACKET) throw new Error('PACKET_TOO_LARGE');
    // Exclusive create: never clobber an existing evidence file. Default 0600
    // on POSIX. Windows still requires operator-controlled filesystem ACLs.
    writeFileSync(opts['--output'],result,{flag:'wx',mode:0o600});
    console.log(JSON.stringify({
      status:'LOCAL_OPERATOR_ENVELOPE_WRITTEN',
      signer_fingerprint_sha256:packet.signer.key_fingerprint_sha256,
      runtime_origin_verified:false,
      authority_granted:false
    }));
  } else {
    const packet=JSON.parse(readBounded(opts['--input'],MAX_PACKET));
    const key=readBounded(opts['--public-key'],MAX_KEY);
    console.log(JSON.stringify(verifyOperatorEnvelope(packet,key),null,2));
  }
} catch(e) {
  // No stack traces, source paths, private fields or keys in terminal error.
  const code=e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : 'OFFLINE_ENVELOPE_ERROR';
  console.error(code+'\n'+USAGE);
  process.exitCode=2;
}
