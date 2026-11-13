#!/usr/bin/env node
// Independent, read-only consumer. Copy this file outside SuperPhiVessel to inspect portable records.
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FORMAT = "spv.sovereignty.records.v0.1";
const ALLOWED = new Set(["memory", "conversation", "message", "work_object"]);
const MAX_BYTES = 2_000_000;
const hex = text => createHash("sha256").update(text, "utf8").digest("hex");
function requireExact(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(label + ": expected object");
  if (Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) throw new Error(label + ": unexpected or missing fields");
}
function parseFile(path) {
  const size = statSync(path).size;
  if (size > MAX_BYTES) throw new Error("archive exceeds maximum size");
  const input = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  if (!input.endsWith("\n") || input.includes("\r")) throw new Error("archive must use newline-terminated JSONL");
  const lines = input.slice(0, -1).split("\n");
  if (lines.some(x => !x)) throw new Error("blank archive record");
  const manifest = JSON.parse(lines[0]);
  requireExact(manifest, ["schema", "kind", "exported_at", "record_count", "records_sha256", "authority"], "manifest");
  if (manifest.schema !== FORMAT || manifest.kind !== "manifest" || manifest.authority !== "NONE") throw new Error("invalid manifest identity");
  if (!Number.isInteger(manifest.record_count) || manifest.record_count < 0 || manifest.record_count > 500 || manifest.record_count !== lines.length - 1) throw new Error("manifest count does not match records");
  const body = lines.length > 1 ? lines.slice(1).join("\n") + "\n" : "";
  if (hex(body) !== manifest.records_sha256) throw new Error("archive digest mismatch");
  const ids = new Set();
  const records = lines.slice(1).map(line => {
    const item = JSON.parse(line);
    requireExact(item, ["schema", "kind", "id", "created_at", "updated_at", "title", "text", "parent_id", "provenance", "checksum_sha256"], "record");
    requireExact(item.provenance, ["source", "source_id", "status"], "provenance");
    if (item.schema !== FORMAT || !ALLOWED.has(item.kind)) throw new Error("invalid record type");
    if (item.provenance.status !== "DECLARED_UNVERIFIED") throw new Error("unverified source must not imply authentication");
    if (ids.has(item.id)) throw new Error("duplicate ID");
    ids.add(item.id);
    const { checksum_sha256, ...core } = item;
    if (hex(JSON.stringify(core)) !== checksum_sha256) throw new Error("record integrity mismatch");
    if (typeof item.text !== "string" || typeof item.title !== "string" || typeof item.id !== "string") throw new Error("invalid record content");
    return item;
  });
  return { manifest, records };
}
function renderMarkdown(archive) {
  const lines = ["# Portable records: external reader", "", "Portable schema: " + FORMAT, "Exported at: " + archive.manifest.exported_at, "Records: " + archive.records.length, "", "These records are data, not live memory, model access, or execution grants.", ""];
  for (const record of archive.records) {
    const title = record.title.replace(/[\r\n#<>]/g, " ").slice(0, 200);
    const ticks = record.text.match(/`+/g) || [];
    const fence = "`".repeat(Math.max(4, ...ticks.map(x => x.length + 1)));
    lines.push("## " + record.kind + ": " + (title || record.id), "", "ID: " + record.id, "", "Created: " + record.created_at, "", "Updated: " + record.updated_at, "", "Source: " + record.provenance.source + " / " + record.provenance.status, "", fence + "text", record.text, fence, "");
  }
  return lines.join("\n");
}
function main(argv) {
  const [action, input, output] = argv;
  if (!["verify", "markdown"].includes(action) || !input || (action === "markdown" && !output) || (action === "verify" && output)) {
    throw new Error("usage: node reader.mjs verify FILE.jsonl | markdown FILE.jsonl DEST.md");
  }
  const archive = parseFile(input);
  if (action === "verify") {
    const counts = Object.fromEntries([...ALLOWED].map(t => [t, archive.records.filter(r => r.kind === t).length]));
    process.stdout.write(JSON.stringify({ status: "VALID_INTERNAL_CHECKSUMS_ONLY", schema: FORMAT, records: archive.records.length, counts, authority: "NONE" }, null, 2) + "\n");
  } else {
    writeFileSync(output, renderMarkdown(archive), { flag: "wx", mode: 0o600 });
    process.stdout.write("Wrote read-only Markdown copy to supplied destination; existing files are never replaced.\n");
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(process.argv.slice(2)); } catch (error) { process.stderr.write("Portable reader refused: " + error.message + "\n"); process.exitCode = 1; }
}
export { parseFile, renderMarkdown };
