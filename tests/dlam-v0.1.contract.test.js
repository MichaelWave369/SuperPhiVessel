const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = path.join(__dirname, '..');
const protocolPath = path.join(root, 'protocols', 'dlam-v0.1', 'README.md');
const inventoryPath = path.join(root, 'protocols', 'dlam-v0.1', 'inventory.json');
const capsulePath = path.join(root, 'protocols', 'dlam-v0.1', 'schemas', 'memory-capsule.schema.json');
const contextPath = path.join(root, 'protocols', 'dlam-v0.1', 'schemas', 'context-packet.schema.json');
const routePath = path.join(root, 'protocols', 'dlam-v0.1', 'schemas', 'route-decision.schema.json');

const protocol = fs.readFileSync(protocolPath, 'utf8');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const capsule = JSON.parse(fs.readFileSync(capsulePath, 'utf8'));
const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));

[
  'CAPABILITY ≠ AUTHORITY',
  'MEMORY ≠ FACT',
  'RETRIEVAL ≠ PROMPT ADMISSION',
  'EVIDENCE TRANSPORT DOES NOT TRANSPORT AUTHORITY',
  'FORGETTING OUTRANKS RELEVANCE',
  'EXACT ADMITTED HISTORY OUTRANKS DERIVED VIEWS',
  'A GENIUS IS A ROLE AND CONTINUITY NAMESPACE, NOT A RESERVED MODEL',
  'THE MODEL IS A GUEST'
].forEach((invariant) => assert(protocol.includes(invariant), 'missing invariant: ' + invariant));

assert(protocol.includes('STATIC → SHADOW → QUALIFIED CANDIDATE → OPERATOR-ACTIVATED → ROLLBACKABLE'), 'routing qualification lifecycle missing');
assert(protocol.includes('REGISTER → DUAL-READ → REINDEX → QUALIFY → CUT OVER → ROLLBACK/PURGE'), 'embedding migration lifecycle missing');
assert(protocol.includes('live SQLite/WAL database MUST NOT be replicated'), 'same-host SQLite boundary missing');

assert(inventory.schema === 'superphivessel.dlam.inventory.v0.1', 'inventory schema mismatch');
assert(inventory.protocol === 'PV-DLAM-0.1', 'inventory protocol mismatch');
assert(inventory.runtime_wiring === false, 'P0 must remain unwired');
assert(inventory.p0_exit && inventory.p0_exit.complete === false, 'P0 exit must remain explicitly incomplete until roster/crosswalk work is done');
assert(inventory.unresolved.some((x) => x.id === 'P0-OPEN-01' && /Genius roster/i.test(x.item)), 'full Genius roster unresolved item missing');

const requiredCapsule = new Set(capsule.required || []);
['memory_id','namespace_id','agent_id','origin','source_status','content_ref','sensitivity','allowed_targets','allowed_purposes','retention_rule']
  .forEach((field) => assert(requiredCapsule.has(field), 'memory capsule missing required field: ' + field));
assert(Array.isArray(capsule.properties.origin.enum), 'origin enum missing');
['OBSERVED','VERIFIED','INFERRED','DREAMED','SIMULATED','UNKNOWN']
  .forEach((origin) => assert(capsule.properties.origin.enum.includes(origin), 'origin missing: ' + origin));

assert(context.properties.action_authority && context.properties.action_authority.const === 'NONE', 'context packet must grant no action authority');
assert((context.required || []).includes('authority_decision_ref'), 'context packet must bind current authority decision');

assert(route.properties.authority_granted && route.properties.authority_granted.const === false, 'route receipt must never grant authority');
['eligible_candidates','excluded_candidates','selection_probability','context_manifest_ref','policy_frontier_ref','index_manifest_ref']
  .forEach((field) => assert((route.required || []).includes(field), 'route receipt missing required field: ' + field));

console.log('PV-DLAM-0.1 contract: PASS');
