import { X509Certificate } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Never read a TLS private key. This is a source-level readiness preflight,
// not Windows trust, browser connectivity, machine attestation, or a runtime
// authorization. Checks and error codes deliberately omit file paths.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MAX_CERT_BYTES = 64 * 1024;
const CHECKS = Object.freeze([
  'WINDOWS_PLATFORM',
  'NODE_22_OR_NEWER',
  'TLS_CERT_CONFIGURED',
  'TLS_CERT_PUBLIC_FILE',
  'TLS_CERT_IP_SAN_LOOPBACK',
  'TLS_CERT_TIME_VALID',
  'TLS_KEY_CONFIGURED',
  'TLS_KEY_FILE_EXISTS',
  'TLS_KEY_OUTSIDE_REPOSITORY',
  'TLS_CERT_AND_KEY_DIFFERENT_FILES'
]);
const isNonempty = v => typeof v === 'string' && v.trim().length > 0;
const inside = (directory, file) => {
  const rel = relative(directory, file);
  return rel === '' || (rel !== '..' && !rel.startsWith('..\\') &&
    !rel.startsWith('../') && !isAbsolute(rel));
};
const mark = (passed, fail, check, ok, problem) => {
  if(ok) passed.push(check);
  else { fail.push(check); problem.push('NOT_READY_' + check); }
};

// Dependency injection is used for synthetic unit tests only. Neither the
// operator CLI nor the GitHub Pages cockpit accepts these dependencies.
export function inspectR2OperatorPreflight({
  platform = process.platform,
  nodeVersion = process.versions.node,
  certPath = process.env.VESSIE_TLS_CERT_FILE,
  keyPath = process.env.VESSIE_TLS_KEY_FILE,
  repoRoot = ROOT
} = {}, {
  lstat = lstatSync,
  readCert = readFileSync,
  parseCert = bytes => new X509Certificate(bytes),
  now = () => Date.now()
} = {}) {
  const passed = [], failed = [], problems = [];
  const major = typeof nodeVersion === 'string' ? Number(nodeVersion.split('.')[0]) : NaN;
  mark(passed,failed,'WINDOWS_PLATFORM',platform==='win32',problems);
  mark(passed,failed,'NODE_22_OR_NEWER',Number.isInteger(major)&&major>=22,problems);

  const certConfigured=isNonempty(certPath);
  const keyConfigured=isNonempty(keyPath);
  mark(passed,failed,'TLS_CERT_CONFIGURED',certConfigured,problems);
  mark(passed,failed,'TLS_KEY_CONFIGURED',keyConfigured,problems);

  const certName=certConfigured?resolve(certPath):null;
  const keyName=keyConfigured?resolve(keyPath):null;
  const different=Boolean(certName && keyName && certName!==keyName);
  mark(passed,failed,'TLS_CERT_AND_KEY_DIFFERENT_FILES',different,problems);

  // No reading key contents. lstat is intentionally restricted to file
  // metadata, and refuses symlinks at the final pathname.
  let keyStat=null;
  if(keyName) {
    try { keyStat=lstat(keyName); } catch { /* generic NOT_READY only */ }
  }
  mark(passed,failed,'TLS_KEY_FILE_EXISTS',
    Boolean(keyStat && keyStat.isFile() && !keyStat.isSymbolicLink()),problems);
  mark(passed,failed,'TLS_KEY_OUTSIDE_REPOSITORY',
    Boolean(keyName && !inside(resolve(repoRoot),keyName)),problems);

  let certStat=null;
  if(certName) {
    try { certStat=lstat(certName); } catch { /* no paths in report */ }
  }
  const certFile=Boolean(certStat && certStat.isFile() && !certStat.isSymbolicLink() &&
    Number.isSafeInteger(certStat.size) && certStat.size > 0 &&
    certStat.size <= MAX_CERT_BYTES);
  mark(passed,failed,'TLS_CERT_PUBLIC_FILE',certFile,problems);
  let sanValid=false,timeValid=false;
  if(certFile) {
    try {
      const publicCert=readCert(certName);
      if(Buffer.isBuffer(publicCert) && publicCert.length>0 &&
        publicCert.length<=MAX_CERT_BYTES) {
        const parsed=parseCert(publicCert);
        sanValid=parsed.checkIP('127.0.0.1')==='127.0.0.1';
        const first=Date.parse(parsed.validFrom),last=Date.parse(parsed.validTo),t=now();
        timeValid=Number.isFinite(first)&&Number.isFinite(last)&&
          Number.isFinite(t)&&first<=t&&t<last;
      }
    } catch { /* invalid public cert, don't reveal underlying path/details */ }
  }
  mark(passed,failed,'TLS_CERT_IP_SAN_LOOPBACK',sanValid,problems);
  mark(passed,failed,'TLS_CERT_TIME_VALID',timeValid,problems);

  const ready=failed.length===0;
  return {
    schema:'superphivessel.gateway.r2.operator-preflight.v0.1',
    status:ready?'LOCAL_SOURCE_PREFLIGHT_READY_FIELD_TEST_REQUIRED':'BLOCKED_OPERATOR_PREFLIGHT',
    checks:CHECKS.map(check=>({check,result:passed.includes(check)?'PASS':'BLOCKED'})),
    issues:problems.sort(),
    check_count:CHECKS.length,
    passed_check_count:passed.length,
    private_key_contents_read:false,
    certificate_trust_validated_by_windows:false,
    browser_tls_trust_validated:false,
    browser_private_network_qualified:false,
    real_ollama_qualified:false,
    gateway_connection_tested:false,
    same_device_authenticated:false,
    field_receipts_collected:false,
    physically_qualified:false,
    operator_approval_granted:false,
    model_routing_approved:false,
    can_execute:false,
    authority_granted:false,
    credentials_included:false,
    device_paths_included:false,
    browser_session_tokens_included:false
  };
}

if(process.argv[1] && import.meta.url===new URL('file://' + resolve(process.argv[1])).href) {
  // This CLI does not write any report file, contact localhost, run Ollama,
  // or inspect the private key. Print only allowlisted statuses.
  const result=inspectR2OperatorPreflight();
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(result.status!=='LOCAL_SOURCE_PREFLIGHT_READY_FIELD_TEST_REQUIRED')
    process.exitCode=2;
}
