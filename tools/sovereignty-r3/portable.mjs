// Sovereignty R3 R0: explicit staging -> portable JSONL; not wired into Vessie's runtime.
import { createHash } from "node:crypto";

export const SCHEMA = "spv.sovereignty.records.v0.1";
export const STAGING_SCHEMA = "spv.sovereignty.staging.v0.1";
const TYPES = new Set(["memory", "conversation", "message", "work_object"]);
const SOURCES = new Set(["synthetic_fixture", "operator_staged", "runtime_adapter_unverified"]);
const MAX_RECORDS = 500;
const MAX_BYTES = 2_000_000;

export function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function fail(message) { throw new Error(message); }
function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(label + ": expected object");
  return value;
}
function fields(value, required, optional, label) {
  object(value, label);
  for (const key of required) if (!Object.hasOwn(value, key)) fail(label + ": missing " + key);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(label + ": forbidden field " + key);
}
function string(value, label, maxLength, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > maxLength) fail(label + ": invalid string");
  return value;
}
function date(value, label) {
  string(value, label, 32);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail(label + ": expected UTC ISO date");
  return value;
}
function recordCore(record) {
  fields(record, ["kind", "id", "created_at", "updated_at", "title", "text", "parent_id", "provenance"], [], "record");
  if (!TYPES.has(record.kind)) fail("record: unknown kind");
  string(record.id, "record.id", 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(record.id)) fail("record.id: invalid identifier");
  date(record.created_at, "record.created_at");
  date(record.updated_at, "record.updated_at");
  if (Date.parse(record.updated_at) < Date.parse(record.created_at)) fail("record: updated before created");
  string(record.title, "record.title", 240, true);
  if (/[\r\n]/.test(record.title)) fail("record.title: single line only");
  string(record.text, "record.text", 20000, true);
  if (!record.title && !record.text) fail("record: title or text required");
  if (record.parent_id !== null) string(record.parent_id, "record.parent_id", 128);
  if (record.parent_id !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(record.parent_id)) fail("record.parent_id invalid");
  fields(record.provenance, ["source", "source_id", "status"], [], "record.provenance");
  if (!SOURCES.has(record.provenance.source)) fail("record.provenance: unknown source");
  string(record.provenance.source_id, "record.provenance.source_id", 128);
  if (record.provenance.status !== "DECLARED_UNVERIFIED") fail("record.provenance: requires DECLARED_UNVERIFIED");
  return record;
}
function packedLine(record) {
  const core = recordCore(record);
  return JSON.stringify({ schema: SCHEMA, ...core, checksum_sha256: sha256(JSON.stringify({ schema: SCHEMA, ...core })) });
}
export function pack(staging) {
  fields(staging, ["schema", "exported_at", "records"], [], "staging");
  if (staging.schema !== STAGING_SCHEMA) fail("staging: unsupported schema");
  date(staging.exported_at, "staging.exported_at");
  if (!Array.isArray(staging.records) || staging.records.length > MAX_RECORDS) fail("staging: invalid record count");
  const ids = new Set();
  const lines = staging.records.map((record, i) => {
    const core = recordCore(record);
    if (ids.has(core.id)) fail("staging: duplicate id " + core.id);
    ids.add(core.id);
    return packedLine(core);
  });
  const body = lines.length ? lines.join("\n") + "\n" : "";
  const manifest = { schema: SCHEMA, kind: "manifest", exported_at: staging.exported_at, record_count: lines.length, records_sha256: sha256(body), authority: "NONE" };
  const output = JSON.stringify(manifest) + "\n" + body;
  if (Buffer.byteLength(output, "utf8") > MAX_BYTES) fail("archive: exceeds size cap");
  return output;
}
export function verify(archive) {
  if (typeof archive !== "string" || Buffer.byteLength(archive, "utf8") > MAX_BYTES) fail("archive: exceeds size cap");
  const normalized = archive.replace(/\r\n/g, "\n");
  if (!normalized.endsWith("\n") || normalized.includes("\r")) fail("archive: invalid line ending");
  const lines = normalized.slice(0, -1).split("\n");
  if (lines.length < 1 || lines.some(x => !x)) fail("archive: blank line");
  let manifest;
  try { manifest = JSON.parse(lines[0]); } catch { fail("archive: invalid manifest JSON"); }
  fields(manifest, ["schema", "kind", "exported_at", "record_count", "records_sha256", "authority"], [], "manifest");
  if (manifest.schema !== SCHEMA || manifest.kind !== "manifest" || manifest.authority !== "NONE") fail("manifest: invalid identity/authority");
  date(manifest.exported_at, "manifest.exported_at");
  if (!Number.isInteger(manifest.record_count) || manifest.record_count < 0 || manifest.record_count > MAX_RECORDS || manifest.record_count !== lines.length - 1) fail("manifest: count mismatch");
  const body = lines.length > 1 ? lines.slice(1).join("\n") + "\n" : "";
  if (sha256(body) !== manifest.records_sha256) fail("manifest: content digest mismatch");
  const ids = new Set();
  const records = lines.slice(1).map(line => {
    let item;
    try { item = JSON.parse(line); } catch { fail("archive: invalid record JSON"); }
    fields(item, ["schema", "kind", "id", "created_at", "updated_at", "title", "text", "parent_id", "provenance", "checksum_sha256"], [], "archived record");
    if (item.schema !== SCHEMA) fail("record: invalid schema");
    const { schema, checksum_sha256, ...core } = item;
    recordCore(core);
    if (sha256(JSON.stringify({ schema, ...core })) !== checksum_sha256) fail("record: checksum mismatch");
    if (ids.has(core.id)) fail("archive: duplicate id");
    ids.add(core.id);
    return core;
  });
  return { manifest, records };
}
export function markdown(archive) {
  const { manifest, records } = verify(archive);
  const lines = ["# Portable Vessel records", "", "Schema: " + SCHEMA, "Exported at: " + manifest.exported_at, "Records: " + records.length, "", "This human-readable copy is not an authority or credential export.", ""];
  for (const item of records) {
    lines.push("## " + item.kind + ": " + (item.title || item.id), "", "- Record ID: " + item.id, "- Created: " + item.created_at, "- Updated: " + item.updated_at, "- Parent: " + (item.parent_id || "none"), "- Source: " + item.provenance.source + " (" + item.provenance.status + ")", "- Source ID: " + item.provenance.source_id, "");
    const matches = item.text.match(/`+/g) || [];
    const longest = Math.max(3, ...matches.map(x => x.length));
    const fence = "`".repeat(longest + 1);
    lines.push(fence + "text", item.text, fence, "");
  }
  return lines.join("\n");
}
