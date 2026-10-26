// المكعّب الزمكاني: خرائط الحدود طبقاتٍ فوق الأرض، والزمن محور عمودي، والخيوط بين الطبقات من لوحة التحولات.
// البيانات من scripts/build_stack.py (web/data/stack)، ومواقع الحقب وأماكن الادعاءات من ملفات الأطلس نفسها.

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- الطبقات الزمنية ----------
const KEYS = ["-4000", "-1000", "-1", "700", "1200", "1600", "1800", "1914", "1945", "2010", "modern"];
const NOW = new Date().getFullYear();
const yearOf = (k) => (k === "modern" ? NOW : Number(k));
const sliceLabel = (k) => (k === "modern" ? "الدول اليوم" : Number(k) < 0 ? `${-Number(k)} ق.م` : `${k}م`);
// المواقع: الحقبة ← طبقتها (كما في أزرار الحقب في الأطلس)
const ERA_SLICE = { 1: "-4000", 2: "-1000", 3: "-1", 4: "700", 5: "1200", 6: "1600", 7: "1800", 8: "modern" };
// لون لكل طبقة من القديم (رملي) إلى الحديث (أخضر مزرق)، بالتدرج بين محطات
const STOPS = [[201, 150, 72], [160, 82, 45], [107, 76, 122], [42, 111, 106]];
function rampColor(t) {
  const x = t * (STOPS.length - 1);
  const i = Math.min(Math.floor(x), STOPS.length - 2);
  const f = x - i;
  return STOPS[i].map((c, j) => Math.round(c + (STOPS[i + 1][j] - c) * f));
}
const SLICE_COLOR = Object.fromEntries(KEYS.map((k, i) => [k, rampColor(i / (KEYS.length - 1))]));
const THREAD_COLOR = { same: [91, 81, 70], succ: [42, 111, 106], change: [192, 57, 43] };

const state = {
  slices: new Map(), // key -> entities
  links: [],
  places: [], // {key, lon, lat, name}
  visible: new Set(KEYS),
  show: { fill: true, edges: true, same: true, succ: true, change: false, places: true },
  axis: "even",
  spacingKm: 150,
  focus: null, // {nodes:Set("key|name"), links:Set(index)}
  lineage: "main",
};

// ارتفاع الطبقة بالمتر: متساوي البعد، أو متناسب مع السنين بين أقدم طبقة واليوم
function zOf(key) {
  const step = state.spacingKm * 1000;
  if (state.axis === "even") return (KEYS.indexOf(key) + 1) * step;
  const y0 = yearOf(KEYS[0]);
  const span = NOW - y0;
  return step + ((yearOf(key) - y0) / span) * step * (KEYS.length - 1);
}
// قبل 1900 تُرسم كل الحدود تقريبية، كما في الأطلس
const isPrecise = (key, e) => yearOf(key) >= 1900 && e.p === 3;

// ---------- الخريطة ----------
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
      { id: "rivers", type: "line", source: "rivers", paint: { "line-color": cssVar("--river"), "line-width": 0.6 } },
    ],
  },
  center: [32, 28],
  zoom: 2.3,
  pitch: 55,
  bearing: -20,
  maxPitch: 85,
  attributionControl: { customAttribution: "Natural Earth · Historical Basemaps (GPL-3) · Pleiades · deck.gl" },
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");

const overlay = new deck.MapboxOverlay({
  interleaved: false,
  layers: [],
  getTooltip: ({ object, layer }) => {
    if (!object) return null;
    if (layer.id === "places") return { text: `${object.name}\n${sliceLabel(object.key)}` };
    if (layer.id === "threads") {
      const [a, an, b, bn, sa, sb] = object;
      return { text: `${an} (${sliceLabel(a)}) ← ${bn} (${sliceLabel(b)})\n${Math.round(sa * 100)}% من أرض الأول · ${Math.round(sb * 100)}% من أرض الثاني` };
    }
    if (object.e) return { text: `${object.e.ar ?? object.e.n}\n${sliceLabel(object.key)}${isPrecise(object.key, object.e) ? "" : " · حد تقريبي"}` };
    return null;
  },
  onClick: (info) => {
    if (info.object && info.object.e) setFocus(info.object.key, info.object.e.n);
    else if (!info.object) setFocus(null);
  },
});
map.addControl(overlay);

// ---------- بناء الطبقات ----------
const nodeId = (key, name) => `${key}|${name}`;
let sliceCache = new Map(); // key -> {polys, rings} بإحداثيات ثلاثية لارتفاع معيّن
function sliceGeometry(key) {
  const z = zOf(key);
  const hit = sliceCache.get(key);
  if (hit && hit.z === z) return hit;
  const polys = [];
  const rings = [];
  for (const e of state.slices.get(key) ?? []) {
    for (const poly of e.g) {
      const p3 = poly.map((ring) => ring.map(([x, y]) => [x, y, z]));
      polys.push({ key, e, polygon: p3 });
      for (const r of p3) rings.push({ key, e, path: r });
    }
  }
  const out = { z, polys, rings };
  sliceCache.set(key, out);
  return out;
}
function entityPos(key, name) {
  const e = state.slices.get(key)?.find((x) => x.n === name);
  return e ? [e.r[0], e.r[1], zOf(key)] : null;
}

function render() {
  const keys = KEYS.filter((k) => state.visible.has(k) && state.slices.has(k));
  const focus = state.focus;
  const inFocus = (key, e) => !focus || focus.nodes.has(nodeId(key, e.n));
  const polys = [];
  const rings = [];
  for (const k of keys) {
    const g = sliceGeometry(k);
    polys.push(...g.polys);
    rings.push(...g.rings);
  }
  const fillAlpha = (d) => (focus ? (inFocus(d.key, d.e) ? 150 : 10) : isPrecise(d.key, d.e) ? 70 : 38);
  const edgeAlpha = (d) => (focus ? (inFocus(d.key, d.e) ? 255 : 25) : isPrecise(d.key, d.e) ? 200 : 110);
  const flat = { depthCompare: "always", depthWriteEnabled: false };
  const layers = [];
  if (state.show.fill) {
    layers.push(new deck.SolidPolygonLayer({
      id: "planes", data: polys, getPolygon: (d) => d.polygon, pickable: true, parameters: flat,
      getFillColor: (d) => [...SLICE_COLOR[d.key], fillAlpha(d)],
      updateTriggers: { getFillColor: [focus] },
    }));
  }
  if (state.show.edges) {
    layers.push(new deck.PathLayer({
      id: "edges", data: rings, getPath: (d) => d.path, widthUnits: "pixels", parameters: flat, pickable: !state.show.fill,
      getWidth: (d) => (focus && inFocus(d.key, d.e) ? 2.5 : 1),
      getColor: (d) => [...SLICE_COLOR[d.key], edgeAlpha(d)],
      updateTriggers: { getWidth: [focus], getColor: [focus] },
    }));
  }
  const vis = new Set(keys);
  const threads = state.links.filter((l, i) => vis.has(l[0]) && vis.has(l[2]) && (focus ? focus.links.has(i) : state.show[l[6]]));
  layers.push(new deck.LineLayer({
    id: "threads", data: threads, pickable: true, widthUnits: "pixels", parameters: flat,
    getSourcePosition: (l) => entityPos(l[0], l[1]),
    getTargetPosition: (l) => entityPos(l[2], l[3]),
    getColor: (l) => [...THREAD_COLOR[l[6]], focus ? 255 : 150],
    getWidth: (l) => (focus ? 1.5 : 0.8) + 3 * Math.max(l[4], l[5]),
    updateTriggers: { getSourcePosition: [state.axis, state.spacingKm], getTargetPosition: [state.axis, state.spacingKm], getColor: [focus], getWidth: [focus] },
  }));
  if (state.show.places) {
    layers.push(new deck.ScatterplotLayer({
      id: "places", data: state.places.filter((p) => vis.has(p.key)), pickable: true, parameters: flat,
      getPosition: (p) => [p.lon, p.lat, zOf(p.key)], radiusUnits: "pixels", getRadius: 4,
      getFillColor: [31, 78, 121, 230], stroked: true, getLineColor: [255, 253, 248, 255], lineWidthUnits: "pixels", getLineWidth: 1,
      updateTriggers: { getPosition: [state.axis, state.spacingKm] },
    }));
  }
  overlay.setProps({ layers });
  placeLabels();
}

// ---------- تسميات الطبقات (HTML، لتظهر العربية سليمة) ----------
const labelsEl = document.getElementById("labels");
function placeLabels() {
  const { width, height } = map.getCanvas().getBoundingClientRect();
  const c = map.getCenter();
  const vp = new deck.WebMercatorViewport({ width, height, longitude: c.lng, latitude: c.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() });
  // المرساة: نقطة على الأرض قرب الحافة اليسرى من الشاشة
  const anchor = map.unproject([Math.min(80, width * 0.15), height * 0.85]);
  labelsEl.innerHTML = KEYS.filter((k) => state.visible.has(k) && state.slices.has(k)).map((k) => {
    const [x, y] = vp.project([anchor.lng, anchor.lat, zOf(k)]);
    if (!(x > 0 && x < width && y > 0 && y < height)) return "";
    const [r, g, b] = SLICE_COLOR[k];
    return `<span style="left:${x + 70}px;top:${y}px;color:rgb(${r},${g},${b})">${escapeHtml(sliceLabel(k))}</span>`;
  }).join("");
}
map.on("move", placeLabels);
map.on("resize", placeLabels);

// ---------- التركيز: سلالة كيان عبر الطبقات ----------
// الرئيسية: إلى الأمام كيان أخذ ربع أرضه فأكثر، وإلى الخلف كيان أعطاه ربع أرضه فأكثر.
// الواسعة: تضيف كل كيان صغير ذهب أكثر أرضه إليه أو جاء أكثر أرضه منه، فتتشعب كثيراً مع الإمبراطوريات.
const LINEAGE = {
  main: { fw: (l) => l[4] >= 0.25, bw: (l) => l[5] >= 0.25 },
  wide: { fw: (l) => l[4] >= 0.25 || l[5] >= 0.5, bw: (l) => l[5] >= 0.25 || l[4] >= 0.5 },
};
let lastFocus = null;
function setFocus(key, name) {
  lastFocus = key ? [key, name] : null;
  const focusEl = document.getElementById("focus");
  if (!key) {
    state.focus = null;
    focusEl.innerHTML = "اضغط أي كيان على أي طبقة لترى ما سبقه وما صار إليه.";
    render();
    return;
  }
  const nodes = new Set([nodeId(key, name)]);
  const links = new Set();
  const out = new Map();
  const inn = new Map();
  state.links.forEach((l, i) => {
    const a = nodeId(l[0], l[1]);
    const b = nodeId(l[2], l[3]);
    if (!out.has(a)) out.set(a, []);
    if (!inn.has(b)) inn.set(b, []);
    out.get(a).push(i);
    inn.get(b).push(i);
  });
  const walk = (start, edges, next, keep) => {
    const queue = [start];
    while (queue.length) {
      const n = queue.shift();
      for (const i of edges.get(n) ?? []) {
        const l = state.links[i];
        if (!keep(l)) continue;
        links.add(i);
        const m = next(l);
        if (!nodes.has(m)) { nodes.add(m); queue.push(m); }
      }
    }
  };
  const start = nodeId(key, name);
  const rule = LINEAGE[state.lineage];
  walk(start, out, (l) => nodeId(l[2], l[3]), rule.fw);
  walk(start, inn, (l) => nodeId(l[0], l[1]), rule.bw);
  state.focus = { nodes, links };
  const bySlice = new Map();
  for (const n of nodes) {
    const i = n.indexOf("|");
    const k = n.slice(0, i);
    if (!bySlice.has(k)) bySlice.set(k, []);
    bySlice.get(k).push(n.slice(i + 1));
  }
  const nameOf = (k, n) => state.slices.get(k)?.find((e) => e.n === n)?.ar ?? n;
  focusEl.innerHTML =
    `<p><b><bdi>${escapeHtml(nameOf(key, name))}</bdi></b> (${escapeHtml(sliceLabel(key))}): ${nodes.size} كياناً في ${bySlice.size} طبقة، و${links.size} خيطاً.</p>` +
    `<ul>${KEYS.filter((k) => bySlice.has(k)).map((k) => `<li>${escapeHtml(sliceLabel(k))}: ${bySlice.get(k).map((n) => `<bdi>${escapeHtml(nameOf(k, n))}</bdi>`).join("، ")}</li>`).join("")}</ul>` +
    `<div class="row"><label class="opt"><input type="radio" name="lineage" value="main"${state.lineage === "main" ? " checked" : ""}> السلالة الرئيسية</label>` +
    `<label class="opt"><input type="radio" name="lineage" value="wide"${state.lineage === "wide" ? " checked" : ""}> كل ما اتصل بأرضه</label></div>` +
    `<button type="button" id="focus-clear">إلغاء التركيز</button>`;
  for (const r of focusEl.querySelectorAll('input[name="lineage"]')) r.addEventListener("change", () => { state.lineage = r.value; setFocus(...lastFocus); });
  document.getElementById("focus-clear").addEventListener("click", () => setFocus(null));
  render();
}

// ---------- لوحة التحكم ----------
const sliceListEl = document.getElementById("slice-list");
sliceListEl.innerHTML = [...KEYS].reverse().map((k) => {
  const [r, g, b] = SLICE_COLOR[k];
  return `<label class="opt"><input type="checkbox" data-slice="${k}" checked><i class="sw" style="background:rgb(${r},${g},${b})"></i> ${escapeHtml(sliceLabel(k))} <span class="sub" data-count="${k}"></span></label>`;
}).join("");
sliceListEl.addEventListener("change", (e) => {
  const k = e.target.dataset.slice;
  if (!k) return;
  if (e.target.checked) state.visible.add(k); else state.visible.delete(k);
  render();
});
function setAllSlices(on) {
  for (const box of sliceListEl.querySelectorAll("input[data-slice]")) box.checked = on;
  state.visible = new Set(on ? KEYS : []);
  render();
}
document.getElementById("slices-all").addEventListener("click", () => setAllSlices(true));
document.getElementById("slices-none").addEventListener("click", () => setAllSlices(false));
for (const k of Object.keys(state.show)) {
  document.getElementById(`show-${k}`).addEventListener("change", (e) => { state.show[k] = e.target.checked; render(); });
}
for (const r of document.querySelectorAll('input[name="axis"]')) {
  r.addEventListener("change", () => { state.axis = r.value; render(); });
}
const spacingEl = document.getElementById("spacing");
const spacingVal = document.getElementById("spacing-val");
spacingVal.textContent = `${state.spacingKm} كم`;
spacingEl.addEventListener("input", () => {
  state.spacingKm = Number(spacingEl.value);
  spacingVal.textContent = `${state.spacingKm} كم`;
  render();
});

// ---------- التحميل ----------
const statusEl = document.getElementById("status");
async function loadPlaces() {
  const files = [1, 2, 3, 4, 5].map((n) => `data/places_era${n}.geojson`);
  const out = [];
  for (const url of files) {
    try {
      const d = await getJson(url);
      for (const f of d.features) {
        const key = ERA_SLICE[f.properties.era];
        if (key) out.push({ key, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], name: f.properties.name_ar });
      }
    } catch {}
  }
  try {
    const d = await getJson("data/claim_points.geojson");
    for (const f of d.features) {
      const eras = new Set(JSON.parse(f.properties.claims).map((c) => c.era));
      for (const era of eras) {
        const key = ERA_SLICE[era];
        if (key) out.push({ key, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], name: `${f.properties.name_ar} (أماكن الادعاءات)` });
      }
    }
  } catch {}
  return out;
}
async function load() {
  try {
    const linksData = await getJson("data/stack/links.json");
    state.links = linksData.links;
  } catch (err) { statusEl.textContent = `تعذّر تحميل الخيوط: ${err.message}`; return; }
  let done = 0;
  // الأحدث أولاً: يظهر أعلى المكعّب سريعاً، ثم تكتمل الطبقات
  await Promise.all([...KEYS].reverse().map(async (k) => {
    try {
      const d = await getJson(`data/stack/slice_${k}.json`);
      state.slices.set(k, d.entities);
      const el = sliceListEl.querySelector(`[data-count="${CSS.escape(k)}"]`);
      if (el) el.textContent = `(${d.entities.length})`;
    } catch (err) { statusEl.textContent = `تعذّر تحميل طبقة ${sliceLabel(k)}: ${err.message}`; }
    done++;
    statusEl.textContent = `تحميل الطبقات ${done} من ${KEYS.length}`;
    render();
  }));
  state.places = await loadPlaces();
  statusEl.textContent = "";
  render();
}
map.on("load", load);
