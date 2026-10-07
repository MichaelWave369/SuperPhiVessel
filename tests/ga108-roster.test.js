const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = path.join(__dirname, '..');
const roster = JSON.parse(fs.readFileSync(path.join(root, 'protocols', 'dlam-v0.1', 'genius-roster.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(root, 'protocols', 'dlam-v0.1', 'schemas', 'genius-profile.schema.json'), 'utf8'));

assert(roster.schema === 'superphivessel.genius-roster.ga108.v0.1', 'roster schema mismatch');
assert(roster.protocol === 'PV-DLAM-0.1', 'roster protocol mismatch');
assert(roster.status === 'CANONICAL_RUNTIME_EXPORT', 'roster status mismatch');
assert(roster.runtime_wiring === false, 'GA108 P0 export must remain unwired');
assert(roster.count === 108, 'GA108 count must be 108');
assert(Array.isArray(roster.entries) && roster.entries.length === 108, 'GA108 entry count mismatch');
assert(Array.isArray(roster.category_order) && roster.category_order.length === 18, 'GA108 category count mismatch');

assert(roster.source.runtime_version === 'v2.0-alpha.11.0.54.10', 'runtime source version mismatch');
assert(roster.source.runtime_sha256 === '96767c267b0d9ed20be9f4d182c30129944311096c0959d20b5d80c89fb2c09e', 'runtime source digest mismatch');
assert(roster.source.git_blob_sha1 === 'b44e0411f7477f2041cb3f130452a6d1f0410121', 'runtime source blob mismatch');
assert(roster.source.catalog_constant === 'GA108_CATALOG_RAW', 'catalog constant mismatch');

const ids = new Set();
const profileIds = new Set();
const namespaces = new Set();
const labels = new Set();
const categoryCounts = new Map();

roster.entries.forEach((entry, index) => {
  const expected = String(index + 1).padStart(3, '0');
  assert(entry.gaId === expected, 'GA108 IDs must remain continuous/frozen at ' + expected);
  assert(entry.profileId === 'ga108:' + entry.gaId, 'profileId mismatch: ' + entry.gaId);
  assert(entry.memoryNamespace === 'genius.ga108.' + entry.gaId, 'memory namespace mismatch: ' + entry.gaId);
  assert(entry.authority === 'NONE', 'profile must not carry authority: ' + entry.gaId);
  assert(entry.modelBinding === null, 'profile must not reserve a model: ' + entry.gaId);
  assert(['PERSON','SCHOOL','KNOWLEDGE_TRADITION'].includes(entry.nodeType), 'invalid nodeType: ' + entry.gaId);
  assert(!ids.has(entry.gaId), 'duplicate gaId: ' + entry.gaId);
  assert(!profileIds.has(entry.profileId), 'duplicate profileId: ' + entry.profileId);
  assert(!namespaces.has(entry.memoryNamespace), 'duplicate memory namespace: ' + entry.memoryNamespace);
  assert(!labels.has(entry.label), 'duplicate label: ' + entry.label);
  ids.add(entry.gaId);
  profileIds.add(entry.profileId);
  namespaces.add(entry.memoryNamespace);
  labels.add(entry.label);
  categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);
});

roster.category_order.forEach((category) => {
  assert(categoryCounts.get(category) === 6, 'expected six GA108 entries in category: ' + category);
});
assert(categoryCounts.size === 18, 'unexpected category outside frozen order');

assert(schema.properties.authority.const === 'NONE', 'profile schema must prohibit authority');
assert(schema.properties.modelBinding.type === 'null', 'profile schema must prohibit fixed model binding');

console.log('GA108 stable roster: PASS · 108 profiles · 18 categories');
