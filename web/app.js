// الأطلس الشامل: الواجهة.
// الطبقات: خريطة أساس (Natural Earth)، مواقع الحقب (Pleiades)، السكان، أماكن الادعاءات، والسنن.

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isNarrow = () => window.innerWidth < 600;
// اللوحة على يمين الشاشة (أو شريط مطويّ أعلاها على الجوال)، وشريط الزمن أسفلها، فتوضع النقاط في المساحة الحرة بينهما.
const timebarHeight = () => document.getElementById("timebar")?.offsetHeight ?? 0;
// حشوة الخريطة نفسها (viewPadding أدناه) تحجز مكان اللوحة وشريط الزمن، وMapLibre تضيفها إلى حشوة كل تقريب،
// فيكفي هنا هامش حول المعالم
const fitPadding = () => (isNarrow() ? { top: 30, bottom: 30, left: 30, right: 30 } : { top: 40, bottom: 40, left: 40, right: 40 });
// الافتتاحية: الكرة تبدأ بعيدة ثم تقترب، إلا لمن طلب من نظامه تقليل الحركة
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const FIRST_VIEW = { center: [35, 32], zoom: 2.8, pitch: 30, bearing: 0 };

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
// النسخة المنشورة صفحةً على claude.ai لا تصل إلى أي مضيف خارجي، فتأتي ببلاطات محزومة يعرّفها tilepacks.js
// (scripts/build_artifact_bundle.mjs): ملف ثنائي لكل مستوى تقريب وفهرس بإزاحات بلاطاته. وبغيرها تُجلب البلاطات من الشبكة.
const PACKS = window.TILE_PACKS ?? null;
// الحزمة نص بترميز base64 لأن منصة النشر لا تقدّم الملفات الثنائية العامة. لكل مستوى فهرس (x/y ← [قطعة، إزاحة، طول])
// وقطع لا تتجاوز حدّ الملف. المستويات العميقة محزومة لإقليم العالم القديم فقط، وما خارجه يُشتق من أقرب سلف محزوم.
function base64Buffer(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
const packCache = new Map();
const packFetch = (file, read) => { if (!packCache.has(file)) packCache.set(file, fetch(file).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return read(r); })); return packCache.get(file); };
async function packTile(layer, z, x, y) {
  const lvl = PACKS?.[layer]?.files?.[z];
  if (!lvl) return null;
  const entry = (await packFetch(lvl.index, (r) => r.json()))[`${x}/${y}`];
  if (!entry) return null;
  const buf = await packFetch(lvl.chunks[entry[0]], (r) => r.text().then(base64Buffer));
  return buf.slice(entry[1], entry[1] + entry[2]);
}
// أقرب بلاطة محزومة: البلاطة نفسها أو أحد أسلافها، ومعها فرق المستوى لاقتطاع موضعها منه
async function packOrAncestor(layer, z, x, y) {
  for (let dz = 0; dz <= z; dz++) {
    const buf = await packTile(layer, z - dz, x >> dz, y >> dz);
    if (buf) return { buf, dz };
  }
  throw new Error(`لا بلاطة محزومة: ${layer}/${z}/${x}/${y}`);
}
const tileBitmap = (buf) => createImageBitmap(new Blob([buf]), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
// صورة: يُقتطع موضع البلاطة من سلفها ويُكبَّر بتنعيم
maplibregl.addProtocol("pack", async (params) => {
  const [layer, z, x, y] = params.url.slice("pack://".length).split("/").map((v, i) => (i ? Number(v) : v));
  const { buf, dz } = await packOrAncestor(layer, z, x, y);
  if (!dz) return { data: buf };
  const n = 1 << dz, size = 256 / n;
  const canvas = new OffscreenCanvas(256, 256);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(await tileBitmap(buf), (x % n) * size, (y % n) * size, size, size, 0, 0, 256, 256);
  return { data: await (await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 })).arrayBuffer() };
});
const DEM_TILES = PACKS?.dem ? "dem0://pack/dem/{z}/{x}/{y}" : "dem0://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
// بيانات الارتفاع تشمل أعماق البحار، فتبدو البحار خنادق غائرة بعد التضخيم، وترسم الظلالُ قاعَها خطوطاً فوق الماء.
// لذلك يُرفع كل ما تحت الصفر إلى الصفر قبل أن تستعمله الخريطة، فيستوي سطح البحر.
// الثمن: اليابسة تحت مستوى البحر (البحر الميت، ووادي الأردن، ومنخفض القطارة) تُعرض عند مستواه.
// ترميز terrarium: الارتفاع = أحمر×256 + أخضر + أزرق/256 − 32768. والبلاطة المشتقة من سلف تُكبَّر بالاستيفاء في الارتفاع نفسه
// لا في الألوان، لأن خلط قنوات الترميز يعطي ارتفاعات خاطئة.
maplibregl.addProtocol("dem0", async (params, abortController) => {
  let buf, dz = 0, x = 0, y = 0;
  if (params.url.startsWith("dem0://pack/")) {
    let z;
    [, z, x, y] = params.url.slice("dem0://pack/".length).split("/").map((v, i) => (i ? Number(v) : v));
    ({ buf, dz } = await packOrAncestor("dem", z, x, y));
  } else {
    const res = await fetch(params.url.replace("dem0://", "https://"), { signal: abortController.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = await res.arrayBuffer();
  }
  const bmp = await tileBitmap(buf);
  const canvas = new OffscreenCanvas(256, 256);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, 256, 256);
  const src = ctx.getImageData(0, 0, 256, 256);
  const s = src.data;
  // البلاطة بدقتها: يكفي رفع ما تحت الصفر إلى الصفر في مكانه (السالب كل ما أحمره دون 128، والصفر 128، 0، 0)
  if (!dz) {
    for (let i = 0; i < s.length; i += 4) if (s[i] < 128) { s[i] = 128; s[i + 1] = 0; s[i + 2] = 0; }
    ctx.putImageData(src, 0, 0);
    return { data: await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer() };
  }
  // المشتقة من سلف: استيفاء ثنائي في الارتفاع نفسه
  const height = (i) => Math.max(0, s[i] * 256 + s[i + 1] + s[i + 2] / 256 - 32768);
  const out = ctx.createImageData(256, 256);
  const d = out.data;
  const n = 1 << dz, step = 1 / n, ox = (x % n) * (256 / n), oy = (y % n) * (256 / n);
  for (let py = 0; py < 256; py++) {
    const sy = Math.min(255, Math.max(0, oy + (py + 0.5) * step - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(255, y0 + 1), fy = sy - y0;
    for (let px = 0; px < 256; px++) {
      const sx = Math.min(255, Math.max(0, ox + (px + 0.5) * step - 0.5));
      const x0 = Math.floor(sx), x1 = Math.min(255, x0 + 1), fx = sx - x0;
      const h = (height((y0 * 256 + x0) * 4) * (1 - fx) + height((y0 * 256 + x1) * 4) * fx) * (1 - fy) + (height((y1 * 256 + x0) * 4) * (1 - fx) + height((y1 * 256 + x1) * 4) * fx) * fy;
      const v = h + 32768, o = (py * 256 + px) * 4;
      d[o] = Math.floor(v / 256); d[o + 1] = Math.floor(v) % 256; d[o + 2] = Math.floor((v - Math.floor(v)) * 256); d[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return { data: await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer() };
});
const DEM_ATTRIBUTION = "التضاريس: Terrain Tiles (USGS 3DEP/SRTM/GMTED2010، NOAA ETOPO1، Copernicus EU-DEM، وغيرها)";
// صور الأقمار الصناعية: NASA Blue Marble: Next Generation (مركّب صور MODIS الحقيقية، 500 م للبكسل) من خدمة NASA GIBS،
// ملك عام. تُجلب وقت العرض حتى المستوى 8، وبعده تُكبَّر البلاطات.
const SAT_TILES = PACKS?.sat ? "pack://sat/{z}/{x}/{y}" : "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const SAT_ATTRIBUTION = "صور الأقمار الصناعية: NASA Blue Marble: Next Generation (Reto Stöckli، NASA Earth Observatory) عبر NASA GIBS";
// لكل أساس ألوانه: الظلال والسماء والحدود. صور الأقمار داكنة، فتُرسم الحدود فوقها بلون فاتح.
const HILLSHADE = {
  satellite: { "hillshade-exaggeration": 0.3, "hillshade-shadow-color": "#000000", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#000000" },
  drawn: { "hillshade-exaggeration": 0.45, "hillshade-shadow-color": cssVar("--relief-shadow"), "hillshade-highlight-color": cssVar("--relief-light"), "hillshade-accent-color": cssVar("--relief-shadow") },
};
// هالة الغلاف الجوي حول الكرة تخفت مع التقريب، والضباب عند الأفق فقط
const SKY = {
  satellite: { "sky-color": "#0b1d3a", "horizon-color": "#9cc3ef", "fog-color": "#9cc3ef", "fog-ground-blend": 0.9, "horizon-fog-blend": 0.4, "sky-horizon-blend": 0.6, "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 0.9, 6, 0] },
  drawn: { "sky-color": cssVar("--sea"), "horizon-color": cssVar("--bg"), "fog-color": cssVar("--bg"), "fog-ground-blend": 0.9, "horizon-fog-blend": 0.4, "sky-horizon-blend": 0.6, "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 3, 0.8, 5, 0] },
};
// لون ثابت لكل كيان عبر السنوات: درجة لون تُشتق من معرّفه في ويكي بيانات إن تحقق، وإلا من اسمه في المصدر،
// فيبقى الكيان نفسه بلونه نفسه من خريطة إلى أخرى. اللون تمييز بصري فقط، ولا يحمل معنى تاريخياً.
function hueOf(key) {
  let h = 2166136261;
  for (const ch of String(key)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}
const ENTITY_SL = { satellite: "78%, 66%", drawn: "48%, 46%" };
const entityColor = (mode) => ["to-color", ["concat", "hsl(", ["to-string", ["get", "_h"]], `, ${ENTITY_SL[mode]})`]];
const swatchColor = (h) => `hsl(${h}, ${ENTITY_SL[basemap.mode]})`;
const HIGHLIGHT_COLOR = { satellite: "#ffffff", drawn: "#2a2620" };
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
      dem: { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: PACKS?.dem?.maxzoom ?? 12, attribution: DEM_ATTRIBUTION },
      "dem-hs": { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: PACKS?.dem?.maxzoom ?? 12, attribution: DEM_ATTRIBUTION },
      ocean: { type: "geojson", data: "data/base/ocean.geojson" },
      satellite: { type: "raster", tiles: [SAT_TILES], tileSize: 256, maxzoom: PACKS?.sat?.maxzoom ?? 8, attribution: SAT_ATTRIBUTION },
    },
    layers: [
      { id: "sea", type: "background", paint: { "background-color": cssVar("--sea") } },
      { id: "satellite", type: "raster", source: "satellite", paint: { "raster-fade-duration": 200 } },
      { id: "land", type: "fill", source: "land", layout: { visibility: "none" }, paint: { "fill-color": cssVar("--land") } },
      // الخريطة المرسومة ملوّنة بالارتفاع من بيانات التضاريس نفسها، بألوان الأطالس الورقية (البحر تغطيه طبقة ocean)
      { id: "relief", type: "color-relief", source: "dem-hs", layout: { visibility: "none" }, paint: { "color-relief-opacity": 0.9, "color-relief-color": ["interpolate", ["linear"], ["elevation"], 0, cssVar("--relief-0"), 300, cssVar("--relief-1"), 800, cssVar("--relief-2"), 1500, cssVar("--relief-3"), 2500, cssVar("--relief-4"), 4000, cssVar("--relief-5")] } },
      { id: "hillshade", type: "hillshade", source: "dem-hs", paint: HILLSHADE.satellite },
      { id: "ocean", type: "fill", source: "ocean", layout: { visibility: "none" }, paint: { "fill-color": cssVar("--sea") } },
      { id: "lakes", type: "fill", source: "lakes", layout: { visibility: "none" }, paint: { "fill-color": cssVar("--sea") } },
      { id: "rivers", type: "line", source: "rivers", paint: { "line-color": cssVar("--river"), "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 6, 1.6] } },
    ],
    sky: SKY.satellite,
  },
  ...(reduceMotion ? FIRST_VIEW : { center: [-10, 18], zoom: 0.9, pitch: 0, bearing: 25 }),
  maxPitch: 85,
  // الإسناد مطويّ خلف زر ⓘ فلا يركب على أزرار الخريطة، ونصّه الكامل في «المصادر والتراخيص»
  attributionControl: { compact: true, customAttribution: "Natural Earth · Pleiades · OWID/HYDE · Gapminder" },
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");

// ---------- لوحة الطبقات: ما يختاره القارئ يعلو على ما تفتحه الأقسام ----------
// كل قسم يطلب إظهار طبقته أو إخفاءها عبر setVis، والطبقة لا تظهر إلا إذا طلبها القسم ولم يطفئها القارئ.
const LAYER_GROUPS = {
  hillshade: ["hillshade", "relief"],
  water: ["lakes", "rivers"],
  borders: ["borders-prev-fill", "borders-prev-line", "borders-fill", "borders-halo", "borders-line-approx", "borders-line", "borders-highlight"],
  peoples: ["peoples-fill", "peoples-line"],
  places: ["places"],
  claims: ["claim-points"],
  demography: ["demography"],
  labels: [], // أسماء الدول: عناصر HTML لا طبقات خريطة، تُدار في updateLabels
};
const groupOf = (id) => Object.keys(LAYER_GROUPS).find((g) => LAYER_GROUPS[g].includes(id));
const wanted = new Map(["hillshade", "lakes", "rivers"].map((id) => [id, true])); // طبقات الأساس ظاهرة ابتداءً
const userOff = new Set(["demography"]); // السكان مطفأة ابتداءً، ويشعلها القارئ من بطاقات الطبقات
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
  for (const id of ["hillshade", "relief"]) if (map.getLayer(id)) map.removeLayer(id);
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
  setVis("relief", !sat);
  if (map.getLayer("hillshade")) for (const [k, v] of Object.entries(HILLSHADE[mode])) map.setPaintProperty("hillshade", k, v);
  map.setSky(SKY[mode]);
  if (map.getLayer("borders-fill")) {
    map.setPaintProperty("borders-fill", "fill-color", entityColor(mode));
    for (const id of ["borders-halo", "borders-line-approx", "borders-line"]) map.setPaintProperty(id, "line-color", entityColor(mode));
    if (map.getLayer("borders-prev-fill")) { map.setPaintProperty("borders-prev-fill", "fill-color", entityColor(mode)); map.setPaintProperty("borders-prev-line", "line-color", entityColor(mode)); }
    map.setPaintProperty("borders-highlight", "line-color", HIGHLIGHT_COLOR[mode]);
  }
}
wanted.set("lakes", false);
wanted.set("relief", false);
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
// الإسناد مطويّ خلف زر ⓘ. وعلى الشاشات الضيقة تُطوى اللوحة إلى شريط عنوان، لتبقى الخريطة مرئية
map.on("load", () => document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
const panelEl = document.getElementById("panel");
const panelToggle = document.getElementById("panel-toggle");
function setPanelCollapsed(c) {
  panelEl.classList.toggle("collapsed", c);
  panelToggle.setAttribute("aria-expanded", String(!c));
  panelToggle.textContent = c ? "القائمة" : "إخفاء";
}
panelToggle.addEventListener("click", () => {
  const open = panelEl.classList.contains("collapsed");
  if (open && !cardEl.hidden) closeCard();
  setPanelCollapsed(!open);
});
if (isNarrow()) setPanelCollapsed(true);
// الكرة في وسط المساحة الحرة: حشوة الخريطة تحجز مكان اللوحة (يمين المكتب، أو شريط عنوانها على الجوال) وشريط الزمن،
// فيتوسّط مركزُ الخريطة ما بقي مرئياً، وتبني عليها كل حركات الكاميرا والتقريب
function viewPadding() {
  const bottom = timebarHeight();
  // أثناء العرض: صندوقه على اليمين (أو أسفل الجوال)
  if (document.body.classList.contains("showcasing")) return isNarrow() ? { top: 0, bottom: bottom + Math.round(window.innerHeight * 0.42), left: 0, right: 0 } : { top: 0, bottom, left: 0, right: 432 };
  if (isNarrow()) return { top: 64, bottom, left: 0, right: 0 };
  return { top: 0, bottom, left: 0, right: panelEl.offsetWidth + 12 };
}
function applyPadding() { map.setPadding(viewPadding()); }
window.addEventListener("resize", applyPadding);
applyPadding();

// ---------- الفضاء: نجوم تُولَّد في المتصفح بلا ملفات خارجية، وتنزاح قليلاً مع حركة الكرة ----------
(function starfield() {
  const w = 1024, c = document.createElement("canvas");
  c.width = c.height = w;
  const ctx = c.getContext("2d");
  let seed = 20260;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 1100; i++) {
    const big = rnd() > 0.94;
    const r = big ? 0.9 + rnd() * 1.1 : 0.25 + rnd() * 0.7;
    const a = (big ? 0.7 : 0.3) + rnd() * 0.3;
    const tint = rnd();
    ctx.fillStyle = tint < 0.12 ? `rgba(255,214,170,${a})` : tint < 0.26 ? `rgba(185,208,255,${a})` : `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * w, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const el = document.getElementById("map");
  el.style.setProperty("--stars", `url(${c.toDataURL("image/png")})`);
  map.on("move", () => {
    const p = map.getCenter();
    el.style.setProperty("--sx", `${(-p.lng * 3 - map.getBearing() * 2).toFixed(1)}px`);
    el.style.setProperty("--sy", `${(p.lat * 3).toFixed(1)}px`);
  });
})();
// يعيد مربعات الطبقات وظهورها إلى ما في userOff (بعد أن يغيّره العرض أو قائمة السكان)
function syncLayerInputs() {
  for (const cb of document.querySelectorAll("#layer-panel input[data-group]")) cb.checked = !userOff.has(cb.dataset.group);
  for (const g of Object.keys(LAYER_GROUPS)) for (const id of LAYER_GROUPS[g]) if (wanted.has(id)) setVis(id, wanted.get(id));
  updateLabels();
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

// ---------- أسماء الدول والكيانات على الخريطة ----------
// عناصر HTML يرسمها المتصفح، فيأتي الخط العربي سليماً بلا خطوط خارجية. تتبع التسميات سنة الحدود المعروضة:
// الدول اليوم (Natural Earth: الاسم والموضع وأدنى تقريب) أو كيانات السنة التاريخية (web/data/borders/labels_{سنة}.json:
// الاسم العربي من ويكي بيانات بعد التحقق، والموضع نقطة تمثيلية داخل الكيان، وأدنى تقريب من مساحته).
// ما لا اسم عربياً موثّقاً له يظهر باسمه الإنجليزي بخط مميّز، والتفاصيل في البطاقة.
// تظهر الأسماء عند تقريب أدنى بدرجة مما تقترحه البيانات، لأن الكرة تعرض العالم أصغر من الخريطة المسطحة.
let countryLabels = [];
let labelKey = null;
let labelInfo = new Map(); // الاسم الإنجليزي في المصدر ← بيانات تسميته، للبطاقة
const labelCache = new Map();
function updateLabels() {
  const on = !userOff.has("labels");
  const z = map.getZoom();
  for (const l of countryLabels) {
    // ما لا اسم عربياً موثّقاً له لا يظهر في المستويات البعيدة، فلا تزدحم الكرة بأسماء إنجليزية
    const show = on && z >= (l.latin ? Math.max(l.min, 3.5) : l.min - 1);
    if (show && !l.added) { l.marker.addTo(map); l.added = true; } else if (!show && l.added) { l.marker.remove(); l.added = false; }
  }
  declutterLabels();
}
// منع التراكب: الأسماء مرتبة بأولويتها (أدنى تقريب أو أكبر مساحة أولاً)، ويُخفى كل اسم يتراكب مع اسم أعلى منه أولوية
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
// بيانات أسماء سنة (أو null إن تعذّرت)، تُحمَّل مرة واحدة وتستعملها الأسماء والألوان والبطاقة
function labelData(key) {
  const url = String(key) === "modern" ? "data/borders/modern_labels.json" : `data/borders/labels_${key}.json`;
  if (!labelCache.has(url)) labelCache.set(url, getJson(url).catch(() => null));
  return labelCache.get(url);
}
async function showLabels(key) {
  key = String(key);
  if (key === labelKey) return;
  labelKey = key;
  const data = await labelData(key);
  if (!data) return;
  if (key !== labelKey) return; // تغيّرت السنة أثناء التحميل
  for (const l of countryLabels) if (l.added) l.marker.remove();
  labelInfo = new Map(data.labels.map((l) => [l.en, l]));
  countryLabels = data.labels.map((l) => {
    const el = document.createElement("div");
    el.className = `country-label${l.min <= 2 ? " major" : l.min <= 3 ? " mid" : ""}${l.ar ? "" : " latin"}`;
    if (l.st === "arabized") {
      // تعريب تقديري: العربي هو الأساس، والإنجليزي تحته بخط صغير
      el.classList.add("arabized");
      el.append(l.ar, Object.assign(document.createElement("small"), { textContent: l.en }));
      el.title = `تعريب تقديري من الاسم الإنجليزي «${l.en}»، يحتاج مراجعة لغوية`;
    } else {
      el.textContent = l.ar ?? l.en;
      el.title = l.ar ? l.en : "لا اسم عربي موثّق بعد";
    }
    return { min: l.min, latin: !l.ar, added: false, marker: new maplibregl.Marker({ element: el, anchor: "center", opacity: "1", opacityWhenCovered: "0" }).setLngLat([l.x, l.y]) };
  });
  // الأسماء العربية أولاً في منع التراكب، ثم ما لا عربي له، مع حفظ ترتيب الأهمية داخل كلٍّ منهما
  countryLabels.sort((a, b) => a.latin - b.latin);
  updateLabels();
}
map.on("zoomend", updateLabels);
map.on("moveend", declutterLabels);

// ---------- البطاقة: درج جانبي على المكتب، وورقة سفلية على الجوال ----------
// النقر على الخريطة يمرّ بحَكَم واحد (آخر الملف) يختار أعلى ما تحت المؤشر أولوية ويفتح بطاقته هنا،
// ويذكر ما تحته أيضاً. الاسم العربي عنوان، والشواهد قبل التفاصيل، ومصدر البيانات في تذييل مطويّ.
const fmtInt = (n) => Math.round(n).toLocaleString("ar-u-nu-latn");
// رقم كبير مقروء («5.3 مليون») والدقيق في التلميح
function fmtBig(n) {
  const f = (x, d) => x.toLocaleString("ar-u-nu-latn", { maximumFractionDigits: d });
  if (n >= 1e9) return `${f(n / 1e9, 2)} مليار`;
  if (n >= 1e6) return `${f(n / 1e6, 1)} مليون`;
  if (n >= 1e4) return `${f(n / 1e3, 0)} ألف`;
  return fmtInt(n);
}
const yearText = (y) => (String(y) === "modern" ? "اليوم" : yearLabel(Number(y)));
const cardEl = document.getElementById("card");
const cardBody = document.getElementById("card-body");
let cardToken = 0; // يُبطل تحميلاً متأخراً لبطاقة فُتحت بعدها أخرى
let cardCurrent = null; // { c, f }: المعروض الآن
let cardAlso = []; // ما تحت المؤشر غير المعروض، لروابط «وهنا أيضاً»
let cardEntity = null; // { name, kind }: الكيان المعروض، لتتبّعه عبر الزمن
function openCard(html) {
  if (isNarrow()) setPanelCollapsed(true); // على الجوال: البطاقة أو القائمة، لا الاثنتان
  cardBody.innerHTML = html;
  cardEl.hidden = false;
  cardEl.scrollTop = 0;
  document.body.classList.add("card-open");
  return ++cardToken;
}
function updateCard(token, html) {
  if (token === cardToken && !cardEl.hidden) cardBody.innerHTML = html;
}
function closeCard() {
  cardToken++;
  cardCurrent = null;
  cardEntity = null;
  cardEl.hidden = true;
  cardEl.classList.remove("full");
  document.body.classList.remove("card-open");
  if (map.getLayer("borders-highlight")) map.setFilter("borders-highlight", ["==", ["get", "NAME"], ""]);
  markPoint(null);
}
cardEl.querySelector(".card-close").addEventListener("click", closeCard);
cardEl.querySelector(".card-grip").addEventListener("click", () => cardEl.classList.toggle("full"));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || cardEl.hidden) return;
  e.stopImmediatePropagation(); // يغلق البطاقة وحدها، لا الرحلة أو العرض تحتها
  closeCard();
});
// حلقة حول النقطة المختارة
function markPoint(coords) {
  const data = { type: "FeatureCollection", features: coords ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coords } }] : [] };
  if (map.getSource("selected")) { map.getSource("selected").setData(data); return; }
  if (!coords) return;
  map.addSource("selected", { type: "geojson", data });
  map.addLayer({ id: "selected", type: "circle", source: "selected", paint: { "circle-radius": 16, "circle-opacity": 0, "circle-stroke-width": 2.5, "circle-stroke-color": HIGHLIGHT_COLOR[basemap.mode] } });
}

const chip = (text, cls = "", attrs = "") => (attrs
  ? `<button type="button" class="chip ${cls}" ${attrs}>${escapeHtml(text)}</button>`
  : `<span class="chip ${cls}">${escapeHtml(text)}</span>`);
function cardHead({ title, en = "", swatch = "", chips = [], note = "" }) {
  return `<header class="ch"><div class="ch-row">${swatch ? `<i class="ch-sw" style="background:${swatch}"></i>` : ""}<h2>${escapeHtml(title)}</h2></div>` +
    (en && en !== title ? `<div class="ch-en" dir="ltr">${escapeHtml(en)}</div>` : "") +
    (chips.length ? `<div class="chips">${chips.join("")}</div>` : "") +
    (note ? `<p class="ch-note">${note}</p>` : "") + `</header>`;
}
// items: [التسمية، القيمة المقروءة، القيمة الدقيقة للتلميح]
function statsHtml(items) {
  const list = items.filter((x) => x && x[1]);
  return list.length ? `<div class="stats">${list.map(([k, v, t]) => `<div class="stat"${t ? ` title="${escapeHtml(t)}"` : ""}><b>${escapeHtml(v)}</b><span>${escapeHtml(k)}</span></div>`).join("")}</div>` : "";
}
function aboutHtml(rows) {
  const dl = rows.filter((r) => r && r[1]).map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${v}</dd>`).join("");
  return dl ? `<details class="card-about"><summary>عن هذه البيانات</summary><dl class="card-dl">${dl}</dl></details>` : "";
}
function alsoHtml() {
  if (!cardAlso.length) return "";
  return `<div class="card-also">وهنا أيضاً: <span class="chips">${cardAlso.map((h, i) => chip(`${h.c.kind}: ${h.c.label(h.f.properties)}`, "", `data-also="${i}"`)).join("")}</span></div>`;
}
function nameSourceHtml(info, modern) {
  if (modern) {
    return info?.source_ar
      ? `تعديل تحريري معلن لصاحب المشروع؛ الاسم في Natural Earth: «${escapeHtml(info.source_ar)}»`
      : "Natural Earth (ملك عام)";
  }
  if (info?.st === "other_era") {
    const when = [info.from != null ? `قام ${yearLabel(info.from)}` : "", info.to != null ? `وزال ${yearLabel(info.to)}` : ""].filter(Boolean).join(" ");
    return `الاسم «${escapeHtml(info.ar_other)}» في ويكي بيانات (${info.qid ? `<a href="https://www.wikidata.org/wiki/${encodeURIComponent(info.qid)}" target="_blank" rel="noopener">${escapeHtml(info.qid)}</a>` : ""}) لكيان آخر بالاسم نفسه ${when}، لا لهذه السنة؛ المعروض اسم المصدر`;
  }
  if (info?.st === "arabized") return "تعريب تقديري من الاسم الإنجليزي، لا اسم عربي موثّق؛ يحتاج مراجعة لغوية";
  if (!info?.ar) return "لا اسم عربي موثّق بعد؛ المعروض اسم المصدر";
  const link = info.qid ? `<a href="https://www.wikidata.org/wiki/${encodeURIComponent(info.qid)}" target="_blank" rel="noopener">${escapeHtml(info.qid)}</a>` : "";
  const span = [info.from != null ? `نشأ ${yearLabel(info.from)}` : "", info.to != null ? `زال ${yearLabel(info.to)}` : ""].filter(Boolean).join("، ");
  if (info.st === "verified") return `ويكي بيانات ${link} (CC0)، متحقق زمنياً${span ? ` (${span})` : ""}`;
  if (info.st === "undated") return `ويكي بيانات ${link} (CC0)، بلا تواريخ فيها للتحقق الزمني`;
  if (info.st === "override") return `تعديل يدوي معلن ${link}`;
  return `ويكي بيانات ${link}`;
}

// شريط حياة الكيان: سنوات الخرائط التي يظهر فيها اسمه، والضغط على سنة ينقل الزمن إليها ويتبعه
function lifeHtml(years, key, swatch) {
  const on = new Set([...(years ?? []).map(String), String(key)]);
  const dots = TIME_STOPS.map((k) => {
    const has = on.has(String(k));
    const now = String(k) === String(key);
    return `<button type="button" class="life-dot${has ? " on" : ""}${now ? " now" : ""}" title="${escapeHtml(yearText(k))}"${has && !now ? ` data-follow="${k}"` : " disabled"}></button>`;
  }).join("");
  const list = TIME_STOPS.filter((k) => on.has(String(k))).map(yearText).join("، ");
  return `<div class="life" style="--sw:${swatch}"><div class="life-title">يظهر على خرائط: ${escapeHtml(list)}</div>` +
    `<div class="life-track">${dots}</div><div class="life-labels"><span>${escapeHtml(yearText(TIME_STOPS[0]))}</span><span>اليوم</span></div></div>`;
}

// شواهد الادعاءات الواقعة على أرض الكيان في هذه الخريطة (web/data/links، من scripts/build_spatial_links.py).
// ربط مكاني محسوب على حدود المصدر، لا حكم تاريخي: الكيان يُختار بالمكان داخل مضلعه.
const linksCache = new Map();
async function loadLinks(key) {
  if (!linksCache.has(key)) {
    try { linksCache.set(key, await getJson(`data/links/claims_by_entity_${key}.json`)); } catch { linksCache.set(key, {}); }
  }
  return linksCache.get(key);
}
const TIER_CLASS = { "متحقق": "tier-v", "قريب من الحد": "tier-r", "شعب": "tier-r", "محل خلاف": "tier-x", "غير متحقق": "tier-x" };
function linkedEvidenceHtml(name, links) {
  const list = links?.[name] ?? [];
  if (!list.length) return `<section class="card-sec"><h3>الشواهد على أرضه</h3><p class="sub">لا شاهد موثّقاً يقع على أرضه في هذه الخريطة بعد.</p></section>`;
  const rows = list.map((c) => `<article class="ev-card"><div class="ev-st">${escapeHtml(c.statement)}</div>` +
    `<div class="ev-by">— <bdi>${escapeHtml(c.attributed_to)}</bdi> · <bdi>${escapeHtml(c.place_ar)}</bdi>${c.place_note ? ` (${escapeHtml(c.place_note)})` : ""}</div>` +
    `<div class="chips">${chip(c.tier, TIER_CLASS[c.tier] ?? "")}${c.sunan.map((s) => chip(s)).join("")}</div>` +
    `<div class="ev-by">${escapeHtml(c.tier_reason)}</div></article>`).join("");
  return `<section class="card-sec"><h3>الشواهد على أرضه (${fmtInt(list.length)})</h3><p class="sub">ربط مكاني محسوب على حدود المصدر، يُصنَّف كل شاهد بمستواه وسببه، ولا يُعدّ حكماً تاريخياً.</p>${rows}</section>`;
}

const entityTitle = (p) => p.NAME_AR || labelInfo.get(p.NAME)?.ar || p.NAME || "أرض بلا كيان مسمّى";
function openEntityCard(f, kind) {
  const p = f.properties;
  const key = time.key;
  markPoint(null);
  if (!p.NAME) {
    cardEntity = null;
    openCard(cardHead({ title: "أرض بلا كيان مسمّى", note: `لا يسمّي المصدر كياناً على هذه الأرض في خريطة ${escapeHtml(yearText(key))}.` }) + alsoHtml());
    return;
  }
  const people = kind === "people";
  cardEntity = { name: p.NAME, kind };
  if (map.getLayer("borders-highlight")) map.setFilter("borders-highlight", ["==", ["get", "NAME"], people ? "" : p.NAME]);
  const modern = String(key) === "modern";
  const info = labelInfo.get(p.NAME);
  const title = entityTitle(p);
  const swatch = people ? PEOPLE_COLOR : swatchColor(p._h ?? hueOf(info?.qid ?? p.NAME));
  const approxAll = !modern && Number(key) < 1900;
  const preciseBorder = modern || (!approxAll && Number(p.BORDERPRECISION) === 3);
  const chips = [chip(`خريطة ${yearText(key)}`), chip(people ? "شعب أو قبيلة" : "كيان سياسي"), chip(preciseBorder ? "حد محدد" : "حد تقريبي")];
  if (info?.st === "arabized") chips.push(chip("تعريب تقديري", "tier-r"));
  else if (!p.NAME_AR && !info?.ar) chips.push(chip("لا اسم عربي موثّق", "tier-x"));
  const notes = [];
  if (people) notes.push("مجموعة بشرية لا دولة، وحدودها تقريبية في المصدر، ولا تُعدّ في إحصاء الدول.");
  if (p.PARTOF && p.PARTOF !== p.NAME) notes.push(`ضمن: <bdi>${escapeHtml(labelInfo.get(p.PARTOF)?.ar ?? p.PARTOF)}</bdi>`);
  const span = info?.st === "verified" && (info.from != null || info.to != null)
    ? `${info.from != null ? yearLabel(info.from) : "؟"} – ${info.to != null ? yearLabel(info.to) : "؟"}` : "";
  const top = cardHead({ title, en: p.NAME, swatch, chips, note: notes.join("<br>") }) +
    statsHtml([["المساحة على هذه الخريطة (كم²)", info?.a ? fmtBig(info.a) : "", info?.a ? `${fmtInt(info.a)} كم² تقريباً` : ""], ["مدته في ويكي بيانات", span]]) +
    lifeHtml(info?.years, key, swatch);
  const prec = modern ? "محددة (Natural Earth)" : `${PRECISION_LABEL[p.BORDERPRECISION] ?? "غير مذكورة"} بحسب المصدر${approxAll ? "، ويرسمها الأطلس تقريبية" : ""}`;
  const about = aboutHtml([
    ["الاسم في المصدر", escapeHtml(p.NAME)],
    ["دقة الحد", escapeHtml(prec)],
    ["مصدر الاسم العربي", nameSourceHtml(info, modern)],
    ["مصدر الحدود", modern ? "Natural Earth (ملك عام)" : "Historical Basemaps (GPL-3)"],
  ]);
  const token = openCard(top + `<section class="card-sec"><h3>الشواهد على أرضه</h3><p class="sub">جارٍ التحميل…</p></section>` + about + alsoHtml());
  loadLinks(key).then((links) => updateCard(token, top + linkedEvidenceHtml(p.NAME, links) + about + alsoHtml()));
}
// تتبّع الكيان المعروض إلى سنة أخرى: ينتقل الزمن، ثم تُفتح بطاقته في تلك السنة إن وُجد فيها
async function followEntity(k) {
  if (!cardEntity) return;
  const { name, kind } = cardEntity;
  const data = await loadBorders(k);
  const src = kind === "people" ? peoplesData : data;
  const f = src?.features.find((x) => x.properties.NAME === name);
  cardAlso = [];
  if (f) { cardCurrent = { c: CLICKABLE.find((c) => c.layer === (kind === "people" ? "peoples-fill" : "borders-fill")), f }; openEntityCard(f, kind); } else closeCard();
}

// دور كل ادعاء في السنن: مؤيد أو مقيِّد (يُملأ عند تحميل السنن)
const claimRoles = new Map();
const COORD_SHORT = {
  "pleiades-representative": "نقطة تمثيلية من Pleiades",
  approximate: "موقع تقديري",
  "natural-earth-modern-city": "موقع المدينة الحديثة",
  "wikidata-modern-city": "موقع المدينة الحديثة",
};
function openClaimCard(f) {
  const p = f.properties;
  markPoint(f.geometry.coordinates);
  if (map.getLayer("borders-highlight")) map.setFilter("borders-highlight", ["==", ["get", "NAME"], ""]);
  cardEntity = null;
  const only = activeSunna ? new Set(activeSunna.ids) : null;
  const claims = JSON.parse(p.claims).filter((c) => !only || only.has(c.id));
  const rows = claims.map((c) => {
    const era = ERAS.find((x) => x.id === Number(c.era));
    const roles = (claimRoles.get(c.id) ?? []).map((r) => chip(`${r.role === "limit" ? "يقيّد" : "يؤيد"}: ${r.name}`, r.role));
    return `<article class="ev-card"><div class="ev-st">${escapeHtml(c.statement)}</div>` +
      `<blockquote class="ev-q" dir="auto">“${escapeHtml(c.quote)}”</blockquote>` +
      `<div class="ev-by">— <bdi>${escapeHtml(c.attributed_to)}</bdi></div>` +
      (c.hedge ? `<div class="ev-hedge">تحفّظ: ${escapeHtml(c.hedge)}</div>` : "") +
      `<div class="chips">${era ? chip(`الحقبة ${era.id}: ${era.label}`, "", `data-time="${era.border}" title="انقل الخريطة إلى زمنه"`) : ""}${roles.join("")}</div></article>`;
  }).join("");
  openCard(cardHead({
    title: p.name_ar, en: p.name_en,
    chips: [chip(COORD_SHORT[p.coord_status] ?? p.coord_status), chip(`الشواهد هنا: ${fmtInt(claims.length)}`, "tier-v")],
    note: p.place_note && p.place_note !== "null" ? escapeHtml(p.place_note) : "",
  }) + `<section class="card-sec"><h3>ما تقوله المصادر عن هذا المكان</h3><p class="sub">كل اقتباس مطابق لنص مصدره، ومعه قائله وتحفّظه.</p>${rows}</section>` +
    aboutHtml([["الموقع", escapeHtml(COORD_LABEL[p.coord_status] ?? p.coord_status)]]) + alsoHtml());
}
function openPlaceCard(f) {
  const p = f.properties;
  markPoint(f.geometry.coordinates);
  if (map.getLayer("borders-highlight")) map.setFilter("borders-highlight", ["==", ["get", "NAME"], ""]);
  cardEntity = null;
  const era = ERAS.find((x) => x.id === Number(p.era));
  openCard(cardHead({
    title: p.name_ar, en: p.name_en,
    chips: [era ? chip(`الحقبة ${era.id}: ${era.label}`) : "", chip(COORD_SHORT[p.coord_status] ?? p.coord_status)].filter(Boolean),
  }) + aboutHtml([
    ["الموقع", escapeHtml(COORD_LABEL[p.coord_status] ?? p.coord_status)],
    ["في Pleiades", p.pleiades_id && p.pleiades_id !== "null" ? `<a href="https://pleiades.stoa.org/places/${encodeURIComponent(p.pleiades_id)}" target="_blank" rel="noopener">${escapeHtml(p.pleiades_title || p.pleiades_id)}</a>` : ""],
    ["في المصدر", p.source_name && p.source_name !== "null" ? escapeHtml(`${p.source_name}${p.source_country && !String(p.source_country).startsWith("wikidata") ? `، ${p.source_country}` : ""}`) : ""],
  ]) + alsoHtml());
}
// أسماء الأقاليم الستة في سلسلة السكان الإقليمية، وأسماء الدول من أسماء Natural Earth العربية إن طابقت
const REGION_AR = { Africa: "أفريقيا", Asia: "آسيا", Europe: "أوروبا", "North and Central America": "أمريكا الشمالية والوسطى", "South America": "أمريكا الجنوبية", Oceania: "أوقيانوسيا" };
let modernAr = new Map();
const demoTitle = (p) => REGION_AR[p.name_en] ?? modernAr.get(p.name_en) ?? p.name_en;
function openDemoCard(f) {
  const p = f.properties;
  markPoint(f.geometry.coordinates);
  if (map.getLayer("borders-highlight")) map.setFilter("borders-highlight", ["==", ["get", "NAME"], ""]);
  cardEntity = null;
  const region = p.level === "region";
  openCard(cardHead({
    title: demoTitle(p), en: p.name_en,
    chips: [chip(`سنة ${yearLabel(Number(p.year))}`), chip(region ? "إقليم حديث التقسيم" : "دولة بحدودها الحديثة")],
    note: region ? "الرقم لإقليم حديث التقسيم، وليس لحدود الحقبة." : "الرقم لأرض الدولة بحدودها الحديثة، لا لكيانات الحقبة.",
  }) + statsHtml([["نسمة", fmtBig(Number(p.population)), `${formatPop(p.population)} نسمة`]]) +
    aboutHtml([["المصدر", escapeHtml(demoMeta?.attribution ?? "")], ["ملاحظة", escapeHtml(demoMeta?.note ?? "")]]) + alsoHtml());
}

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
// from وto مدة الحقبة كما في وصفها، ويُرسم بها شريط الزمن وتُعرف بها حقبة كل سنة حدود
const ERAS = [
  { id: 1, from: -4000, to: -1200, border: -4000, label: "الماء والاستقرار", file: "data/places_era1.geojson", desc: "الحقبة الأولى: وادي الرافدين ومصر القديمة (4000-1200 ق.م)." },
  { id: 2, from: -1200, to: -500, border: -1000, label: "الطرق والممالك", file: "data/places_era2.geojson", desc: "الحقبة الثانية: الطرق والممالك الأولى (1200-500 ق.م)." },
  { id: 3, from: -500, to: 300, border: -1, label: "الإمبراطوريات الكبرى", file: "data/places_era3.geojson", desc: "الحقبة الثالثة: الإمبراطوريات الكبرى (500 ق.م-300م)." },
  { id: 4, from: 300, to: 1000, border: 700, label: "الأديان الكبرى", file: "data/places_era4.geojson", desc: "الحقبة الرابعة: الأديان الكبرى وتشكّل العالم القديم المتأخر (300-1000م). مدن العصر الإسلامي (بغداد والبصرة وسامراء والقيروان والفسطاط) مواقع مدن حديثة، لا مواقع أثرية." },
  { id: 5, from: 1000, to: 1450, border: 1200, label: "التبادل العابر للقارات", file: "data/places_era5.geojson", desc: "الحقبة الخامسة: التبادل العابر للقارات (1000-1450م). مدن العالم الإسلامي (القاهرة وتونس وفاس وأصفهان وسمرقند وحلب ودلهي) مواقع مدن حديثة من Natural Earth، لا مواقع أثرية." },
  { id: 6, from: 1450, to: 1760, border: 1600, label: "الكشوف وتبادل العالم", file: "data/places_era6.geojson", desc: "الحقبة السادسة: الكشوف وتبادل العالم (1450-1760م). الحدود تقريبية لسنة 1600. المدن مراكز كبرى مختارة للحقبة، ومواقعها وأسماؤها من Natural Earth، وهي مواقع المدن الحديثة." },
  { id: 7, from: 1760, to: 1914, border: 1800, label: "الصناعة والمدينة", file: "data/places_era7.geojson", desc: "الحقبة السابعة: الصناعة والمدينة (1760-1914م). الحدود تقريبية لسنة 1800. المدن مراكز كبرى مختارة للحقبة، ومواقعها وأسماؤها من Natural Earth، وهي مواقع المدن الحديثة." },
  { id: 8, from: 1914, to: 2025, border: "modern", label: "الحروب العالمية والدولة الحديثة", file: "data/places_era8.geojson", desc: "الحقبة الثامنة: الحروب العالمية والدولة الحديثة (1914-2025م). الخريطة هنا حدود الدول اليوم من Natural Earth (ملك عام)، ويمكن اختيار حدود 1945 من القائمة. المواقع عواصم الدول اليوم من المصدر نفسه." },
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
// طبقة الشعوب والقبائل: مضلعات يصنّفها ويكي بيانات شعوباً لا دولاً، ترسمها فوق الحدود بلون ونقط مختلفين.
// تقريبية كما في المصدر، ولا تُعدّ دولاً في الإحصاء ولا في الشواهد السياسية.
const PEOPLE_COLOR = "#7d4f8f";
let peoplesData = null;
// تهشير مائل للشعوب: انتماء بشري لا سيادة، فلا تُملأ مثل الدول
function peoplePattern() {
  if (map.hasImage("people-hatch")) return;
  const n = 12;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d");
  ctx.strokeStyle = PEOPLE_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const d of [-n, 0, n]) { ctx.moveTo(d, n); ctx.lineTo(d + n, 0); }
  ctx.stroke();
  map.addImage("people-hatch", ctx.getImageData(0, 0, n, n));
}
async function loadPeoples(key) {
  let data;
  try { data = await getJson(`data/borders/peoples_${key}.geojson`); } catch { data = { type: "FeatureCollection", features: [] }; }
  peoplesData = data;
  setLayerCount("peoples", data.features.length ? `المضلعات: ${fmtInt(data.features.length)}` : "لا شيء في هذه السنة");
  if (map.getSource("peoples")) {
    map.getSource("peoples").setData(data);
  } else {
    peoplePattern();
    map.addSource("peoples", { type: "geojson", data });
    map.addLayer({ id: "peoples-fill", type: "fill", source: "peoples", paint: { "fill-pattern": "people-hatch", "fill-opacity": 0.8 } });
    map.addLayer({ id: "peoples-line", type: "line", source: "peoples", paint: { "line-color": PEOPLE_COLOR, "line-width": 1.2, "line-dasharray": [2, 2], "line-opacity": 0.85 } });
    pointerOn("peoples-fill");
  }
  for (const id of LAYER_GROUPS.peoples) setVis(id, true);
}

// ---------- الزمن: سنة واحدة تقود الحدود والأسماء والشعوب والمواقع والسكان والشواهد ----------
// سنوات الحدود المتاحة هي محطات الزمن، و«اليوم» آخرها. شريط الزمن وقائمة الحدود وأزرار الحقب والرحلات والعرض
// كلها تمرّ بـ loadBorders، فلا تجتمع حدود سنة مع مواقع حقبة أخرى أو سكانها.
const TIME_STOPS = [...BORDER_YEARS, "modern"];
const MODERN_YEAR = 2025; // موضع «اليوم» على الشريط، كما في scripts/config/spatial_rules.json
const time = { key: null, token: 0 };
const timeKey = (v) => (String(v) === "modern" ? "modern" : Number(v));
const yearOf = (k) => (String(k) === "modern" ? MODERN_YEAR : Number(k));
const eraOf = (k) => { const y = yearOf(k); return ERAS.find((e) => y >= e.from && y < e.to) ?? ERAS[ERAS.length - 1]; };
// طبقة السكان الأقرب إلى كل سنة حدود (r: الأقاليم الستة، c: الدول). 1914 و1945 لا طبقة قريبة منهما،
// فلا يُعرض لهما سكان بدل عرض أرقام سنة بعيدة. والسنة الفعلية للبيانات تُذكر في بطاقة الطبقة والبطاقة.
const DEMO_FOR_TIME = { "-4000": "r1", "-1000": "r2", "-1": "r3", 700: "r4", 1200: "r5", 1600: "r6", 1800: "r7", 2010: "c8", modern: "c8" };
const setLayerCount = (g, text) => { const el = document.getElementById(`lc-${g}`); if (el) el.textContent = text; };

// الانتقال بين سنتين تلاشٍ متقاطع: الخريطة السابقة تخفت والجديدة تظهر. ولا تُحرَّك الحدود من شكل إلى شكل،
// لأن الحدود الوسيطة تكون مختلَقة؛ والتلاشي يُري الفجوة بين الخريطتين ولا يملؤها بالتخمين.
const FADE_MS = 900;
const EMPTY_FC = { type: "FeatureCollection", features: [] };
let bordersShown = null;
let fadeRaf = 0;
// t من 0 إلى 1 يُضرب في عتامة كل طبقات الحدود
function bordersOpacity(t, fillOpacity) {
  map.setPaintProperty("borders-fill", "fill-opacity", t === 1 ? fillOpacity : ["*", t, fillOpacity]);
  map.setPaintProperty("borders-halo", "line-opacity", 0.28 * t);
  map.setPaintProperty("borders-line-approx", "line-opacity", 0.7 * t);
  map.setPaintProperty("borders-line", "line-opacity", 0.85 * t);
}
function crossfade(prev, fillOpacity) {
  cancelAnimationFrame(fadeRaf);
  if (!map.getSource("borders-prev")) {
    map.addSource("borders-prev", { type: "geojson", data: EMPTY_FC });
    const ec = entityColor(basemap.mode);
    map.addLayer({ id: "borders-prev-fill", type: "fill", source: "borders-prev", paint: { "fill-color": ec, "fill-opacity": 0 } }, "borders-fill");
    map.addLayer({ id: "borders-prev-line", type: "line", source: "borders-prev", paint: { "line-color": ec, "line-width": 1.1, "line-opacity": 0 } }, "borders-fill");
    setVis("borders-prev-fill", true);
    setVis("borders-prev-line", true);
  }
  map.getSource("borders-prev").setData(prev);
  const named = ["case", ["to-boolean", ["get", "NAME"]], 0.22, 0];
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / FADE_MS);
    const e = t * t * (3 - 2 * t);
    bordersOpacity(e, fillOpacity);
    map.setPaintProperty("borders-prev-fill", "fill-opacity", ["*", 1 - e, named]);
    map.setPaintProperty("borders-prev-line", "line-opacity", 0.6 * (1 - e));
    if (t < 1) fadeRaf = requestAnimationFrame(step);
    else map.getSource("borders-prev").setData(EMPTY_FC);
  };
  fadeRaf = requestAnimationFrame(step);
}
async function loadBorders(key) {
  key = timeKey(key);
  const token = ++time.token;
  time.key = key;
  borderSelect.value = String(key);
  renderTime();
  const modern = key === "modern";
  const url = modern ? "data/borders/modern_countries.geojson" : `data/borders/borders_${key}.geojson`;
  let data, labels;
  try { [data, labels] = await Promise.all([getJson(url), labelData(key)]); } catch (err) { borderNoteEl.textContent = `تعذّر تحميل الحدود: ${err.message}`; return; }
  if (token !== time.token) return data; // طُلبت سنة أخرى أثناء التحميل
  // لون كل كيان من معرّفه في ويكي بيانات إن تحقق، وإلا من اسمه في المصدر
  const qids = new Map((labels?.labels ?? []).filter((l) => l.qid).map((l) => [l.en, l.qid]));
  for (const f of data.features) if (f.properties.NAME) f.properties._h = hueOf(qids.get(f.properties.NAME) ?? f.properties.NAME);
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
      (approxAll && preciseCount ? " قبل 1900 يرسم الأطلس كل الحدود تقريبية، لأن كثيراً منها لم يكن مرسوماً بمعاهدات آنذاك، والبطاقة تذكر وصف المصدر." : "");
  const named = ["to-boolean", ["get", "NAME"]];
  // قبل 1900 لا شيء يُرسم محدداً: شرط لا يتحقق (لا دقة سالبة في المصدر)
  const precise = ["==", ["get", "BORDERPRECISION"], approxAll ? -1 : 3];
  const fillOpacity = ["case", ["!", named], 0, precise, 0.3, 0.2];
  showLabels(key);
  if (map.getSource("borders")) {
    const prev = bordersShown;
    map.getSource("borders").setData(data);
    if (prev && prev !== data && !reduceMotion) crossfade(prev, fillOpacity); else bordersOpacity(1, fillOpacity);
    map.setFilter("borders-halo", ["all", named, ["!", precise]]);
    map.setFilter("borders-line-approx", ["all", named, ["!", precise]]);
    map.setFilter("borders-line", ["all", named, precise]);
    map.setFilter("borders-highlight", ["==", ["get", "NAME"], cardEntity?.kind === "state" ? cardEntity.name : ""]);
  } else {
    map.addSource("borders", { type: "geojson", data });
    const before = map.getLayer("places") ? "places" : undefined;
    // الدقة ترسم اليقين: الحد المحدد خط متصل، والتقريبي (أو مجهول الدقة) خط متقطع فوق هالة ضبابية
    // تُري الحد منطقةً لا خطاً. والأرض التي لا يسمّي المصدر عليها كياناً تبقى بلا تعبئة ولا حد.
    const ec = entityColor(basemap.mode);
    map.addLayer({ id: "borders-fill", type: "fill", source: "borders", paint: { "fill-color": ec, "fill-opacity": fillOpacity } }, before);
    map.addLayer({
      id: "borders-halo", type: "line", source: "borders", filter: ["all", named, ["!", precise]],
      paint: { "line-color": ec, "line-opacity": 0.28, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 4, 4, 10, 7, 22], "line-blur": ["interpolate", ["linear"], ["zoom"], 1, 3, 4, 8, 7, 18] },
    }, before);
    map.addLayer({ id: "borders-line-approx", type: "line", source: "borders", filter: ["all", named, ["!", precise]], paint: { "line-color": ec, "line-width": 1.1, "line-opacity": 0.7, "line-dasharray": [3, 3] } }, before);
    map.addLayer({ id: "borders-line", type: "line", source: "borders", filter: ["all", named, precise], paint: { "line-color": ec, "line-width": 1.4, "line-opacity": 0.85 } }, before);
    map.addLayer({ id: "borders-highlight", type: "line", source: "borders", filter: ["==", ["get", "NAME"], ""], paint: { "line-color": HIGHLIGHT_COLOR[basemap.mode], "line-width": 3 } }, before);
    pointerOn("borders-fill");
    for (const id of LAYER_GROUPS.borders) setVis(id, true);
  }
  bordersShown = data;
  const names = new Set(namedFeats.map((f) => f.properties.NAME)).size;
  setLayerCount("borders", `الكيانات: ${fmtInt(names)}`);
  await loadPeoples(key);
  if (token !== time.token) return data;
  const era = eraOf(key);
  markEra(era.id);
  descEl.textContent = era.desc;
  const places = await loadPlaces(era);
  if (token !== time.token) return data;
  loadDemography(DEMO_FOR_TIME[key] ?? "", { fit: false });
  ensureClaimPoints().then(() => { if (token === time.token) applyClaimView(); });
  renderNow({ names, labels, places, era });
  return data;
}
const placesCache = new Map();
let placesData = null;
async function loadPlaces(era) {
  if (!era.file) {
    setVis("places", false);
    countEl.textContent = "لا مواقع موثّقة لهذه الحقبة بعد.";
    warnEl.textContent = "";
    setLayerCount("places", "لا مواقع لهذه الحقبة");
    return null;
  }
  if (!placesCache.has(era.file)) placesCache.set(era.file, getJson(era.file));
  let data;
  try { data = await placesCache.get(era.file); } catch (err) { placesCache.delete(era.file); countEl.textContent = `تعذّر تحميل المواقع: ${err.message}`; return null; }
  placesData = data;
  const matched = data._meta?.matched ?? "";
  warnEl.textContent = matched ? `طابق Pleiades: ${matched}. المواقع التقديرية بلون أفتح.` : "";
  countEl.textContent = `عدد المواقع: ${data.features.length}`;
  setLayerCount("places", `المواقع: ${fmtInt(data.features.length)}`);
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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 4, 6, 7],
        "circle-color": ["match", ["get", "coord_status"], "approximate", "#b59a7a", "#8a4b2a"],
        "circle-stroke-color": "#fffdf8",
        "circle-stroke-width": 1.8,
      },
    }, map.getLayer("demography") ? "demography" : map.getLayer("claim-points") ? "claim-points" : undefined);
    pointerOn("places");
  }
  setVis("places", true);
  return data;
}
// الحقبة من أزرارها: زمنها، ثم تقريب إلى مواقعها
async function loadEra(era) {
  await loadBorders(era.border);
  if (era.file && placesCache.has(era.file)) {
    try { fitTo((await placesCache.get(era.file)).features, 6); } catch {}
  }
}
const borderSelect = document.getElementById("border-select");
const borderNoteEl = document.getElementById("border-note");
borderSelect.innerHTML = `<option value="modern">الدول اليوم (Natural Earth)</option>` + BORDER_YEARS.map((y) => `<option value="${y}">${escapeHtml(yearLabel(y))}</option>`).join("");
borderSelect.addEventListener("change", () => loadBorders(borderSelect.value));
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

let demoMeta = null;
let demoData = null;
let demoRequest = 0;
// fit: تقريب إلى نقاط الطبقة حين يختارها القارئ من القائمة، لا حين تتبع الزمن
async function loadDemography(key, { fit = true } = {}) {
  const req = ++demoRequest;
  demoSelect.value = key || "";
  if (!key) {
    setVis("demography", false);
    demoNoteEl.textContent = "";
    demoMeta = null;
    setLayerCount("demography", "لا طبقة قريبة من هذه السنة");
    return;
  }
  const demo = DEMO.find((d) => d.key === key);
  let data;
  try { data = await getJson(demo.file); } catch (err) { demoNoteEl.textContent = `تعذّر تحميل طبقة السكان: ${err.message}`; return; }
  if (req !== demoRequest) return;
  const m = data._meta;
  demoMeta = m;
  demoData = data;
  const unit = m.countries ? `${m.countries} دولة` : "6 أقاليم";
  demoNoteEl.innerHTML = `سنة ${escapeHtml(m.year)}، ${unit}.<span class="research-only"> ${escapeHtml(m.note)}</span>`;
  setLayerCount("demography", `بيانات سنة ${yearLabel(Number(m.year))}`);
  const source = map.getSource("demography");
  if (source) {
    source.setData(data);
  } else {
    map.addSource("demography", { type: "geojson", data });
    map.addLayer({
      id: "demography",
      type: "circle",
      source: "demography",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "population"], 0, 3, 1000000, 8, 100000000, 22, 1000000000, 40],
        "circle-color": "#e0913f",
        "circle-opacity": 0.42,
        "circle-stroke-color": "#fff3e0",
        "circle-stroke-width": 1,
      },
    }, map.getLayer("claim-points") ? "claim-points" : undefined);
    pointerOn("demography");
  }
  setVis("demography", true);
  if (fit) fitTo(data.features, 3);
}
demoSelect.addEventListener("change", () => {
  if (demoSelect.value) { userOff.delete("demography"); syncLayerInputs(); }
  loadDemography(demoSelect.value);
});

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
let claimPointsReady = null;
// ما يُعرض من أماكن الادعاءات: ادعاءات حقبة الزمن الحالي، إلا إذا اختارت سُنّة أو رحلة أو زرّ «كلها» غير ذلك
const claimView = { override: false, filter: null };

function ensureClaimPoints() {
  claimPointsReady ??= (async () => {
    try { claimPoints = await getJson("data/claim_points.geojson"); } catch { claimPointsReady = null; return false; }
    // حقب ادعاءات كل مكان، ليُصفّى بها بحسب الزمن
    for (const f of claimPoints.features) f.properties.eras = `,${[...new Set(JSON.parse(f.properties.claims).map((c) => c.era))].join(",")},`;
    map.addSource("claim-points", { type: "geojson", data: claimPoints });
    map.addLayer({
      id: "claim-points",
      type: "circle",
      source: "claim-points",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["+", 8, ["*", 1.8, ["get", "count"]]],
        "circle-color": cssVar("--evidence"),
        "circle-opacity": 0.78,
        "circle-stroke-color": "#fffdf8",
        "circle-stroke-width": 2,
      },
    });
    pointerOn("claim-points");
    return true;
  })();
  return claimPointsReady;
}
const eraClaimFilter = () => ["in", `,${eraOf(time.key ?? "modern").id},`, ["get", "eras"]];
function applyClaimView() {
  if (!map.getLayer("claim-points")) return;
  map.setFilter("claim-points", claimView.override ? claimView.filter : eraClaimFilter());
  setVis("claim-points", true);
  if (claimView.override) { setLayerCount("claims", claimView.filter ? "مختارة" : "كلها"); return; }
  const id = `,${eraOf(time.key ?? "modern").id},`;
  const n = claimPoints.features.filter((f) => f.properties.eras.includes(id)).length;
  setLayerCount("claims", n ? `الأماكن في الحقبة: ${fmtInt(n)}` : "لا أماكن في هذه الحقبة");
}
// show=false يعيد العرض إلى ادعاءات الحقبة الحالية
function showClaimPoints(show, filter = null) {
  claimView.override = show;
  claimView.filter = show ? filter : null;
  applyClaimView();
  claimMapBtn.setAttribute("aria-pressed", String(show && !filter));
}
claimMapBtn.addEventListener("click", async () => {
  if (!(await ensureClaimPoints())) return;
  const show = claimMapBtn.getAttribute("aria-pressed") !== "true";
  clearSunna();
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
function clearSunna() {
  activeSunna = null;
  for (const b of sunanListEl.querySelectorAll("button")) b.setAttribute("aria-pressed", "false");
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
    for (const c of s.supporting) if (c.id) claimRoles.set(c.id, [...(claimRoles.get(c.id) ?? []), { name: s.name, role: "support" }]);
    for (const c of s.limiting) if (c.id) claimRoles.set(c.id, [...(claimRoles.get(c.id) ?? []), { name: s.name, role: "limit" }]);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = s.name.replace("سُنّة ", "");
    btn.title = s.name;
    btn.dataset.sunna = s.id;
    btn.setAttribute("aria-pressed", "false");
    // الضغط على السُّنّة المختارة يلغي اختيارها ويعيد أماكن الشواهد إلى حقبة الزمن الحالي
    btn.addEventListener("click", () => {
      if (activeSunna?.id === s.id) { clearSunna(); showClaimPoints(false); sunanDetailEl.textContent = ""; return; }
      selectSunna(s);
    });
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
// الأسماء العربية لكيانات السنتين المعروضتين (تُملأ في showTransition)، والإنجليزي في التلميح ومفتاح الإبراز
let trAr = {};
const entBtn = (name, key) => {
  const ar = trAr[key]?.get(name);
  return `<button type="button" class="ent${ar ? "" : " latin"}" data-key="${escapeHtml(key)}" data-name="${escapeHtml(name)}" title="${escapeHtml(name)}">${escapeHtml(ar ?? name)}</button>`;
};
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
  const head = entBtn(r.name, b);
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
  trAr = { [a]: new Map(d.from.filter((r) => r.name_ar).map((r) => [r.name, r.name_ar])), [b]: new Map(d.to.filter((r) => r.name_ar).map((r) => [r.name, r.name_ar])) };
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

// ---------- حَكَم النقر: أعلى ما تحت المؤشر أولوية يفتح بطاقته، وما تحته يُذكر فيها ----------
// الشاهد أولاً، ثم الموقع، ثم السكان، ثم الشعب، ثم الكيان؛ والأرض بلا كيان مسمّى لا تُعرض إلا إن لم يكن تحت المؤشر غيرها.
const CLICKABLE = [
  { layer: "claim-points", kind: "شواهد", label: (p) => p.name_ar, open: openClaimCard },
  { layer: "places", kind: "موقع", label: (p) => p.name_ar, open: openPlaceCard },
  { layer: "demography", kind: "سكان", label: demoTitle, open: openDemoCard },
  { layer: "peoples-fill", kind: "شعب", label: entityTitle, open: (f) => openEntityCard(f, "people") },
  { layer: "borders-fill", kind: "كيان", label: entityTitle, open: (f) => openEntityCard(f, "state") },
];
function showHit(hit) {
  cardCurrent = hit;
  hit.c.open(hit.f);
}
map.on("click", (e) => {
  const layers = CLICKABLE.map((c) => c.layer).filter((id) => map.getLayer(id));
  const feats = layers.length ? map.queryRenderedFeatures(e.point, { layers }) : [];
  const hits = [];
  for (const c of CLICKABLE) {
    const f = feats.find((x) => x.layer.id === c.layer && (c.layer !== "borders-fill" || x.properties.NAME));
    if (f) hits.push({ c, f });
  }
  if (!hits.length) {
    const blank = feats.find((x) => x.layer.id === "borders-fill");
    if (blank) hits.push({ c: CLICKABLE[CLICKABLE.length - 1], f: blank });
  }
  if (!hits.length) { if (!cardEl.hidden) closeCard(); return; }
  cardAlso = hits.slice(1);
  showHit(hits[0]);
});
cardBody.addEventListener("click", (e) => {
  const t = e.target.closest("[data-also], [data-follow], [data-time]");
  if (!t) return;
  if (t.dataset.also != null) {
    const i = Number(t.dataset.also);
    const next = cardAlso[i];
    cardAlso = [cardCurrent, ...cardAlso.filter((_, j) => j !== i)];
    showHit(next);
  } else if (t.dataset.follow) {
    followEntity(timeKey(t.dataset.follow));
  } else {
    loadBorders(t.dataset.time);
  }
});

// ---------- الزمن الحالي في اللوحة ----------
const nowYearEl = document.getElementById("now-year");
const nowEraEl = document.getElementById("now-era");
const nowDescEl = document.getElementById("now-desc");
const nowStatsEl = document.getElementById("now-stats");
let claimsIndex = null;
getJson("data/claims_index.json").then((idx) => { claimsIndex = idx; renderBands(); if (time.key != null) renderNow(); }).catch(() => {});
let nowParts = {};
function renderNow(parts) {
  if (parts) nowParts = parts;
  const { names, labels, places, era } = nowParts;
  if (!era) return;
  nowYearEl.textContent = yearText(time.key);
  nowEraEl.textContent = `الحقبة ${era.id}: ${era.label}`;
  nowDescEl.textContent = era.desc;
  const all = labels?.labels ?? [];
  const ar = all.filter((l) => l.ar).length;
  const claims = claimsIndex?.find((c) => c.era === era.id)?.count;
  nowStatsEl.innerHTML = [
    names != null ? chip(`الكيانات المسمّاة: ${fmtInt(names)}`) : "",
    all.length ? chip(`الأسماء العربية: ${fmtInt(ar)} من ${fmtInt(all.length)}`) : "",
    places ? chip(`مواقع الحقبة: ${fmtInt(places.features.length)}`) : "",
    claims != null ? chip(`ادعاءات الحقبة: ${fmtInt(claims)}`, "tier-v") : "",
  ].join("");
  setLayerCount("labels", all.length ? `العربية: ${fmtInt(ar)} من ${fmtInt(all.length)}` : "");
}
labelData("modern").then((d) => { if (d) modernAr = new Map(d.labels.filter((l) => l.ar).map((l) => [l.en, l.ar])); });

// ---------- شريط الزمن ----------
// لكل حقبة شريحة متساوية العرض، والسنة داخلها بنسبة موقعها من مدتها، فلا تبتلع الحقب الطويلة الشريط.
// الماضي على اليمين والحاضر على اليسار، كاتجاه الكتابة. المحطات سنوات الحدود المتاحة فقط.
const tbTrack = document.getElementById("tb-track");
const tbBands = document.getElementById("tb-bands");
const tbStops = document.getElementById("tb-stops");
const tbThumb = document.getElementById("tb-thumb");
const tbYear = document.getElementById("tb-year");
const tbEra = document.getElementById("tb-era");
const tbPlay = document.getElementById("tb-play");
function tbPos(k) {
  const y = yearOf(k);
  let i = ERAS.findIndex((e) => y >= e.from && y < e.to);
  if (i < 0) i = ERAS.length - 1;
  const e = ERAS[i];
  return (i + Math.min(1, Math.max(0, (y - e.from) / (e.to - e.from)))) / ERAS.length;
}
// ارتفاع عمود الكثافة في كل حقبة من عدد ادعاءاتها (claims_index.json)
function renderBands() {
  const max = Math.max(1, ...(claimsIndex ?? []).map((c) => c.count));
  tbBands.innerHTML = ERAS.map((e) => {
    const n = claimsIndex?.find((c) => c.era === e.id)?.count ?? 0;
    return `<div class="tb-band" data-era="${e.id}" title="الحقبة ${e.id}: ${escapeHtml(e.label)}${claimsIndex ? ` · ادعاءاتها: ${n}` : ""}"><span class="tb-band-label">${escapeHtml(e.label)}</span>` +
      (n ? `<i class="tb-density" style="height:${Math.round(3 + 14 * n / max)}px"></i>` : "") + `</div>`;
  }).join("");
  renderTime();
}
const stopLabel = (k) => (String(k) === "modern" ? "اليوم" : Number(k) < 0 ? `${-k} ق.م` : String(k));
tbStops.innerHTML = TIME_STOPS.map((k, i) => {
  const edge = i === 0 ? " first" : i === TIME_STOPS.length - 1 ? " last" : "";
  return `<div class="tb-stop${edge}" data-k="${k}" style="inset-inline-start:${(tbPos(k) * 100).toFixed(2)}%"><i></i><span>${escapeHtml(stopLabel(k))}</span></div>`;
}).join("");
let tbPreview = null; // المحطة أثناء السحب، قبل الإفلات
function renderTime() {
  const k = tbPreview ?? time.key;
  if (k == null) return;
  const era = eraOf(k);
  tbThumb.style.insetInlineStart = `${(tbPos(k) * 100).toFixed(2)}%`;
  tbYear.textContent = yearText(k);
  tbEra.textContent = `الحقبة ${era.id}: ${era.label}`;
  for (const el of tbStops.children) el.classList.toggle("cur", el.dataset.k === String(k));
  for (const el of tbBands.children) el.classList.toggle("cur", Number(el.dataset.era) === era.id);
  declutterStops();
  const i = TIME_STOPS.findIndex((s) => String(s) === String(k));
  tbTrack.setAttribute("aria-valuenow", String(i));
  tbTrack.setAttribute("aria-valuetext", `${yearText(k)}، الحقبة ${era.id}: ${era.label}`);
}
// تسميات المحطات المتقاربة (1914 و1945 و2010 واليوم) قد تتراكب: تبقى تسمية المحطة الحالية، ثم كل تسمية لا تتراكب مع ما بقي
function declutterStops() {
  const els = [...tbStops.children].sort((a, b) => b.classList.contains("cur") - a.classList.contains("cur"));
  const kept = [];
  for (const el of els) {
    const span = el.querySelector("span");
    span.style.visibility = "";
    const r = span.getBoundingClientRect();
    if (!r.width) continue;
    if (kept.some((k) => r.left < k.right + 4 && r.right > k.left - 4)) span.style.visibility = "hidden";
    else kept.push(r);
  }
}
window.addEventListener("resize", declutterStops);
renderBands();
function stopAt(clientX) {
  const r = tbTrack.getBoundingClientRect();
  const frac = (r.right - clientX) / r.width;
  let best = TIME_STOPS[0];
  for (const k of TIME_STOPS) if (Math.abs(tbPos(k) - frac) < Math.abs(tbPos(best) - frac)) best = k;
  return best;
}
tbTrack.addEventListener("pointerdown", (e) => {
  stopPlay();
  tbTrack.setPointerCapture(e.pointerId);
  tbTrack.classList.add("dragging");
  tbPreview = stopAt(e.clientX);
  renderTime();
});
tbTrack.addEventListener("pointermove", (e) => {
  if (tbPreview == null) return;
  const k = stopAt(e.clientX);
  if (k !== tbPreview) { tbPreview = k; renderTime(); }
});
function endDrag() {
  if (tbPreview == null) return;
  const k = tbPreview;
  tbPreview = null;
  tbTrack.classList.remove("dragging");
  if (String(k) !== String(time.key)) loadBorders(k); else renderTime();
}
tbTrack.addEventListener("pointerup", endDrag);
tbTrack.addEventListener("pointercancel", endDrag);
function stepTime(d) {
  const i = TIME_STOPS.findIndex((s) => String(s) === String(time.key));
  const j = Math.max(0, Math.min(TIME_STOPS.length - 1, i + d));
  if (j !== i) loadBorders(TIME_STOPS[j]);
  return j !== i;
}
tbTrack.addEventListener("keydown", (e) => {
  // اتجاه الصفحة عربي: السهم الأيسر يتقدّم في الزمن
  const d = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: 1, ArrowDown: -1 }[e.key];
  if (d) { e.preventDefault(); stopPlay(); stepTime(d); }
  else if (e.key === "Home") { e.preventDefault(); stopPlay(); loadBorders(TIME_STOPS[0]); }
  else if (e.key === "End") { e.preventDefault(); stopPlay(); loadBorders(TIME_STOPS[TIME_STOPS.length - 1]); }
});
// التشغيل: يعبر المحطات واحدة واحدة حتى اليوم
let playTimer = null;
function stopPlay() {
  clearInterval(playTimer);
  playTimer = null;
  tbPlay.setAttribute("aria-pressed", "false");
  tbPlay.textContent = "▶";
  tbPlay.setAttribute("aria-label", "تشغيل الزمن");
}
tbPlay.addEventListener("click", () => {
  if (playTimer) return stopPlay();
  if (String(time.key) === String(TIME_STOPS[TIME_STOPS.length - 1])) loadBorders(TIME_STOPS[0]);
  tbPlay.setAttribute("aria-pressed", "true");
  tbPlay.textContent = "❚❚";
  tbPlay.setAttribute("aria-label", "إيقاف الزمن");
  playTimer = setInterval(() => { if (!stepTime(1)) stopPlay(); }, 2800);
});

// البداية: سنة 1200م، حقبة التبادل العابر للقارات، فيرى الزائر الكيانات بألوانها والشواهد في مكانها
const START_TIME = 1200;
map.on("load", async () => {
  await loadBorders(START_TIME);
  if (!reduceMotion && !document.body.classList.contains("showcasing")) map.flyTo({ ...FIRST_VIEW, duration: 5200, curve: 1.3, essential: false });
});

// ---------- الافتتاحية: العنوان وثلاثة أبواب، في الزيارة الأولى فقط ----------
const introEl = document.getElementById("intro");
let introSeen = false;
try { introSeen = localStorage.getItem("atlas-intro-seen") === "1"; } catch {}
document.getElementById("intro-span").textContent = `من ${yearText(TIME_STOPS[0])} إلى اليوم: الدول والشعوب ومواقع الحقب والسكان، والشواهد الموثّقة في أماكنها، على كرة واحدة. والسنن فرضيات تُختبر بها.`;
function dismissIntro() {
  if (introEl.hidden) return;
  introEl.classList.remove("on");
  setTimeout(() => (introEl.hidden = true), 600);
  try { localStorage.setItem("atlas-intro-seen", "1"); } catch {}
}
function hint(el) {
  el.classList.remove("hint");
  void el.offsetWidth;
  el.classList.add("hint");
}
if (!introSeen) {
  introEl.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => introEl.classList.add("on")));
  map.on("dragstart", dismissIntro);
}
introEl.addEventListener("click", (e) => {
  const door = e.target.closest("[data-door]")?.dataset.door;
  if (!door) return;
  dismissIntro();
  if (door === "show") scStart("fusion");
  else if (door === "time") { tbTrack.focus(); hint(document.getElementById("timebar")); }
  else if (door === "sunan") {
    setPanelCollapsed(false);
    const sec = sunanListEl.closest("details");
    sec.open = true;
    sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    hint(sec);
  }
});
