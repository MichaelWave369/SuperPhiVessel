// Pure browser-compatible Sovereignty R3 R2 adapter.
// Mirrors the R0/R1 explicitly staged contract; no runtime/browser-storage access.
const SCHEMA = "spv.sovereignty.records.v0.1";
const MAPPING_SCHEMA = "spv.sovereignty.operator-map.v0.1";
const TYPES = new Set(["conversation", "message", "memory", "work_object"]);
const SOURCES = new Set(["synthetic_fixture", "operator_staged", "runtime_adapter_unverified"]);
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const SENSITIVE = /(?:passw(?:or)?d|api.?key|bearer|token|secret|private.?key|credential|lease|grant|authorization|permissions?|session.?key)/i;
const isoUtc = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const digestFormat = /^[0-9a-f]{64}$/;
const MAX_SOURCE = 2_000_000;
const MAX_OUTPUT = 2_000_000;
const MAX_RECORDS = 500;
const encoder = new TextEncoder();

function refuse(message) { throw new Error(message); }
function validObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) refuse(label + ": must be an object");
  return value;
}
function exactKeys(value, keys, label) {
  validObject(value, label);
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) refuse(label + ": unexpected or missing fields");
}
function plainString(value, label, limit, allowEmpty = false) {
  if (typeof value !== "string" || value.length > limit || (!allowEmpty && !value.trim())) refuse(label + ": invalid string");
  return value;
}
function utcDate(value, label) {
  plainString(value, label, 32);
  if (!isoUtc.test(value) || !Number.isFinite(Date.parse(value))) refuse(label + ": expected an ISO UTC date");
  return value;
}
function stableId(value, label) {
  plainString(value, label, 128);
  if (!identifier.test(value)) refuse(label + ": invalid identifier");
  return value;
}
function segments(value, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) refuse(label + ": path must have 1–8 components");
  for (const part of value) {
    plainString(part, label + " segment", 80);
    if (FORBIDDEN.has(part) || SENSITIVE.test(part)) refuse(label + ": sensitive or reserved field");
  }
  return value;
}
function ownPath(value, path, label) {
  let here = value;
  for (const part of path) {
    if (here === null || typeof here !== "object" || Array.isArray(here) || !Object.hasOwn(here, part)) refuse(label + ": missing mapped field");
    here = here[part];
  }
  return here;
}
function mapped(item, path, label, optional = false) {
  if (path === null) {
    if (!optional) refuse(label + ": field not mapped");
    return null;
  }
  return ownPath(item, segments(path, label), label);
}
function sourceObject(sourceText) {
  if (typeof sourceText !== "string" || encoder.encode(sourceText).byteLength > MAX_SOURCE) refuse("source: exceeds 2 MB");
  let obj;
  try { obj = JSON.parse(sourceText); } catch { refuse("source: invalid JSON"); }
  return validObject(obj, "source");
}
function mappingObject(config) {
  exactKeys(config, ["schema", "source_sha256", "exported_at", "collections"], "mapping");
  if (config.schema !== MAPPING_SCHEMA || !digestFormat.test(config.source_sha256)) refuse("mapping: schema or digest invalid");
  utcDate(config.exported_at, "mapping.exported_at");
  if (!Array.isArray(config.collections) || config.collections.length < 1 || config.collections.length > 8) refuse("mapping: invalid collections count");
  for (const collection of config.collections) {
    exactKeys(collection, ["kind", "source_id", "items_path", "parent_kind", "fields"], "collection");
    if (!TYPES.has(collection.kind)) refuse("collection: unsupported kind");
    stableId(collection.source_id, "collection.source_id");
    segments(collection.items_path, "collection.items_path");
    if (collection.parent_kind !== null && !TYPES.has(collection.parent_kind)) refuse("collection.parent_kind unsupported");
    exactKeys(collection.fields, ["id", "title", "text", "created_at", "updated_at", "parent_id"], "collection.fields");
    for (const name of ["id", "title", "text", "created_at", "updated_at"]) segments(collection.fields[name], "fields." + name);
    if (collection.fields.parent_id !== null) segments(collection.fields.parent_id, "fields.parent_id");
    if ((collection.fields.parent_id === null) !== (collection.parent_kind === null)) refuse("parent_kind and parent_id must be set together");
  }
  return config;
}
function recordCheck(record) {
  exactKeys(record, ["kind", "id", "created_at", "updated_at", "title", "text", "parent_id", "provenance"], "record");
  if (!TYPES.has(record.kind)) refuse("record.kind invalid");
  stableId(record.id, "record.id");
  utcDate(record.created_at, "record.created_at");
  utcDate(record.updated_at, "record.updated_at");
  if (Date.parse(record.updated_at) < Date.parse(record.created_at)) refuse("record: updated before created");
  plainString(record.title, "record.title", 240, true);
  if (/[\r\n]/.test(record.title)) refuse("record.title: single line only");
  plainString(record.text, "record.text", 20_000, true);
  if (!record.title && !record.text) refuse("record: title and text cannot both be empty");
  if (record.parent_id !== null) stableId(record.parent_id, "record.parent_id");
  exactKeys(record.provenance, ["source", "source_id", "status"], "record.provenance");
  if (!SOURCES.has(record.provenance.source) || record.provenance.status !== "DECLARED_UNVERIFIED") refuse("record provenance invalid");
  stableId(record.provenance.source_id, "record.provenance.source_id");
}
export async function sha256(text, subtle = globalThis.crypto?.subtle) {
  if (!subtle || typeof subtle.digest !== "function") refuse("SHA-256 unavailable in this browser; use a secure context");
  const digest = await subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
export function inspectShape(sourceText) {
  const obj = sourceObject(sourceText);
  const entries = [];
  const walk = (value, label, depth) => {
    if (entries.length >= 150) return;
    if (Array.isArray(value)) {
      entries.push({path: label, type: "array", count: value.length});
      if (depth < 4 && value[0] && typeof value[0] === "object" && !Array.isArray(value[0])) walk(value[0], label + ".[first]", depth + 1);
    } else if (value !== null && typeof value === "object") {
      entries.push({path: label, type: "object", fields: Object.keys(value).length});
      if (depth < 4) for (const key of Object.keys(value).slice(0, 30)) {
        if (entries.length >= 150) break;
        walk(value[key], label === "$" ? "$." + key : label + "." + key, depth + 1);
      }
    } else {
      entries.push({path: label, type: value === null ? "null" : typeof value});
    }
  };
  walk(obj, "$", 0);
  return {entries, truncated: entries.length >= 150};
}
export async function convert(sourceText, mappingText, subtle = globalThis.crypto?.subtle) {
  const input = sourceObject(sourceText);
  if (typeof mappingText !== "string" || encoder.encode(mappingText).byteLength > 100_000) refuse("mapping: exceeds 100 KB");
  let mapping;
  try { mapping = JSON.parse(mappingText); } catch { refuse("mapping: invalid JSON"); }
  mappingObject(mapping);
  if (await sha256(sourceText, subtle) !== mapping.source_sha256) refuse("mapping: source SHA-256 mismatch");
  const records = [];
  const ids = new Set();
  for (const collection of mapping.collections) {
    const items = ownPath(input, collection.items_path, "collection.items_path");
    if (!Array.isArray(items) || items.length + records.length > MAX_RECORDS) refuse("collection: expected bounded array");
    const fields = collection.fields;
    for (const item of items) {
      validObject(item, "collection item");
      const unique = stableId(mapped(item, fields.id, "id"), "mapped id");
      const title = mapped(item, fields.title, "title");
      const text = mapped(item, fields.text, "text");
      const createdAt = mapped(item, fields.created_at, "created_at");
      const updatedAt = mapped(item, fields.updated_at, "updated_at");
      if ([title, text, createdAt, updatedAt].some(value => typeof value !== "string")) refuse("mapped fields: expected string");
      const rawParent = mapped(item, fields.parent_id, "parent_id", true);
      const parentId = rawParent === null ? null : collection.parent_kind + ":" + stableId(rawParent, "mapped parent");
      const record = {kind: collection.kind, id: collection.kind + ":" + unique, created_at: createdAt, updated_at: updatedAt, title, text, parent_id: parentId, provenance: {source: "runtime_adapter_unverified", source_id: collection.source_id, status: "DECLARED_UNVERIFIED"}};
      recordCheck(record);
      if (ids.has(record.id)) refuse("record: duplicate id");
      ids.add(record.id);
      records.push(record);
    }
  }
  const lines = [];
  for (const record of records) {
    const body = {schema: SCHEMA, ...record};
    lines.push(JSON.stringify({...body, checksum_sha256: await sha256(JSON.stringify(body), subtle)}));
  }
  const recordsBody = lines.length ? lines.join("\n") + "\n" : "";
  const manifest = {schema: SCHEMA, kind: "manifest", exported_at: mapping.exported_at, record_count: records.length, records_sha256: await sha256(recordsBody, subtle), authority: "NONE"};
  const archive = JSON.stringify(manifest) + "\n" + recordsBody;
  if (encoder.encode(archive).byteLength > MAX_OUTPUT) refuse("archive: exceeds 2 MB");
  return {archive, record_count: records.length, kinds: Object.fromEntries([...TYPES].map(kind => [kind, records.filter(r => r.kind === kind).length]))};
}
