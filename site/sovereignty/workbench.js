import { inspectShape, sha256, convert } from "./portable-web.mjs";

const sourceInput = document.getElementById("sourceFile");
const mappingInput = document.getElementById("mappingFile");
const consentInput = document.getElementById("consent");
const inspectButton = document.getElementById("inspectButton");
const convertButton = document.getElementById("convertButton");
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
}
sourceInput.addEventListener("change", () => {
  consentInput.checked = false;
  resetInspection();
  setStatus(sourceInput.files?.length ? "Source selected. Inspect its local structure before mapping." : "No source selected.");
});
mappingInput.addEventListener("change", () => {
  consentInput.checked = false;
  clearDownload();
  updateButtons();
  setStatus(mappingInput.files?.length ? "Mapping selected. Review the files, then explicitly approve conversion." : "No mapping selected.");
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
    setStatus("Inspection completed locally. Review field names and create a mapping pinned to this exact SHA-256.");
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
window.addEventListener("pagehide", clearDownload);
updateButtons();
