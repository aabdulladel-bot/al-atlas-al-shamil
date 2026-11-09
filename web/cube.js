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
  // الوضع: "place" يبدأ بسؤال (ماذا كان هنا؟) ويرسم عمود نقطة واحدة؛ "all" كل الطبقات (متقدم)
  mode: "place",
  column: null,
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
  const col = cube.mode === "place" ? cube.column : null;
  const all = cube.mode === "all" && !focus;
  // ما يُرسم وحده، لا ما يُخفَّت: سلالة الكيان المركَّز، أو كيانات عمود النقطة، أو كل الطبقات في الوضع المتقدم.
  // كان المكعّب يرسم كل الكيانات (نحو 2400) في كل الأحوال، فيضيع المطلوب في الزحام.
  const show = focus ? (key, e) => focus.nodes.has(cubeNode(key, e.n))
    : all ? () => true
    : col ? (key, e) => col.nodes.has(cubeNode(key, e.n))
    : () => false;
  const polys = [];
  const rings = [];
  for (const k of keys) {
    const g = cubeGeometry(k);
    for (const d of g.polys) if (show(k, d.e)) polys.push(d);
    for (const d of g.rings) if (show(k, d.e)) rings.push(d);
  }
  // في الوضع المتقدم إحدى عشرة طبقة متراكبة بتعبئة خفيفة، وفي غيره كيانات قليلة فتُرسم واضحة
  const fillAlpha = (d) => (all ? (cubePrecise(d.key, d.e) ? 45 : 25) : cubePrecise(d.key, d.e) ? 140 : 105);
  const edgeAlpha = (d) => (all ? (cubePrecise(d.key, d.e) ? 170 : 100) : 255);
  // الأسطح شفافة لا تحجب بعضها، والكرة تحجب ما خلفها
  const flat = { depthCompare: "less-equal", depthWriteEnabled: false };
  const layers = [];
  if (cube.show.fill) {
    layers.push(new deck.SolidPolygonLayer({
      id: "cube-planes", data: polys, getPolygon: (d) => d.polygon, pickable: true, parameters: flat,
      getFillColor: (d) => [...CUBE_COLOR[d.key], fillAlpha(d)],
      updateTriggers: { getFillColor: [focus, cube.mode, col] },
    }));
  }
  if (cube.show.edges) {
    layers.push(new deck.PathLayer({
      id: "cube-edges", data: rings, getPath: (d) => d.path, widthUnits: "pixels", parameters: flat, pickable: !cube.show.fill,
      getWidth: () => (all ? 1 : 2.5),
      getColor: (d) => [...CUBE_COLOR[d.key], edgeAlpha(d)],
      updateTriggers: { getWidth: [focus, cube.mode], getColor: [focus, cube.mode] },
    }));
  }
  const vis = new Set(keys);
  // الخيوط: خيوط السلالة مع التركيز، وكل الخيوط المختارة في الوضع المتقدم، ولا خيوط في عمود النقطة
  const threads = cube.links.filter((l, i) => vis.has(l[0]) && vis.has(l[2]) && (focus ? focus.links.has(i) : all && cube.show[l[6]]));
  layers.push(new deck.LineLayer({
    id: "cube-threads", data: threads, pickable: true, widthUnits: "pixels", parameters: flat,
    getSourcePosition: (l) => cubePos(l[0], l[1]),
    getTargetPosition: (l) => cubePos(l[2], l[3]),
    getColor: (l) => [...CUBE_THREAD[l[6]], focus ? 255 : 170],
    getWidth: (l) => (focus ? 1.5 : 0.8) + 3 * Math.max(l[4], l[5]),
    updateTriggers: { getSourcePosition: [cube.axis, cube.spacingKm], getTargetPosition: [cube.axis, cube.spacingKm], getColor: [focus], getWidth: [focus] },
  }));
  // العمود: خط عمودي يصل الطبقات عند النقطة المسؤول عنها، أو عند مركز الكيان في «من حكم أرضه»، وعلامة على كل طبقة
  const anchorCol = focus?.anchor ? { lon: focus.anchor[0], lat: focus.anchor[1], hits: CUBE_KEYS.map((k) => ({ key: k, e: focus.chain.some((c) => c.key === k) ? true : null })) } : !focus ? col : null;
  if (anchorCol) {
    const col = anchorCol;
    const zs = keys.map((k) => cubeZ(k));
    if (zs.length) {
      layers.push(new deck.LineLayer({
        id: "cube-column", data: [col], widthUnits: "pixels", parameters: flat, getWidth: 2,
        getSourcePosition: (c) => [c.lon, c.lat, 0], getTargetPosition: (c) => [c.lon, c.lat, Math.max(...zs)],
        getColor: [255, 255, 255, 220], updateTriggers: { getTargetPosition: [cube.axis, cube.spacingKm, keys.length] },
      }));
      layers.push(new deck.ScatterplotLayer({
        id: "cube-column-dots", data: keys.map((k) => ({ k, hit: col.hits.find((h) => h.key === k)?.e })), parameters: flat,
        getPosition: (d) => [col.lon, col.lat, cubeZ(d.k)], radiusUnits: "pixels", getRadius: (d) => (d.hit ? 6 : 3),
        getFillColor: (d) => (d.hit ? [...CUBE_COLOR[d.k], 255] : [255, 255, 255, 120]), stroked: true,
        getLineColor: [20, 30, 50, 255], lineWidthUnits: "pixels", getLineWidth: 1,
        updateTriggers: { getPosition: [cube.axis, cube.spacingKm] },
      }));
    }
  }
  if (cube.show.places && all) {
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

// ---------- عمود النقطة: ماذا كان هنا؟ ----------
// لكل خريطة الكيانُ المسمّى الذي تقع النقطة داخل حدوده في المصدر. الحدود قبل 1900 تقريبية، فالجواب تقريبي قربها.
function cubeInRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function cubeContains(e, x, y) {
  if (!e._bb) {
    let a = 180, b = 90, c = -180, d = -90;
    for (const poly of e.g) for (const [px, py] of poly[0]) { if (px < a) a = px; if (py < b) b = py; if (px > c) c = px; if (py > d) d = py; }
    e._bb = [a, b, c, d];
  }
  const [a, b, c, d] = e._bb;
  if (x < a || x > c || y < b || y > d) return false;
  return e.g.some((poly) => cubeInRing(poly[0], x, y) && !poly.slice(1).some((h) => cubeInRing(h, x, y)));
}
const cubeName = (key, n) => cubeEntity(key, n)?.ar ?? (typeof labelInfo !== "undefined" ? labelInfo.get(n)?.ar : null) ?? n;
function cubeColumnAt([lon, lat]) {
  const hits = CUBE_KEYS.map((k) => ({ key: k, e: (cube.slices.get(k) ?? []).find((x) => x.n && cubeContains(x, lon, lat)) ?? null }));
  cube.column = { lon, lat, hits, nodes: new Set(hits.filter((h) => h.e).map((h) => cubeNode(h.key, h.e.n))) };
  cube.focus = null;
  cube.lastFocus = null;
  cubePanelIdle();
  cubeRender();
}
const CUBE_PLACE_HINT = "اضغط أي مكان على الخريطة لترى من حكمه في كل خريطة، من 4000 ق.م إلى اليوم. ثم اضغط اسماً لترى سلالته.";
function cubePanelIdle() {
  const col = cube.mode === "place" ? cube.column : null;
  if (!col) { cubeFocusEl.textContent = cube.mode === "place" ? CUBE_PLACE_HINT : CUBE_FOCUS_HINT; return; }
  const named = col.hits.filter((h) => h.e).length;
  const rows = [...col.hits].reverse().map((h) => {
    const [r, g, b] = CUBE_COLOR[h.key];
    const sw = `<i class="sw" style="background:rgb(${r},${g},${b})"></i>`;
    const era = `<span class="cube-era">${escapeHtml(cubeLabel(h.key))}</span>`;
    if (!h.e) return `<li class="cube-row empty">${sw}${era}<span class="sub">لا كيان مسمّى هنا في المصدر</span></li>`;
    const approx = cubePrecise(h.key, h.e) ? "" : ` <span class="sub">حد تقريبي</span>`;
    return `<li class="cube-row">${sw}${era}<button type="button" class="linkish" data-cube-lineage="${escapeHtml(h.key)}|${escapeHtml(h.e.n)}"><bdi>${escapeHtml(cubeName(h.key, h.e.n))}</bdi></button>${approx}</li>`;
  }).join("");
  cubeFocusEl.innerHTML = `<p><b>ماذا كان هنا؟</b> ${named} من ${col.hits.length} خريطة تسمّي كياناً على هذه النقطة. الأحدث في الأعلى.</p>` +
    `<ol class="cube-col">${rows}</ol><p class="sub">اضغط اسماً لترى سلالته عبر الطبقات، أو اضغط مكاناً آخر على الخريطة.</p>`;
  for (const b of cubeFocusEl.querySelectorAll("[data-cube-lineage]")) {
    b.addEventListener("click", () => { const v = b.dataset.cubeLineage; const i = v.indexOf("|"); cubeSetFocus(v.slice(0, i), v.slice(i + 1)); });
  }
}

// ---------- التركيز: سلالة كيان عبر الطبقات ----------
// «كل ما اتصل بأرضه»: يتبع كل خيط يتجاوز ربع الأرض في الاتجاهين، فيتشعّب كثيراً مع الإمبراطوريات.
// والوضع الافتراضي («من حكم أرضه») لا يتبع الخيوط بل يقيس الأرض نفسها (cubeLandChain).
const CUBE_LINEAGE = {
  wide: { fw: (l) => l[4] >= 0.25 || l[5] >= 0.5, bw: (l) => l[5] >= 0.25 || l[4] >= 0.5 },
};
const cubeFocusEl = document.getElementById("cube-focus");
const CUBE_FOCUS_HINT = "اضغط أي كيان على أي طبقة لترى ما سبقه وما صار إليه.";
// عيّنات من أرض الكيان: نقاط شبكة داخل حدوده، تُسأل عنها كل طبقة
function cubeSamples(e) {
  cubeContains(e, 0, 0); // يحسب المستطيل المحيط
  const [a, b, c, d] = e._bb;
  for (const n of [16, 32, 64]) {
    const pts = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = a + ((i + 0.5) * (c - a)) / n;
      const y = b + ((j + 0.5) * (d - b)) / n;
      if (cubeContains(e, x, y)) pts.push([x, y]);
    }
    if (pts.length >= 40 || n === 64) return pts.length ? pts : [e.r];
  }
  return [e.r];
}
// السلسلة على أرض الكيان: لكل خريطة الكيانُ الذي يغطي أكبر نصيب من أرض الكيان المختار، ونصيبه.
// كانت السلسلة تتبع سلف الكيان كله خطوة بعد خطوة، فتنجرف مع الإمبراطوريات إلى أراضٍ بعيدة
// (من العراق إلى العثمانيين ثم الفاطميين في مصر ثم الرومان). هنا تبقى على الأرض نفسها.
function cubeLandChain(key, name) {
  const e = cubeEntity(key, name);
  if (!e) return [];
  const pts = cubeSamples(e);
  return CUBE_KEYS.map((k) => {
    const counts = new Map();
    for (const [x, y] of pts) {
      const hit = (cube.slices.get(k) ?? []).find((z) => z.n && cubeContains(z, x, y));
      if (hit) counts.set(hit.n, (counts.get(hit.n) ?? 0) + 1);
    }
    let best = null;
    let n = 0;
    for (const [nm, c] of counts) if (c > n) { best = nm; n = c; }
    return { key: k, name: best, share: best ? n / pts.length : 0 };
  });
}
function cubeSetFocus(key, name) {
  cube.lastFocus = key ? [key, name] : null;
  if (!key) {
    cube.focus = null;
    cubePanelIdle();
    cubeRender();
    return;
  }
  const start = cubeNode(key, name);
  const nodes = new Set([start]);
  const links = new Set();
  let chain = null;
  if (cube.lineage === "main") {
    chain = cubeLandChain(key, name).filter((c) => c.name && c.share >= 0.1);
    for (const c of chain) nodes.add(cubeNode(c.key, c.name));
    // لا خيوط هنا: الخيط يصل مركزَي كيانين كاملين، والسؤال عن أرض واحدة، فيُرسم عمود عند مركزها بدلاً منه
  } else {
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
    const rule = CUBE_LINEAGE.wide;
    walk(out, (l) => cubeNode(l[2], l[3]), rule.fw);
    walk(inn, (l) => cubeNode(l[0], l[1]), rule.bw);
  }
  const picked = cubeEntity(key, name);
  cube.focus = { nodes, links, anchor: chain && picked ? picked.r : null, chain };
  if (picked) map.easeTo({ center: picked.r, zoom: Math.max(map.getZoom(), 2.8), duration: 900 });
  const title = `<b><bdi>${escapeHtml(cubeName(key, name))}</bdi></b> (${escapeHtml(cubeLabel(key))})`;
  let body;
  if (chain) {
    const rows = [...chain].reverse().map((c) => {
      const [r, g, b] = CUBE_COLOR[c.key];
      const self = c.key === key && c.name === name;
      return `<li class="cube-row${self ? " self" : ""}"><i class="sw" style="background:rgb(${r},${g},${b})"></i><span class="cube-era">${escapeHtml(cubeLabel(c.key))}</span>` +
        `<button type="button" class="linkish" data-cube-lineage="${escapeHtml(c.key)}|${escapeHtml(c.name)}"><bdi>${escapeHtml(cubeName(c.key, c.name))}</bdi></button>` +
        `<span class="sub">${Math.round(c.share * 100)}%</span></li>`;
    }).join("");
    body = `<p>${title}: من حكم أرضه في كل خريطة. النسبة نصيب كل كيان من أرض هذا الكيان، والأحدث في الأعلى.</p><ol class="cube-col">${rows}</ol>` +
      `<p class="sub">يُعرض الكيان إن غطّى عُشر الأرض فأكثر. والحدود قبل 1900 تقريبية، فالنسب تقريبية.</p>`;
  } else {
    const bySlice = new Map();
    for (const n of nodes) {
      const i = n.indexOf("|");
      const k = n.slice(0, i);
      if (!bySlice.has(k)) bySlice.set(k, []);
      bySlice.get(k).push(n.slice(i + 1));
    }
    body = `<p>${title}: ${nodes.size} كياناً في ${bySlice.size} طبقة، و${links.size} خيطاً.</p>` +
      `<ul class="tr-list">${CUBE_KEYS.filter((k) => bySlice.has(k)).map((k) => `<li>${escapeHtml(cubeLabel(k))}: ${bySlice.get(k).map((n) => `<bdi>${escapeHtml(cubeName(k, n))}</bdi>`).join("، ")}</li>`).join("")}</ul>`;
  }
  cubeFocusEl.innerHTML = body +
    `<div class="mode"><label><input type="radio" name="cube-lineage" value="main"${cube.lineage === "main" ? " checked" : ""}> من حكم أرضه (أوضح)</label>` +
    `<label><input type="radio" name="cube-lineage" value="wide"${cube.lineage === "wide" ? " checked" : ""}> كل ما اتصل بأرضه (متشعّب)</label></div>` +
    `<div class="row"><button type="button" id="cube-focus-clear">${cube.mode === "place" && cube.column ? "رجوع إلى عمود النقطة" : "إلغاء التركيز"}</button></div>`;
  for (const r of cubeFocusEl.querySelectorAll('input[name="cube-lineage"]')) r.addEventListener("change", () => { cube.lineage = r.value; cubeSetFocus(...cube.lastFocus); });
  for (const bt of cubeFocusEl.querySelectorAll("[data-cube-lineage]")) {
    bt.addEventListener("click", () => { const v = bt.dataset.cubeLineage; const i = v.indexOf("|"); cubeSetFocus(v.slice(0, i), v.slice(i + 1)); });
  }
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
    // وتُخفى الأسماء وطبقة الشعوب وشاشة الترحيب، وتُسطَّح الكرة: الطبقات فوق كرة تتلوى وتتزاحم
    cube.prev = { terrain: terrainState.on, bordersOff: userOff.has("borders"), labelsOff: userOff.has("labels"), peoplesOff: userOff.has("peoples"),
      placesOff: userOff.has("places"), claimsOff: userOff.has("claims"),
      projection: map.getProjection?.()?.type ?? "globe", pitch: map.getPitch(), bearing: map.getBearing() };
    terrainState.on = false;
    applyTerrain();
    for (const g of ["borders", "peoples", "places", "claims", "labels"]) {
      userOff.add(g);
      for (const id of LAYER_GROUPS[g]) if (wanted.has(id)) setVis(id, wanted.get(id));
    }
    updateLabels();
    document.body.classList.add("cubing");
    if (cube.prev.projection !== "mercator") map.setProjection({ type: "mercator" });
    cubePanelIdle();
    document.getElementById("cube-panel").scrollIntoView({ block: "start", behavior: "smooth" });
    if (!cube.overlay) {
      try {
        if (!window.deck) await loadScript("vendor/deck.gl.min.js");
      } catch (err) { cubeStatusEl.textContent = err.message; return; }
      cube.overlay = new deck.MapboxOverlay({ interleaved: true, layers: [], getTooltip: cubeTooltip, onClick: (info) => {
        if (info.object && info.object.e) cubeSetFocus(info.object.key, info.object.e.n);
        else if (!info.object && cube.mode === "place" && info.coordinate && cube.loaded) cubeColumnAt(info.coordinate);
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
      if (!cube.prev.peoplesOff) userOff.delete("peoples");
      if (!cube.prev.labelsOff) userOff.delete("labels");
      if (!cube.prev.placesOff) userOff.delete("places");
      if (!cube.prev.claimsOff) userOff.delete("claims");
      for (const g of ["borders", "peoples", "places", "claims"]) for (const id of LAYER_GROUPS[g]) if (wanted.has(id)) setVis(id, wanted.get(id));
      updateLabels();
      if (cube.prev.projection !== "mercator") map.setProjection({ type: cube.prev.projection });
      map.easeTo({ pitch: cube.prev.pitch, bearing: cube.prev.bearing, duration: 800 });
    }
  }
  if (!on) document.body.classList.remove("cubing");
  document.getElementById("terrain-toggle").checked = terrainState.on;
  const proj = document.querySelector(`input[name="projection"][value="${on ? "mercator" : cube.prev?.projection ?? "globe"}"]`);
  if (proj) proj.checked = true;
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
for (const r of document.querySelectorAll('input[name="cube-mode"]')) r.addEventListener("change", () => {
  cube.mode = r.value;
  cube.focus = null;
  cube.lastFocus = null;
  cubePanelIdle();
  cubeRender();
});
cubeFocusEl.textContent = CUBE_PLACE_HINT;
