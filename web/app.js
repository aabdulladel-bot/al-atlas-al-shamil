// الأطلس الشامل: الواجهة.
// الطبقات: خريطة أساس (Natural Earth)، مواقع الحقب (Pleiades)، السكان، أماكن الادعاءات، والسنن.

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isNarrow = () => window.innerWidth < 600;
// على الشاشات الضيقة تشغل اللوحة أعلى الشاشة (حتى 55%)، فتوضع النقاط تحتها.
const fitPadding = () => (isNarrow() ? { top: Math.round(window.innerHeight * 0.55) + 20, bottom: 30, left: 30, right: 30 } : { top: 40, bottom: 40, left: 40, right: 420 });

// ---------- طريقة العرض: مبسّط أو باحث ----------
const modeButtons = document.querySelectorAll(".mode button");
function setMode(mode) {
  document.body.dataset.mode = mode;
  for (const b of modeButtons) b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  try { localStorage.setItem("atlas-mode", mode); } catch {}
}
for (const b of modeButtons) b.addEventListener("click", () => setMode(b.dataset.mode));
try { const saved = localStorage.getItem("atlas-mode"); if (saved === "research" || saved === "simple") setMode(saved); } catch {}

// ---------- الخريطة وطبقات الأساس ----------
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      land: { type: "geojson", data: "data/base/land.geojson" },
      lakes: { type: "geojson", data: "data/base/lakes.geojson" },
      rivers: { type: "geojson", data: "data/base/rivers.geojson" },
    },
    layers: [
      { id: "sea", type: "background", paint: { "background-color": cssVar("--sea") } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": cssVar("--land") } },
      { id: "lakes", type: "fill", source: "lakes", paint: { "fill-color": cssVar("--sea") } },
      { id: "rivers", type: "line", source: "rivers", paint: { "line-color": cssVar("--river"), "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 6, 1.6] } },
    ],
  },
  center: [35, 32],
  zoom: 3,
  attributionControl: { customAttribution: "Natural Earth · Pleiades · OWID/HYDE · Gapminder" },
});
map.addControl(new maplibregl.NavigationControl(), "bottom-left");
const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "320px" });

function fitTo(features, maxZoom) {
  if (!features.length) return;
  const bounds = new maplibregl.LngLatBounds();
  for (const f of features) bounds.extend(f.geometry.coordinates);
  map.fitBounds(bounds, { padding: fitPadding(), maxZoom, duration: 500 });
}
function pointerOn(layer) {
  map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
}
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- الحقب ومواقعها ----------
const ERAS = [
  { id: 1, border: -4000, label: "الماء والاستقرار", file: "data/places_era1.geojson", desc: "الحقبة الأولى: وادي الرافدين ومصر القديمة (4000-1200 ق.م)." },
  { id: 2, border: -1000, label: "الطرق والممالك", file: "data/places_era2.geojson", desc: "الحقبة الثانية: الطرق والممالك الأولى (1200-500 ق.م)." },
  { id: 3, border: -1, label: "الإمبراطوريات الكبرى", file: "data/places_era3.geojson", desc: "الحقبة الثالثة: الإمبراطوريات الكبرى (500 ق.م-300م)." },
  { id: 4, border: 700, label: "الأديان الكبرى", file: "data/places_era4.geojson", desc: "الحقبة الرابعة: الأديان الكبرى وتشكّل العالم القديم المتأخر (300-1000م). مدن العصر الإسلامي (بغداد والبصرة وسامراء والقيروان والفسطاط) مواقع مدن حديثة، لا مواقع أثرية." },
  { id: 5, border: 1200, label: "التبادل العابر للقارات", file: "data/places_era5.geojson", desc: "الحقبة الخامسة: التبادل العابر للقارات (1000-1450م). مدن العالم الإسلامي (القاهرة وتونس وفاس وأصفهان وسمرقند وحلب ودلهي) مواقع مدن حديثة من Natural Earth، لا مواقع أثرية." },
  { id: 6, border: 1600, label: "الكشوف وتبادل العالم", file: null, desc: "الحقبة السادسة: الكشوف وتبادل العالم (1450-1760م). الحدود تقريبية لسنة 1600، ولا مواقع موثّقة لهذه الحقبة بعد." },
  { id: 7, border: 1800, label: "الصناعة والمدينة", file: null, desc: "الحقبة السابعة: الصناعة والمدينة (1760-1914م). الحدود تقريبية لسنة 1800، والمواقع الموثّقة لهذه الحقبة في الادعاءات فقط." },
  { id: 8, border: "modern", label: "الحروب العالمية والدولة الحديثة", file: null, desc: "الحقبة الثامنة: الحروب العالمية والدولة الحديثة (1914-2025م). الخريطة هنا حدود الدول اليوم من Natural Earth (ملك عام)، ويمكن اختيار حدود 1945 من القائمة. لا مواقع موثّقة بعد." },
];
// سنوات طبقة الحدود المتاحة (web/data/borders)، وتُختار بها الحقبة أو يدوياً من القائمة
const BORDER_YEARS = [-4000, -1000, -1, 700, 1200, 1600, 1800, 1914, 1945, 2010];
const yearLabel = (y) => (y < 0 ? `${-y} ق.م` : `${y}م`);
const COORD_LABEL = {
  "pleiades-representative": "إحداثيات من Pleiades (نقطة تمثيلية)",
  approximate: "إحداثيات تقديرية، لم تُطابَق بعد",
  "natural-earth-modern-city": "موقع المدينة الحديثة من Natural Earth (ملك عام)، لا موقع أثري",
  "wikidata-modern-city": "موقع المدينة من Wikidata (CC0)، لا موقع أثري",
};
const erasEl = document.getElementById("eras");
const descEl = document.getElementById("era-desc");
const warnEl = document.getElementById("era-warn");
const countEl = document.getElementById("count");

function markEra(id) {
  for (const btn of erasEl.querySelectorAll("button")) btn.setAttribute("aria-pressed", String(Number(btn.dataset.era) === id));
}
const PRECISION_LABEL = { 1: "تقريبية", 2: "دقة متوسطة", 3: "محددة بالقانون الدولي" };
async function loadBorders(key) {
  borderSelect.value = String(key);
  const modern = key === "modern";
  const url = modern ? "data/borders/modern_countries.geojson" : `data/borders/borders_${key}.geojson`;
  let data;
  try { data = await getJson(url); } catch (err) { borderNoteEl.textContent = `تعذّر تحميل الحدود: ${err.message}`; return; }
  borderNoteEl.textContent = modern
    ? `حدود الدول اليوم (${data.features.length} كياناً) من Natural Earth، ملك عام.`
    : `حدود تقريبية لسنة ${yearLabel(key)} (${data.features.length} كياناً). المصدر: Historical Basemaps (GPL-3)، ولا تعكس وضعاً مؤكداً.`;
  if (map.getSource("borders")) { map.getSource("borders").setData(data); return; }
  map.addSource("borders", { type: "geojson", data });
  const before = map.getLayer("places") ? "places" : undefined;
  // الدقة تحدد الشفافية وسُمك الخط: الحد التقريبي أخفّ، والمحدد بالقانون أوضح
  map.addLayer({ id: "borders-fill", type: "fill", source: "borders", paint: { "fill-color": "#8a4b2a", "fill-opacity": ["match", ["get", "BORDERPRECISION"], 1, 0.06, 2, 0.12, 3, 0.18, 0.12] } }, before);
  map.addLayer({ id: "borders-line", type: "line", source: "borders", paint: { "line-color": "#8a4b2a", "line-width": ["match", ["get", "BORDERPRECISION"], 3, 1.4, 1], "line-opacity": ["match", ["get", "BORDERPRECISION"], 1, 0.35, 0.7] } }, before);
  map.on("click", "borders-fill", (e) => {
    const p = e.features[0].properties;
    const prec = PRECISION_LABEL[p.BORDERPRECISION];
    popup.setLngLat(e.lngLat).setHTML(`<div class="popup-name">${escapeHtml(p.NAME)}</div>${p.PARTOF ? `<div class="popup-sub">ضمن: ${escapeHtml(p.PARTOF)}</div>` : ""}${prec ? `<div class="popup-sub">دقة الحد: ${escapeHtml(prec)}</div>` : ""}`).addTo(map);
  });
  pointerOn("borders-fill");
}
async function loadEra(era) {
  markEra(era.id);
  descEl.textContent = era.desc;
  loadBorders(era.border);
  if (!era.file) {
    if (map.getLayer("places")) map.setLayoutProperty("places", "visibility", "none");
    countEl.textContent = "لا مواقع موثّقة لهذه الحقبة بعد.";
    warnEl.textContent = "";
    return;
  }
  countEl.textContent = "جارٍ التحميل...";
  let data;
  try { data = await getJson(era.file); } catch (err) { countEl.textContent = `تعذّر تحميل المواقع: ${err.message}`; return; }
  const matched = data._meta?.matched ?? "";
  warnEl.textContent = matched ? `طابق Pleiades: ${matched}. المواقع التقديرية بلون أفتح.` : "";
  countEl.textContent = `عدد المواقع: ${data.features.length}`;
  const source = map.getSource("places");
  if (source) {
    source.setData(data);
    map.setLayoutProperty("places", "visibility", "visible");
  } else {
    map.addSource("places", { type: "geojson", data });
    map.addLayer({
      id: "places",
      type: "circle",
      source: "places",
      paint: {
        "circle-radius": 6,
        "circle-color": ["match", ["get", "coord_status"], "approximate", "#b59a7a", "#8a4b2a"],
        "circle-stroke-color": "#fffdf8",
        "circle-stroke-width": 2,
      },
    });
    map.on("click", "places", (e) => {
      const p = e.features[0].properties;
      popup.setLngLat(e.lngLat).setHTML(
        `<div class="popup-name">${escapeHtml(p.name_ar)}</div>` +
        `<div class="popup-sub">${escapeHtml(p.name_en)}<span class="research-only"> · ${escapeHtml(COORD_LABEL[p.coord_status] ?? p.coord_status)}</span></div>`
      ).addTo(map);
    });
    pointerOn("places");
  }
  fitTo(data.features, 6);
  for (const btn of erasEl.querySelectorAll("button")) btn.setAttribute("aria-pressed", String(Number(btn.dataset.era) === era.id));
}
const borderSelect = document.getElementById("border-select");
const borderNoteEl = document.getElementById("border-note");
borderSelect.innerHTML = `<option value="modern">الدول اليوم (Natural Earth)</option>` + BORDER_YEARS.map((y) => `<option value="${y}">${escapeHtml(yearLabel(y))}</option>`).join("");
borderSelect.addEventListener("change", () => loadBorders(Number(borderSelect.value)));
for (const era of ERAS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = era.label;
  btn.dataset.era = era.id;
  btn.setAttribute("aria-pressed", "false");
  btn.addEventListener("click", () => loadEra(era));
  erasEl.appendChild(btn);
}

// ---------- السكان ----------
const DEMO = [
  { key: "r1", label: "إقليمي: ٤٠٠٠–١٢٠٠ ق.م (سنة ٢٠٠٠ ق.م)", file: "data/demography_regional_era1.geojson" },
  { key: "r2", label: "إقليمي: ١٢٠٠–٥٠٠ ق.م (سنة ١٠٠٠ ق.م)", file: "data/demography_regional_era2.geojson" },
  { key: "r3", label: "إقليمي: ٥٠٠ ق.م–٣٠٠م (سنة ١م)", file: "data/demography_regional_era3.geojson" },
  { key: "r4", label: "إقليمي: ٣٠٠–١٠٠٠م (سنة ٧٠٠)", file: "data/demography_regional_era4.geojson" },
  { key: "r5", label: "إقليمي: ١٠٠٠–١٤٥٠م (سنة ١٢٠٠)", file: "data/demography_regional_era5.geojson" },
  { key: "r6", label: "إقليمي: ١٤٥٠–١٧٦٠م (سنة ١٦٠٠)", file: "data/demography_regional_era6.geojson" },
  { key: "r7", label: "إقليمي: ١٧٦٠–١٩١٤م (سنة ١٨٠٠)", file: "data/demography_regional_era7.geojson" },
  { key: "c6", label: "بحسب الدولة: سنة ١٧٠٠", file: "data/demography_era6.geojson" },
  { key: "c7", label: "بحسب الدولة: سنة ١٨٠٠", file: "data/demography_era7.geojson" },
  { key: "c8", label: "بحسب الدولة: سنة ٢٠٠٨", file: "data/demography_era8.geojson" },
];
const demoSelect = document.getElementById("demo-select");
const demoNoteEl = document.getElementById("demo-note");
demoSelect.innerHTML = `<option value="">بدون طبقة سكان</option>` + DEMO.map((d) => `<option value="${d.key}">${escapeHtml(d.label)}</option>`).join("");
const formatPop = (n) => Number(n).toLocaleString("ar-u-nu-latn");

async function loadDemography(key) {
  if (!key) {
    if (map.getLayer("demography")) map.setLayoutProperty("demography", "visibility", "none");
    demoNoteEl.textContent = "";
    return;
  }
  const demo = DEMO.find((d) => d.key === key);
  let data;
  try { data = await getJson(demo.file); } catch (err) { demoNoteEl.textContent = `تعذّر تحميل طبقة السكان: ${err.message}`; return; }
  const m = data._meta;
  const unit = m.countries ? `${m.countries} دولة` : "6 أقاليم";
  demoNoteEl.innerHTML = `سنة ${escapeHtml(m.year)}، ${unit}.<span class="research-only"> ${escapeHtml(m.note)}</span>`;
  const source = map.getSource("demography");
  if (source) {
    source.setData(data);
    map.setLayoutProperty("demography", "visibility", "visible");
  } else {
    map.addSource("demography", { type: "geojson", data });
    map.addLayer({
      id: "demography",
      type: "circle",
      source: "demography",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "population"], 0, 3, 1000000, 8, 100000000, 22, 1000000000, 40],
        "circle-color": "#8a4b2a",
        "circle-opacity": 0.4,
        "circle-stroke-color": "#fffdf8",
        "circle-stroke-width": 1,
      },
    }, map.getLayer("claim-points") ? "claim-points" : undefined);
    map.on("click", "demography", (e) => {
      const p = e.features[0].properties;
      popup.setLngLat(e.lngLat).setHTML(
        `<div class="popup-name">${escapeHtml(p.name_en)}</div>` +
        `<div class="popup-sub">${formatPop(p.population)} نسمة، سنة ${escapeHtml(p.year)}</div>` +
        `<div class="popup-sub">${p.level === "region" ? "إقليم تقريبي، وليس حدود الحقبة" : "حدود الدولة الحديثة، وليست كيانات الحقبة"}</div>`
      ).addTo(map);
    });
    pointerOn("demography");
  }
  fitTo(data.features, 3);
}
demoSelect.addEventListener("change", () => loadDemography(demoSelect.value));

// ---------- الادعاءات بحسب الحقبة ----------
const claimsEl = document.getElementById("claims-eras");
const claimsListEl = document.getElementById("claims-list");

function claimHtml(c, extra = "") {
  return `<div class="ev ${extra}">${escapeHtml(c.statement)}` +
    `<div class="sub">${escapeHtml(c.attributed_to)}</div>` +
    `<details class="research-only"><summary class="sub">الاقتباس والتحفّظ</summary>` +
    `<div class="src-quote">“${escapeHtml(c.quote)}”</div><div class="sub">تحفّظ: ${escapeHtml(c.hedge)}</div></details></div>`;
}
async function loadClaims(n) {
  claimsListEl.textContent = "جارٍ التحميل...";
  try {
    const data = await getJson(`data/claims_era${n}.json`);
    claimsListEl.innerHTML = `<p class="sub">${escapeHtml(data._meta.status)} (${data._meta.count})</p>` +
      (data.claims.length ? data.claims.map((c) => claimHtml(c)).join("") : "<p>لا ادعاءات موثّقة لهذه الحقبة بعد.</p>");
  } catch (err) {
    claimsListEl.textContent = `تعذّر تحميل الادعاءات: ${err.message}`;
  }
  for (const btn of claimsEl.querySelectorAll("button")) btn.setAttribute("aria-pressed", String(Number(btn.dataset.claims) === n));
}
// أزرار الحقب تُبنى من الفهرس الذي يولّده scripts/build_claims.mjs.
getJson("data/claims_index.json").then((index) => {
  for (const { era: n, count } of index) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `الحقبة ${n} (${count})`;
    btn.dataset.claims = n;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => loadClaims(n));
    claimsEl.appendChild(btn);
  }
}).catch((err) => { claimsListEl.textContent = `تعذّر تحميل فهرس الادعاءات: ${err.message}`; });

// ---------- أماكن الادعاءات ----------
const claimMapBtn = document.getElementById("claim-map-btn");
let claimPoints = null;

async function ensureClaimPoints() {
  if (claimPoints) return true;
  try { claimPoints = await getJson("data/claim_points.geojson"); } catch { return false; }
  map.addSource("claim-points", { type: "geojson", data: claimPoints });
  map.addLayer({
    id: "claim-points",
    type: "circle",
    source: "claim-points",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": ["+", 9, ["*", 2.5, ["get", "count"]]],
      "circle-color": cssVar("--evidence"),
      "circle-opacity": 0.7,
      "circle-stroke-color": "#fffdf8",
      "circle-stroke-width": 2,
    },
  });
  map.on("click", "claim-points", (e) => {
    const p = e.features[0].properties;
    const only = activeSunna ? new Set(activeSunna.ids) : null;
    const list = JSON.parse(p.claims).filter((c) => !only || only.has(c.id)).map((c) =>
      `<div style="margin-top:6px">${escapeHtml(c.statement)}` +
      `<div class="popup-sub">الحقبة ${c.era} · ${escapeHtml(c.attributed_to)}</div>` +
      `<div class="popup-sub research-only">“${escapeHtml(c.quote)}”</div></div>`
    ).join("");
    popup.setLngLat(e.lngLat).setHTML(`<div class="popup-name">${escapeHtml(p.name_ar)}</div>${list}`).addTo(map);
  });
  pointerOn("claim-points");
  return true;
}
function showClaimPoints(show, filter = null) {
  if (!map.getLayer("claim-points")) return;
  map.setFilter("claim-points", filter);
  map.setLayoutProperty("claim-points", "visibility", show ? "visible" : "none");
  claimMapBtn.setAttribute("aria-pressed", String(show && !filter));
}
claimMapBtn.addEventListener("click", async () => {
  if (!(await ensureClaimPoints())) return;
  const show = claimMapBtn.getAttribute("aria-pressed") !== "true";
  activeSunna = null;
  for (const b of sunanListEl.querySelectorAll("button")) b.setAttribute("aria-pressed", "false");
  showClaimPoints(show);
  if (show) fitTo(claimPoints.features, 4);
});

// ---------- السنن ----------
const sunanListEl = document.getElementById("sunan-list");
const sunanDetailEl = document.getElementById("sunan-detail");
let sunanData = null;
let activeSunna = null;

function renderSunna(s, placesLinked) {
  const khaldun = s.khaldun.map((k) => `<div class="khaldun">«${escapeHtml(k.quote)}»<div class="sub">ابن خلدون، المقدمة: ${escapeHtml(k.location)}</div></div>`).join("");
  const support = s.supporting.length
    ? s.supporting.map((c) => claimHtml(c, "support")).join("")
    : `<p class="sub">لا شواهد مؤيدة موثّقة بعد.</p>`;
  const limits = s.limiting.map((x) => {
    if (x.kind === "claim") return claimHtml({ ...x, statement: `${x.statement} — ${x.note}` }, "limit");
    if (x.kind === "khaldun") return `<div class="ev limit">«${escapeHtml(x.quote)}» <span class="sub">(${escapeHtml(x.location)})</span><div class="sub">${escapeHtml(x.note)}</div></div>`;
    return `<div class="ev limit research-only">${escapeHtml(x.note)}</div>`;
  }).join("");
  const antecedents = (s.antecedents || []).length
    ? `<details class="research-only"><summary class="sub">صياغات سابقة للفكرة (لا تُحسب شواهد)</summary>${s.antecedents.map((c) => claimHtml({ ...c, statement: `${c.statement} — ${c.why}` }, "antecedent")).join("")}</details>`
    : "";
  const modern = s.modern.length
    ? `<details class="research-only"><summary class="sub">قراءات حديثة (إحالة عامة لم تُقتبس)</summary>${s.modern.map((m) => `<div class="sub">${escapeHtml(m.work)}: ${escapeHtml(m.note)}</div>`).join("")}</details>`
    : "";
  const quant = (s.quantitative || []).length
    ? `<div class="quant"><div class="sub"><b>اختبار كمي ببيانات Seshat</b> (ارتباط لا سببية):</div>` +
      s.quantitative.map((q) => `<div class="ev"><span class="badge">${escapeHtml(q.verdict)}</span> ${escapeHtml(q.scope)}<div class="sub research-only">${escapeHtml(q.text)}</div></div>`).join("") +
      `</div>`
    : "";
  const mapNote = placesLinked ? `<p class="sub">أماكن الشواهد معروضة على الخريطة باللون الأخضر.</p>` : `<p class="sub">لا أماكن موثّقة الإحداثيات لشواهد هذه السُنّة بعد.</p>`;
  sunanDetailEl.innerHTML =
    `<div class="hyp">${escapeHtml(s.hypothesis)}</div>` +
    `<span class="badge">${escapeHtml(s.strength)}: ${s.supporting.length} مؤيد، ${s.limiting.length} مقيِّد</span>` +
    khaldun + quant + mapNote + support + limits + antecedents + modern;
}
async function selectSunna(s) {
  for (const b of sunanListEl.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.sunna === s.id));
  const ids = [...s.supporting, ...s.limiting].filter((x) => x.id).map((x) => x.id);
  activeSunna = { id: s.id, ids };
  const ready = await ensureClaimPoints();
  let linked = [];
  if (ready && ids.length) {
    linked = claimPoints.features.filter((f) => ids.some((id) => f.properties.claim_ids.includes(`,${id},`)));
    showClaimPoints(linked.length > 0, ["any", ...ids.map((id) => ["in", `,${id},`, ["get", "claim_ids"]])]);
    fitTo(linked, 4);
  } else if (ready) {
    showClaimPoints(false);
  }
  renderSunna(s, linked.length > 0);
}
async function loadSunan() {
  try { sunanData = await getJson("data/sunan.json"); } catch (err) { sunanDetailEl.textContent = `تعذّر تحميل السنن: ${err.message}`; return; }
  for (const s of sunanData.sunan) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = s.name.replace("سُنّة ", "");
    btn.title = s.name;
    btn.dataset.sunna = s.id;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => selectSunna(s));
    sunanListEl.appendChild(btn);
  }
}

map.on("load", () => { loadSunan(); });
