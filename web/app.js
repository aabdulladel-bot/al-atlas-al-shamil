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
// تُطلب بلاطات الارتفاع عبر بروتوكول dem0 الذي يرفع ما تحت مستوى البحر إلى مستواه (انظر أدناه)
const DEM_TILES = "dem0://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
// بيانات الارتفاع تشمل أعماق البحار، فتبدو البحار خنادق غائرة بعد التضخيم، وترسم الظلالُ قاعَها خطوطاً فوق الماء.
// لذلك يُرفع كل ما تحت الصفر إلى الصفر قبل أن تستعمله الخريطة، فيستوي سطح البحر.
// الثمن: اليابسة تحت مستوى البحر (البحر الميت، ووادي الأردن، ومنخفض القطارة) تُعرض عند مستواه.
// ترميز terrarium: الارتفاع = أحمر×256 + أخضر + أزرق/256 − 32768، فالسالب كل ما أحمره دون 128، والصفر (128، 0، 0).
maplibregl.addProtocol("dem0", async (params, abortController) => {
  const res = await fetch(params.url.replace("dem0://", "https://"), { signal: abortController.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 128) { d[i] = 128; d[i + 1] = 0; d[i + 2] = 0; }
  ctx.putImageData(img, 0, 0);
  return { data: await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer() };
});
const DEM_ATTRIBUTION = "التضاريس: Terrain Tiles (USGS 3DEP/SRTM/GMTED2010، NOAA ETOPO1، Copernicus EU-DEM، وغيرها)";
// صور الأقمار الصناعية: NASA Blue Marble: Next Generation (مركّب صور MODIS الحقيقية، 500 م للبكسل) من خدمة NASA GIBS،
// ملك عام. تُجلب وقت العرض حتى المستوى 8، وبعده تُكبَّر البلاطات.
const SAT_TILES = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const SAT_ATTRIBUTION = "صور الأقمار الصناعية: NASA Blue Marble: Next Generation (Reto Stöckli، NASA Earth Observatory) عبر NASA GIBS";
// لكل أساس ألوانه: الظلال والسماء والحدود. صور الأقمار داكنة، فتُرسم الحدود فوقها بلون فاتح.
const HILLSHADE = {
  satellite: { "hillshade-exaggeration": 0.3, "hillshade-shadow-color": "#000000", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#000000" },
  drawn: { "hillshade-exaggeration": 0.45, "hillshade-shadow-color": cssVar("--relief-shadow"), "hillshade-highlight-color": cssVar("--relief-light"), "hillshade-accent-color": cssVar("--relief-shadow") },
};
// هالة الغلاف الجوي حول الكرة تخفت مع التقريب، والضباب عند الأفق فقط
const SKY = {
  satellite: { "sky-color": "#0b1d3a", "horizon-color": "#9cc3ef", "fog-color": "#9cc3ef", "fog-ground-blend": 0.9, "horizon-fog-blend": 0.4, "sky-horizon-blend": 0.6, "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 3, 0.8, 5, 0] },
  drawn: { "sky-color": cssVar("--sea"), "horizon-color": cssVar("--bg"), "fog-color": cssVar("--bg"), "fog-ground-blend": 0.9, "horizon-fog-blend": 0.4, "sky-horizon-blend": 0.6, "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 3, 0.8, 5, 0] },
};
const BORDER_COLOR = { satellite: "#ffe2b0", drawn: "#8a4b2a" };
const HIGHLIGHT_COLOR = { satellite: "#ff5a36", drawn: "#c0392b" };
const basemap = { mode: "satellite" };
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    // كرة أرضية افتراضياً، ويمكن التبديل إلى الخريطة المسطحة من لوحة الطبقات
    projection: { type: "globe" },
    sources: {
      land: { type: "geojson", data: "data/base/land.geojson" },
      lakes: { type: "geojson", data: "data/base/lakes.geojson" },
      rivers: { type: "geojson", data: "data/base/rivers.geojson" },
      // التضاريس: بلاطات الارتفاعات المفتوحة (Terrain Tiles على AWS)، تُجلب وقت العرض ولا تُخزَّن.
      // مصدران منفصلان للتجسيم وللظلال، كما توصي MapLibre، حتى لا تتنازعا دقة البلاطات.
      dem: { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 12, attribution: DEM_ATTRIBUTION },
      "dem-hs": { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 12, attribution: DEM_ATTRIBUTION },
      ocean: { type: "geojson", data: "data/base/ocean.geojson" },
      satellite: { type: "raster", tiles: [SAT_TILES], tileSize: 256, maxzoom: 8, attribution: SAT_ATTRIBUTION },
    },
    layers: [
      { id: "sea", type: "background", paint: { "background-color": cssVar("--sea") } },
      { id: "satellite", type: "raster", source: "satellite", paint: { "raster-fade-duration": 200 } },
      { id: "land", type: "fill", source: "land", layout: { visibility: "none" }, paint: { "fill-color": cssVar("--land") } },
      { id: "hillshade", type: "hillshade", source: "dem-hs", paint: HILLSHADE.satellite },
      { id: "ocean", type: "fill", source: "ocean", layout: { visibility: "none" }, paint: { "fill-color": cssVar("--sea") } },
      { id: "lakes", type: "fill", source: "lakes", layout: { visibility: "none" }, paint: { "fill-color": cssVar("--sea") } },
      { id: "rivers", type: "line", source: "rivers", paint: { "line-color": cssVar("--river"), "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 6, 1.6] } },
    ],
    sky: SKY.satellite,
  },
  center: [35, 32],
  zoom: 3,
  pitch: 35,
  maxPitch: 85,
  attributionControl: { customAttribution: "Natural Earth · Pleiades · OWID/HYDE · Gapminder" },
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "320px" });

// ---------- لوحة الطبقات: ما يختاره القارئ يعلو على ما تفتحه الأقسام ----------
// كل قسم يطلب إظهار طبقته أو إخفاءها عبر setVis، والطبقة لا تظهر إلا إذا طلبها القسم ولم يطفئها القارئ.
const LAYER_GROUPS = {
  hillshade: ["hillshade"],
  water: ["lakes", "rivers"],
  borders: ["borders-fill", "borders-halo", "borders-line-approx", "borders-line", "borders-highlight"],
  places: ["places"],
  claims: ["claim-points"],
  demography: ["demography"],
  labels: [], // أسماء الدول: عناصر HTML لا طبقات خريطة، تُدار في updateLabels
};
const groupOf = (id) => Object.keys(LAYER_GROUPS).find((g) => LAYER_GROUPS[g].includes(id));
const wanted = new Map(["hillshade", "lakes", "rivers"].map((id) => [id, true])); // طبقات الأساس ظاهرة ابتداءً
const userOff = new Set();
function setVis(id, on) {
  wanted.set(id, on);
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on && !userOff.has(groupOf(id)) ? "visible" : "none");
}
// التضخيم التلقائي: قوي على مستوى القارات حيث الجبال لا تُرى بمقياسها، وخفيف عند الاقتراب من الأرض
const autoExaggeration = (z) => Math.round(Math.max(1.5, Math.min(15, 15 * Math.pow(0.6, z - 3))) * 2) / 2;
const terrainState = { on: true, auto: true, exaggeration: autoExaggeration(3) };
function applyTerrain() {
  if (!map.getSource("dem")) return; // أُوقفت التضاريس لتعذّر الوصول إلى بلاطاتها
  map.setTerrain(terrainState.on ? { source: "dem", exaggeration: terrainState.exaggeration } : null);
}
map.on("zoomend", () => {
  if (!terrainState.auto) return;
  const e = autoExaggeration(map.getZoom());
  if (e === terrainState.exaggeration) return;
  terrainState.exaggeration = e;
  showExaggeration();
  if (terrainState.on) applyTerrain();
});
const reliefNoteEl = document.getElementById("relief-note");
// خطأ في بلاطات التضاريس لا يكسر الأطلس. إن فشلت البلاطات الأولى كلها (لا شبكة أو حجب)، تُوقف التضاريس والظلال
// فتكفّ الطلبات وتبقى الخريطة مسطحة مع ذكر السبب. وإن فشل بعضها فقط يُنبَّه إلى ذلك. والأخطاء الأخرى تُطبع كما كانت.
const dem = { ok: 0, failed: 0, stopped: false };
map.on("data", (e) => { if (e.dataType === "source" && (e.sourceId === "dem" || e.sourceId === "dem-hs") && e.tile) dem.ok++; });
function stopRelief() {
  dem.stopped = true;
  map.setTerrain(null);
  if (map.getLayer("hillshade")) map.removeLayer("hillshade");
  for (const id of ["dem", "dem-hs"]) if (map.getSource(id)) map.removeSource(id);
  for (const id of ["terrain-toggle", "terrain-exaggeration", "terrain-auto"]) document.getElementById(id).disabled = true;
  document.querySelector('#layer-panel input[data-group="hillshade"]').disabled = true;
  reliefNoteEl.textContent = "تعذّر الوصول إلى بلاطات التضاريس، فعُرضت الخريطة بلا تضاريس. بقية الطبقات تعمل.";
}
map.on("error", (e) => {
  if (e.sourceId === "satellite") {
    sat.failed++;
    if (!sat.stopped && sat.ok === 0 && sat.failed >= 8) stopSatellite();
    else if (!sat.stopped && sat.ok > 0) basemapNoteEl.textContent = "تعذّر تحميل بعض بلاطات صور الأقمار الصناعية.";
    return;
  }
  if (e.sourceId === "dem" || e.sourceId === "dem-hs") {
    dem.failed++;
    if (!dem.stopped && dem.ok === 0 && dem.failed >= 8) stopRelief();
    else if (!dem.stopped && dem.ok > 0) reliefNoteEl.textContent = "تعذّر تحميل بعض بلاطات التضاريس، فقد تظهر أجزاء مسطحة.";
    return;
  }
  console.error(e.error ?? e);
});
map.on("load", applyTerrain);

// ---------- الأساس: صور الأقمار الصناعية أو خريطة مرسومة ----------
const basemapNoteEl = document.getElementById("basemap-note");
function applyBasemap(mode) {
  basemap.mode = mode;
  const sat = mode === "satellite";
  document.getElementById("map").classList.toggle("space", sat);
  if (map.getLayer("satellite")) map.setLayoutProperty("satellite", "visibility", sat ? "visible" : "none");
  for (const id of ["land", "ocean"]) map.setLayoutProperty(id, "visibility", sat ? "none" : "visible");
  setVis("lakes", !sat); // البحيرات ظاهرة في الصور نفسها
  if (map.getLayer("hillshade")) for (const [k, v] of Object.entries(HILLSHADE[mode])) map.setPaintProperty("hillshade", k, v);
  map.setSky(SKY[mode]);
  if (map.getLayer("borders-fill")) {
    map.setPaintProperty("borders-fill", "fill-color", BORDER_COLOR[mode]);
    for (const id of ["borders-halo", "borders-line-approx", "borders-line"]) map.setPaintProperty(id, "line-color", BORDER_COLOR[mode]);
    map.setPaintProperty("borders-highlight", "line-color", HIGHLIGHT_COLOR[mode]);
  }
}
wanted.set("lakes", false);
document.getElementById("map").classList.add("space");
// إن فشلت أولى بلاطات الصور كلها (لا شبكة أو حجب) يُحذف مصدرها فتكفّ الطلبات، ويُعرض الأساس المرسوم مع ذكر السبب
const sat = { ok: 0, failed: 0, stopped: false };
map.on("data", (e) => { if (e.dataType === "source" && e.sourceId === "satellite" && e.tile) sat.ok++; });
function stopSatellite() {
  sat.stopped = true;
  if (map.getLayer("satellite")) map.removeLayer("satellite");
  if (map.getSource("satellite")) map.removeSource("satellite");
  const satRadio = document.querySelector('input[name="basemap"][value="satellite"]');
  satRadio.disabled = true;
  document.querySelector('input[name="basemap"][value="drawn"]').checked = true;
  applyBasemap("drawn");
  basemapNoteEl.textContent = "تعذّر الوصول إلى صور الأقمار الصناعية (NASA GIBS)، فعُرضت الخريطة المرسومة.";
}
// على الشاشات الضيقة: قسم الطبقات مطويّ، والإسناد مطويّ خلف زر ⓘ، لتبقى الخريطة مرئية
if (isNarrow()) {
  document.getElementById("layer-panel").open = false;
  map.on("load", () => document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
}
document.getElementById("layer-panel").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.group) {
    if (t.checked) userOff.delete(t.dataset.group); else userOff.add(t.dataset.group);
    for (const id of LAYER_GROUPS[t.dataset.group]) if (wanted.has(id)) setVis(id, wanted.get(id));
    if (t.dataset.group === "labels") updateLabels();
  } else if (t.id === "terrain-toggle") {
    terrainState.on = t.checked;
    applyTerrain();
  } else if (t.name === "projection") {
    map.setProjection({ type: t.value });
  } else if (t.name === "basemap") {
    applyBasemap(t.value);
  }
});
const exaggerationEl = document.getElementById("terrain-exaggeration");
const exaggerationVal = document.getElementById("terrain-exaggeration-val");
const exaggerationAutoEl = document.getElementById("terrain-auto");
function showExaggeration() {
  exaggerationEl.value = String(terrainState.exaggeration);
  exaggerationVal.textContent = `×${terrainState.exaggeration}${terrainState.auto ? " (تلقائي)" : ""}`;
  exaggerationAutoEl.checked = terrainState.auto;
}
showExaggeration();
exaggerationEl.addEventListener("input", () => {
  terrainState.auto = false;
  terrainState.exaggeration = Number(exaggerationEl.value);
  showExaggeration();
  if (terrainState.on) applyTerrain();
});
exaggerationAutoEl.addEventListener("change", () => {
  terrainState.auto = exaggerationAutoEl.checked;
  if (terrainState.auto) terrainState.exaggeration = autoExaggeration(map.getZoom());
  showExaggeration();
  if (terrainState.on) applyTerrain();
});

// ---------- أسماء الدول اليوم بالعربية ----------
// عناصر HTML يرسمها المتصفح، فيأتي الخط العربي سليماً بلا خطوط خارجية. الاسم والموضع وأدنى تقريب من Natural Earth.
// تظهر الأسماء عند تقريب أدنى بدرجة مما يقترحه المصدر، لأن الكرة تعرض العالم أصغر من الخريطة المسطحة.
const countryLabels = [];
function updateLabels() {
  const on = !userOff.has("labels");
  const z = map.getZoom();
  for (const l of countryLabels) {
    const show = on && z >= l.min - 1;
    if (show && !l.added) { l.marker.addTo(map); l.added = true; } else if (!show && l.added) { l.marker.remove(); l.added = false; }
  }
  declutterLabels();
}
// منع التراكب: الأسماء مرتبة بأولويتها في المصدر (أدنى تقريب أولاً)، ويُخفى كل اسم يتراكب مع اسم أعلى منه أولوية
// حتى يُقرَّب. ما خلف الكرة أو التضاريس تخفيه MapLibre (opacityWhenCovered) فلا يحجز مكاناً.
function declutterLabels() {
  const kept = [];
  for (const l of countryLabels) {
    if (!l.added) continue;
    const el = l.marker.getElement();
    el.style.visibility = "";
    if (el.style.opacity === "0") continue;
    const r = el.getBoundingClientRect();
    const box = { l: r.left - 3, r: r.right + 3, t: r.top - 2, b: r.bottom + 2 };
    if (kept.some((k) => box.l < k.r && box.r > k.l && box.t < k.b && box.b > k.t)) el.style.visibility = "hidden";
    else kept.push(box);
  }
}
map.on("load", async () => {
  let data;
  try { data = await getJson("data/borders/modern_labels.json"); } catch { return; }
  for (const l of data.labels) {
    const el = document.createElement("div");
    el.className = `country-label${l.min <= 2 ? " major" : l.min <= 3 ? " mid" : ""}`;
    el.textContent = l.ar;
    el.title = l.en;
    countryLabels.push({ min: l.min, added: false, marker: new maplibregl.Marker({ element: el, anchor: "center", opacity: "1", opacityWhenCovered: "0" }).setLngLat([l.x, l.y]) });
  }
  updateLabels();
});
map.on("zoomend", updateLabels);
map.on("moveend", declutterLabels);

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
  // حكم من الأطلس لا من المصدر: قبل القرن العشرين لم تُرسم أكثر الحدود بمعاهدات، فتُرسم كلها تقريبية
  const approxAll = !modern && Number(key) < 1900;
  const namedFeats = data.features.filter((f) => f.properties.NAME);
  const preciseCount = namedFeats.filter((f) => f.properties.BORDERPRECISION === 3).length;
  const unnamedCount = data.features.length - namedFeats.length;
  borderNoteEl.textContent = modern
    ? `حدود الدول اليوم (${data.features.length} كياناً) من Natural Earth، ملك عام.`
    : `حدود سنة ${yearLabel(key)}: ${namedFeats.length} مضلعاً مسمّى، ` +
      (preciseCount ? `${preciseCount} منها يصفه المصدر بأنه محدد، و${namedFeats.length - preciseCount} تقريبي` : "كلها تقريبية في المصدر") +
      `${unnamedCount ? `، و${unnamedCount} أرضاً بلا كيان مسمّى` : ""}. المصدر: Historical Basemaps (GPL-3).` +
      (approxAll && preciseCount ? " قبل 1900 يرسم الأطلس كل الحدود تقريبية، لأن كثيراً منها لم يكن مرسوماً بمعاهدات آنذاك، والنافذة تذكر وصف المصدر." : "");
  const named = ["to-boolean", ["get", "NAME"]];
  // قبل 1900 لا شيء يُرسم محدداً: شرط لا يتحقق (لا دقة سالبة في المصدر)
  const precise = ["==", ["get", "BORDERPRECISION"], approxAll ? -1 : 3];
  const fillOpacity = ["case", ["!", named], 0, precise, 0.16, 0.07];
  if (map.getSource("borders")) {
    map.getSource("borders").setData(data);
    map.setPaintProperty("borders-fill", "fill-opacity", fillOpacity);
    map.setFilter("borders-halo", ["all", named, ["!", precise]]);
    map.setFilter("borders-line-approx", ["all", named, ["!", precise]]);
    map.setFilter("borders-line", ["all", named, precise]);
    map.setFilter("borders-highlight", ["==", ["get", "NAME"], ""]);
    return data;
  }
  map.addSource("borders", { type: "geojson", data });
  const before = map.getLayer("places") ? "places" : undefined;
  // الدقة ترسم اليقين: الحد المحدد خط متصل، والتقريبي (أو مجهول الدقة) خط متقطع فوق هالة ضبابية
  // تُري الحد منطقةً لا خطاً. والأرض التي لا يسمّي المصدر عليها كياناً تبقى بلا تعبئة ولا حد.
  const bc = BORDER_COLOR[basemap.mode];
  map.addLayer({ id: "borders-fill", type: "fill", source: "borders", paint: { "fill-color": bc, "fill-opacity": fillOpacity } }, before);
  map.addLayer({
    id: "borders-halo", type: "line", source: "borders", filter: ["all", named, ["!", precise]],
    paint: { "line-color": bc, "line-opacity": 0.32, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 4, 4, 10, 7, 22], "line-blur": ["interpolate", ["linear"], ["zoom"], 1, 3, 4, 8, 7, 18] },
  }, before);
  map.addLayer({ id: "borders-line-approx", type: "line", source: "borders", filter: ["all", named, ["!", precise]], paint: { "line-color": bc, "line-width": 1, "line-opacity": 0.55, "line-dasharray": [3, 3] } }, before);
  map.addLayer({ id: "borders-line", type: "line", source: "borders", filter: ["all", named, precise], paint: { "line-color": bc, "line-width": 1.3, "line-opacity": 0.75 } }, before);
  map.addLayer({ id: "borders-highlight", type: "line", source: "borders", filter: ["==", ["get", "NAME"], ""], paint: { "line-color": HIGHLIGHT_COLOR[basemap.mode], "line-width": 3 } }, before);
  map.on("click", "borders-fill", (e) => {
    const p = e.features[0].properties;
    if (!p.NAME) {
      popup.setLngLat(e.lngLat).setHTML(`<div class="popup-sub">أرض لا يسمّي المصدر عليها كياناً في هذه السنة</div>`).addTo(map);
      return;
    }
    const prec = `${PRECISION_LABEL[p.BORDERPRECISION] ?? "غير مذكورة"} (بحسب المصدر)`;
    popup.setLngLat(e.lngLat).setHTML(`<div class="popup-name">${escapeHtml(p.NAME)}</div>${p.PARTOF && p.PARTOF !== p.NAME ? `<div class="popup-sub">ضمن: ${escapeHtml(p.PARTOF)}</div>` : ""}<div class="popup-sub">دقة الحد: ${escapeHtml(prec)}</div>`).addTo(map);
  });
  pointerOn("borders-fill");
  for (const id of LAYER_GROUPS.borders) setVis(id, true);
  return data;
}
async function loadEra(era) {
  markEra(era.id);
  descEl.textContent = era.desc;
  loadBorders(era.border);
  if (!era.file) {
    setVis("places", false);
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
    setVis("places", true);
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
    setVis("places", true);
  }
  fitTo(data.features, 6);
  for (const btn of erasEl.querySelectorAll("button")) btn.setAttribute("aria-pressed", String(Number(btn.dataset.era) === era.id));
}
const borderSelect = document.getElementById("border-select");
const borderNoteEl = document.getElementById("border-note");
borderSelect.innerHTML = `<option value="modern">الدول اليوم (Natural Earth)</option>` + BORDER_YEARS.map((y) => `<option value="${y}">${escapeHtml(yearLabel(y))}</option>`).join("");
borderSelect.addEventListener("change", () => loadBorders(borderSelect.value === "modern" ? "modern" : Number(borderSelect.value)));
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
    setVis("demography", false);
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
    setVis("demography", true);
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
    setVis("demography", true);
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
    const note = p.place_note ? `<div class="popup-sub">${escapeHtml(p.place_note)}</div>` : "";
    popup.setLngLat(e.lngLat).setHTML(`<div class="popup-name">${escapeHtml(p.name_ar)}</div>${note}${list}`).addTo(map);
  });
  pointerOn("claim-points");
  return true;
}
function showClaimPoints(show, filter = null) {
  if (!map.getLayer("claim-points")) return;
  map.setFilter("claim-points", filter);
  setVis("claim-points", show);
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

// ---------- لوحة التحولات: مطابقة جغرافية بين خريطتين (مسبقة الحساب في scripts/build_transitions.py) ----------
const TRANSITION_KEYS = [...BORDER_YEARS.map(String), "modern"];
const transitionLabel = (k) => (k === "modern" ? "الدول اليوم" : yearLabel(k));
const trFrom = document.getElementById("tr-from");
const trTo = document.getElementById("tr-to");
const trResultEl = document.getElementById("tr-result");
const trOptions = TRANSITION_KEYS.map((k) => `<option value="${k}">${escapeHtml(transitionLabel(k))}</option>`).join("");
trFrom.innerHTML = trOptions;
trTo.innerHTML = trOptions;
trFrom.value = "1800";
trTo.value = "1945";
const pct = (x) => `${Math.round(x * 100)}%`;
// زر اسم يُظهر الكيان على خريطة سنته
const entBtn = (name, key) => `<button type="button" class="ent" data-key="${escapeHtml(key)}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
// المصير والمنشأ: علاقات مكانية بين خريطتين، لا أحكام تاريخية بالسببية
const FATES = [
  ["split", "انقسمت أرضه", "كيانان أو أكثر أخذ كل منهما 10% فأكثر من أرضه"],
  ["succeeded", "خلفه اسم آخر على معظم أرضه", "أكثر من نصف أرضه في كيان واحد، وأكثر من نصف ذلك الكيان من أرضه: تغيّر اسم أو خلافة دولة"],
  ["absorbed", "دخلت أرضه في كيان أوسع", "ربع أرضه فأكثر صار جزءاً صغيراً من كيان أكبر"],
  ["reduced", "تقلّص", "بقي ربع أرضه فأكثر في كيان قائم عليها، وما بقي بلا كيان مسمّى"],
  ["dispersed", "توزّعت أرضه بين كيانات صغيرة", "لم يأخذ أي كيان ربع أرضه"],
  ["vanished", "زال ولم يغطِّ أرضه كيان مسمّى", "أقل من ربع أرضه تحت كيانات مسمّاة في الخريطة الثانية"],
  ["name_moved", "بقي اسمه في موضع آخر", "الاسم نفسه لكن التداخل أقل من الربع"],
  ["kept", "بقي اسمه", "الاسم نفسه على جزء من الأرض نفسها"],
];
const ORIGINS = [
  ["merged", "تكوّن من أراضي عدة كيانات", "كيانان أو أكثر أسهم كل منهما بـ 10% فأكثر من أرضه"],
  ["carved", "قام على جزء من كيان أوسع", "ربع أرضه فأكثر من كيان أكبر منه"],
  ["expanded", "قام على كيان سابق وتجاوزه", "أكثر من نصف أرض الكيان السابق فيه، وأكثر أرضه من خارجه"],
  ["assembled", "تجمّع من قطع صغيرة", "لم يُسهم أي كيان بربع أرضه"],
  ["new_land", "قام على أرض لم يسمّها المصدر", "أقل من ربع أرضه تحت كيانات مسمّاة في الخريطة الأولى"],
];
const trCache = new Map();
async function transitionData(a, b) {
  const k = `${a}__${b}`;
  if (!trCache.has(k)) trCache.set(k, getJson(`data/transitions/${k}.json`));
  return trCache.get(k);
}
function linkText(links, i, key) {
  // links: [الاسم، نصيبه من أرض الأول، نصيب الأول من أرضه]
  return links.filter((l) => l[i] >= 0.1).map((l) => `<span class="lk">${entBtn(l[0], key)} <span class="sub">${pct(l[i])}</span></span>`).join(" · ");
}
function fateLine(r, a, b) {
  const f = r.fate;
  const head = `${entBtn(r.name, a)}${r.precision === 1 ? ' <span class="sub" title="حدود تقريبية في المصدر">≈</span>' : ""}`;
  if (f.type === "kept" || f.type === "name_moved") {
    const ratio = f.area_ratio;
    const change = ratio >= 1.5 ? `اتسع ×${ratio.toFixed(1)}` : ratio <= 0.67 ? `تقلّص إلى ${pct(ratio)}` : "";
    return `<li>${head}${change ? ` <span class="sub">${change}</span>` : ""}<span class="sub research-only"> · بقي ${pct(f.retained)} من أرضه تحت الاسم</span></li>`;
  }
  if (f.type === "dispersed" || f.type === "vanished") return `<li>${head} <span class="sub research-only">تغطية الكيانات المسمّاة: ${pct(f.named_cover)}</span></li>`;
  return `<li>${head} ← ${linkText(r.links, 1, b)}</li>`;
}
function originLine(r, a, b) {
  const o = r.origin;
  const head = `${entBtn(r.name, b)}${r.name_ar ? ` <span class="sub">${escapeHtml(r.name_ar)}</span>` : ""}`;
  if (o.type === "assembled" || o.type === "new_land") return `<li>${head} <span class="sub research-only">تغطية الكيانات المسمّاة: ${pct(o.named_cover)}</span></li>`;
  return `<li>${head} ← ${linkText(r.links, 2, a)}</li>`;
}
function group(label, help, items) {
  if (!items.length) return "";
  return `<details><summary>${escapeHtml(label)} <b>${items.length}</b></summary><p class="sub">${escapeHtml(help)}</p><ul class="tr-list">${items.join("")}</ul></details>`;
}
let trRequest = 0;
async function showTransition() {
  const req = ++trRequest;
  let a = trFrom.value;
  let b = trTo.value;
  if (a === b) { trResultEl.textContent = "اختر سنتين مختلفتين."; return; }
  const swapped = TRANSITION_KEYS.indexOf(a) > TRANSITION_KEYS.indexOf(b);
  if (swapped) [a, b] = [b, a];
  trResultEl.textContent = "جارٍ التحميل...";
  let d;
  try { d = await transitionData(a, b); } catch (err) { if (req === trRequest) trResultEl.textContent = `تعذّر تحميل المقارنة: ${err.message}`; return; }
  if (req !== trRequest) return; // تغيّر الاختيار أثناء التحميل
  const c = d.counts;
  const n = (side, t) => c[side][t] ?? 0;
  const fates = FATES.map(([t, label, help]) => group(label, help, d.from.filter((r) => r.fate.type === t).map((r) => fateLine(r, a, b))));
  const origins = ORIGINS.map(([t, label, help]) => group(label, help, d.to.filter((r) => r.origin.type === t).map((r) => originLine(r, a, b))));
  trResultEl.innerHTML =
    (swapped ? `<p class="sub">رُتّبت السنتان زمنياً.</p>` : "") +
    `<p>من ${escapeHtml(transitionLabel(a))} (${d.from.length} كياناً مسمّى) إلى ${escapeHtml(transitionLabel(b))} (${d.to.length}): ` +
    `بقي اسم <b>${n("from", "kept")}</b>، وحلّ اسم آخر على معظم أرض <b>${n("from", "succeeded")}</b>، وانقسم <b>${n("from", "split")}</b>، ودخل <b>${n("from", "absorbed")}</b> في كيان أوسع.</p>` +
    `<h4 class="tr-h">مصير كيانات ${escapeHtml(transitionLabel(a))}</h4>${fates.join("")}` +
    `<h4 class="tr-h">منشأ الكيانات الجديدة في ${escapeHtml(transitionLabel(b))}</h4>${origins.join("")}`;
}
// الضغط على اسم يعرض حدود سنته ويقرّب إليه ويبرزه
trResultEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button.ent");
  if (!btn) return;
  const key = btn.dataset.key === "modern" ? "modern" : Number(btn.dataset.key);
  const data = await loadBorders(key);
  if (!data) return;
  const name = btn.dataset.name;
  const feats = data.features.filter((f) => f.properties.NAME === name);
  if (!feats.length) return;
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => { if (typeof c[0] === "number") { bb[0] = Math.min(bb[0], c[0]); bb[1] = Math.min(bb[1], c[1]); bb[2] = Math.max(bb[2], c[0]); bb[3] = Math.max(bb[3], c[1]); } else c.forEach(walk); };
  for (const f of feats) walk(f.geometry.coordinates);
  map.setFilter("borders-highlight", ["==", ["get", "NAME"], name]);
  map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: fitPadding(), maxZoom: 6 });
});
trFrom.addEventListener("change", showTransition);
trTo.addEventListener("change", showTransition);
showTransition();
