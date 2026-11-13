import { FAMILIES, CAPABILITIES, JOURNEYS } from "./data.mjs";

const search = document.getElementById("capSearch");
const filters = document.getElementById("familyFilters");
const cards = document.getElementById("capabilities");
const count = document.getElementById("resultCount");
const empty = document.getElementById("emptyState");
const journeySelect = document.getElementById("journeySelect");
const journeyDescription = document.getElementById("journeyDescription");
const journeySteps = document.getElementById("journeySteps");
const params = new URLSearchParams(location.search);
let family = FAMILIES.includes(params.get("family")) ? params.get("family") : "All";

function element(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== undefined) node.textContent = textContent;
  return node;
}
function link(label, href, className) {
  const anchor = element("a", className, label);
  anchor.href = href;
  if (href.startsWith("https://")) {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }
  return anchor;
}
function updateQuery() {
  const url = new URL(location.href);
  if (search.value.trim()) url.searchParams.set("q", search.value.trim());
  else url.searchParams.delete("q");
  if (family !== "All") url.searchParams.set("family", family);
  else url.searchParams.delete("family");
  if (journeySelect.value !== "research") url.searchParams.set("journey", journeySelect.value);
  else url.searchParams.delete("journey");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}
function renderCapabilities() {
  const terms = search.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = CAPABILITIES.filter(cap => {
    if (family !== "All" && cap.family !== family) return false;
    const haystack = [cap.family, cap.name, cap.summary, cap.status, cap.where, cap.boundary, ...cap.tags].join(" ").toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  });
  const fragment = document.createDocumentFragment();
  visible.forEach(cap => {
    const card = element("article", "atlas-card");
    card.id = "mode-" + cap.id;
    const header = element("div", "atlas-card-header");
    const group = element("span", "family-caption", cap.family);
    const status = element("span", "status-pill status-" + cap.status, cap.status);
    header.append(group, status);
    const title = element("h3", null, cap.name);
    const desc = element("p", "atlas-card-summary", cap.summary);
    const meta = element("dl", "atlas-card-meta");
    const whereLabel = element("dt", null, "FIND IT");
    const whereValue = element("dd", null, cap.where);
    const ruleLabel = element("dt", null, "BOUNDARY");
    const ruleValue = element("dd", null, cap.boundary);
    meta.append(whereLabel, whereValue, ruleLabel, ruleValue);
    card.append(header, title, desc, meta, link("Inspect source / manual", cap.source, "source-link"));
    fragment.append(card);
  });
  cards.replaceChildren(fragment);
  count.textContent = visible.length + " of " + CAPABILITIES.length + " documented mode and capability entries · source-reviewed, not live telemetry";
  empty.hidden = visible.length !== 0;
  [...filters.children].forEach(button => {
    const active = button.dataset.family === family;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("active", active);
  });
  updateQuery();
}
function renderJourney() {
  const item = JOURNEYS[journeySelect.value];
  if (!item) return;
  journeyDescription.replaceChildren(element("strong", null, item.title), element("p", null, item.description));
  const fragment = document.createDocumentFragment();
  item.steps.forEach((step, index) => {
    const li = element("li", "journey-step");
    const num = element("span", "journey-num", String(index + 1).padStart(2, "0"));
    const section = element("div");
    section.append(link(step.name, step.href, "journey-name"), element("p", null, step.detail));
    li.append(num, section);
    fragment.append(li);
  });
  journeySteps.replaceChildren(fragment);
  updateQuery();
}
FAMILIES.forEach(value => {
  const btn = element("button", "family-filter", value);
  btn.type = "button";
  btn.dataset.family = value;
  btn.addEventListener("click", () => { family = value; renderCapabilities(); });
  filters.append(btn);
});
const q = params.get("q");
if (q) search.value = q.slice(0, 200);
const requestedJourney = params.get("journey");
if (requestedJourney && Object.hasOwn(JOURNEYS, requestedJourney)) journeySelect.value = requestedJourney;
search.addEventListener("input", renderCapabilities);
journeySelect.addEventListener("change", renderJourney);
document.addEventListener("keydown", event => {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable]")) return;
  event.preventDefault();
  search.focus();
});
renderCapabilities();
renderJourney();
