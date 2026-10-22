// كل حقبة لها ملف مواقع مستقل، وتُبنى بـ scripts/build_places.mjs.
const ERAS = [
  { id: 1, label: "الماء والاستقرار", file: "data/places_era1.geojson", desc: "الحقبة الأولى: وادي الرافدين ومصر القديمة (4000-1200 ق.م)." },
  { id: 2, label: "الطرق والممالك", file: "data/places_era2.geojson", desc: "الحقبة الثانية: الطرق والممالك الأولى (1200-500 ق.م)." },
];

const COORD_LABEL = {
  "pleiades-representative": "إحداثيات من Pleiades (نقطة تمثيلية)",
  approximate: "إحداثيات تقديرية، لم تُطابَق بعد",
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": getComputedStyle(document.body).backgroundColor } }],
  },
  center: [40, 32],
  zoom: 4.5,
});
map.addControl(new maplibregl.NavigationControl(), "bottom-left");

const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: true });
const countEl = document.getElementById("count");
const warnEl = document.getElementById("era-warn");
const descEl = document.getElementById("era-desc");
const erasEl = document.getElementById("eras");

async function loadEra(era) {
  countEl.textContent = "جارٍ التحميل...";
  let data;
  try {
    const res = await fetch(era.file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    countEl.textContent = `تعذّر تحميل البيانات: ${err.message}`;
    return;
  }

  descEl.textContent = era.desc;
  const matched = data._meta?.matched ?? "";
  warnEl.textContent = matched ? `طابق Pleiades: ${matched}. المواقع التقديرية موسومة على الخريطة.` : "";
  countEl.textContent = `عدد المواقع: ${data.features.length}`;

  if (map.getLayer("places")) map.setLayoutProperty("places", "visibility", "visible");
  const source = map.getSource("places");
  if (source) {
    source.setData(data);
  } else {
    map.addSource("places", { type: "geojson", data });
    map.addLayer({
      id: "places",
      type: "circle",
      source: "places",
      paint: {
        "circle-radius": 7,
        "circle-color": ["match", ["get", "coord_status"], "approximate", "#b59a7a", "#8a4b2a"],
        "circle-stroke-color": "#fffdf8",
        "circle-stroke-width": 2,
      },
    });
    map.on("click", "places", (e) => {
      const p = e.features[0].properties;
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="popup-name">${escapeHtml(p.name_ar)}</div>` +
            `<div class="popup-sub">${escapeHtml(p.name_en)} · ${escapeHtml(COORD_LABEL[p.coord_status] ?? p.coord_status)}</div>`
        )
        .addTo(map);
    });
    map.on("mouseenter", "places", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "places", () => (map.getCanvas().style.cursor = ""));
  }

  const bounds = new maplibregl.LngLatBounds();
  for (const f of data.features) bounds.extend(f.geometry.coordinates);
  map.fitBounds(bounds, { padding: { top: 230, bottom: 60, left: 40, right: 40 }, maxZoom: 6, duration: 400 });

  for (const btn of erasEl.querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(Number(btn.dataset.era) === era.id));
  }
}

// طبقة السكان: الحقب 6 و7 و8 فقط، لأن الحقب الأخرى لا تملك بيانات في المصدر (انظر data/derived/README.md).
const DEMO = [
  { key: "r1", label: "إقليمي ق.م ٤٠٠٠–١٢٠٠", file: "data/demography_regional_era1.geojson" },
  { key: "r2", label: "إقليمي ق.م ١٢٠٠–٥٠٠", file: "data/demography_regional_era2.geojson" },
  { key: "r3", label: "إقليمي ق.م ٥٠٠–٣٠٠", file: "data/demography_regional_era3.geojson" },
  { key: "r4", label: "إقليمي ٣٠٠–١٠٠٠", file: "data/demography_regional_era4.geojson" },
  { key: "r5", label: "إقليمي ١٠٠٠–١٤٥٠", file: "data/demography_regional_era5.geojson" },
  { key: "r6", label: "إقليمي ١٤٥٠–١٧٦٠", file: "data/demography_regional_era6.geojson" },
  { key: "r7", label: "إقليمي ١٧٦٠–١٩١٤", file: "data/demography_regional_era7.geojson" },
  { key: "c6", label: "السكان ١٤٥٠–١٧٦٠", file: "data/demography_era6.geojson" },
  { key: "c7", label: "السكان ١٧٦٠–١٩١٤", file: "data/demography_era7.geojson" },
  { key: "c8", label: "السكان ١٩١٤–٢٠٢٥", file: "data/demography_era8.geojson" },
];
const demoEl = document.getElementById("demo-eras");
const demoNoteEl = document.getElementById("demo-note");
let activeDemo = null;

function formatPop(n) {
  return Number(n).toLocaleString("ar-u-nu-latn");
}

async function loadDemography(demo) {
  let data;
  try {
    const res = await fetch(demo.file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    demoNoteEl.textContent = `تعذّر تحميل طبقة السكان: ${err.message}`;
    return;
  }
  activeDemo = demo.key;
  if (map.getLayer("places")) map.setLayoutProperty("places", "visibility", "none");
  countEl.textContent = "";
  warnEl.textContent = "";
  descEl.textContent = `طبقة السكان: ${demo.label}`;
  for (const btn of erasEl.querySelectorAll("button")) btn.setAttribute("aria-pressed", "false");
  const m = data._meta;
  const unit = m.countries ? `${m.countries} دولة` : "6 أقاليم";
  demoNoteEl.textContent = `سنة ${m.year}، ${unit}. ${m.note}`;

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
        "circle-opacity": 0.45,
        "circle-stroke-color": "#fffdf8",
        "circle-stroke-width": 1,
      },
    });
    map.on("click", "demography", (e) => {
      const p = e.features[0].properties;
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="popup-name">${escapeHtml(p.name_en)}</div>` +
            `<div class="popup-sub">${formatPop(p.population)} نسمة، سنة ${p.year}</div>` +
            `<div class="popup-sub">${p.level === "region" ? "إقليم HYDE، تقريبي، وليس حدود الحقبة" : "حدود الدولة الحديثة، وليست كيانات الحقبة"}</div>`
        )
        .addTo(map);
    });
    map.on("mouseenter", "demography", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "demography", () => (map.getCanvas().style.cursor = ""));
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const f of data.features) bounds.extend(f.geometry.coordinates);
  map.fitBounds(bounds, { padding: { top: 40, bottom: 40, left: 40, right: 420 }, maxZoom: 3, duration: 400 });

  for (const btn of demoEl.querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.demo === demo.key));
  }
}

for (const demo of DEMO) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = demo.label;
  btn.dataset.demo = demo.key;
  btn.setAttribute("aria-pressed", "false");
  btn.addEventListener("click", () => loadDemography(demo));
  demoEl.appendChild(btn);
}

const noDemoBtn = document.createElement("button");
noDemoBtn.type = "button";
noDemoBtn.textContent = "بدون طبقة";
noDemoBtn.setAttribute("aria-pressed", "true");
noDemoBtn.addEventListener("click", () => {
  if (map.getLayer("demography")) map.setLayoutProperty("demography", "visibility", "none");
  activeDemo = null;
  demoNoteEl.textContent = "";
  for (const btn of demoEl.querySelectorAll("button")) btn.setAttribute("aria-pressed", String(btn === noDemoBtn));
});
demoEl.appendChild(noDemoBtn);

for (const era of ERAS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = era.label;
  btn.dataset.era = era.id;
  btn.setAttribute("aria-pressed", "false");
  btn.addEventListener("click", () => loadEra(era));
  erasEl.appendChild(btn);
}

// ادعاءات موثّقة لكل حقبة (مسودة): تُعرض بعد مطابقة النص.
const CLAIM_ERAS = [1, 2, 3, 4, 5, 6];
const claimsEl = document.getElementById("claims-eras");
const claimsListEl = document.getElementById("claims-list");

function renderClaims(data) {
  const items = data.claims.map((c) => {
    const where = c.chapter ? `<div class="popup-sub">${escapeHtml(c.chapter)}</div>` : "";
    return `<div class="claim">${where}<div>${escapeHtml(c.statement)}</div>` +
      `<div class="quote">“${escapeHtml(c.quote)}”</div>` +
      `<div class="popup-sub">${escapeHtml(c.attributed_to)}</div>` +
      `<div class="popup-sub">تحفّظ: ${escapeHtml(c.hedge)}</div></div>`;
  });
  return items.length ? items.join("") : "<p>لا ادعاءات موثّقة لهذه الحقبة بعد.</p>";
}

async function loadClaims(n) {
  claimsListEl.textContent = "جارٍ التحميل...";
  try {
    const res = await fetch(`data/claims_era${n}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    claimsListEl.innerHTML = `<p class="popup-sub">${escapeHtml(data._meta.status)} (${data._meta.count})</p>` + renderClaims(data);
  } catch (err) {
    claimsListEl.textContent = `تعذّر تحميل الادعاءات: ${err.message}`;
  }
  for (const btn of claimsEl.querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", String(Number(btn.dataset.claims) === n));
  }
}

for (const n of CLAIM_ERAS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = `ح${n}`;
  btn.title = `ادعاءات الحقبة ${n}`;
  btn.dataset.claims = n;
  btn.setAttribute("aria-pressed", "false");
  btn.addEventListener("click", () => loadClaims(n));
  claimsEl.appendChild(btn);
}

// ادعاءات مرتبطة بأماكن على الخريطة (طبقة منفصلة، تُحمَّل عند الطلب).
const claimMapBtn = document.getElementById("claim-map-btn");
let claimLayerReady = false;

async function toggleClaimPoints() {
  const show = claimMapBtn.getAttribute("aria-pressed") !== "true";
  if (show && !claimLayerReady) {
    try {
      const res = await fetch("data/claim_points.geojson");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      map.addSource("claim-points", { type: "geojson", data });
      map.addLayer({
        id: "claim-points",
        type: "circle",
        source: "claim-points",
        paint: {
          "circle-radius": ["+", 10, ["*", 3, ["get", "count"]]],
          "circle-color": "#2a6f6a",
          "circle-opacity": 0.65,
          "circle-stroke-color": "#fffdf8",
          "circle-stroke-width": 2,
        },
      });
      map.on("click", "claim-points", (e) => {
        const p = e.features[0].properties;
        const list = JSON.parse(p.claims).map((c) =>
          `<div style="margin-top:6px">${escapeHtml(c.statement)}` +
          `<div class="popup-sub">حقبة ${c.era}: “${escapeHtml(c.quote)}”</div>` +
          `<div class="popup-sub">${escapeHtml(c.attributed_to)}</div></div>`
        ).join("");
        popup
          .setLngLat(e.lngLat)
          .setHTML(`<div class="popup-name">${escapeHtml(p.name_ar)} (${escapeHtml(p.name_en)})</div>${list}`)
          .addTo(map);
      });
      map.on("mouseenter", "claim-points", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "claim-points", () => (map.getCanvas().style.cursor = ""));
      claimLayerReady = true;
    } catch (err) {
      countEl.textContent = `تعذّر تحميل الادعاءات على الخريطة: ${err.message}`;
      return;
    }
  }
  if (claimLayerReady) map.setLayoutProperty("claim-points", "visibility", show ? "visible" : "none");
  claimMapBtn.setAttribute("aria-pressed", String(show));
  claimMapBtn.textContent = show ? "إخفاء الادعاءات من الخريطة" : "عرض الادعاءات على الخريطة";
}

claimMapBtn.addEventListener("click", toggleClaimPoints);

map.on("load", () => loadEra(ERAS[0]));
