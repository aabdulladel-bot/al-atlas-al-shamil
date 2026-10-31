// الاستكشاف: البحث الموحّد، وشريط القارات، و«العالم في هذه الحقبة»، والتحدي، وجواز المستكشف.
// مستلهم من نموذج «رحّال AI» في البحث والقارات والتبويبات والجواز، ومبني على بيانات الأطلس وحدها:
// لا نص تاريخي مكتوب هنا، فكل نتيجة وسؤال وشرح يُولَّد من الملفات المحمّلة (الأسماء والمواقع والشواهد والسنن).
// يعتمد على ما في app.js: map وloadBorders وloadEra وlabelData وplacesCache وclaimPoints وsunanData وopenEntityCard وغيرها.

// ---------- أدوات النص العربي ----------
// مطابقة لا تتأثر بالتشكيل والتطويل وصور الألف والياء والتاء المربوطة
function norm(s) {
  return String(s ?? "").toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/\s+/g, " ").trim();
}
const ICONS = { entity: "◼", people: "◩", place: "●", claim: "❝", sunna: "✦", era: "⧗", year: "⌖", journey: "➜" };
const TYPE_AR = { entity: "الدول والكيانات", people: "الشعوب والقبائل", place: "مواقع الحقب", claim: "الشواهد", sunna: "السنن", era: "الحقب", year: "الزمن", journey: "الرحلات" };

// ---------- جواز المستكشف: تقدّم القارئ في متصفحه وحده ----------
const PASS_KEY = "atlas-passport-v1";
const passport = (() => {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(PASS_KEY) || "{}"); } catch {}
  const sets = {};
  for (const k of ["era", "entity", "place", "claim", "sunna", "journey"]) sets[k] = new Set(d[k] ?? []);
  return { sets, quiz: d.quiz ?? { right: 0, total: 0 } };
})();
function passportSave() {
  const out = { quiz: passport.quiz };
  for (const [k, v] of Object.entries(passport.sets)) out[k] = [...v];
  try { localStorage.setItem(PASS_KEY, JSON.stringify(out)); } catch {}
}
function passportNote(kind, id) {
  const set = passport.sets[kind];
  if (!set || id == null || set.has(String(id))) return;
  set.add(String(id));
  passportSave();
}

// ---------- الانتقال إلى نتيجة: الزمن ثم الكاميرا ثم البطاقة ----------
const nearestKey = (keys) => {
  if (keys.some((k) => String(k) === String(time.key))) return time.key;
  const y = yearOf(time.key);
  return keys.reduce((b, k) => (Math.abs(yearOf(k) - y) < Math.abs(yearOf(b) - y) ? k : b), keys[0]);
};
async function goEntity(it) {
  const key = timeKey(nearestKey(it.keys));
  const data = await loadBorders(key);
  const zoom = Math.max(3, Math.min(6, (it.min ?? 3) + 1));
  map.flyTo({ center: [it.x, it.y], zoom, pitch: 25, bearing: 0, duration: reduceMotion ? 0 : 2200, essential: true });
  let f = data?.features.find((x) => x.properties.NAME === it.en);
  let kind = "state";
  if (!f) { f = peoplesData?.features.find((x) => x.properties.NAME === it.en); kind = "people"; }
  if (!f) return;
  cardAlso = [];
  showHit({ c: CLICKABLE.find((c) => c.layer === (kind === "people" ? "peoples-fill" : "borders-fill")), f });
}
async function goPlace(it) {
  const era = ERAS.find((e) => e.id === it.era);
  if (era) await loadBorders(era.border);
  map.flyTo({ center: it.coords, zoom: 6, pitch: 20, bearing: 0, duration: reduceMotion ? 0 : 2200, essential: true });
  const f = placesData?.features.find((x) => x.properties.name_ar === it.ar && x.geometry.coordinates[0] === it.coords[0]);
  if (f) { cardAlso = []; showHit({ c: CLICKABLE.find((c) => c.layer === "places"), f }); }
}
async function goClaimPlace(it) {
  const era = ERAS.find((e) => e.id === it.era);
  if (era) await loadBorders(era.border);
  clearSunna();
  showClaimPoints(false);
  map.flyTo({ center: it.coords, zoom: 5.5, pitch: 20, bearing: 0, duration: reduceMotion ? 0 : 2200, essential: true });
  const f = claimPoints?.features.find((x) => x.properties.slug === it.slug);
  if (f) { cardAlso = []; showHit({ c: CLICKABLE.find((c) => c.layer === "claim-points"), f }); }
}
function goSunna(it) {
  const s = sunanData?.sunan.find((x) => x.id === it.id);
  if (!s) return;
  closeCard();
  setPanelCollapsed(false);
  const sec = sunanListEl.closest("details");
  sec.open = true;
  selectSunna(s);
  sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}
async function goItem(it) {
  if (it.type === "entity" || it.type === "people") return goEntity(it);
  if (it.type === "place") return goPlace(it);
  if (it.type === "claim") return goClaimPlace(it);
  if (it.type === "sunna") return goSunna(it);
  if (it.type === "era") return loadEra(ERAS.find((e) => e.id === it.id));
  if (it.type === "year") return loadBorders(it.key);
  if (it.type === "journey") return startJourney(it.id);
}

// ---------- فهرس البحث: يُبنى عند أول تركيز على الخانة ----------
let searchIndex = null;
function buildIndex() {
  searchIndex ??= (async () => {
    const items = [];
    // الكيانات بأسمائها العربية والإنجليزية في كل سنوات ظهورها
    const ents = new Map();
    await Promise.all(TIME_STOPS.map(async (k) => {
      const d = await labelData(k);
      for (const l of d?.labels ?? []) {
        if (!l.en?.trim()) continue;
        const e = ents.get(l.en) ?? { type: "entity", en: l.en, shown: l.en_shown ?? l.en, ar: null, keys: [], x: l.x, y: l.y, min: l.min, a: 0 };
        e.ar ??= l.ar ?? null;
        e.keys.push(k);
        if ((l.a ?? 0) >= e.a) { e.a = l.a ?? 0; e.x = l.x; e.y = l.y; e.min = l.min; }
        ents.set(l.en, e);
      }
    }));
    const peoples = new Set();
    await Promise.all(BORDER_YEARS.map(async (k) => {
      try { for (const f of (await getJson(`data/borders/peoples_${k}.geojson`)).features) peoples.add(f.properties.NAME); } catch {}
    }));
    for (const e of ents.values()) {
      if (peoples.has(e.en)) e.type = "people";
      e.title = e.ar ?? e.shown;
      e.sub = `${e.ar && e.shown !== e.ar ? `${e.shown} · ` : ""}${e.keys.map(yearText).join("، ")}`;
      e.text = [e.title, e.shown];
      e.weight = Math.log10(1 + (e.a || 1e5));
      items.push(e);
    }
    // مواقع الحقب
    for (const era of ERAS) {
      if (!era.file) continue;
      if (!placesCache.has(era.file)) placesCache.set(era.file, getJson(era.file));
      let d;
      try { d = await placesCache.get(era.file); } catch { continue; }
      for (const f of d.features) {
        const p = f.properties;
        items.push({ type: "place", ar: p.name_ar, title: p.name_ar, sub: `الحقبة ${era.id}: ${era.label}${p.name_en && p.name_en !== p.name_ar ? ` · ${p.name_en}` : ""}`, text: [p.name_ar, p.name_en], era: era.id, coords: f.geometry.coordinates, weight: 4 });
      }
    }
    // الشواهد: كل ادعاء له مكان، ويُفتح على بطاقة مكانه
    if (await ensureClaimPoints()) {
      for (const f of claimPoints.features) {
        const p = f.properties;
        for (const c of JSON.parse(p.claims)) {
          items.push({ type: "claim", title: c.statement, sub: `${p.name_ar} · الحقبة ${c.era} · ${c.attributed_to}`, text: [c.statement, p.name_ar, p.name_en, c.attributed_to], era: c.era, coords: f.geometry.coordinates, slug: p.slug, weight: 3 });
        }
      }
    }
    for (const s of sunanData?.sunan ?? []) items.push({ type: "sunna", id: s.id, title: s.name, sub: s.hypothesis, text: [s.name, s.hypothesis], weight: 6 });
    for (const e of ERAS) items.push({ type: "era", id: e.id, title: `الحقبة ${e.id}: ${e.label}`, sub: e.desc, text: [e.label, `الحقبة ${e.id}`], weight: 6 });
    try {
      for (const j of await getJson("data/journeys/index.json")) items.push({ type: "journey", id: j.id, title: j.title, sub: "رحلة سردية بشواهد موثّقة", text: [j.title], weight: 6 });
    } catch {}
    for (const it of items) it.n = it.text.filter(Boolean).map(norm);
    return items;
  })();
  return searchIndex;
}
// سنة مكتوبة («1600» أو «500 ق.م») تنقل إلى أقرب محطة زمنية
function yearHit(q) {
  const m = /^(\d{1,4})\s*(ق\s*\.?\s*م|ق|bc|b\.c\.?)?\s*$/i.exec(q.trim());
  if (!m) return null;
  const y = Number(m[1]) * (m[2] ? -1 : 1);
  const key = TIME_STOPS.reduce((b, k) => (Math.abs(yearOf(k) - y) < Math.abs(yearOf(b) - y) ? k : b), TIME_STOPS[0]);
  return { type: "year", key, title: `انتقل إلى ${yearText(key)}`, sub: `أقرب خريطة حدود إلى سنة ${yearLabel(y)}، الحقبة ${eraOf(key).id}: ${eraOf(key).label}` };
}
function score(it, toks) {
  let s = 0;
  for (const t of toks) {
    const [p, ...rest] = it.n;
    if (p.startsWith(t)) s += 3;
    else if (p.split(" ").some((w) => w.startsWith(t) || w.startsWith(`ال${t}`))) s += 2;
    else if (p.includes(t)) s += 1;
    else if (rest.some((r) => r.includes(t))) s += 0.5;
    else return 0;
  }
  return s + it.weight / 10;
}
const PER_TYPE = 5;
async function search(q) {
  const toks = norm(q).split(" ").filter((t) => t.length >= 1);
  if (!toks.length || norm(q).length < 2) return [];
  const items = await buildIndex();
  const scored = items.map((it) => [score(it, toks), it]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
  const byType = new Map();
  for (const [, it] of scored) {
    const list = byType.get(it.type) ?? [];
    if (list.length < PER_TYPE) list.push(it);
    byType.set(it.type, list);
  }
  const order = ["year", "entity", "people", "place", "claim", "sunna", "era", "journey"];
  const yh = yearHit(q);
  if (yh) byType.set("year", [yh]);
  return order.filter((t) => byType.has(t)).map((t) => [t, byType.get(t)]);
}
function highlight(text, q) {
  const safe = escapeHtml(text);
  const raw = q.trim();
  if (raw.length < 2) return safe;
  const i = safe.indexOf(escapeHtml(raw));
  return i < 0 ? safe : `${safe.slice(0, i)}<mark>${safe.slice(i, i + escapeHtml(raw).length)}</mark>${safe.slice(i + escapeHtml(raw).length)}`;
}

const qEl = document.getElementById("q");
const qRes = document.getElementById("q-results");
let qItems = [];
let qSel = -1;
let qToken = 0;
function closeResults() {
  qRes.hidden = true;
  qEl.setAttribute("aria-expanded", "false");
  qSel = -1;
}
function markSel() {
  qRes.querySelectorAll(".qr").forEach((b, i) => b.setAttribute("aria-selected", String(i === qSel)));
  qRes.querySelector('.qr[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}
async function runSearch() {
  const q = qEl.value;
  const token = ++qToken;
  if (norm(q).length < 2) { closeResults(); return; }
  const groups = await search(q);
  if (token !== qToken) return;
  qItems = groups.flatMap(([, list]) => list);
  qSel = -1;
  qRes.innerHTML = groups.length
    ? groups.map(([t, list]) => `<div class="qr-group">${TYPE_AR[t]}</div>` + list.map((it) => {
        const i = qItems.indexOf(it);
        return `<button type="button" class="qr" role="option" aria-selected="false" data-i="${i}"><span class="qr-ic" aria-hidden="true">${ICONS[it.type]}</span><span class="qr-t"><b>${highlight(it.title, q)}</b><span>${escapeHtml(it.sub ?? "")}</span></span></button>`;
      }).join("")).join("")
    : `<p>لا نتيجة لـ«${escapeHtml(q)}». جرّب اسماً آخر أو سنة مثل 1600 أو 500 ق.م.</p>`;
  qRes.hidden = false;
  qEl.setAttribute("aria-expanded", "true");
}
function pick(i) {
  const it = qItems[i];
  if (!it) return;
  closeResults();
  qEl.value = "";
  qEl.blur();
  goItem(it);
}
let qTimer = 0;
qEl.addEventListener("focus", () => { buildIndex(); });
qEl.addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(runSearch, 120); });
qEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.stopPropagation(); if (!qRes.hidden) closeResults(); else qEl.blur(); return; }
  if (qRes.hidden || !qItems.length) return;
  if (e.key === "ArrowDown") { e.preventDefault(); qSel = (qSel + 1) % qItems.length; markSel(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); qSel = (qSel - 1 + qItems.length) % qItems.length; markSel(); }
  else if (e.key === "Enter") { e.preventDefault(); pick(qSel < 0 ? 0 : qSel); }
});
qRes.addEventListener("click", (e) => { const b = e.target.closest(".qr"); if (b) pick(Number(b.dataset.i)); });
document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#search-box")) closeResults(); });
// «/» يضع المؤشر في البحث
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !e.target.closest("input, textarea, select")) { e.preventDefault(); qEl.focus(); }
});

// ---------- شريط القارات ----------
// المناطق محسوبة من Natural Earth (scripts/build_regions.mjs)، والعالم منظر الكرة كاملة
const railEl = document.getElementById("rail");
let regions = [];
let activeRegion = null;
function inRegion(lon, lat) {
  if (!activeRegion) return true;
  const [w, s, e, n] = activeRegion.bbox;
  const x = e > 180 && lon < 0 ? lon + 360 : lon;
  return x >= w && x <= e && lat >= s && lat <= n;
}
function setRegion(id) {
  activeRegion = regions.find((r) => r.id === id) ?? null;
  for (const b of railEl.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.region === (activeRegion?.id ?? "world")));
  if (activeRegion) {
    const [w, s, e, n] = activeRegion.bbox;
    map.fitBounds([[w, s], [e, n]], { padding: fitPadding(), pitch: 25, bearing: 0, duration: reduceMotion ? 0 : 2400, essential: true });
  } else {
    map.flyTo({ center: [30, 22], zoom: isNarrow() ? 0.9 : 1.6, pitch: 0, bearing: 0, duration: reduceMotion ? 0 : 2400, essential: true });
  }
  renderList();
}
getJson("data/base/regions.json").then((d) => {
  regions = d.regions;
  railEl.innerHTML = [{ id: "world", ar: "العالم" }, ...regions].map((r) =>
    `<button type="button" data-region="${r.id}" aria-pressed="${r.id === "world"}"><span class="mini" aria-hidden="true"></span>${escapeHtml(r.ar)}</button>`).join("");
}).catch(() => { railEl.hidden = true; });
railEl.addEventListener("click", (e) => { const b = e.target.closest("button[data-region]"); if (b) setRegion(b.dataset.region === "world" ? null : b.dataset.region); });

// ---------- التبويبات: نظرة، والعالم في هذه الحقبة، والتحدي ----------
const tabs = ["over", "list", "quiz"];
function showTab(id) {
  for (const t of tabs) {
    document.getElementById(`tab-${t}`).setAttribute("aria-selected", String(t === id));
    document.getElementById(`pane-${t}`).hidden = t !== id;
  }
  if (id === "list") renderList();
  if (id === "quiz" && !quiz.q) nextQuestion();
}
for (const t of tabs) document.getElementById(`tab-${t}`).addEventListener("click", () => showTab(t));
document.querySelector('#now [role="tablist"]').addEventListener("keydown", (e) => {
  const i = tabs.findIndex((t) => document.getElementById(`tab-${t}`).getAttribute("aria-selected") === "true");
  const d = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
  if (!d) return;
  const n = tabs[(i + d + tabs.length) % tabs.length];
  showTab(n);
  document.getElementById(`tab-${n}`).focus();
});

// ---------- العالم في هذه الحقبة: كل ما على الخريطة الآن، مصفّى بالنوع والقارة ----------
const LIST_TYPES = [["all", "الكل"], ["claim", "الشواهد"], ["place", "المواقع"], ["entity", "الكيانات"], ["people", "الشعوب"]];
let listType = "all";
const listTypesEl = document.getElementById("list-types");
const listBody = document.getElementById("list-body");
const listNote = document.getElementById("list-note");
listTypesEl.innerHTML = LIST_TYPES.map(([id, ar]) => `<button type="button" data-t="${id}" aria-pressed="${id === "all"}">${ar}</button>`).join("");
listTypesEl.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-t]");
  if (!b) return;
  listType = b.dataset.t;
  for (const x of listTypesEl.querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
  renderList();
});
const LIST_MAX = 30;
let listItems = [];
function renderList() {
  if (document.getElementById("pane-list").hidden || time.key == null) return;
  const era = eraOf(time.key);
  const want = (t) => listType === "all" || listType === t;
  const groups = [];
  if (want("claim") && claimPoints) {
    const id = `,${era.id},`;
    const list = claimPoints.features.filter((f) => f.properties.eras.includes(id) && inRegion(...f.geometry.coordinates)).map((f) => {
      const claims = JSON.parse(f.properties.claims).filter((c) => c.era === era.id);
      return { type: "claim", title: f.properties.name_ar, sub: `${claims.length} شواهد · ${claims[0]?.statement ?? ""}`, era: era.id, coords: f.geometry.coordinates, slug: f.properties.slug, color: "var(--evidence)" };
    });
    groups.push(["الشواهد في هذه الحقبة", list]);
  }
  if (want("place") && placesData && era.file) {
    groups.push(["مواقع الحقبة", placesData.features.filter((f) => inRegion(...f.geometry.coordinates)).map((f) => ({ type: "place", ar: f.properties.name_ar, title: f.properties.name_ar, sub: COORD_SHORT[f.properties.coord_status] ?? "", era: era.id, coords: f.geometry.coordinates, color: "#c47a4a" }))]);
  }
  if (want("entity") || want("people")) {
    const peoples = new Set((peoplesData?.features ?? []).map((f) => f.properties.NAME));
    const labs = [...labelInfo.values()].filter((l) => l.en?.trim() && inRegion(l.x, l.y)).sort((a, b) => (b.a ?? 0) - (a.a ?? 0) || (a.min ?? 9) - (b.min ?? 9));
    const mk = (l, type) => ({ type, en: l.en, keys: [time.key], x: l.x, y: l.y, min: l.min, title: l.ar ?? l.en_shown ?? l.en, sub: [l.a ? `${fmtBig(l.a)} كم²` : "", l.st === "arabized" ? "تعريب تقديري" : !l.ar ? "لا اسم عربي موثّق" : ""].filter(Boolean).join(" · "), color: type === "people" ? PEOPLE_COLOR : swatchColor(hueOf(l.qid ?? l.en)) });
    if (want("entity")) groups.push(["الكيانات (الأكبر مساحة أولاً)", labs.filter((l) => !peoples.has(l.en)).map((l) => mk(l, "entity"))]);
    if (want("people")) groups.push(["الشعوب والقبائل", labs.filter((l) => peoples.has(l.en)).map((l) => mk(l, "people"))]);
  }
  listItems = [];
  listBody.innerHTML = groups.filter(([, l]) => l.length).map(([h, l]) => {
    const shown = l.slice(0, LIST_MAX);
    return `<div class="li-h">${escapeHtml(h)} (${fmtInt(l.length)})</div>` + shown.map((it) => {
      listItems.push(it);
      return `<button type="button" class="li" data-i="${listItems.length - 1}"><i style="background:${it.color}"></i><span><b>${escapeHtml(it.title)}</b><small>${escapeHtml(it.sub ?? "")}</small></span></button>`;
    }).join("") + (l.length > LIST_MAX ? `<p class="sub">وغيرها ${fmtInt(l.length - LIST_MAX)}، والبحث يصل إليها.</p>` : "");
  }).join("") || `<p class="sub">لا شيء من هذا النوع${activeRegion ? ` في ${escapeHtml(activeRegion.ar)}` : ""} في هذه الحقبة.</p>`;
  listNote.innerHTML = activeRegion ? `مقصورة على ${escapeHtml(activeRegion.ar)} · <button type="button" class="chip" id="list-clear">العالم كله</button>` : `خريطة ${escapeHtml(yearText(time.key))}، والحقبة ${era.id}: ${escapeHtml(era.label)}`;
}
listBody.addEventListener("click", (e) => { const b = e.target.closest(".li"); if (b) goItem(listItems[Number(b.dataset.i)]); });
listNote.addEventListener("click", (e) => { if (e.target.id === "list-clear") setRegion(null); });

// ---------- التحدي: أسئلة مولّدة من بيانات الأطلس، لا مكتوبة ----------
const quizBody = document.getElementById("quiz-body");
const quiz = { n: 0, q: null };
// عشوائية ثابتة البذرة: السؤال نفسه لكل قارئ في الترتيب نفسه
function rnd(seed) { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
function shuffle(arr, seed) { return arr.map((v, i) => [rnd(seed + i * 7), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v); }
function pickFrom(arr, seed) { return arr[Math.floor(rnd(seed) * arr.length) % arr.length]; }
const GENERATORS = [
  // أيّ الكيانين أقدم نشأةً؟ من تواريخ ويكي بيانات المتحقق منها لكيانات الخريطة الحالية
  (seed) => {
    const ents = [...labelInfo.values()].filter((l) => l.st === "verified" && l.from != null && l.ar);
    if (ents.length < 2) return null;
    for (let t = 0; t < 30; t++) {
      const a = pickFrom(ents, seed + t), b = pickFrom(ents, seed + t + 101);
      if (a.en === b.en || Math.abs(a.from - b.from) < 50) continue;
      const opts = shuffle([a, b], seed);
      const old = a.from < b.from ? a : b;
      return { q: `على خريطة ${yearText(time.key)}: أيّ الكيانين أقدم نشأةً؟`, o: opts.map((x) => x.ar), a: opts.indexOf(old),
        why: `«${a.ar}» نشأ ${yearLabel(a.from)}، و«${b.ar}» نشأ ${yearLabel(b.from)} (بحسب ويكي بيانات).` };
    }
    return null;
  },
  // أين يقع هذا الشاهد؟ ادعاء من الحقبة الحالية، والخيارات أماكن شواهد أخرى
  (seed) => {
    if (!claimPoints || claimPoints.features.length < 3) return null;
    const id = `,${eraOf(time.key).id},`;
    // الشاهد الذي يذكر مكانه في نصه يكشف الجواب، فلا يُسأل عنه
    const ask = (f) => JSON.parse(f.properties.claims).filter((c) => !norm(c.statement).includes(norm(f.properties.name_ar)));
    const usable = claimPoints.features.filter((f) => ask(f).length);
    const pool = usable.filter((f) => f.properties.eras.includes(id));
    const src = pool.length ? pool : usable;
    if (!src.length) return null;
    const f = pickFrom(src, seed);
    const c = pickFrom(ask(f), seed + 3);
    const others = shuffle(claimPoints.features.filter((x) => x.properties.name_ar !== f.properties.name_ar), seed + 5).slice(0, 2).map((x) => x.properties.name_ar);
    const opts = shuffle([f.properties.name_ar, ...others], seed + 9);
    return { q: `أين يقع هذا الشاهد؟ «${c.statement}»`, o: opts, a: opts.indexOf(f.properties.name_ar), why: `في ${f.properties.name_ar}. — ${c.attributed_to}` };
  },
  // أيّ سُنّة يؤيدها هذا الشاهد؟ من أدوار الادعاءات في السنن
  (seed) => {
    const names = (sunanData?.sunan ?? []).map((s) => s.name);
    const ids = [...claimRoles.entries()].filter(([, r]) => r.some((x) => x.role === "support"));
    if (names.length < 3 || !ids.length || !claimPoints) return null;
    for (let t = 0; t < 20; t++) {
      const [cid, roles] = pickFrom(ids, seed + t);
      const f = claimPoints.features.find((x) => x.properties.claim_ids.includes(`,${cid},`));
      if (!f) continue;
      const c = JSON.parse(f.properties.claims).find((x) => x.id === cid);
      const right = roles.find((x) => x.role === "support").name;
      const wrong = shuffle(names.filter((n) => !roles.some((r) => r.name === n)), seed + t).slice(0, 2);
      const opts = shuffle([right, ...wrong], seed + t + 3);
      return { q: `أيّ سُنّة يؤيدها هذا الشاهد؟ «${c.statement}»`, o: opts, a: opts.indexOf(right), why: `يؤيد «${right}» في سنن الأطلس. — ${c.attributed_to}` };
    }
    return null;
  },
  // في أيّ حقبة هذا الموقع؟ من ملفات مواقع الحقب
  (seed) => {
    const eras = ERAS.filter((e) => e.file && placesCache.has(e.file));
    if (eras.length < 3 || !placesData) return null;
    const era = eraOf(time.key);
    const f = pickFrom(placesData.features, seed);
    if (!f) return null;
    const wrong = shuffle(ERAS.filter((e) => e.id !== era.id), seed + 4).slice(0, 2);
    const opts = shuffle([era, ...wrong], seed + 8);
    return { q: `في أيّ حقبة يضع الأطلس موقع «${f.properties.name_ar}»؟`, o: opts.map((e) => `الحقبة ${e.id}: ${e.label}`), a: opts.indexOf(era), why: `من مواقع الحقبة ${era.id}: ${era.label}. ${COORD_LABEL[f.properties.coord_status] ?? ""}` };
  },
];
function nextQuestion() {
  quiz.n++;
  let q = null;
  for (let t = 0; t < GENERATORS.length && !q; t++) q = GENERATORS[(quiz.n + t) % GENERATORS.length](quiz.n * 31 + t);
  quiz.q = q;
  if (!q) { quizBody.innerHTML = `<p class="sub">لا بيانات كافية لسؤال في هذه الحقبة. جرّب حقبة أخرى من شريط الزمن.</p>`; return; }
  quizBody.innerHTML = `<p class="qz-q">${escapeHtml(q.q)}</p>` + q.o.map((o, i) => `<button type="button" class="qz-o" data-i="${i}">${escapeHtml(o)}</button>`).join("") +
    `<p class="qz-why" hidden></p><div class="qz-foot"><span>أجبت صحيحاً: ${fmtInt(passport.quiz.right)} من ${fmtInt(passport.quiz.total)}</span><button type="button" id="qz-next">سؤال آخر</button></div>` +
    `<p class="sub">الأسئلة مولّدة من بيانات الأطلس نفسها (ويكي بيانات، والشواهد الموثّقة، والسنن، ومواقع الحقب).</p>`;
}
quizBody.addEventListener("click", (e) => {
  if (e.target.id === "qz-next") return nextQuestion();
  const b = e.target.closest(".qz-o");
  if (!b || !quiz.q || b.disabled) return;
  const ok = Number(b.dataset.i) === quiz.q.a;
  quizBody.querySelectorAll(".qz-o").forEach((x, i) => { x.disabled = true; if (i === quiz.q.a) x.classList.add("ok"); });
  if (!ok) b.classList.add("no");
  const why = quizBody.querySelector(".qz-why");
  why.textContent = `${ok ? "صحيح." : "ليس هذا."} ${quiz.q.why}`;
  why.hidden = false;
  passport.quiz.total++;
  if (ok) passport.quiz.right++;
  passportSave();
  quizBody.querySelector(".qz-foot span").textContent = `أجبت صحيحاً: ${fmtInt(passport.quiz.right)} من ${fmtInt(passport.quiz.total)}`;
});

// الزمن تغيّر: تُحدَّث القائمة، ويُبدأ سؤال جديد إن كان التحدي مفتوحاً
document.addEventListener("atlas:time", () => {
  passportNote("era", eraOf(time.key).id);
  renderList();
  if (!document.getElementById("pane-quiz").hidden) nextQuestion(); else quiz.q = null;
});

// ---------- جواز المستكشف ----------
const modalEl = document.getElementById("modal");
const sheetEl = document.getElementById("sheet");
let lastFocus = null;
function openPassport() {
  const s = passport.sets;
  const nSunan = sunanData?.sunan?.length ?? 0;
  const nJourneys = journeyListEl.querySelectorAll("button").length;
  const prog = (label, n, of) => `<div class="prog">${escapeHtml(label)}: ${fmtInt(n)} من ${fmtInt(of)}<div class="prog-bar"><i style="width:${of ? Math.round((100 * Math.min(n, of)) / of) : 0}%"></i></div></div>`;
  sheetEl.innerHTML = `<div class="sheet-hd"><h2 id="sheet-title">جواز المستكشف</h2><button type="button" class="card-close" data-close aria-label="إغلاق">×</button></div>` +
    `<div class="tiles"><div class="tile"><b>${fmtInt(s.entity.size)}</b><span>كيانات فتحت بطاقاتها</span></div><div class="tile"><b>${fmtInt(s.claim.size)}</b><span>شواهد قرأتها</span></div><div class="tile"><b>${fmtInt(passport.quiz.right)}</b><span>إجابات صحيحة من ${fmtInt(passport.quiz.total)}</span></div></div>` +
    prog("الحقب التي زرتها", s.era.size, ERAS.length) + prog("السنن التي فتحتها", s.sunna.size, nSunan) + prog("الرحلات التي بدأتها", s.journey.size, nJourneys) + `<p class="sub">مواقع فتحت بطاقاتها: ${fmtInt(s.place.size)}</p>` +
    `<p class="note">يُحفظ هذا السجل في متصفحك وحده، ولا يُرسل إلى أي خادم، ولا يطلب اسماً ولا بريداً.</p><button type="button" class="reset" data-reset>إعادة ضبط السجل</button>`;
  lastFocus = document.activeElement;
  modalEl.hidden = false;
  sheetEl.querySelector("[data-close]").focus();
}
function closeModal() {
  modalEl.hidden = true;
  lastFocus?.focus?.();
}
document.getElementById("passport-btn").addEventListener("click", openPassport);
modalEl.addEventListener("click", (e) => {
  if (e.target === modalEl || e.target.closest("[data-close]")) return closeModal();
  if (e.target.closest("[data-reset]")) {
    for (const v of Object.values(passport.sets)) v.clear();
    passport.quiz = { right: 0, total: 0 };
    passportSave();
    openPassport();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalEl.hidden) { e.stopImmediatePropagation(); closeModal(); }
}, true);
