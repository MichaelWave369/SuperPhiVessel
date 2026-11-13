import { inspectShape, sha256, convert } from "./portable-web.mjs";
import { convertCanonical } from "./canonical-v1.mjs";

const sourceInput = document.getElementById("sourceFile");
const mappingInput = document.getElementById("mappingFile");
const consentInput = document.getElementById("consent");
const inspectButton = document.getElementById("inspectButton");
const convertButton = document.getElementById("convertButton");
const canonicalButton = document.getElementById("canonicalButton");
const report = document.getElementById("inspection");
const shapeReport = document.getElementById("shapeReport");
const hashDisplay = document.getElementById("sourceHash");
const downloadLink = document.getElementById("downloadLink");
const conversionResult = document.getElementById("conversionResult");
const convertedCount = document.getElementById("convertedCount");
const statusMessage = document.getElementById("statusMessage");
let inspectedFile = null;
let objectUrl = null;
let busy = false;

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}
function clearDownload() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  downloadLink.hidden = true;
  downloadLink.removeAttribute("href");
  conversionResult.hidden = true;
}
function resetInspection() {
  inspectedFile = null;
  report.hidden = true;
  hashDisplay.textContent = "";
  shapeReport.textContent = "";
  clearDownload();
  updateButtons();
}
function updateButtons() {
  const source = sourceInput.files?.[0];
  const mapping = mappingInput.files?.[0];
  inspectButton.disabled = busy || !source || source.size > 2_000_000;
  convertButton.disabled = busy || !source || !mapping || !consentInput.checked ||
    inspectedFile !== source || source.size > 2_000_000 || mapping.size > 100_000;
  canonicalButton.disabled = busy || !source || !consentInput.checked ||
    inspectedFile !== source || source.size > 2_000_000;
}
sourceInput.addEventListener("change", () => {
  consentInput.checked = false;
  resetInspection();
  const selected = sourceInput.files?.[0];
  if (!selected) {
    setStatus("No source selected.");
  } else if (selected.size > 2_000_000) {
    // File metadata only. No private contents read from oversized sources.
    setStatus("Selected file is " + selected.size + " bytes, above the 2 MB pilot limit. Inspection and extraction are disabled; no file contents were read.", true);
  } else {
    setStatus("Source selected. Inspect its structure, then choose verified canonical extraction or a separately reviewed JSON mapping.");
  }
});
mappingInput.addEventListener("change", () => {
  consentInput.checked = false;
  clearDownload();
  updateButtons();
  const selectedMap = mappingInput.files?.[0];
  if (selectedMap?.size > 100_000) {
    setStatus("Selected mapping exceeds the 100 KB limit; the general JSON conversion is disabled. Canonical Bundle v1 extraction does not require a mapping.", true);
  } else {
    setStatus(selectedMap ? "Mapping selected for general JSON. Review it and explicitly approve conversion; canonical Bundle v1 extraction needs no mapping." : "No mapping selected. Canonical Bundle v1 extraction remains available after source inspection and approval.");
  }
});
consentInput.addEventListener("change", () => {
  clearDownload();
  updateButtons();
});
inspectButton.addEventListener("click", async () => {
  const file = sourceInput.files?.[0];
  if (!file || busy) return;
  busy = true;
  resetInspection();
  updateButtons();
  setStatus("Inspecting selected file in browser memory…");
  try {
    if (file.size > 2_000_000) throw new Error("Source file exceeds 2 MB");
    const text = await file.text();
    const structure = inspectShape(text);
    const digest = await sha256(text);
    if (sourceInput.files?.[0] !== file) throw new Error("Source selection changed");
    shapeReport.textContent = JSON.stringify(structure.entries, null, 2) +
      (structure.truncated ? "\nStructure display truncated to 150 entries." : "");
    hashDisplay.textContent = digest;
    report.hidden = false;
    inspectedFile = file;
    setStatus("Inspection completed locally. Review field names. For an audited Vessie Bundle v1, approve and use canonical extraction; otherwise supply a reviewed mapping pinned to this SHA-256.");
  } catch (error) {
    setStatus("Inspection refused: " + error.message, true);
  } finally {
    busy = false;
    updateButtons();
  }
});
convertButton.addEventListener("click", async () => {
  if (busy || !consentInput.checked) return;
  const file = sourceInput.files?.[0];
  const mapFile = mappingInput.files?.[0];
  if (!file || !mapFile || file !== inspectedFile) return;
  busy = true;
  clearDownload();
  updateButtons();
  setStatus("Validating selected files and preparing an in-memory archive…");
  try {
    if (file.size > 2_000_000 || mapFile.size > 100_000) throw new Error("Selected file exceeds allowed size");
    const [sourceText, mappingText] = await Promise.all([file.text(), mapFile.text()]);
    const converted = await convert(sourceText, mappingText);
    if (sourceInput.files?.[0] !== file || mappingInput.files?.[0] !== mapFile || !consentInput.checked) {
      throw new Error("Selected files or approval changed during conversion");
    }
    const blob = new Blob([converted.archive], {type: "application/x-ndjson"});
    objectUrl = URL.createObjectURL(blob);
    downloadLink.href = objectUrl;
    downloadLink.hidden = false;
    const counts = Object.entries(converted.kinds).filter(([, n]) => n > 0).map(([name, n]) => name + ": " + n);
    convertedCount.textContent = converted.record_count + " records prepared (" + (counts.join(", ") || "empty") + "). No transfer occurred.";
    conversionResult.hidden = false;
    setStatus("Archive ready. Choose Download to save the plaintext records. The original source was not changed.");
  } catch (error) {
    setStatus("Conversion refused: " + error.message, true);
  } finally {
    busy = false;
    updateButtons();
  }
});

canonicalButton.addEventListener("click", async () => {
  if (busy || !consentInput.checked) return;
  const file = sourceInput.files?.[0];
  if (!file || inspectedFile !== file || file.size > 2_000_000) return;
  busy = true;
  clearDownload();
  updateButtons();
  setStatus("Verifying canonical SHA-256 seal, historical custody and exact v1 source schema in browser memory…");
  try {
    const sourceText = await file.text();
    const converted = await convertCanonical(sourceText);
    if (sourceInput.files?.[0] !== file || !consentInput.checked) {
      throw new Error("Selected file or consent changed during conversion");
    }
    const blob = new Blob([converted.archive], {type: "application/x-ndjson"});
    objectUrl = URL.createObjectURL(blob);
    downloadLink.href = objectUrl;
    downloadLink.hidden = false;
    const counts = Object.entries(converted.kinds).filter(([, n]) => n > 0).map(([kind, n]) => kind + ": " + n);
    convertedCount.textContent = converted.record_count + " records prepared (" +
      (counts.join(", ") || "empty") + "). Text extraction only; verified outer SHA-256 seal. " +
      converted.warning;
    conversionResult.hidden = false;
    setStatus("Canonical text archive ready. This is not a full-fidelity identity, metadata or authority restoration.");
  } catch (error) {
    setStatus("Canonical text extraction refused: " + error.message, true);
  } finally {
    busy = false;
    updateButtons();
  }
});

window.addEventListener("pagehide", clearDownload);
updateButtons();
