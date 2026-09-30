const fs = require('fs');
const vm = require('vm');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'runtime', 'MANIFEST.json'), 'utf8')
);
const runtimePath = process.env.PV_RUNTIME_FILE ||
  path.join(__dirname, '..', manifest.runtime.path);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class Store {
  constructor(seed = {}) { this.map = new Map(Object.entries(seed)); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(String(k)) ? this.map.get(String(k)) : null; }
  setItem(k, v) { this.map.set(String(k), String(v)); }
  removeItem(k) { this.map.delete(String(k)); }
}

const html = fs.readFileSync(runtimePath, 'utf8');
const version = String(manifest.runtime.version || '').replace(/^v/, '');
assert(html.includes("const SUPER_PHIVESSEL_VERSION='" + version + "';"), 'runtime version mismatch');
assert(!html.includes('Mikey retains final authority over goals and decisions.'), 'operator-specific memory seed remains');
assert(html.includes('The current human operator retains final authority over goals and decisions.'), 'neutral authority seed missing');
assert(html.includes("const RECOVERY_DB_NAME = 'parallax_vessel_recovery_public_epoch_1';"), 'recovery DB epoch not rotated');

const block = html.match(/\/\/ BEGIN PV-BLANK-STATE-0\.1([\s\S]*?)\/\/ END PV-BLANK-STATE-0\.1/);
assert(block, 'blank-state migration block missing');

const localStorage = new Store({
  vessel_history_v1: 'OLD_CHAT',
  'vessel_memory:vsl_old': 'OLD_MEMORY',
  vessel_key_openai: 'OLD_SECRET',
  'phivessel:ael-history': 'OLD_AEL',
  'parallax-vessel-session': 'OLD_SESSION',
  unrelated_app_state: 'KEEP'
});
const sessionStorage = new Store({
  vessel_soma_focus_session_v1: 'OLD_FOCUS',
  unrelated_session_state: 'KEEP'
});
const deletedDatabases = [];
const indexedDB = { deleteDatabase(name) { deletedDatabases.push(name); return {}; } };
const context = { localStorage, sessionStorage, indexedDB, window: {} };

vm.createContext(context);
vm.runInContext(block[1], context);

const snap = context.window.PhiBlankState.snapshot();
assert(snap.migrated === true && snap.status === 'MIGRATED', 'first boot did not migrate');
for (const key of ['vessel_history_v1', 'vessel_memory:vsl_old', 'vessel_key_openai', 'phivessel:ael-history', 'parallax-vessel-session']) {
  assert(localStorage.getItem(key) === null, 'legacy Vessie key survived: ' + key);
}
assert(sessionStorage.getItem('vessel_soma_focus_session_v1') === null, 'legacy session state survived');
assert(localStorage.getItem('unrelated_app_state') === 'KEEP', 'unrelated localStorage was modified');
assert(sessionStorage.getItem('unrelated_session_state') === 'KEEP', 'unrelated sessionStorage was modified');
assert(deletedDatabases.includes('parallax_vessel_recovery_v1'), 'legacy recovery DB deletion was not requested');
assert(localStorage.getItem('phivessel_public_data_epoch_v1') === 'PV-PUBLIC-BLANK-2026-09-29-V1', 'epoch marker missing');

localStorage.setItem('vessel_history_v1', 'NEW_EPOCH_CHAT');
const second = vm.runInContext('runPublicDataEpochMigration()', context);
assert(second.migrated === false && second.status === 'CURRENT', 'migration repeated in current epoch');
assert(localStorage.getItem('vessel_history_v1') === 'NEW_EPOCH_CHAT', 'current-epoch state was erased');

console.log('blank-state: PASS');
