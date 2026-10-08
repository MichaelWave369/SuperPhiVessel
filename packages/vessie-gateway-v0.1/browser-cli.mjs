import { startBrowserGateway, loadTlsFiles } from './browser-server.mjs';

try {
  const tls=loadTlsFiles(process.env.VESSIE_TLS_KEY_FILE,process.env.VESSIE_TLS_CERT_FILE);
  const port=process.env.VESSIE_BROWSER_GATEWAY_PORT===undefined?
    8790:Number(process.env.VESSIE_BROWSER_GATEWAY_PORT);
  const gateway=await startBrowserGateway({...tls,port});
  console.log([
    'VESSIE BROWSER GATEWAY R2 · READ ONLY',
    'Local URL: https://127.0.0.1:'+gateway.port,
    'Approved browser origin: '+gateway.origin,
    'One-use pairing secret (valid until paired; keep private): '+gateway.pairCode,
    'Pair code is shown once and never stored in the repository.',
    'Your browser must trust the TLS certificate, including IP SAN 127.0.0.1.',
    'No chat, execution, memory access, paid calls or model approval.',
    'Restart this process to invalidate the in-memory session and re-pair.'
  ].join('\n'));
}catch(error){
  console.error(error instanceof Error?error.message:'Failed to start browser pairing');
  process.exitCode=1;
}
