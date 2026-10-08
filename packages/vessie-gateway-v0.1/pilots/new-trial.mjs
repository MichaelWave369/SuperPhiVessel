import { randomBytes } from 'node:crypto';

// Non-secret operator-visible correlation label. Not an authenticator, bearer,
// browser attestation, runtime-origin proof, or machine identifier.
const trialId = randomBytes(16).toString('hex');
console.log('R2 operator trial ID (not a secret; copy to PowerShell and React):');
console.log(trialId);
console.log('Use this ID for a single Windows TLS + browser report pair.');
