const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'runtime', 'MANIFEST.json'), 'utf8')
);
const runtimePath = process.env.PV_RUNTIME_FILE ||
  path.join(__dirname, '..', manifest.runtime.path);
const html = fs.readFileSync(runtimePath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function count(needle) {
  return html.split(needle).length - 1;
}

const handlers = [
  ['exportKeyring', 'const exportKeyring=function(){', 'onClick:exportKeyring'],
  ['autoAssignOllama', 'const autoAssignOllama=function', 'onClick:autoAssignOllama'],
  ['applyOllamaStabilityPreset', 'const applyOllamaStabilityPreset=function', 'onClick:applyOllamaStabilityPreset']
];

for (const [name, definition, binding] of handlers) {
  assert(count(definition) === 1, name + ' must have exactly one implementation');
  assert(count(binding) >= 1, name + ' has no Service / Models binding');
  assert(html.indexOf(definition) < html.indexOf(binding), name + ' must be defined before its render binding');
}

assert(html.includes('PV-SERVICE-MODELS-REPAIR-0.2'), 'service/models repair protocol marker missing');
assert(html.includes("schema:'phivessel-portable-keyring'"), 'portable keyring schema missing');
assert(html.includes('Portable Keyring export contains your provider API keys in PLAINTEXT.'), 'plaintext keyring warning missing');
assert(html.includes('const importKeyringFile=function(file){'), 'portable keyring import handler missing');

console.log('service-models-render: PASS');
