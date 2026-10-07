import crypto from 'node:crypto';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));

function output(value) {
  process.stdout.write(JSON.stringify(value));
}

if (request.op === 'keygen') {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  output({
    public_key_b64: publicKey.export({format:'der', type:'spki'}).toString('base64'),
    private_key_b64: privateKey.export({format:'der', type:'pkcs8'}).toString('base64')
  });
} else if (request.op === 'sign') {
  const key = crypto.createPrivateKey({
    key: Buffer.from(request.private_key_b64, 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
  const signature = crypto.sign(null, Buffer.from(request.payload_b64, 'base64'), key);
  output({signature_b64: signature.toString('base64')});
} else if (request.op === 'verify') {
  const key = crypto.createPublicKey({
    key: Buffer.from(request.public_key_b64, 'base64'),
    format: 'der',
    type: 'spki'
  });
  const ok = crypto.verify(
    null,
    Buffer.from(request.payload_b64, 'base64'),
    key,
    Buffer.from(request.signature_b64, 'base64')
  );
  output({ok});
} else {
  throw new Error('unknown op');
}
