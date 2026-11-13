// R3 R1: explicitly approved local source mapping, no canonical runtime access.
import { createHash } from "node:crypto";
import { pack, verify, STAGING_SCHEMA } from "./portable.mjs";

export const MAPPING_SCHEMA = "spv.sovereignty.operator-map.v0.1";
const MAX_SOURCE_BYTES = 2_000_000;
const MAX_COLLECTIONS = 8;
const MAX_ITEMS = 500;
const TYPES = new Set(["conversation", "message", "memory", "work_object"]);
const BLOCKED_PATH_COMPONENT = /(?:passw(?:or)?d|api.?key|bearer|token|secret|private.?key|credential|lease|grant|authorization|permissions?|session.?key)/i;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const HEX64 = /^[a-f0-9]{64}$/;

export function checksum(source) {
  return createHash("sha256").update(source, "utf8").digest("hex");
}
function bad(message) { throw new Error(message); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad(label + ": expected object");
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) bad(label + ": wrong keys");
}
function str(value, label, max=128) {
  if (typeof value !== "string" || !value.trim() || value.length > max) bad(label + ": invalid string");
  return value;
}
function path(value, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) bad(label + ": expected bounded path array");
  for (const part of value) {
    str(part, label + " segment", 80);
    if (FORBIDDEN_KEYS.has(part) || BLOCKED_PATH_COMPONENT.test(part)) bad(label + ": reserved/sensitive field name");
  }
  return value;
}
function parse(source) {
  if (typeof source !== "string" || Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) bad("source: too large");
  let obj;
  try { obj = JSON.parse(source); } catch { bad("source: invalid JSON"); }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) bad("source: expected JSON object");
  return obj;
}
function get(obj, segments, label) {
  let cur = obj;
  for (const segment of segments) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur) || !Object.hasOwn(cur, segment)) bad(label + ": missing own field " + segment);
    cur = cur[segment];
  }
  return cur;
}
function field(item, segment, label, required = true) {
  if (segment === null) {
    if (required) bad(label + ": required field not mapped");
    return null;
  }
  return get(item, path(segment, label), label);
}
function id(value, label) {
  str(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) bad(label + ": invalid portable identifier");
  return value;
}
export function inspectShape(source) {
  const obj = parse(source);
  const out = [];
  const walk = (value, label, depth) => {
    if (out.length >= 150) return;
    if (Array.isArray(value)) {
      out.push({ path: label, type: "array", count: value.length });
      if (depth < 4 && value.length > 0 && value[0] && typeof value[0] === "object" && !Array.isArray(value[0])) walk(value[0], label + ".[first]", depth+1);
      return;
    }
    if (value && typeof value === "object") {
      out.push({ path: label, type: "object", fields: Object.keys(value).length });
      if (depth < 4) for (const key of Object.keys(value).slice(0, 30)) {
        if (out.length >= 150) break;
        // Never print any leaf value. Displaying keys locally may still reveal private names.
        walk(value[key], label === "$" ? "$." + key : label + "." + key, depth+1);
      }
      return;
    }
    out.push({ path: label, type: value === null ? "null" : typeof value });
  };
  walk(obj, "$", 0);
  return { status: "LOCAL_SHAPE_ONLY_UNVERIFIED", source_sha256: checksum(source), entries: out, truncated: out.length >= 150 };
}
function validateMapping(config) {
  exactKeys(config, ["schema", "source_sha256", "exported_at", "collections"], "mapping");
  if (config.schema !== MAPPING_SCHEMA || !HEX64.test(config.source_sha256)) bad("mapping: schema/checksum invalid");
  str(config.exported_at, "mapping.exported_at", 32);
  if (!Array.isArray(config.collections) || config.collections.length === 0 || config.collections.length > MAX_COLLECTIONS) bad("mapping: collection count invalid");
  for (const c of config.collections) {
    exactKeys(c, ["kind", "source_id", "items_path", "parent_kind", "fields"], "mapping.collection");
    if (!TYPES.has(c.kind)) bad("mapping.collection: unknown kind");
    id(c.source_id, "mapping.source_id");
    path(c.items_path, "mapping.items_path");
    if (c.parent_kind !== null && !TYPES.has(c.parent_kind)) bad("mapping: invalid parent_kind");
    exactKeys(c.fields, ["id", "title", "text", "created_at", "updated_at", "parent_id"], "mapping.fields");
    for (const name of ["id", "title", "text", "created_at", "updated_at"]) path(c.fields[name], "mapping.fields." + name);
    if (c.fields.parent_id !== null) path(c.fields.parent_id, "mapping.fields.parent_id");
    if ((c.fields.parent_id === null) !== (c.parent_kind === null)) bad("mapping: parent_id and parent_kind must be both set or both null");
  }
  return config;
}
export function mapToPortable(source, config) {
  const raw = parse(source);
  const map = validateMapping(config);
  if (checksum(source) !== map.source_sha256) bad("mapping: source file changed; digest mismatch");
  const records = [];
  for (const collection of map.collections) {
    const items = get(raw, collection.items_path, "items_path");
    if (!Array.isArray(items) || records.length + items.length > MAX_ITEMS) bad("mapping: expected bounded collection array");
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) bad("mapping: collection item not object");
      const c = collection.fields;
      const identifier = id(field(item, c.id, "id"), "mapped id");
      const title = field(item, c.title, "title");
      const text = field(item, c.text, "text");
      const created = field(item, c.created_at, "created_at");
      const updated = field(item, c.updated_at, "updated_at");
      if (typeof title !== "string" || typeof text !== "string" || typeof created !== "string" || typeof updated !== "string") bad("mapping: expected text and date strings");
      const parent = field(item, c.parent_id, "parent_id", false);
      const parentId = parent === null ? null : collection.parent_kind + ":" + id(parent, "mapped parent ID");
      records.push({
        kind: collection.kind,
        id: collection.kind + ":" + identifier,
        created_at: created,
        updated_at: updated,
        title, text,
        parent_id: parentId,
        provenance: { source: "runtime_adapter_unverified", source_id: collection.source_id, status: "DECLARED_UNVERIFIED" }
      });
    }
  }
  const staging = { schema: STAGING_SCHEMA, exported_at: map.exported_at, records };
  // Existing portable packer enforces dates, unique IDs, text caps, size caps and no unexpected fields.
  const packed = pack(staging);
  verify(packed);
  return packed;
}
