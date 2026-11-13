import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { pack, verify, markdown, SCHEMA, STAGING_SCHEMA } from "../tools/sovereignty-r3/portable.mjs";
import { parseFile } from "../tools/sovereignty-r3/reader.mjs";

const fixturePath = fileURLToPath(new URL("./fixtures/sovereignty-r3-synthetic-staging.json", import.meta.url));
const readerPath = fileURLToPath(new URL("../tools/sovereignty-r3/reader.mjs", import.meta.url));
const packerPath = fileURLToPath(new URL("../tools/sovereignty-r3/pack-cli.mjs", import.meta.url));
const fixture = () => JSON.parse(readFileSync(fixturePath, "utf8"));

test("portable JSONL retains all four record types, textual fields and provenance", () => {
  const prepared = fixture();
  assert.equal(prepared.schema, STAGING_SCHEMA);
  const archive = pack(prepared);
  const data = verify(archive);
  assert.equal(data.manifest.schema, SCHEMA);
  assert.equal(data.manifest.authority, "NONE");
  assert.equal(data.records.length, 4);
  assert.deepEqual(data.records.map(r => r.kind), ["conversation", "message", "memory", "work_object"]);
  for (const [i, record] of data.records.entries()) {
    assert.equal(record.text, prepared.records[i].text);
    assert.equal(record.created_at, prepared.records[i].created_at);
    assert.equal(record.updated_at, prepared.records[i].updated_at);
    assert.deepEqual(record.provenance, prepared.records[i].provenance);
    assert.equal(record.parent_id, prepared.records[i].parent_id);
  }
  assert.equal(pack(prepared), archive, "same staging data must produce identical byte output");
  const md = markdown(archive);
  assert.match(md, /Portable Vessel records/);
  assert.match(md, /Imaginary garden/);
  assert.match(md, /not an authority/i);
});

test("archives refuse corruption, duplicate identities, unsupported fields and false authority", () => {
  const valid = pack(fixture());
  assert.throws(() => verify(valid.replace("Imaginary garden", "Altered garden")), /digest mismatch/);
  assert.throws(() => verify(valid.replace('"authority":"NONE"', '"authority":"EXECUTE"')), /manifest: invalid/);
  assert.throws(() => verify(valid.replace('"record_count":4', '"record_count":3')), /count mismatch/);
  assert.throws(() => verify(valid.slice(0, -1)), /line ending/);
  const duplicate = fixture();
  duplicate.records[1].id = duplicate.records[0].id;
  assert.throws(() => pack(duplicate), /duplicate id/);
  const hostile = fixture();
  hostile.records[0].executor_grant = { approved: true };
  assert.throws(() => pack(hostile), /forbidden field executor_grant/);
  const secret = fixture();
  secret.records[0].provenance.api_key = "NOT_A_REAL_SECRET";
  assert.throws(() => pack(secret), /forbidden field api_key/);
  const outOfOrder = fixture();
  outOfOrder.records[0].updated_at = "2026-01-01T00:00:00Z";
  assert.throws(() => pack(outOfOrder), /updated before created/);
});

test("independent reader works from a fresh, non-SPV directory without importing this repository", () => {
  const temp = mkdtempSync(join(tmpdir(), "spv-sovereignty-r3-"));
  try {
    const archivePath = join(temp, "records.jsonl");
    const detachedReader = join(temp, "reader.mjs");
    const mdPath = join(temp, "records.md");
    writeFileSync(archivePath, pack(fixture()), { flag: "wx", mode: 0o600 });
    copyFileSync(readerPath, detachedReader);
    const result = execFileSync(process.execPath, [detachedReader, "verify", archivePath], { cwd: temp, encoding: "utf8", timeout: 10000 });
    const status = JSON.parse(result);
    assert.equal(status.status, "VALID_INTERNAL_CHECKSUMS_ONLY");
    assert.equal(status.records, 4);
    assert.equal(status.authority, "NONE");
    assert.equal(parseFile(archivePath).records.length, 4);
    execFileSync(process.execPath, [detachedReader, "markdown", archivePath, mdPath], { cwd: temp, encoding: "utf8", timeout: 10000 });
    assert.ok(existsSync(mdPath));
    assert.match(readFileSync(mdPath, "utf8"), /Fictional subject prefers native plants/);
    const second = spawnSync(process.execPath, [detachedReader, "markdown", archivePath, mdPath], { cwd: temp, encoding: "utf8", timeout: 10000 });
    assert.notEqual(second.status, 0, "reader must not replace existing files");
    assert.match(second.stderr, /refused/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("packer requires explicit file paths and refuses to replace existing exports", () => {
  const temp = mkdtempSync(join(tmpdir(), "spv-sovereignty-export-"));
  try {
    const exportPath = join(temp, "owned.jsonl");
    const first = execFileSync(process.execPath, [packerPath, "pack", fixturePath, exportPath], { cwd: temp, encoding: "utf8", timeout: 10000 });
    assert.match(first, /Created 4 portable records/);
    assert.equal(verify(readFileSync(exportPath, "utf8")).records.length, 4);
    const repeat = spawnSync(process.execPath, [packerPath, "pack", fixturePath, exportPath], { cwd: temp, encoding: "utf8", timeout: 10000 });
    assert.notEqual(repeat.status, 0);
    assert.match(repeat.stderr, /refused/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("no real credentials, sessions or unrelated authority are bundled in source examples", () => {
  const fixtureText = readFileSync(fixturePath, "utf8");
  assert.doesNotMatch(fixtureText, /Bearer\s+[a-z0-9._-]+/i);
  assert.doesNotMatch(fixtureText, /PRIVATE KEY/);
  assert.doesNotMatch(fixtureText, /"password"\s*:/);
  assert.equal(fixture().records.every(r => r.provenance.source === "synthetic_fixture"), true);
});
