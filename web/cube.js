// المكعّب الزمكاني داخل الأطلس: خرائط الحدود طبقاتٍ فوق الأرض (أو الكرة)، والزمن يصعد، والخيوط بين الطبقات من لوحة التحولات.
// يُحمَّل deck.gl وبيانات web/data/stack (من scripts/build_stack.py) عند أول تشغيل فقط.
// يعتمد على ما يعرّفه app.js: map وescapeHtml وgetJson وterrainState وapplyTerrain وsetVis وwanted وuserOff وLAYER_GROUPS.

const CUBE_KEYS = ["-4000", "-1000", "-1", "700", "1200", "1600", "1800", "1914", "1945", "2010", "modern"];
const CUBE_NOW = new Date().getFullYear();
const cubeYearOf = (k) => (k === "modern" ? CUBE_NOW : Number(k));
const cubeLabel = (k) => (k === "modern" ? "الدول اليوم" : Number(k) < 0 ? `${-Number(k)} ق.م` : `${k}م`);
// المواقع: الحقبة ← طبقتها (كما في أزرار الحقب)
const CUBE_ERA_SLICE = { 1: "-4000", 2: "-1000", 3: "-1", 4: "700", 5: "1200", 6: "1600", 7: "1800", 8: "modern" };
// لون لكل طبقة من القديم (ذهبي رملي) إلى الحديث (أخضر مزرق)، فاتحة لتُقرأ فوق صور الأقمار
const CUBE_STOPS = [[240, 196, 110], [232, 132, 84], [190, 140, 220], [92, 200, 190]];
function cubeRamp(t) {
  const x = t * (CUBE_STOPS.length - 1);
  const i = Math.min(Math.floor(x), CUBE_STOPS.length - 2);
  const f = x - i;
  return CUBE_STOPS[i].map((c, j) => Math.round(c + (CUBE_STOPS[i + 1][j] - c) * f));
}
const CUBE_COLOR = Object.fromEntries(CUBE_KEYS.map((k, i) => [k, cubeRamp(i / (CUBE_KEYS.length - 1))]));
const CUBE_THREAD = { same: [235, 230, 220], succ: [92, 220, 200], change: [255, 110, 80] };

const cube = {
  on: false,
  loaded: false,
  overlay: null,
  slices: new Map(),
  links: [],
  places: [],
  visible: new Set(CUBE_KEYS),
  show: { fill: true, edges: true, same: true, succ: true, change: false, places: true },
  axis: "even",
  spacingKm: 150,
  focus: null,
  lineage: "main",
  lastFocus: null,
  prev: null, // حال الخريطة قبل التشغيل، لتُستعاد عند الإطفاء
};

// ارتفاع الطبقة بالمتر: متساوي البعد، أو متناسب مع السنين بين أقدم طبقة واليوم
function cubeZ(key) {
  const step = cube.spacingKm * 1000;
  if (cube.axis === "even") return (CUBE_KEYS.indexOf(key) + 1) * step;
  const y0 = cubeYearOf(CUBE_KEYS[0]);
  return step + ((cubeYearOf(key) - y0) / (CUBE_NOW - y0)) * step * (CUBE_KEYS.length - 1);
}
// قبل 1900 تُرسم كل الحدود تقريبية، كما في الخريطة
const cubePrecise = (key, e) => cubeYearOf(key) >= 1900 && e.p === 3;
const cubeNode = (key, name) => `${key}|${name}`;

const cubeGeomCache = new Map();
function cubeGeometry(key) {
  const z = cubeZ(key);
  const hit = cubeGeomCache.get(key);
  if (hit && hit.z === z) return hit;
  const polys = [];
  const rings = [];
  for (const e of cube.slices.get(key) ?? []) {
    for (const poly of e.g) {
      const p3 = poly.map((ring) => ring.map(([x, y]) => [x, y, z]));
      polys.push({ key, e, polygon: p3 });
      for (const r of p3) rings.push({ key, e, path: r });
    }
  }
  const out = { z, polys, rings };
  cubeGeomCache.set(key, out);
  return out;
}
const cubeEntity = (key, name) => cube.slices.get(key)?.find((x) => x.n === name);
function cubePos(key, name) {
  const e = cubeEntity(key, name);
  return e ? [e.r[0], e.r[1], cubeZ(key)] : null;
}

function cubeRender() {
  if (!cube.on || !cube.overlay) return;
  const keys = CUBE_KEYS.filter((k) => cube.visible.has(k) && cube.slices.has(k));
  const focus = cube.focus;
  const inFocus = (key, e) => !focus || focus.nodes.has(cubeNode(key, e.n));
  const polys = [];
  const rings = [];
  for (const k of keys) {
    const g = cubeGeometry(k);
    polys.push(...g.polys);
    rings.push(...g.rings);
  }
  // إحدى عشرة طبقة متراكبة: تعبئة خفيفة بلا تركيز حتى تُقرأ الطبقات من خلال بعضها
  const fillAlpha = (d) => (focus ? (inFocus(d.key, d.e) ? 150 : 8) : cubePrecise(d.key, d.e) ? 45 : 25);
  const edgeAlpha = (d) => (focus ? (inFocus(d.key, d.e) ? 255 : 20) : cubePrecise(d.key, d.e) ? 170 : 100);
  // الأسطح شفافة لا تحجب بعضها، والكرة تحجب ما خلفها
  const flat = { depthCompare: "less-equal", depthWriteEnabled: false };
  const layers = [];
  if (cube.show.fill) {
    layers.push(new deck.SolidPolygonLayer({
      id: "cube-planes", data: polys, getPolygon: (d) => d.polygon, pickable: true, parameters: flat,
      getFillColor: (d) => [...CUBE_COLOR[d.key], fillAlpha(d)],
      updateTriggers: { getFillColor: [focus] },
    }));
  }
  if (cube.show.edges) {
    layers.push(new deck.PathLayer({
      id: "cube-edges", data: rings, getPath: (d) => d.path, widthUnits: "pixels", parameters: flat, pickable: !cube.show.fill,
      getWidth: (d) => (focus && inFocus(d.key, d.e) ? 2.5 : 1),
      getColor: (d) => [...CUBE_COLOR[d.key], edgeAlpha(d)],
      updateTriggers: { getWidth: [focus], getColor: [focus] },
    }));
  }
  const vis = new Set(keys);
  const threads = cube.links.filter((l, i) => vis.has(l[0]) && vis.has(l[2]) && (focus ? focus.links.has(i) : cube.show[l[6]]));
  layers.push(new deck.LineLayer({
    id: "cube-threads", data: threads, pickable: true, widthUnits: "pixels", parameters: flat,
    getSourcePosition: (l) => cubePos(l[0], l[1]),
    getTargetPosition: (l) => cubePos(l[2], l[3]),
    getColor: (l) => [...CUBE_THREAD[l[6]], focus ? 255 : 170],
    getWidth: (l) => (focus ? 1.5 : 0.8) + 3 * Math.max(l[4], l[5]),
    updateTriggers: { getSourcePosition: [cube.axis, cube.spacingKm], getTargetPosition: [cube.axis, cube.spacingKm], getColor: [focus], getWidth: [focus] },
  }));
  if (cube.show.places) {
    layers.push(new deck.ScatterplotLayer({
      id: "cube-places", data: cube.places.filter((p) => vis.has(p.key)), pickable: true, parameters: flat,
      getPosition: (p) => [p.lon, p.lat, cubeZ(p.key)], radiusUnits: "pixels", getRadius: 4,
      getFillColor: [255, 255, 255, 235], stroked: true, getLineColor: [20, 30, 50, 255], lineWidthUnits: "pixels", getLineWidth: 1,
      updateTriggers: { getPosition: [cube.axis, cube.spacingKm] },
    }));
  }
  cube.overlay.setProps({ layers });
}

function cubeTooltip({ object, layer }) {
  if (!object || !layer) return null;
  if (layer.id === "cube-places") return { text: `${object.name}\n${cubeLabel(object.key)}` };
  if (layer.id === "cube-threads") {
    const [a, an, b, bn, sa, sb] = object;
    return { text: `${an} (${cubeLabel(a)}) ← ${bn} (${cubeLabel(b)})\n${Math.round(sa * 100)}% من أرض الأول · ${Math.round(sb * 100)}% من أرض الثاني` };
  }
  if (object.e) return { text: `${object.e.ar ?? object.e.n}\n${cubeLabel(object.key)}${cubePrecise(object.key, object.e) ? "" : " · حد تقريبي"}` };
  return null;
}

// ---------- التركيز: سلالة كيان عبر الطبقات ----------
// الرئيسية: إلى الأمام كيان أخذ ربع أرضه فأكثر، وإلى الخلف كيان أعطاه ربع أرضه فأكثر.
// الواسعة: تضيف كل كيان صغير ذهب أكثر أرضه إليه أو جاء أكثر أرضه منه، فتتشعب كثيراً مع الإمبراطوريات.
const CUBE_LINEAGE = {
  main: { fw: (l) => l[4] >= 0.25, bw: (l) => l[5] >= 0.25 },
  wide: { fw: (l) => l[4] >= 0.25 || l[5] >= 0.5, bw: (l) => l[5] >= 0.25 || l[4] >= 0.5 },
};
const cubeFocusEl = document.getElementById("cube-focus");
const CUBE_FOCUS_HINT = "اضغط أي كيان على أي طبقة لترى ما سبقه وما صار إليه.";
function cubeSetFocus(key, name) {
  cube.lastFocus = key ? [key, name] : null;
  if (!key) {
    cube.focus = null;
    cubeFocusEl.textContent = CUBE_FOCUS_HINT;
    cubeRender();
    return;
  }
  const start = cubeNode(key, name);
  const nodes = new Set([start]);
  const links = new Set();
  const out = new Map();
  const inn = new Map();
  cube.links.forEach((l, i) => {
    const a = cubeNode(l[0], l[1]);
    const b = cubeNode(l[2], l[3]);
    if (!out.has(a)) out.set(a, []);
    if (!inn.has(b)) inn.set(b, []);
    out.get(a).push(i);
    inn.get(b).push(i);
  });
  const walk = (edges, next, keep) => {
    const queue = [start];
    while (queue.length) {
      const n = queue.shift();
      for (const i of edges.get(n) ?? []) {
        const l = cube.links[i];
        if (!keep(l)) continue;
        links.add(i);
        const m = next(l);
        if (!nodes.has(m)) { nodes.add(m); queue.push(m); }
      }
    }
  };
  const rule = CUBE_LINEAGE[cube.lineage];
  walk(out, (l) => cubeNode(l[2], l[3]), rule.fw);
  walk(inn, (l) => cubeNode(l[0], l[1]), rule.bw);
  cube.focus = { nodes, links };
  const picked = cubeEntity(key, name);
  if (picked) map.easeTo({ center: picked.r, zoom: Math.max(map.getZoom(), 2.8), duration: 900 });
  const bySlice = new Map();
  for (const n of nodes) {
    const i = n.indexOf("|");
    const k = n.slice(0, i);
    if (!bySlice.has(k)) bySlice.set(k, []);
    bySlice.get(k).push(n.slice(i + 1));
  }
  const nameOf = (k, n) => cubeEntity(k, n)?.ar ?? n;
  cubeFocusEl.innerHTML =
    `<p><b><bdi>${escapeHtml(nameOf(key, name))}</bdi></b> (${escapeHtml(cubeLabel(key))}): ${nodes.size} كياناً في ${bySlice.size} طبقة، و${links.size} خيطاً.</p>` +
    `<ul class="tr-list">${CUBE_KEYS.filter((k) => bySlice.has(k)).map((k) => `<li>${escapeHtml(cubeLabel(k))}: ${bySlice.get(k).map((n) => `<bdi>${escapeHtml(nameOf(k, n))}</bdi>`).join("، ")}</li>`).join("")}</ul>` +
    `<div class="mode"><label><input type="radio" name="cube-lineage" value="main"${cube.lineage === "main" ? " checked" : ""}> السلالة الرئيسية</label>` +
    `<label><input type="radio" name="cube-lineage" value="wide"${cube.lineage === "wide" ? " checked" : ""}> كل ما اتصل بأرضه</label></div>` +
    `<div class="row"><button type="button" id="cube-focus-clear">إلغاء التركيز</button></div>`;
  for (const r of cubeFocusEl.querySelectorAll('input[name="cube-lineage"]')) r.addEventListener("change", () => { cube.lineage = r.value; cubeSetFocus(...cube.lastFocus); });
  document.getElementById("cube-focus-clear").addEventListener("click", () => cubeSetFocus(null));
  cubeRender();
}

// ---------- التحميل والتشغيل ----------
const cubeStatusEl = document.getElementById("cube-status");
const cubeSliceListEl = document.getElementById("cube-slices");
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`تعذّر تحميل ${src}`));
    document.head.appendChild(s);
  });
}
async function cubeLoadPlaces() {
  const out = [];
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    try {
      const d = await getJson(`data/places_era${n}.geojson`);
      for (const f of d.features) {
        const key = CUBE_ERA_SLICE[f.properties.era];
        if (key) out.push({ key, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], name: f.properties.name_ar });
      }
    } catch {}
  }
  try {
    const d = await getJson("data/claim_points.geojson");
    for (const f of d.features) {
      for (const era of new Set(JSON.parse(f.properties.claims).map((c) => c.era))) {
        const key = CUBE_ERA_SLICE[era];
        if (key) out.push({ key, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], name: `${f.properties.name_ar} (أماكن الادعاءات)` });
      }
    }
  } catch {}
  return out;
}
async function cubeLoad() {
  cubeStatusEl.textContent = "تحميل محرّك الرسم...";
  if (!window.deck) await loadScript("vendor/deck.gl.min.js");
  cubeStatusEl.textContent = "تحميل الخيوط...";
  cube.links = (await getJson("data/stack/links.json")).links;
  let done = 0;
  // الأحدث أولاً: يظهر أعلى المكعّب سريعاً، ثم تكتمل الطبقات
  await Promise.all([...CUBE_KEYS].reverse().map(async (k) => {
    try {
      const d = await getJson(`data/stack/slice_${k}.json`);
      cube.slices.set(k, d.entities);
      const el = cubeSliceListEl.querySelector(`[data-count="${CSS.escape(k)}"]`);
      if (el) el.textContent = `(${d.entities.length})`;
    } catch (err) { cubeStatusEl.textContent = `تعذّر تحميل طبقة ${cubeLabel(k)}: ${err.message}`; }
    done++;
    cubeStatusEl.textContent = `تحميل الطبقات ${done} من ${CUBE_KEYS.length}`;
    cubeRender();
  }));
  cube.places = await cubeLoadPlaces();
  cube.loaded = true;
  cubeStatusEl.textContent = "";
  cubeRender();
}

async function cubeSetOn(on) {
  cube.on = on;
  document.getElementById("cube-controls").hidden = !on;
  if (on) {
    // التضاريس تتعارض مع محور الزمن العمودي، وحدود الخريطة المسطّحة تكرار للطبقات: تُطفأ وتُستعاد عند الإطفاء
    // تُخفى عبر آلية لوحة الطبقات نفسها، فلا يعيدها فتح حقبة أثناء المكعّب
    cube.prev = { terrain: terrainState.on, bordersOff: userOff.has("borders"), pitch: map.getPitch(), bearing: map.getBearing() };
    terrainState.on = false;
    applyTerrain();
    userOff.add("borders");
    for (const id of LAYER_GROUPS.borders) if (wanted.has(id)) setVis(id, wanted.get(id));
    if (!cube.overlay) {
      try {
        if (!window.deck) await loadScript("vendor/deck.gl.min.js");
      } catch (err) { cubeStatusEl.textContent = err.message; return; }
      cube.overlay = new deck.MapboxOverlay({ interleaved: true, layers: [], getTooltip: cubeTooltip, onClick: (info) => {
        if (info.object && info.object.e) cubeSetFocus(info.object.key, info.object.e.n);
        else if (!info.object) cubeSetFocus(null);
      } });
    }
    if (!map.hasControl(cube.overlay)) map.addControl(cube.overlay);
    // منظر مائل على قلب العالم القديم، حيث أكثر الطبقات كثافة
    map.easeTo({ center: [35, 30], zoom: Math.max(2.4, Math.min(map.getZoom(), 3.2)), pitch: 55, bearing: -15, duration: 900 });
    if (!cube.loaded) {
      try { await cubeLoad(); } catch (err) { cubeStatusEl.textContent = `تعذّر تحميل المكعّب: ${err.message}`; }
    } else cubeRender();
  } else {
    if (cube.overlay && map.hasControl(cube.overlay)) map.removeControl(cube.overlay);
    if (cube.prev) {
      terrainState.on = cube.prev.terrain;
      applyTerrain();
      if (!cube.prev.bordersOff) userOff.delete("borders");
      for (const id of LAYER_GROUPS.borders) if (wanted.has(id)) setVis(id, wanted.get(id));
      map.easeTo({ pitch: cube.prev.pitch, bearing: cube.prev.bearing, duration: 800 });
    }
  }
  document.getElementById("terrain-toggle").checked = terrainState.on;
}

// ---------- لوحة التحكم ----------
cubeSliceListEl.innerHTML = [...CUBE_KEYS].reverse().map((k) => {
  const [r, g, b] = CUBE_COLOR[k];
  return `<label class="opt"><input type="checkbox" data-slice="${k}" checked><i class="sw" style="background:rgb(${r},${g},${b});border:1px solid #0003"></i> ${escapeHtml(cubeLabel(k))} <span class="sub" data-count="${k}"></span></label>`;
}).join("");
cubeSliceListEl.addEventListener("change", (e) => {
  const k = e.target.dataset.slice;
  if (!k) return;
  if (e.target.checked) cube.visible.add(k); else cube.visible.delete(k);
  cubeRender();
});
function cubeAllSlices(on) {
  for (const box of cubeSliceListEl.querySelectorAll("input[data-slice]")) box.checked = on;
  cube.visible = new Set(on ? CUBE_KEYS : []);
  cubeRender();
}
document.getElementById("cube-slices-all").addEventListener("click", () => cubeAllSlices(true));
document.getElementById("cube-slices-none").addEventListener("click", () => cubeAllSlices(false));
for (const k of Object.keys(cube.show)) {
  document.getElementById(`cube-show-${k}`).addEventListener("change", (e) => { cube.show[k] = e.target.checked; cubeRender(); });
}
for (const r of document.querySelectorAll('input[name="cube-axis"]')) r.addEventListener("change", () => { cube.axis = r.value; cubeRender(); });
const cubeSpacingEl = document.getElementById("cube-spacing");
const cubeSpacingVal = document.getElementById("cube-spacing-val");
cubeSpacingVal.textContent = `${cube.spacingKm} كم`;
cubeSpacingEl.addEventListener("input", () => {
  cube.spacingKm = Number(cubeSpacingEl.value);
  cubeSpacingVal.textContent = `${cube.spacingKm} كم`;
  cubeRender();
});
document.getElementById("cube-toggle").addEventListener("change", (e) => cubeSetOn(e.target.checked));
cubeFocusEl.textContent = CUBE_FOCUS_HINT;
