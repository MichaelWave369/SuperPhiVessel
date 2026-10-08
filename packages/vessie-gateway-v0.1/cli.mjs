import { randomBytes } from 'node:crypto';
import { startGateway } from './server.mjs';
import { discoverOllama } from './ollama-probe.mjs';

const command = process.argv[2] ?? 'help';
if (command === 'token') {
  console.log(randomBytes(32).toString('hex'));
} else if (command === 'probe') {
  const result = await discoverOllama();
  console.log(JSON.stringify(result, null, 2));
  if (result.probe_status !== 'AVAILABLE') process.exitCode = 2;
} else if (command === 'start') {
  const token = process.env.VESSIE_GATEWAY_TOKEN;
  const port = process.env.VESSIE_GATEWAY_PORT === undefined ? 8789 : Number(process.env.VESSIE_GATEWAY_PORT);
  try {
    const server = await startGateway({ token, port });
    const address = server.address();
    console.log(JSON.stringify({
      gateway: 'vessie-gateway-v0.1',
      listen: 'http://127.0.0.1:' + address.port,
      status: 'LOCAL_READ_ONLY',
      browser_pairing: 'NOT_IMPLEMENTED',
      token_exposed_in_log: false,
      authority_granted: false,
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Failed to start');
    process.exitCode = 1;
  }
} else {
  console.log('Usage: node cli.mjs token | probe | start');
  if (command !== 'help') process.exitCode = 1;
}
