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
const crosswalkPath = path.join(root, 'protocols', 'dlam-v0.1', 'ownership-crosswalk.json');
const scmSourcePath = path.join(root, 'protocols', 'dlam-v0.1', 'scm-v0.8-source.json');

const protocol = fs.readFileSync(protocolPath, 'utf8');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const capsule = JSON.parse(fs.readFileSync(capsulePath, 'utf8'));
const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
const crosswalk = JSON.parse(fs.readFileSync(crosswalkPath, 'utf8'));
const scmSource = JSON.parse(fs.readFileSync(scmSourcePath, 'utf8'));

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
assert(inventory.p0_exit && inventory.p0_exit.complete === true, 'P0 exit must be complete after roster, crosswalk, and SCM source mapping are frozen');
assert(!inventory.unresolved.some((x) => x.id === 'P0-OPEN-01'), 'resolved Genius roster blocker must not remain unresolved');
assert(Array.isArray(inventory.resolved) && inventory.resolved.some((x) => x.id === 'P0-OPEN-01' && /108/.test(x.resolution || '')), 'resolved Genius roster receipt missing');
assert(inventory.genius_roster && inventory.genius_roster.count === 108, 'canonical GA108 inventory binding missing');
assert(inventory.p0_exit && inventory.p0_exit.progress && inventory.p0_exit.progress.stable_genius_roster_ids === true, 'stable Genius roster progress not recorded');
assert(inventory.p0_exit.progress.scm_v0_8_mapping === true, 'SCM v0.8 source mapping must be complete');
assert(!inventory.unresolved.some((x) => x.id === 'P0-OPEN-02'), 'resolved SCM source blocker must not remain unresolved');
assert(inventory.resolved.some((x) => x.id === 'P0-OPEN-02' && x.source_sha256 === 'cf55a10e16772e302464b7d9a4630c7d2d795bb48e727f59cea06543d6b7a7d3'), 'SCM source resolution receipt missing');

assert(crosswalk.schema === 'superphivessel.dlam.ownership-crosswalk.v0.1', 'ownership crosswalk schema mismatch');
assert(crosswalk.protocol === 'PV-DLAM-0.1', 'ownership crosswalk protocol mismatch');
assert(crosswalk.runtime_wiring === false, 'ownership crosswalk must remain unwired in P0');
assert(crosswalk.status === 'P0_FROZEN_BASELINE', 'ownership crosswalk must be frozen at P0 exit');
const owners = crosswalk.target_stack || {};
assert(owners.orchestration.owner_system === 'SuperPhiVessel', 'SuperPhiVessel orchestration ownership missing');
assert(owners.governed_memory_and_execution_boundary.owner_system === 'PhiOS', 'PhiOS target governed-memory ownership missing');
assert(owners.p1_reference_service.owner_system === 'BrainC', 'BrainC P1 reference-service role missing');
assert(owners.epistemic_and_relational_views.owner_system === 'NestedBubbleGear', 'NBG view ownership missing');
assert(owners.peer_transport.owner_system === 'Infinite-Porch', 'Infinite Porch transport role missing');
assert(crosswalk.invariants.some((x) => /No integration may create two writable canonical memory truths/i.test(x)), 'single canonical writable truth invariant missing');
assert(crosswalk.invariants.some((x) => /evidence transport does not transport authority/i.test(x)), 'transport authority boundary missing');

assert(scmSource.schema === 'superphivessel.dlam.source-map.v0.1', 'SCM source-map schema mismatch');
assert(scmSource.protocol === 'PV-DLAM-0.1', 'SCM source-map protocol mismatch');
assert(scmSource.filename === 'Sovereign_Continuity_Memory_Master_Spec_v0_8.docx', 'SCM v0.8 source filename mismatch');
assert(scmSource.sha256 === 'cf55a10e16772e302464b7d9a4630c7d2d795bb48e727f59cea06543d6b7a7d3', 'SCM v0.8 source hash mismatch');
assert(scmSource.canonical_repository && scmSource.canonical_repository.established === false, 'SCM source map must not invent a canonical repository');
assert(scmSource.public_repository_policy && scmSource.public_repository_policy.source_bytes_committed === false, 'internal SCM source bytes must not be mirrored by P0');

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
