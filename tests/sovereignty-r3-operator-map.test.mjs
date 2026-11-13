import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { checksum, inspectShape, mapToPortable, MAPPING_SCHEMA } from "../tools/sovereignty-r3/operator-map.mjs";
import { verify } from "../tools/sovereignty-r3/portable.mjs";
const fixturePath = fileURLToPath(new URL("./fixtures/sovereignty-r3-operator-source.synthetic.json", import.meta.url));
const cli = fileURLToPath(new URL("../tools/sovereignty-r3/operator-map-cli.mjs", import.meta.url));
const source = () => readFileSync(fixturePath, "utf8");
function mapping(raw = source()) {
  const standardFields = {
    id: ["uid"], title: ["label"], text: ["body"],
    created_at: ["first_seen"], updated_at: ["last_seen"], parent_id: null
  };
  return {
    schema: MAPPING_SCHEMA,
    source_sha256: checksum(raw),
    exported_at: "2026-11-13T19:00:00Z",
    collections: [
      { kind: "conversation", source_id: "test-export-v1", items_path: ["conversations"], parent_kind: null, fields: standardFields },
      { kind: "message", source_id: "test-export-v1", items_path: ["messages"], parent_kind: "conversation", fields: { ...standardFields, parent_id: ["conversation_uid"] } },
      { kind: "memory", source_id: "test-export-v1", items_path: ["memories"], parent_kind: null, fields: standardFields }
    ]
  };
}
test("redacted inspector reports only shape and explicit source binding, never field values", () => {
  const report = JSON.stringify(inspectShape(source()));
  assert.match(report, /source_sha256/);
  assert.match(report, /conversations/);
  assert.match(report, /provider_token/);
  assert.doesNotMatch(report, /SYNTHETIC_EXCLUDED_SENTINEL_9832/);
  assert.doesNotMatch(report, /Imaginary gardens can drift/);
  assert.doesNotMatch(report, /floating gardens/);
  assert.doesNotMatch(report, /invalid.example/);
});
test("explicitly mapped synthetic records round-trip through independent R0 JSONL", () => {
  const out = mapToPortable(source(), mapping());
  const verified = verify(out);
  assert.equal(verified.records.length, 3);
  assert.deepEqual(verified.records.map(r => r.kind), ["conversation", "message", "memory"]);
  assert.equal(verified.records[1].parent_id, "conversation:conv-one");
  assert.equal(verified.records[1].text, "Imaginary gardens can drift between cloud islands.");
  assert.equal(verified.records[2].provenance.status, "DECLARED_UNVERIFIED");
  assert.equal(verified.records[2].provenance.source, "runtime_adapter_unverified");
  assert.doesNotMatch(out, /SYNTHETIC_EXCLUDED_SENTINEL_9832/);
  assert.doesNotMatch(out, /invalid.example/);
  assert.equal(mapToPortable(source(), mapping()), out, "same pinned source + map produces identical archive");
});
test("mapping refuses changed source, secret paths, unsafe path keys and unrecognized authority", () => {
  const map = mapping();
  assert.throws(() => mapToPortable(source() + " ", map), /source file changed/);
  const bad = mapping();
  bad.collections[0].fields.text = ["external_settings", "provider_token"];
  assert.throws(() => mapToPortable(source(), bad), /sensitive field name/);
  const unsafe = mapping();
  unsafe.collections[0].items_path = ["__proto__"];
  assert.throws(() => mapToPortable(source(), unsafe), /reserved/);
  const privileged = mapping();
  privileged.collections[0].authority = "EXECUTE";
  assert.throws(() => mapToPortable(source(), privileged), /wrong keys/);
  const invalidDate = mapping();
  invalidDate.exported_at = "yesterday";
  assert.throws(() => mapToPortable(source(), invalidDate), /UTC ISO date/);
});
test("malformed mappings, missing collections, unbound parents and duplicate IDs fail closed", () => {
  const c = mapping();
  c.collections[1].parent_kind = null;
  assert.throws(() => mapToPortable(source(), c), /both set or both null/);
  const wrong = mapping();
  wrong.collections[0].items_path = ["not_there"];
  assert.throws(() => mapToPortable(source(), wrong), /missing own field/);
  const list = mapping();
  list.collections[0].items_path = ["external_settings"];
  assert.throws(() => mapToPortable(source(), list), /expected bounded collection array/);
  const duplicateSource = JSON.parse(source());
  duplicateSource.memories.push({ ...duplicateSource.memories[0] });
  const changed = JSON.stringify(duplicateSource);
  const duplicateMap = mapping(changed);
  assert.throws(() => mapToPortable(changed, duplicateMap), /duplicate id/);
});
test("operator CLI converts only to newly created local file and refuses to overwrite", () => {
  const tmp = mkdtempSync(join(tmpdir(), "spv-r3-map-"));
  try {
    const mappingFile = join(tmp, "mapping.json");
    const out = join(tmp, "owned-records.jsonl");
    writeFileSync(mappingFile, JSON.stringify(mapping()), { flag: "wx" });
    const inspect = execFileSync(process.execPath, [cli, "inspect", fixturePath], { encoding: "utf8", cwd: tmp, timeout: 10000 });
    assert.doesNotMatch(inspect, /SYNTHETIC_EXCLUDED_SENTINEL_9832/);
    const status = execFileSync(process.execPath, [cli, "convert", fixturePath, mappingFile, out], { encoding: "utf8", cwd: tmp, timeout: 10000 });
    assert.match(status, /Converted approved fields/);
    assert.equal(verify(readFileSync(out, "utf8")).records.length, 3);
    const repeated = spawnSync(process.execPath, [cli, "convert", fixturePath, mappingFile, out], { encoding: "utf8", cwd: tmp, timeout: 10000 });
    assert.notEqual(repeated.status, 0);
    assert.match(repeated.stderr, /refused/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
