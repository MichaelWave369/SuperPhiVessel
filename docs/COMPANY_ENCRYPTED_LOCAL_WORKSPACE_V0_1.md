# SPV-COMPANY-10: Optional Encrypted Local Workspace v0.1

**Feature:** explicit passphrase-encrypted storage for COMPANY-09's validated, replayable archive, in the user's own browser profile. This does **not** replace manual portable JSON export and is not automatic persistence, cloud sync, data authentication or external execution evidence.

## How it works

- Inside Company Mode, open **Encrypted Local Workspace**. Nothing is checked, decrypted, read or saved on initial render.
- Optionally click **CHECK FOR LOCAL ENCRYPTED SLOT**. This reads only the sealed IndexedDB record's existence and validates the encryption envelope; it does not decrypt or import workspace data.
- To save: create a Company plan, optionally add human priorities and attach full Anti-M journals, enter and confirm a **unique 12–512 character passphrase**, then click **ENCRYPT + SAVE CURRENT WORKSPACE**.
- Saving reuses COMPANY-09's validated archive export. Every full Anti-M journal is replayed again. The archive is encrypted with AES-256-GCM using WebCrypto, a **new 16-byte random salt** and **12-byte random IV** for every save. The key is derived via PBKDF2-HMAC-SHA-256 with **310,000 iterations** and remains non-extractable. GCM authenticates ciphertext and fixes additional authenticated domain-separation data. Only the encrypted envelope is written to a single IndexedDB slot.
- If an encrypted slot exists, an explicit overwrite confirmation is required. Each save requires the passphrase; there is **no auto-save, cached key, remembered passphrase or unattended refresh**.
- To recover: return to the same browser profile and website origin, type your passphrase, click **UNLOCK + REPLAY SAVED WORKSPACE**, and inspect the decrypted preview. The GCM tag must verify, then the inner COMPANY-09 payload SHA-256, Company plan and priority scopes, and *every* Anti-M journal chain and contract match must validate. **No Company state changes during preview**.
- Click **RESTORE DECRYPTED WORKSPACE (EXPLICIT)**. Replacing an already-open Company plan requires another confirmation. Plan, priorities and replayed Anti-M displays are updated together.
- To delete: click **DELETE THIS BROWSER'S ENCRYPTED SLOT** and confirm. This only deletes the current website origin/browser profile IndexedDB record, not other copies, backups or browser/device snapshots.

## Security boundaries and non-goals

- **At-rest confidentiality, not end-to-end cloud security:** The plaintext is created in page memory during intentional save/unlock. An XSS, malicious browser extension, browser/devtools compromise, keylogger, or malware running in the user's session can steal a passphrase and/or unlocked data. WebCrypto does not eliminate these threats. React clearing the password input does **not guarantee memory erasure**.
- **Passphrase custody is the user's responsibility.** There is no reset, server recovery, key escrow or bypass. Choose a strong unique passphrase (prefer a long random or multiple-word passphrase). A 12-character minimum is a safety floor, not a claim that all such passphrases are strong.
- **No credentials in cleartext storage.** The IndexedDB record contains only schema markers, PBKDF2 parameters, salt, IV, AES-GCM ciphertext and non-authority metadata. Neither passphrase nor derived key is stored. The page has no remote API access for this feature.
- **Same origin and browser profile:** storage is browser-local. It may be deleted by clearing site data, private-browsing lifetime, quota eviction, or profile migration. Other browsers/devices do not automatically share it.
- **No guaranteed durable persistence:** IndexedDB storage is best effort. Keep a separate **portable archive JSON backup** on a private, secure device. That portable export is *unencrypted*, so protect it or move it into an encrypted storage location.
- **No verified authorship:** an attacker who knows the passphrase or controls the browser can replace encrypted records. Decryption proves possession of the passphrase and ciphertext integrity, not who created the data.
- **No trusted execution evidence:** A saved Company local review and Anti-M `VERIFIED_DONE_LOCAL` remain self-reported. Encryption, integrity and successful decryption never promote completion, confer GitHub write permission or independently attest CI/deployment/customer acceptance.
- **No hidden side effects:** no background timers, auto-fetches, cloud database, cross-site relay, GitHub writes, model invocation, spending, automatic actions or telemetry.

## Failure modes

- Refuse unsupported browser crypto/IndexedDB, incorrect or too-short passphrases, wrong password, modified AES-GCM ciphertext, mutated IV/salt, unexpected schema/KDF downgrade, forged authority flags, oversize archives and malformed base64.
- Refuse imported decrypted content if inner archive hash, priority/node scope, Anti-M SHA-256 event replay, full journal matching or other COMPANY-09 checks fail.
- Failed decrypt/import does **not overwrite** the current Company workspace. Deletion requires a separate deliberate click and confirmation.
- Errors from browsers rejecting IndexedDB transactions fail closed. No plaintext fallback to localStorage.
- One encrypted local slot per website origin; overwriting loses the previous slot. Multiple tabs can race, so avoid simultaneous editing. This is not a multi-user service.

## Verification

From `apps/vessie-web`: `npm test && npm run build`.

Browser smoke test on secure HTTPS GitHub Pages or local loopback: create a plan and attach a full Anti-M journal, encrypt and save, refresh, unlock and preview, explicitly restore, verify the Company node is not promoted by Anti-M local closure, overwrite with a new passphrase, verify old password fails, and delete the saved slot. Check DevTools IndexedDB holds only the encrypted envelope and no plaintext or passphrase. Confirm no request is sent during these actions.

**Ledger Above Ego. DONE Means Verified** remains a governance aspiration; encrypted local records are never proof of external DONE.
