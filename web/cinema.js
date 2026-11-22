// العرض السينمائي للرحلات: خريطة كاملة بلا لوحات، وترجمة نصية تتقدّم مقطعاً مقطعاً،
// وكاميرا تطير بين أماكن الشواهد، ومسار يُرسم بينها، ونبض على المكان، وتظليل للكيان الذي يقع فيه،
// وعلامة ✕ على الشاهد المقيِّد. كل نص يُعرض يأتي من ملف الرحلة المولَّد (web/data/journeys/{id}.json)،
// فلا نص هنا إلا أسماء الأزرار. وضع القراءة (صندوق الرحلة في journey.js) يبقى متاحاً بزر «قراءة».
// كل ما في الملف داخل نطاق مغلق: أسماء دواله لا تتصادم مع دوال الملفات الأخرى (explore.js فيه setRegion مثلاً)،
// ولا يُصدَّر إلا ما تحتاجه journey.js والاختبارات.
(() => {
const CINE_PREF_KEY = "atlas-journey-mode";
const cine = {
  on: false, playing: true, token: 0,
  chunks: [], ci: 0, timer: null, due: 0, remain: 0,
  stepTotal: 1, stepElapsed: 0, resumedAt: 0, raf: 0,
  markers: [], anchors: [], allAnchors: [], routes: [], prevAnchor: null, routeAnim: 0,
};

function cinemaPreferred() {
  try { return localStorage.getItem(CINE_PREF_KEY) !== "read"; } catch { return true; }
}
function setCinemaPref(mode) {
  try { localStorage.setItem(CINE_PREF_KEY, mode); } catch {}
}

// ---------- عناصر الواجهة ----------
const cineEl = document.createElement("div");
cineEl.id = "cine";
cineEl.hidden = true;
cineEl.innerHTML = `
  <div class="cine-top">
    <div class="cine-bars" id="cine-bars"></div>
    <div class="cine-head">
      <div class="cine-chip"><span class="cine-jt" id="cine-jt"></span><span class="cine-st" id="cine-st"></span></div>
      <button type="button" class="cine-btn cine-x-btn" data-act="exit" aria-label="إنهاء الرحلة" title="إنهاء (Esc)">✕</button>
    </div>
  </div>
  <div class="cine-cap" id="cine-cap" aria-hidden="true"><div class="cap-box" id="cine-cap-box"></div><div class="cap-src" id="cine-cap-src"></div></div>
  <div class="cine-card" id="cine-card" hidden></div>
  <div class="cine-ctrl">
    <button type="button" class="cine-btn" data-act="prev" title="السابق (→)">السابق</button>
    <button type="button" class="cine-btn cine-play" data-act="toggle" aria-label="إيقاف مؤقت" title="إيقاف وتشغيل (مسافة)">❚❚</button>
    <button type="button" class="cine-btn" data-act="next" title="التالي (←)">التالي</button>
    <button type="button" class="cine-btn cine-export" data-act="export" title="حفظ هذه الخطوة كصورة 9:16 مع إسنادها">صورة</button>
    <button type="button" class="cine-btn cine-read" data-act="read" title="النص الكامل بالاقتباسات والتحفظات">قراءة</button>
  </div>
  <p class="sr-only" id="cine-sr" aria-live="polite"></p>`;
document.body.appendChild(cineEl);
const $c = (id) => document.getElementById(id);

// ---------- تقسيم النص إلى مقاطع ترجمة قصيرة ----------
// الجملة تُقسم أولاً عند علامات الترقيم، ثم كل عبارة إلى مقاطع متوازنة لا تزيد على ست كلمات
function chunkText(text, max = isNarrow() ? 5 : 6) {
  const out = [];
  const clauses = String(text ?? "").replace(/\s+/g, " ").trim().split(/(?<=[،؛:.!؟?])\s+/);
  for (const clause of clauses) {
    const words = clause.split(" ").filter(Boolean);
    if (!words.length) continue;
    const parts = Math.ceil(words.length / max);
    const size = Math.ceil(words.length / parts);
    for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(" "));
  }
  return out.map((t) => t.replace(/[.]$/, ""));
}
const wordsOf = (t) => t.split(/\s+/).filter(Boolean).length;
const chunkMs = (c) => Math.max(1500, Math.min(3800, 520 + wordsOf(c.t) * (c.kind === "quote" ? 360 : 300)));

// مقاطع الخطوة: جملة الربط، ثم نص كل عنصر مع نسبته إلى قائله
function stepChunks(st) {
  const list = [];
  const push = (text, kind, src = null) => { for (const t of chunkText(text)) list.push({ t, kind, src }); };
  push(st.frame, "frame");
  for (const it of st.items) {
    if (it.khaldun) {
      push(it.hypothesis, "claim", "فرضية السُّنّة");
      const q = it.khaldun[0];
      if (q && wordsOf(q.quote) <= 45) push(q.quote, "quote", `ابن خلدون، المقدمة · ${q.location}`);
    } else if (it.statement) {
      push(it.statement, st.kind === "limits" ? "limit" : "claim", it.attributed_to);
    } else if (it.caution) {
      push(it.caution, "caution", "تحفظ");
    } else if (it.scope) {
      push(`${it.scope}: ${it.verdict}`, "claim", "الاختبار الكمي");
      push(it.text, "claim", "الاختبار الكمي");
    }
  }
  return list;
}

// ---------- أماكن الخطوة ومراسيها ----------
async function stepPlaces(st) {
  const ids = st.items.filter((it) => it.id).map((it) => it.id);
  if (!ids.length || !(await ensureClaimPoints())) return [];
  return claimPoints.features.filter((f) => ids.some((id) => f.properties.claim_ids.includes(`,${id},`)));
}
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// قوس الدائرة العظمى بين نقطتين، بخطوط طول متصلة (لا قفز عند خط التاريخ)
function greatCircle(a, b, n = 72) {
  const r = Math.PI / 180;
  const [l1, p1, l2, p2] = [a[0] * r, a[1] * r, b[0] * r, b[1] * r];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (d < 1e-4) return [a, b];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    let lon = Math.atan2(y, x) / r;
    const prev = out[out.length - 1];
    if (prev) while (lon - prev[0] > 180) lon -= 360;
    if (prev) while (lon - prev[0] < -180) lon += 360;
    out.push([lon, Math.atan2(z, Math.sqrt(x * x + y * y)) / r]);
  }
  return out;
}

// ---------- الكيان الذي يقع فيه المكان في سنة الحدود ----------
function inRing(pt, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inPoly = (pt, rings) => inRing(pt, rings[0]) && !rings.slice(1).some((h) => inRing(pt, h));
function containing(data, pt) {
  return data.features.find((f) => {
    const g = f.geometry;
    if (!g || !f.properties?.NAME) return false;
    if (g.type === "Polygon") return inPoly(pt, g.coordinates);
    if (g.type === "MultiPolygon") return g.coordinates.some((p) => inPoly(pt, p));
    return false;
  });
}
async function regionAt(border, pt) {
  const key = timeKey(border);
  const url = key === "modern" ? "data/borders/modern_countries.geojson" : `data/borders/borders_${key}.geojson`;
  try { return containing(await getJson(url), pt) ?? null; } catch { return null; }
}

// ---------- طبقات العرض على الخريطة ----------
const EMPTY = { type: "FeatureCollection", features: [] };
function ensureCineLayers() {
  if (map.getSource("cine-route")) return;
  map.addSource("cine-region", { type: "geojson", data: EMPTY });
  map.addSource("cine-route", { type: "geojson", data: EMPTY });
  map.addSource("cine-head", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "cine-region-fill", type: "fill", source: "cine-region", paint: { "fill-color": "#e3342f", "fill-opacity": 0, "fill-opacity-transition": { duration: 900 } } });
  map.addLayer({ id: "cine-region-glow", type: "line", source: "cine-region", paint: { "line-color": "#ff3b30", "line-width": 7, "line-blur": 5, "line-opacity": 0, "line-opacity-transition": { duration: 900 } } });
  map.addLayer({ id: "cine-region-line", type: "line", source: "cine-region", paint: { "line-color": "#ff5a4f", "line-width": 1.8, "line-dasharray": [2, 1.4], "line-opacity": 0, "line-opacity-transition": { duration: 900 } } });
  map.addLayer({ id: "cine-route-done", type: "line", source: "cine-route", filter: ["==", ["get", "s"], "done"], layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 1.8, "line-opacity": 0.7, "line-dasharray": [2, 2.2] } });
  map.addLayer({ id: "cine-route-live", type: "line", source: "cine-route", filter: ["==", ["get", "s"], "live"], layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 3.4, "line-opacity": 0.95 } });
  map.addLayer({ id: "cine-route-dash", type: "line", source: "cine-route", filter: ["==", ["get", "s"], "live"], paint: { "line-color": "#e3342f", "line-width": 3.4, "line-dasharray": [1, 1.2] } });
  map.addLayer({ id: "cine-head-glow", type: "circle", source: "cine-head", paint: { "circle-radius": 13, "circle-color": "#ffffff", "circle-opacity": 0.28, "circle-blur": 0.8 } });
  map.addLayer({ id: "cine-head-dot", type: "circle", source: "cine-head", paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": "#e3342f", "circle-stroke-width": 2.5 } });
}
const CINE_LAYERS = ["cine-region-fill", "cine-region-glow", "cine-region-line", "cine-route-done", "cine-route-live", "cine-route-dash", "cine-head-glow", "cine-head-dot"];
function removeCineLayers() {
  for (const id of CINE_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  for (const s of ["cine-region", "cine-route", "cine-head"]) if (map.getSource(s)) map.removeSource(s);
}
function raiseCineLayers() { for (const id of CINE_LAYERS) if (map.getLayer(id)) map.moveLayer(id); }

function drawRoutes(live = null, head = null) {
  const feats = cine.routes.map((coords) => ({ type: "Feature", properties: { s: "done" }, geometry: { type: "LineString", coordinates: coords } }));
  if (live && live.length > 1) feats.push({ type: "Feature", properties: { s: "live" }, geometry: { type: "LineString", coordinates: live } });
  map.getSource("cine-route")?.setData({ type: "FeatureCollection", features: feats });
  map.getSource("cine-head")?.setData(head ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: head } }] } : EMPTY);
}

// يُرسم المسار من المرسى السابق إلى الحالي خلال طيران الكاميرا، ثم يبقى خطاً منقّطاً خافتاً
function animateRoute(from, to, ms, token) {
  cancelAnimationFrame(cine.routeAnim);
  const path = greatCircle(from, to);
  if (path.length < 3) return;
  const t0 = performance.now();
  const frame = (now) => {
    if (token !== cine.token) return;
    const f = ms <= 0 ? 1 : Math.min(1, (now - t0) / ms);
    const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2; // تسارع ثم تباطؤ
    const n = Math.max(2, Math.round(e * (path.length - 1)) + 1);
    const live = path.slice(0, n);
    drawRoutes(live, live[live.length - 1]);
    if (f < 1) cine.routeAnim = requestAnimationFrame(frame);
    else { cine.routes.push(path); drawRoutes(null, null); }
  };
  cine.routeAnim = requestAnimationFrame(frame);
}

function setRegion(feature) {
  if (!map.getSource("cine-region")) return;
  map.getSource("cine-region").setData(feature ? { type: "FeatureCollection", features: [feature] } : EMPTY);
  const on = feature ? 1 : 0;
  map.setPaintProperty("cine-region-fill", "fill-opacity", on * 0.24);
  map.setPaintProperty("cine-region-glow", "line-opacity", on * 0.55);
  map.setPaintProperty("cine-region-line", "line-opacity", on * 0.95);
}

// ---------- علامات HTML: نبض المكان، والتسمية، و✕ القيد ----------
// MapLibre تضع العلامة بخاصية transform على عنصرها، فالمحتوى وحركته في عنصر داخلي لا يمسّها
function addMarker(el, lngLat, anchor = "center") {
  const wrap = document.createElement("div");
  wrap.className = "cine-mk";
  wrap.appendChild(el);
  const m = new maplibregl.Marker({ element: wrap, anchor }).setLngLat(lngLat).addTo(map);
  cine.markers.push(m);
  return m;
}
function clearMarkers() { for (const m of cine.markers) m.remove(); cine.markers = []; }
function pinEl(name, sub, small = false) {
  const el = document.createElement("div");
  el.className = `cine-pin${small ? " small" : ""}`;
  el.innerHTML = `<i class="ring"></i><i class="ring r2"></i><b class="dot"></b>${name ? `<span class="cine-lbl">${escapeHtml(name)}${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span>` : ""}`;
  return el;
}
function crossEl() {
  const el = document.createElement("div");
  el.className = "cine-cross";
  el.setAttribute("aria-hidden", "true");
  return el;
}

// ---------- إخفاء طبقات الأطلس أثناء العرض وإعادتها كما كانت ----------
const hiddenGroups = () => Object.entries(LAYER_GROUPS).filter(([g]) => g !== "hillshade" && g !== "water").flatMap(([, ids]) => ids);
const savedVis = new Map();
function hideAtlasLayers() {
  for (const id of hiddenGroups()) {
    if (!map.getLayer(id)) continue;
    const v = map.getLayoutProperty(id, "visibility") ?? "visible";
    if (!savedVis.has(id) || v !== "none") savedVis.set(id, v);
    map.setLayoutProperty(id, "visibility", "none");
  }
  raiseCineLayers();
}
function restoreAtlasLayers() {
  for (const [id, v] of savedVis) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
  savedVis.clear();
}

// ---------- الكاميرا ----------
// الهامش العلوي يتسع لشريط التقدّم وعنوان الخطوة وتسمية المكان فوق نقطته، فلا يقع مكان تحت العنوان
// (كانت «طرابزون» تقع تحته على الجوال بهامش 90)
function capPadding() {
  const h = window.innerHeight, w = window.innerWidth;
  return isNarrow() ? { top: 140, bottom: Math.round(h * 0.34), left: 28, right: 28 } : { top: 125, bottom: Math.round(h * 0.26), left: Math.round(w * 0.08), right: Math.round(w * 0.08) };
}
// احتواء النطاق في الكاميرا. حساب الكرة في MapLibre قد يفشل على الجوال (نطاق شبه نقطي أو حشوة كبيرة)،
// فيُلقي خطأ «reading 'center'»؛ عندها يُطار إلى مركز النطاق بدل الاحتواء.
function fitOrFly(xs, ys, opts, maxZoom) {
  const w = Math.min(...xs), s = Math.min(...ys), e = Math.max(...xs), n = Math.max(...ys);
  const center = [(w + e) / 2, (s + n) / 2];
  const fly = () => map.flyTo({ ...opts, center, zoom: Math.min(maxZoom, isNarrow() ? 3.2 : 3.6), padding: capPadding(), curve: 1.2 });
  if (e - w < 0.5 && n - s < 0.5) return fly();
  try { map.fitBounds([[w, s], [e, n]], { ...opts, padding: capPadding(), maxZoom }); } catch { fly(); }
}
function flyCamera(pts, ms) {
  const opts = { pitch: 0, bearing: 0, duration: camMs(ms), essential: true };
  if (!pts.length && cine.allAnchors.length > 1) {
    // الافتتاح والخاتمة: نطاق أماكن الرحلة كلها، لا الكرة كاملة
    const xs = cine.allAnchors.map((p) => p[0]), ys = cine.allAnchors.map((p) => p[1]);
    fitOrFly(xs, ys, opts, 3.6);
  } else if (!pts.length) {
    const c = cine.allAnchors.length ? cine.allAnchors[0] : [30, 22];
    map.flyTo({ ...opts, center: c, zoom: isNarrow() ? 1.4 : 2, padding: capPadding(), curve: 1.2 });
  } else if (pts.length === 1) {
    map.flyTo({ ...opts, center: pts[0], zoom: isNarrow() ? 3.9 : 4.3, padding: capPadding(), curve: 1.3 });
  } else {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    fitOrFly(xs, ys, opts, 4.4);
  }
}

// ---------- الترجمة: عرض المقاطع وتوقيتها مع الإيقاف المؤقت ----------
const capEl = $c("cine-cap"), capBox = $c("cine-cap-box"), capSrc = $c("cine-cap-src");
// النص يُبدَّل فوراً، ثم تُعاد حركة الظهور؛ فلا يبقى المقطع مخفياً إن تأخر مؤقِّت أو تتابعت الخطوات
function showChunk(c) {
  capEl.className = `cine-cap k-${c.kind}`;
  const text = c.kind === "quote" ? `«${c.t}»` : c.t;
  const words = text.split(/\s+/);
  const dur = chunkMs(c);
  // الكلمات تُضاء واحدة بعد أخرى حتى نهاية المقطع، فيقرأ العين مع الصوت دون أن تُكشف الجملة كلها مرة واحدة
  capBox.innerHTML = reduceMotion ? escapeHtml(text) : words.map((w, i) => `<span class="w" style="--d:${Math.round((i / words.length) * dur * 0.85)}ms">${escapeHtml(w)}</span>`).join(" ");
  capSrc.textContent = c.src ? `— ${c.src}` : "";
  capSrc.hidden = !c.src;
  if (reduceMotion) return;
  void capEl.offsetWidth; // إعادة تشغيل الحركة
  capEl.classList.add("cap-in");
}
// بطاقة فوق الخريطة: تُفتح وتُغلق بالتتابع، ولا تلتقط النقر فيمر إلى الخريطة
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function cardShow(html) {
  const el = $c("cine-card");
  el.innerHTML = html;
  el.hidden = false;
  el.classList.remove("in");
  void el.offsetWidth;
  el.classList.add("in");
}
function cardHide() {
  const el = $c("cine-card");
  el.classList.remove("in");
  el.hidden = true;
}
function sunnaOf(journey) { return sunanData?.sunan?.find((x) => x.id === journey.sunna) ?? null; }
function introCardHtml(journey) {
  const sn = sunnaOf(journey);
  return (journey.hook ? `<p class="cc-hook">${escapeHtml(journey.hook)}</p>` : "") +
    `<p class="cc-kicker">رحلة</p><h2>${escapeHtml(journey.title.replace(/^رحلة:\s*/, ""))}</h2>` +
    (sn ? `<p class="cc-hyp">${escapeHtml(sn.hypothesis)}</p>` : "");
}
function closingCardHtml(journey) {
  const sn = sunnaOf(journey);
  if (!sn) return `<p class="cc-kicker">خلاصة</p>`;
  const sup = sn.supporting.length, lim = sn.limiting.filter((x) => x.id).length;
  return `<p class="cc-kicker">خلاصة</p><p class="cc-hyp">${escapeHtml(sn.hypothesis)}</p>` +
    `<p class="cc-count">الشواهد الموثّقة: ${sup} مؤيدة، ${lim} مقيِّدة</p>` +
    `<p class="cc-note">السُّنّة فرضية تختبرها الشواهد، ولا قانون مؤكد.</p>`;
}
// الإخفاء التلقائي: الأزرار تختفي بعد لحظات من الإيقاع، وأي لمس يُظهرها
let idleTimer = null;
let overCtrl = false; // المؤشر فوق شريط التحكم: لا تُخفى الأزرار تحته
function wake() {
  cineEl.classList.remove("idle");
  clearTimeout(idleTimer);
  if (cine.on && cine.playing) idleTimer = setTimeout(() => {
    if (!cine.on || !cine.playing) return;
    // لا إخفاء والمؤشر أو التركيز على الأزرار، فيبقى النقر ممكناً
    if (overCtrl || cineEl.querySelector(".cine-ctrl, .cine-top")?.contains(document.activeElement) || cineEl.querySelector(".cine-top:focus-within, .cine-ctrl:focus-within")) return wake();
    cineEl.classList.add("idle");
  }, 2600);
}
for (const el of cineEl.querySelectorAll(".cine-ctrl, .cine-top")) {
  el.addEventListener("pointerenter", () => { overCtrl = true; wake(); });
  el.addEventListener("pointerleave", () => { overCtrl = false; wake(); });
}
function scheduleChunk(token, ms) {
  clearTimeout(cine.timer);
  cine.due = performance.now() + ms;
  cine.timer = setTimeout(() => {
    if (token !== cine.token) return;
    if (cine.ci < cine.chunks.length - 1) {
      cine.ci++;
      showChunk(cine.chunks[cine.ci]);
      scheduleChunk(token, chunkMs(cine.chunks[cine.ci]));
    } else {
      cine.timer = null;
      cine.done = true;
      afterStep(token);
    }
  }, ms);
}
function afterStep(token) {
  const { journey, index } = journeyState;
  if (index === journey.steps.length - 1 && cine.playing) cardShow(closingCardHtml(journey));
  if (index < journey.steps.length - 1) {
    cine.timer = setTimeout(() => { if (token === cine.token && cine.playing) go(1); }, 700);
  } else {
    setPlaying(false, true); // نهاية الرحلة: يصير الزر «إعادة»
  }
}

function setPlaying(p, ended = false) {
  wake();
  const btn = cineEl.querySelector('[data-act="toggle"]');
  if (p && !cine.playing) {
    cine.playing = true;
    cine.resumedAt = performance.now();
    // انتهت مقاطع الخطوة قبل الإيقاف: يُستأنف الانتقال، وإلا يُكمل المقطع الحالي ما بقي من وقته
    if (cine.done) afterStep(cine.token);
    else scheduleChunk(cine.token, Math.max(300, cine.remain));
  } else if (!p && cine.playing) {
    cine.playing = false;
    cine.stepElapsed += performance.now() - cine.resumedAt;
    cine.remain = Math.max(0, cine.due - performance.now());
    clearTimeout(cine.timer);
  }
  btn.textContent = ended ? "↺" : cine.playing ? "❚❚" : "▶";
  btn.setAttribute("aria-label", ended ? "إعادة الرحلة" : cine.playing ? "إيقاف مؤقت" : "تشغيل");
  btn.dataset.ended = ended ? "1" : "";
  cineEl.classList.toggle("paused", !cine.playing);
}

// شريط التقدّم: قطعة لكل خطوة، والحالية تمتلئ بمرور زمن ترجمتها
function renderBars(total, index) {
  const bars = $c("cine-bars");
  if (bars.children.length !== total) bars.innerHTML = Array.from({ length: total }, () => '<span><i></i></span>').join("");
  [...bars.children].forEach((b, i) => { b.firstChild.style.width = i < index ? "100%" : "0%"; b.classList.toggle("on", i === index); });
}
function tickBar() {
  cancelAnimationFrame(cine.raf);
  const loop = () => {
    if (!cine.on || !journeyState) return;
    const el = cine.stepElapsed + (cine.playing ? performance.now() - cine.resumedAt : 0);
    const bar = $c("cine-bars").children[journeyState.index]?.firstChild;
    if (bar) bar.style.width = `${Math.min(100, (el / cine.stepTotal) * 100)}%`;
    cine.raf = requestAnimationFrame(loop);
  };
  cine.raf = requestAnimationFrame(loop);
}

// ---------- تشغيل خطوة ----------
async function runStep() {
  const token = ++cine.token;
  cardHide();
  const { journey, index } = journeyState;
  const st = journey.steps[index];
  const total = journey.steps.length;
  clearTimeout(cine.timer);
  cine.timer = null;
  clearMarkers();
  setRegion(null);

  $c("cine-jt").textContent = journey.title.replace(/^رحلة:\s*/, "");
  $c("cine-st").textContent = st.title;
  renderBars(total, index);
  cineEl.querySelector('[data-act="prev"]').disabled = index === 0;
  cineEl.querySelector('[data-act="next"]').disabled = index === total - 1;
  $c("cine-sr").textContent = `${st.title}. ${st.frame}`;

  cine.chunks = stepChunks(st);
  cine.ci = 0;
  cine.done = false;
  cine.stepTotal = 600 + cine.chunks.reduce((s, c) => s + chunkMs(c), 0);
  cine.stepElapsed = 0;
  cine.resumedAt = performance.now();
  tickBar();

  // الحدود تُحمَّل لسنة الخطوة (فتبقى السنة صحيحة بعد الخروج)، وتُخفى طبقاتها ما دام العرض قائماً
  loadBorders(st.border).then(() => { if (token === cine.token && cine.on) hideAtlasLayers(); });

  const places = await stepPlaces(st);
  if (token !== cine.token) return;
  const pts = places.map((f) => f.geometry.coordinates);
  const anchor = pts.length ? centroid(pts) : null;
  const flight = st.kind === "khaldun" || st.kind === "end" || !pts.length ? 4400 : 3600;

  flyCamera(st.kind === "end" ? [] : pts, flight);
  if (anchor && cine.prevAnchor && st.kind !== "limits") animateRoute(cine.prevAnchor, anchor, camMs(flight * 0.9), token);

  // عند الوصول: النبض والتسميات، وتظليل الكيان، و✕ على أماكن القيد
  setTimeout(async () => {
    if (token !== cine.token) return;
    const era = st.title.includes("·") ? st.title.split("·").pop().trim() : "";
    if (st.kind === "end") {
      for (const a of cine.anchors) addMarker(pinEl("", "", true), a);
    }
    for (const f of places) {
      const pin = pinEl(f.properties.name_ar, places.length < 4 ? era : "");
      addMarker(pin, f.geometry.coordinates);
      // التسمية تقع في الجهة الأوسع من الشاشة، فلا تُقصّ عند الحافة (كانت تُقصّ قرب الحافة اليسرى)
      if (map.project(f.geometry.coordinates).x > window.innerWidth / 2) pin.classList.add("flip");
      // على خطوة القيد تبتعد التسمية عن علامة ✕ التي تغطي النقطة (نصف عرضها 32 بكسل)
      if (st.kind === "limits") { pin.classList.add("beside-cross"); addMarker(crossEl(), f.geometry.coordinates); }
    }
    if (anchor && st.kind === "evidence") {
      const region = await regionAt(st.border, places[0].geometry.coordinates);
      if (token === cine.token) setRegion(region);
    }
  }, reduceMotion ? 0 : flight * 0.85);

  if (anchor && st.kind === "evidence") {
    if (!cine.anchors.some((a) => a[0] === anchor[0] && a[1] === anchor[1])) cine.anchors.push(anchor);
    cine.prevAnchor = anchor;
  }

  showChunk(cine.chunks[0]);
  if (cine.playing) scheduleChunk(token, 600 + chunkMs(cine.chunks[0]));
  else { cine.remain = 600 + chunkMs(cine.chunks[0]); cine.due = performance.now() + cine.remain; }
  setPlaying(cine.playing);
}

// تصدير الخطوة صورةً عمودية 9:16: لقطة الخريطة كما هي لحظة الرسم، وتحتها نص الخطوة وشاهدها وإسناده.
// كل نص مكتوب هنا يأتي من الرحلة أو الادعاء نفسه، ولا يُضاف شيء من خارجهما.
// تصدير الخطوة صورة 9:16. المساحة السفلية والعلوية تغطيها واجهات المنصات الاجتماعية، فالنص في المنطقة الآمنة، والإسناد فوقها.
// القياسات تُحسب أولاً، فإن امتلأت الكتلة النصية تُصغَّر الخطوط بنسب متدرجة بدل أن تتجاوز الإسناد.
const EXPORT = { W: 1080, H: 1920, textTop: 1000, textBottom: 1540, footBottom: 1660, maxW: 920 };
const EXPORT_FONTS = ["600 38px 'IBM Plex Sans Arabic'", "700 64px 'Noto Kufi Arabic'", "500 44px 'IBM Plex Sans Arabic'"];
async function exportStepImage() {
  if (!journeyState) return;
  const { journey, index } = journeyState;
  const st = journey.steps[index];
  const { W, H } = EXPORT;
  // الخطوط تُحمَّل قبل الرسم، وإلا رسم الكانفس بخط احتياطي
  await Promise.all(EXPORT_FONTS.map((f) => document.fonts?.load(f).catch(() => {})));
  const snap = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 2000);
    map.once("render", () => {
      clearTimeout(t);
      try { resolve(map.getCanvas()); } catch { resolve(null); }
    });
    map.triggerRepaint();
  });
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, W, H);
  if (snap) {
    // الخريطة تملأ الجزء العلوي بنسبتها، مع اقتصاص من الوسط
    const mh = Math.round(H * 0.55); // الخريطة تملأ النصف العلوي، والاقتصاص من الجانبين يبقي المحور المركزي
    const sw = snap.width, sh = snap.height;
    const scale = Math.max(W / sw, mh / sh);
    const dw = sw * scale, dh = sh * scale;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, mh); ctx.clip();
    ctx.drawImage(snap, (W - dw) / 2, (mh - dh) / 2, dw, dh);
    ctx.restore();
    // حافة الخريطة السفلى تذوب في الخلفية، فلا تنقطع بخط أفقي حاد
    const fade = ctx.createLinearGradient(0, mh - 260, 0, mh);
    fade.addColorStop(0, "rgba(7,10,18,0)");
    fade.addColorStop(1, "rgba(7,10,18,1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, mh - 260, W, 260);
  }
  // تدرّج نحو النص
  const grad = ctx.createLinearGradient(0, 780, 0, H);
  grad.addColorStop(0, "rgba(7,10,18,0)");
  grad.addColorStop(0.35, "rgba(7,10,18,0.92)");
  grad.addColorStop(1, "rgba(7,10,18,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 780, W, H - 780);
  ctx.direction = "rtl";
  ctx.textAlign = "right";

  const claim = st.items.find((it) => it.statement);
  const plain = journey.title.replace(/^رحلة:\s*/, "");
  const blocks = [
    { font: (k) => `600 ${k}px 'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif`, px: 38, lh: 50, color: "#e9b44c", text: `${plain} · ${(index + 1).toLocaleString("ar")} من ${journey.steps.length.toLocaleString("ar")}`, gap: 0 },
    { font: (k) => `700 ${k}px 'Noto Kufi Arabic', 'IBM Plex Sans Arabic', sans-serif`, px: 64, lh: 80, color: "#ffffff", text: st.title, gap: 22 },
    { font: (k) => `500 ${k}px 'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif`, px: 44, lh: 62, color: "rgba(255,255,255,0.92)", text: st.frame, gap: 30 },
  ];
  if (claim) {
    blocks.push({ font: (k) => `400 ${k}px 'Amiri', Georgia, serif`, px: 40, lh: 58, color: "rgba(255,255,255,0.88)", text: `«${claim.quote}»`, gap: 36 });
    blocks.push({ font: (k) => `500 ${k}px 'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif`, px: 34, lh: 48, color: "rgba(233,180,76,0.95)", text: `— ${claim.attributed_to}`, gap: 14 });
    if (claim.hedge) blocks.push({ font: (k) => `500 ${k}px 'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif`, px: 30, lh: 44, color: "rgba(255,255,255,0.7)", text: `تحفظ: ${claim.hedge}`, gap: 12 });
  }
  // يرسم الكتل من موضع البداية بمقياس معيّن، أو يقيس فقط إن لم يُرسم
  const place = (k, draw, y0 = EXPORT.textTop) => {
    let y = y0;
    for (const b of blocks) {
      const px = Math.round(b.px * k);
      const lh = Math.round(b.lh * k);
      ctx.font = b.font(px);
      const lines = linesOf(ctx, b.text, EXPORT.maxW);
      y += b.gap * k;
      if (draw) { ctx.fillStyle = b.color; lines.forEach((ln, i) => ctx.fillText(ln, W - 80, y + i * lh)); }
      y += lines.length * lh;
    }
    return y;
  };
  // الكتلة مرتبطة بالأسفل، فتقف فوق الإسناد مباشرة، ولا تُترك فراغاً تحت الخريطة
  let k = 1;
  for (const cand of [1, 0.92, 0.84, 0.76, 0.68]) { k = cand; if (place(cand, false) <= EXPORT.textBottom) break; }
  const height = place(k, false) - EXPORT.textTop;
  place(k, true, Math.max(EXPORT.textTop, EXPORT.textBottom - height));

  // الإسناد في المنطقة الآمنة فوق حافة المنصة: المصدر وقيد التقنية
  ctx.font = "500 28px 'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  const foot = "الأطلس الشامل · الشواهد موثّقة بنصوصها، والسُّنن فرضيات تختبرها الشواهد";
  const footLines = linesOf(ctx, foot, EXPORT.maxW);
  footLines.forEach((ln, i) => ctx.fillText(ln, W - 80, EXPORT.footBottom - (footLines.length - 1 - i) * 40));

  const url = out.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `atlas-${journey.id}-${index + 1}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
// يقسم النص إلى أسطر على عرض محدد دون رسم، ليُقاس الارتفاع قبل الرسم
function linesOf(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function go(delta) {
  if (!journeyState) return;
  const next = journeyState.index + delta;
  if (next < 0 || next >= journeyState.journey.steps.length) return;
  journeyState.index = next;
  wake();
  runStep();
}
window.cinemaGo = (d) => (cine.on ? go(d) : null); // للاختبارات وللتصوير الآلي

// ---------- الدخول والخروج ----------
async function cinemaStart() {
  if (!journeyState) return;
  setCinemaPref("cinema");
  cine.on = true;
  cine.routes = [];
  cine.anchors = [];
  cine.prevAnchor = null;
  journeyBox.hidden = true;
  document.body.classList.add("cinema");
  cineEl.hidden = false;
  if (claimPoints) showClaimPoints(false);
  ensureCineLayers();
  hideAtlasLayers();
  cine.playing = true;
  map.dragPan.disable(); // الإيماءة تتقدّم في الفيلم، والسحب يتعارض معها فيُوقف الكاميرا
  cine.allAnchors = [];
  for (const st of journeyState.journey.steps.filter((x) => x.kind === "evidence")) {
    const pts = (await stepPlaces(st)).map((f) => f.geometry.coordinates);
    if (pts.length) cine.allAnchors.push(centroid(pts));
  }
  if (!cine.on) return;
  // بطاقة الافتتاح قبل الخطوة الأولى، ثم تبدأ الكاميرا
  if (journeyState.index === 0) {
    cardShow(introCardHtml(journeyState.journey));
    await wait(window.CINE_INTRO_MS ?? 3400); // المهلة قابلة للتعديل في الاختبار فقط
    if (!cine.on) return;
  }
  cardHide();
  await runStep();
}

function cinemaStop() {
  if (!cine.on) return;
  cine.on = false;
  cine.token++;
  clearTimeout(cine.timer);
  cine.timer = null;
  cancelAnimationFrame(cine.raf);
  cancelAnimationFrame(cine.routeAnim);
  clearMarkers();
  removeCineLayers();
  restoreAtlasLayers();
  cardHide();
  cineEl.classList.remove("idle");
  clearTimeout(idleTimer);
  map.dragPan.enable();
  cineEl.hidden = true;
  document.body.classList.remove("cinema");
}

// إلى وضع القراءة: صندوق الرحلة بالاقتباسات والتحفظات على الخطوة نفسها
function toReading() {
  setCinemaPref("read");
  cinemaStop();
  journeyBox.hidden = false;
  showJourneyStep();
}

cineEl.addEventListener("click", (e) => {
  const act = e.target.closest("button")?.dataset.act;
  if (!act || !journeyState) return;
  if (act === "exit") return endJourney();
  if (act === "read") return toReading();
  if (act === "export") return exportStepImage();
  if (act === "next") return go(1);
  if (act === "prev") return go(-1);
  if (act === "toggle") {
    if (e.target.closest("button").dataset.ended) { journeyState.index = 0; cine.routes = []; cine.anchors = []; cine.prevAnchor = null; drawRoutes(); cine.playing = true; return runStep(); }
    setPlaying(!cine.playing);
  }
});

document.addEventListener("keydown", (e) => {
  if (!cine.on || e.target.closest("input, select, textarea")) return;
  wake(); // لوحة المفاتيح تُظهر الأزرار المخفية، فلا يقع التركيز على زر غير مرئي
  if (e.key === "Escape") { e.preventDefault(); return endJourney(); }
  // المسافة على زر مركَّز تضغطه المتصفح نفسه، فلا تُعاد هنا
  if (e.key === " " && !e.target.closest("button")) { e.preventDefault(); return setPlaying(!cine.playing); }
  if (e.key === "ArrowLeft") { e.preventDefault(); return go(1); }
  if (e.key === "ArrowRight") { e.preventDefault(); return go(-1); }
});

// الإيماءات: سحب أفقي يتقدّم (يميناً للسابق ويساراً للتالي، كاتجاه القراءة)، ونقرة على الشاشة تُوقف وتُشغّل
let swipe = null;
// تحريك الفأرة يُظهر الأزرار كما في مشغلات الفيديو، فيصير النقر عليها ممكناً من أول مرة
document.addEventListener("pointermove", (e) => { if (cine.on && e.pointerType === "mouse") wake(); }, { capture: true, passive: true }); // التقاط قبل الخريطة التي قد توقف انتشار الحدث
cineEl.addEventListener("focusin", () => { if (cine.on) wake(); });
document.addEventListener("pointerdown", (e) => {
  if (!cine.on) return;
  wake();
  swipe = { x: e.clientX, y: e.clientY, t: performance.now(), target: e.target };
});
document.addEventListener("pointerup", (e) => {
  if (!cine.on || !swipe) return;
  const s0 = swipe;
  swipe = null;
  if (s0.target.closest?.("button, input, select, a")) return; // أزرار التحكم تعمل وحدها
  const dx = e.clientX - s0.x, dy = e.clientY - s0.y, dt = performance.now() - s0.t;
  if (Math.abs(dx) > 50 && Math.abs(dx) > 1.6 * Math.abs(dy)) go(dx < 0 ? 1 : -1);
  else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 350) setPlaying(!cine.playing);
});

window.cinemaStart = cinemaStart;
window.cinemaStop = cinemaStop;
window.cinemaPreferred = cinemaPreferred;
})();
