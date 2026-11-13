#!/usr/bin/env node
// Explicit operator-selected staging fixture -> portable export; not a runtime-memory extractor.
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pack, verify } from "./portable.mjs";

function main([action, input, output]) {
  if (action !== "pack" || !input || !output) throw new Error("usage: node pack-cli.mjs pack STAGED.json NEW_ARCHIVE.jsonl");
  if (resolve(input) === resolve(output)) throw new Error("input and output must be different files");
  if (statSync(input).size > 2_000_000) throw new Error("staged input exceeds 2MB");
  const staged = JSON.parse(readFileSync(input, "utf8"));
  const archive = pack(staged);
  const checked = verify(archive);
  writeFileSync(output, archive, { flag: "wx", mode: 0o600 });
  process.stdout.write("Created " + checked.records.length + " portable records. Local-only, declared provenance, no authority; destination created without overwrite.\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(process.argv.slice(2)); } catch (error) { process.stderr.write("Portable packer refused: " + error.message + "\n"); process.exitCode = 1; }
}
