#!/usr/bin/env node
// Local-only operator mapping helper. No browser, network, provider or runtime access.
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectShape, mapToPortable } from "./operator-map.mjs";
function readBounded(path) {
  if (statSync(path).size > 2_000_000) throw new Error("source exceeds 2 MB R1 limit");
  return readFileSync(path, "utf8");
}
function main(args) {
  const [action, sourcePath, mappingPath, outPath] = args;
  if (action === "inspect" && sourcePath && !mappingPath && !outPath) {
    const result = inspectShape(readBounded(sourcePath));
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }
  if (action === "convert" && sourcePath && mappingPath && outPath) {
    const outputs = [resolve(sourcePath), resolve(mappingPath), resolve(outPath)];
    if (new Set(outputs).size !== 3) throw new Error("source, mapping and output paths must be different");
    if (statSync(mappingPath).size > 100_000) throw new Error("mapping file exceeds 100 KB");
    const source = readBounded(sourcePath);
    const mapping = JSON.parse(readFileSync(mappingPath, "utf8"));
    const packed = mapToPortable(source, mapping);
    writeFileSync(outPath, packed, { flag: "wx", mode: 0o600 });
    process.stdout.write("Converted approved fields to new portable archive. Local-only, declared provenance, authority NONE.\n");
    return;
  }
  throw new Error("usage: node operator-map-cli.mjs inspect SOURCE.json | convert SOURCE.json MAPPING.json NEW_ARCHIVE.jsonl");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(process.argv.slice(2)); }
  catch (e) { process.stderr.write("Operator mapping refused: " + e.message + "\n"); process.exitCode = 1; }
}
