import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import { convert, sha256, inspectShape } from "../site/sovereignty/portable-web.mjs";
import { checksum, mapToPortable } from "../tools/sovereignty-r3/operator-map.mjs";
import { verify } from "../tools/sovereignty-r3/portable.mjs";
import { parseFile } from "../tools/sovereignty-r3/reader.mjs";

const file = (relative) => readFileSync(new URL("../" + relative, import.meta.url), "utf8");
const fixture = file("tests/fixtures/sovereignty-r3-operator-source.synthetic.json");
const subtle = webcrypto.subtle;
function mapping(source = fixture) {
  const fields = {id: ["uid"], title: ["label"], text: ["body"], created_at: ["first_seen"], updated_at: ["last_seen"], parent_id: null};
  return {
    schema: "spv.sovereignty.operator-map.v0.1",
    source_sha256: checksum(source),
    exported_at: "2026-11-13T19:00:00Z",
    collections: [
      {kind: "conversation", source_id: "test-export-v1", items_path: ["conversations"], parent_kind: null, fields},
      {kind: "message", source_id: "test-export-v1", items_path: ["messages"], parent_kind: "conversation", fields: {...fields, parent_id: ["conversation_uid"]}},
      {kind: "memory", source_id: "test-export-v1", items_path: ["memories"], parent_kind: null, fields}
    ]
  };
}
test("browser WebCrypto output matches the independent Node R1/R0 exporter byte for byte", async () => {
  const map = mapping();
  assert.equal(await sha256(fixture, subtle), map.source_sha256);
  const browser = await convert(fixture, JSON.stringify(map), subtle);
  const node = mapToPortable(fixture, map);
  assert.equal(browser.archive, node);
  const parsed = verify(browser.archive);
  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.records[1].parent_id, "conversation:conv-one");
  assert.deepEqual(browser.kinds, {conversation:1, message:1, memory:1, work_object:0});
  assert.doesNotMatch(browser.archive, /SYNTHETIC_EXCLUDED_SENTINEL_9832/);
  assert.doesNotMatch(browser.archive, /invalid.example/);
});
test("inspection never surfaces field values but may show source field names", () => {
  const s = JSON.stringify(inspectShape(fixture));
  assert.match(s, /provider_token/);
  assert.match(s, /conversations/);
  assert.doesNotMatch(s, /SYNTHETIC_EXCLUDED_SENTINEL_9832/);
  assert.doesNotMatch(s, /Imaginary gardens can drift/);
  assert.doesNotMatch(s, /invalid.example/);
});
test("a changed source file, forbidden paths and injected authority fail closed", async () => {
  const map = mapping();
  await assert.rejects(convert(fixture+" ", JSON.stringify(map), subtle), /SHA-256 mismatch/);
  const reserved = mapping();
  reserved.collections[0].fields.text = ["provider_token"];
  await assert.rejects(convert(fixture, JSON.stringify(reserved), subtle), /sensitive or reserved/);
  const priv = mapping();
  priv.collections[0].source_id = "fine";
  priv.collections[0].permissions = ["WRITE"];
  await assert.rejects(convert(fixture, JSON.stringify(priv), subtle), /unexpected or missing fields/);
  const unsupported = mapping();
  unsupported.collections[0].items_path = ["__proto__"];
  await assert.rejects(convert(fixture, JSON.stringify(unsupported), subtle), /sensitive or reserved/);
  await assert.rejects(convert(fixture, "{invalid", subtle), /invalid JSON/);
});
test("size limits, duplicates and timestamp policy reject unsafe output", async () => {
  await assert.rejects(convert("x".repeat(2_000_001), JSON.stringify(mapping()), subtle), /exceeds 2 MB/);
  await assert.rejects(convert(fixture, " ".repeat(100_001), subtle), /exceeds 100 KB/);
  const dupe = JSON.parse(fixture);
  dupe.memories.push({...dupe.memories[0]});
  const dupeText = JSON.stringify(dupe);
  await assert.rejects(convert(dupeText, JSON.stringify(mapping(dupeText)), subtle), /duplicate id/);
  const changed = JSON.parse(fixture);
  changed.messages[0].first_seen = "unknown date";
  const changedText = JSON.stringify(changed);
  await assert.rejects(convert(changedText, JSON.stringify(mapping(changedText)), subtle), /expected an ISO UTC date/);
});
test("browser page restricts network and requires explicit source file, mapping and approval", () => {
  const html = file("site/sovereignty/index.html");
  const ui = file("site/sovereignty/workbench.js");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /default-src 'none'/);
  for (const id of ["sourceFile","mappingFile","consent","inspectButton","convertButton","downloadLink","inspection","statusMessage"]) {
    assert.ok(html.includes('id="' + id + '"'), "missing control: " + id);
  }
  assert.match(html, /type="module" src="\.\/workbench\.js"/);
  assert.match(ui, /consentInput\.checked/);
  assert.match(ui, /new Blob/);
  assert.match(ui, /URL\.createObjectURL/);
  assert.match(ui, /URL\.revokeObjectURL/);
  assert.doesNotMatch(ui, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\blocalStorage\b|\bindexedDB\b/i);
  assert.doesNotMatch(file("site/sovereignty/portable-web.mjs"), /\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\blocalStorage\b|\bindexedDB\b/i);
});
