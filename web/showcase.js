// العرض الشامل: جولة سينمائية تعرض كل طبقة وحدها، ثم تصهر الطبقات طبقةً فوق طبقة، ثم تعبر الحقب الثماني بها كلها.
// النصوص هنا وصف للطبقة ومصدرها فقط؛ الأرقام تُحسب من البيانات المحمّلة، والنص التاريخي في مشاهد الحقب
// اقتباس موثّق من ادعاءات الحقبة (web/data/claims_era{n}.json) بقائله وتحفّظه، لا نص مكتوب هنا.
// يستعمل ما في app.js وcube.js: LAYER_GROUPS وuserOff وwanted وsetVis وapplyBasemap وterrainState وloadEra وloadBorders
// وloadDemography وensureClaimPoints وshowClaimPoints وselectSunna وcubeSetOn، ولا يكرّر منطق أي طبقة.
const showcaseBox = document.getElementById("showcase-box");
const SC_MS = 9000;
const show = { scenes: null, mode: "", index: 0, timer: null, paused: false, token: 0, saved: null, leave: null };
const scNum = (n) => Number(n).toLocaleString("ar");
const scNarrow = () => window.innerWidth < 600;
// صندوق العرض على جانب الشاشة (أو أسفلها على الجوال)، وهو وشريط الزمن محجوزان في حشوة الخريطة نفسها
const scPad = () => (scNarrow() ? { top: 40, bottom: 40, left: 20, right: 20 } : { top: 60, bottom: 60, left: 60, right: 60 });

// ---------- التحكم في الطبقات ----------
function scGroups(on) {
  for (const g of Object.keys(LAYER_GROUPS)) {
    if (on.includes(g)) userOff.delete(g); else userOff.add(g);
    for (const id of LAYER_GROUPS[g]) if (wanted.has(id)) setVis(id, wanted.get(id));
  }
  updateLabels();
}
function scBasemap(mode) {
  const m = mode === "satellite" && sat.stopped ? "drawn" : mode;
  applyBasemap(m);
  const r = document.querySelector(`input[name="basemap"][value="${m}"]`);
  if (r) r.checked = true;
}
function scTerrain(on) {
  terrainState.on = on && !dem.stopped;
  applyTerrain();
  const t = document.getElementById("terrain-toggle");
  if (t) t.checked = terrainState.on;
}
function scDemography(key) {
  demoSelect.value = key || "";
  return loadDemography(key || "");
}

// ---------- الكاميرا ----------
// تحليق إلى المشهد ثم دوران بطيء طوال مدته، ويُلغى إن انتقل العرض
function scFly(cam, ms) {
  const token = show.token;
  map.flyTo({ ...cam, duration: 3400, essential: true });
  setTimeout(() => {
    if (token !== show.token || show.paused) return;
    map.easeTo({ bearing: (cam.bearing ?? 0) + 24, duration: Math.max(1500, ms - 3600), easing: (t) => t });
  }, 3500);
}
function scFitFeatures(features, maxZoom, pitch = 45) {
  const pts = features.filter((f) => f.geometry && f.geometry.type === "Point").map((f) => f.geometry.coordinates);
  if (!pts.length) return false;
  const b = new maplibregl.LngLatBounds();
  for (const c of pts) b.extend(c);
  map.fitBounds(b, { padding: scPad(), maxZoom, pitch, duration: 3400 });
  return true;
}
const scWait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- المشاهد: كل طبقة وحدها ----------
function soloScenes() {
  return [
    {
      title: "الأرض كما هي",
      async run(set, alive) {
        scGroups(["hillshade"]);
        scBasemap("satellite");
        scTerrain(true);
        scFly({ center: [86, 28], zoom: 4.3, pitch: 66, bearing: -20 }, SC_MS);
        return sat.stopped
          ? "صور الأقمار الصناعية غير متاحة هنا، فتظهر الخريطة المرسومة مع ظلال التضاريس."
          : "صور NASA Blue Marble الحقيقية، وتضاريس Terrain Tiles مجسّمة، قبل أي طبقة بشرية.";
      },
    },
    {
      title: "الماء",
      async run(set, alive) {
        scGroups(["water"]);
        scBasemap("drawn");
        scTerrain(false);
        scFly({ center: [31, 24], zoom: 3.4, pitch: 35, bearing: 0 }, SC_MS);
        return "الأنهار والبحيرات من Natural Earth.";
      },
    },
    {
      title: "حدود الحقب",
      duration: BORDER_YEARS.length * 1300 + 2500,
      async run(set, alive) {
        scGroups(["borders"]);
        scBasemap("drawn");
        scTerrain(false);
        map.flyTo({ center: [35, 28], zoom: 1.9, pitch: 0, bearing: 0, duration: 2000 });
        const token = show.token;
        for (const y of [...BORDER_YEARS, "modern"]) {
          if (token !== show.token) return;
          const data = await loadBorders(y);
          const named = data ? data.features.filter((f) => f.properties.NAME).length : 0;
          set(`الحدود تتبدّل عبر الزمن: ${y === "modern" ? "اليوم" : yearLabel(y)}. الكيانات المسمّاة: ${scNum(named)}. المصدر: Historical Basemaps وNatural Earth.`);
          await scWait(1300);
        }
      },
    },
    {
      title: "الأسماء العربية",
      async run(set, alive) {
        scGroups(["labels"]);
        scBasemap("drawn");
        scTerrain(false);
        await loadBorders(1600);
        if (!alive()) return "";
        scFly({ center: [40, 32], zoom: 2.7, pitch: 30, bearing: 0 }, SC_MS);
        const all = [...labelInfo.values()];
        const ar = all.filter((l) => l.ar).length;
        return `أسماء الكيانات على خريطة سنة 1600م، والعربي أولاً من ويكي بيانات أو تعريب معلن، والإنجليزي في البطاقة. الأسماء العربية: ${scNum(ar)} من ${scNum(all.length)}.`;
      },
    },
    {
      title: "الشعوب والقبائل",
      async run(set, alive) {
        scGroups(["peoples", "labels"]);
        scBasemap("drawn");
        scTerrain(false);
        await loadBorders(1600);
        let n = 0;
        try { n = (await getJson("data/borders/peoples_1600.geojson")).features.length; } catch {}
        if (!alive()) return "";
        scFly({ center: [-100, 40], zoom: 3, pitch: 40, bearing: 0 }, SC_MS);
        return `طبقة مستقلة عن الدول على خريطة 1600م، بحدود تقريبية كما في المصدر. المضلعات: ${scNum(n)}.`;
      },
    },
    {
      title: "مواقع الحقب",
      async run(set, alive) {
        scGroups(["places"]);
        scBasemap("drawn");
        scTerrain(false);
        const era = ERAS[2];
        await loadEra(era);
        let feats = [];
        try { feats = (await getJson(era.file)).features; } catch {}
        if (!alive()) return "";
        if (!scFitFeatures(feats, 5)) scFly({ center: [20, 38], zoom: 3.4, pitch: 40, bearing: 0 }, SC_MS);
        return `مواقع حقبة «${era.label}» بإحداثيات Pleiades أو Natural Earth. عدد المواقع: ${scNum(feats.length)}.`;
      },
    },
    {
      title: "الادعاءات الموثّقة على الأرض",
      async run(set, alive) {
        scGroups(["claims"]);
        scBasemap("drawn");
        scTerrain(false);
        if (await ensureClaimPoints() && alive()) showClaimPoints(true);
        if (!alive()) return "";
        const feats = claimPoints?.features ?? [];
        const total = feats.reduce((s, f) => s + (Number(f.properties.count) || 0), 0);
        if (!scFitFeatures(feats, 4, 30)) scFly({ center: [30, 30], zoom: 2, pitch: 30, bearing: 0 }, SC_MS);
        return `أماكن ادعاءات اقتباسها مطابق لنص المصدر. الأماكن: ${scNum(feats.length)}، والروابط: ${scNum(total)}.`;
      },
    },
    {
      title: "السكان",
      async run(set, alive) {
        scGroups(["demography"]);
        scBasemap("drawn");
        scTerrain(false);
        await scDemography("c8");
        let meta = {};
        try { meta = (await getJson("data/demography_era8.geojson"))._meta ?? {}; } catch {}
        if (!alive()) return "";
        scFly({ center: [20, 20], zoom: 1.6, pitch: 0, bearing: 0 }, SC_MS);
        return `السكان بحسب الدولة سنة ${meta.year ?? ""}، من Gapminder.${meta.countries ? ` الدول: ${scNum(meta.countries)}.` : ""}`;
      },
    },
    {
      title: "السنن على الخريطة",
      async run(set, alive) {
        scGroups(["claims", "labels"]);
        scBasemap("drawn");
        scTerrain(false);
        const s = sunanData?.sunan?.find((x) => x.id === "sn_trade");
        if (s) await selectSunna(s);
        if (!alive()) return "";
        const n = claimPoints ? claimPoints.features.filter((f) => [...(s?.supporting ?? []), ...(s?.limiting ?? [])].some((c) => c.id && f.properties.claim_ids.includes(`,${c.id},`))).length : 0;
        scFly({ center: [25, 33], zoom: 2.6, pitch: 35, bearing: 0 }, SC_MS);
        return s ? `«${s.name}»: شواهدها المرتبطة بأماكن تظهر وحدها. الأماكن: ${scNum(n)}.` : "لم تُحمَّل السنن بعد.";
      },
    },
    {
      title: "المكعّب الزمكاني",
      duration: SC_MS + 3000,
      async run(set, alive) {
        scGroups([]);
        scBasemap("drawn");
        try { await cubeSetOn(true); } catch { return "تعذّر تشغيل المكعّب الزمكاني هنا."; }
        if (!alive()) { cubeSetOn(false); return ""; }
        show.leave = () => cubeSetOn(false);
        // منظر مائل منخفض يُري تراكب الطبقات، ثم دوران بطيء
        scFly({ center: [35, 30], zoom: 2.3, pitch: 64, bearing: -28 }, SC_MS + 3000);
        return "الخرائط مكدّسة فوق بعضها عبر الزمن، والخيوط تصل كل كيان بما خلفه.";
      },
    },
  ];
}

// ---------- المشاهد: صهر الطبقات ----------
const FUSION_CAM = { center: [35, 32], zoom: 3.3, pitch: 50, bearing: -10 };
const DEMO_FOR_ERA = { 1: "r1", 2: "r2", 3: "r3", 4: "r4", 5: "r5", 6: "r6", 7: "r7", 8: "c8" };
const ALL_GROUPS = ["hillshade", "water", "borders", "labels", "peoples", "places", "claims", "demography"];
// ادعاءات كل حقبة كما يولّدها scripts/build_claims.mjs
const eraClaimsCache = new Map();
function eraClaims(n) {
  if (!eraClaimsCache.has(n)) eraClaimsCache.set(n, getJson(`data/claims_era${n}.json`).then((d) => d.claims ?? []).catch(() => []));
  return eraClaimsCache.get(n);
}
// اقتباس الحقبة: أول ادعاء له مكان على الخريطة واقتباس متوسط الطول، وإلا أول ادعاء فيها
async function eraQuote(era) {
  const claims = await eraClaims(era.id);
  const placed = new Set((claimPoints?.features ?? []).flatMap((f) => f.properties.claim_ids.split(",").filter(Boolean)));
  const fit = (c) => c.quote && c.quote.length >= 20 && c.quote.length <= 220;
  return claims.find((c) => placed.has(c.id) && fit(c)) ?? claims.find(fit) ?? claims[0] ?? null;
}
// وقائع المشهد من البيانات المحمّلة: الكيانات، والأسماء العربية، والمواقع، والادعاءات
// (لا «أكبرها مساحة»: مضلعات المصدر تشمل جماعات صيد وجمع ليست دولاً، فيضلّل الترتيب)
async function eraFacts(era) {
  const all = (await labelData(era.border))?.labels ?? [];
  const ar = all.filter((l) => l.ar).length;
  const claims = claimsIndex?.find((c) => c.era === era.id)?.count;
  return [
    nowParts.names != null ? `الكيانات المسمّاة: ${scNum(nowParts.names)}` : "",
    all.length ? `الأسماء العربية: ${scNum(ar)} من ${scNum(all.length)}` : "",
    placesData && era.file ? `مواقع الحقبة: ${scNum(placesData.features.length)}` : "",
    claims != null ? `ادعاءات الحقبة: ${scNum(claims)}` : "",
  ].filter(Boolean);
}
function fusionScenes() {
  const build = [
    { title: "الأرض", groups: ["hillshade"], text: "تبدأ من الأرض وحدها: الصور والتضاريس." },
    { title: "+ الماء", groups: ["hillshade", "water"], text: "تُضاف الأنهار والبحيرات." },
    { title: "+ الحدود", groups: ["hillshade", "water", "borders"], text: "تُضاف حدود سنة 1200م، كل كيان بلونه، والتقريبي منها متقطع." },
    { title: "+ الأسماء", groups: ["hillshade", "water", "borders", "labels"], text: "تُضاف الأسماء العربية للكيانات." },
    { title: "+ الشعوب", groups: ["hillshade", "water", "borders", "labels", "peoples"], text: "تُضاف طبقة الشعوب والقبائل بتهشير، لأنها انتماء لا سيادة." },
    { title: "+ المواقع", groups: ["hillshade", "water", "borders", "labels", "peoples", "places"], text: "تُضاف مواقع الحقبة." },
    { title: "+ الادعاءات", groups: ["hillshade", "water", "borders", "labels", "peoples", "places", "claims"], text: "تُضاف أماكن الادعاءات الموثّقة." },
    { title: "+ السكان", groups: ALL_GROUPS, text: "ويُضاف السكان: الطبقات كلها معاً." },
  ].map((b, i) => ({
    title: b.title,
    duration: 5200,
    async run(set, alive) {
      if (i === 0) {
        scBasemap("satellite");
        scTerrain(true);
        await loadEra(ERAS[4]);
        await scDemography("r5");
        if (!alive()) return "";
        if (await ensureClaimPoints()) showClaimPoints(true);
        scFly(FUSION_CAM, 5200 * 8);
      }
      if (!alive()) return "";
      scGroups(b.groups);
      return b.text;
    },
  }));
  const eras = ERAS.map((era) => ({
    title: `الحقبة ${scNum(era.id)}: ${era.label}`,
    async run(set, alive) {
      scGroups(ALL_GROUPS);
      await loadEra(era);
      await scDemography(DEMO_FOR_ERA[era.id]);
      const ready = await ensureClaimPoints();
      if (!alive()) return "";
      scGroups(ALL_GROUPS);
      if (ready) showClaimPoints(true, eraClaimFilter());
      // الكاميرا على مواقع الحقبة وأماكن شواهدها معاً
      const eraId = `,${era.id},`;
      const pts = [...(era.file ? placesData?.features ?? [] : []), ...(ready ? claimPoints.features.filter((f) => f.properties.eras.includes(eraId)) : [])];
      if (!scFitFeatures(pts, 4.5, 50)) scFly({ center: [30, 30], zoom: 2, pitch: 40, bearing: 0 }, SC_MS);
      const c = await eraQuote(era);
      return {
        text: era.desc,
        facts: await eraFacts(era),
        quote: c ? { statement: c.statement, quote: c.quote, by: c.attributed_to, hedge: c.hedge } : null,
      };
    },
  }));
  const finale = {
    title: "تشريح الأطلس",
    duration: ANATOMY_MS + 7000,
    async run(set, alive) {
      scGroups(ALL_GROUPS);
      await loadEra(ERAS[4]);
      await scDemography("r5");
      const ready = await ensureClaimPoints();
      if (!alive()) return "";
      if (ready) showClaimPoints(true, eraClaimFilter());
      // إلى قلب العالم القديم، ثم تُبسط الخريطة لتُرى الطبقات صفائح مستوية (على الكرة تصير قشوراً منحنية)
      map.flyTo({ center: [44, 30], zoom: 2.4, pitch: 0, bearing: 0, duration: 2600, essential: true });
      await scWait(2600);
      if (!alive()) return "";
      try { await anatomyRun(set); } catch (err) { set(`تعذّر عرض الطبقات منفصلة هنا: ${err.message}`); }
      if (!alive()) return "";
      scGroups(ALL_GROUPS);
      const sunanCount = sunanData?.sunan?.length ?? 0;
      return { text: `كل طبقة صفحة من مصدر، وتجتمع على أرض واحدة. وكل طبقة يمكن إخفاؤها أو عرضها وحدها، والزمن من الشريط أسفل الشاشة.`, facts: [`الحقب: ${scNum(ERAS.length)}`, `السنن: ${scNum(sunanCount)}`, `محطات الزمن: ${scNum(TIME_STOPS.length)}`] };
    },
  };
  return [...build, ...eras, finale];
}

// ---------- تشريح الأطلس: الطبقات صفائح فوق الأرض، ثم تهبط وتلتحم ----------
// يرسمها deck.gl فوق الكرة بالبيانات المحمّلة نفسها (حدود السنة من web/data/stack كما في المكعّب)، وتُخفى طبقات الخريطة أثناءها.
const ANATOMY_MS = 9000;
const ANATOMY_RISE = 220000; // المسافة بين الصفائح بالمتر في ذروة الارتفاع
// إطار كل صفيحة: مستطيل العالم القديم بنقاط متقاربة، فيتبع انحناء الكرة ولا يقطعها
const PLATE_FRAME = (() => {
  const [w, so, e, n] = [-25, -8, 92, 62];
  const ring = [];
  for (let x = w; x <= e; x += 2) ring.push([x, so]);
  for (let y = so; y <= n; y += 2) ring.push([e, y]);
  for (let x = e; x >= w; x -= 2) ring.push([x, n]);
  for (let y = n; y >= so; y -= 2) ring.push([w, y]);
  return ring;
})();
const anatomy = { overlay: null, raf: 0, projection: null };
const PLATES = [
  { id: "borders", name: "الدول والكيانات" },
  { id: "peoples", name: "الشعوب والقبائل" },
  { id: "places", name: "مواقع الحقبة" },
  { id: "demography", name: "السكان" },
  { id: "claims", name: "الشواهد الموثّقة" },
];
function hslRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
function polysOf(geom) {
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  return [];
}
function anatomyStop() {
  cancelAnimationFrame(anatomy.raf);
  if (anatomy.overlay && map.hasControl(anatomy.overlay)) map.removeControl(anatomy.overlay);
  if (anatomy.projection) { map.setProjection({ type: anatomy.projection }); anatomy.projection = null; }
}
async function anatomyRun(set) {
  const token0 = show.token;
  if (!window.deck) await loadScript("vendor/deck.gl.min.js");
  const key = String(time.key);
  const slice = (await getJson(`data/stack/slice_${key}.json`)).entities;
  const qids = new Map(((await labelData(key))?.labels ?? []).filter((l) => l.qid).map((l) => [l.en, l.qid]));
  const borders = slice.flatMap((e) => e.g.map((poly) => ({ poly, color: hslRgb(hueOf(qids.get(e.n) ?? e.n), 78, 66) })));
  const peoples = (peoplesData?.features ?? []).flatMap((f) => polysOf(f.geometry));
  const places = placesData?.features ?? [];
  const eraId = `,${eraOf(time.key).id},`;
  const claims = (claimPoints?.features ?? []).filter((f) => f.properties.eras.includes(eraId));
  const demo = demoData?.features ?? [];
  if (token0 !== show.token) return;
  const lift = (poly, z) => poly.map((ring) => ring.map(([x, y]) => [x, y, z]));
  const flat = { depthCompare: "less-equal", depthWriteEnabled: false };
  if (!anatomy.overlay) anatomy.overlay = new deck.MapboxOverlay({ interleaved: true, layers: [] });
  scGroups(["hillshade", "water"]);
  anatomy.projection = map.getProjection()?.type ?? "globe";
  map.setProjection({ type: "mercator" });
  map.addControl(anatomy.overlay);
  show.leave = () => anatomyStop();
  map.easeTo({ center: [46, 30], zoom: 2.35, pitch: 62, bearing: -24, duration: 2400, essential: true });
  const zOf = (id, s) => (PLATES.findIndex((p) => p.id === id) + 1) * s;
  const frames = PLATES.map((p) => ({ id: p.id }));
  const draw = (s) => anatomy.overlay.setProps({ layers: [
    new deck.SolidPolygonLayer({ id: "an-frames", data: s > 1000 ? frames : [], parameters: flat, getPolygon: (d) => [PLATE_FRAME.map(([x, y]) => [x, y, zOf(d.id, s)])], getFillColor: [243, 230, 208, 16], updateTriggers: { getPolygon: s } }),
    new deck.PathLayer({ id: "an-frame-edges", data: s > 1000 ? frames : [], parameters: flat, widthUnits: "pixels", getWidth: 1, getPath: (d) => PLATE_FRAME.map(([x, y]) => [x, y, zOf(d.id, s)]), getColor: [243, 214, 164, 110], updateTriggers: { getPath: s } }),
    new deck.SolidPolygonLayer({ id: "an-borders", data: borders, parameters: flat, getPolygon: (d) => lift(d.poly, zOf("borders", s)), getFillColor: (d) => [...d.color, 120], updateTriggers: { getPolygon: s } }),
    new deck.PathLayer({ id: "an-borders-edge", data: borders.flatMap((d) => d.poly.map((ring) => ({ ring, color: d.color }))), parameters: flat, widthUnits: "pixels", getWidth: 1, getPath: (d) => d.ring.map(([x, y]) => [x, y, zOf("borders", s)]), getColor: (d) => [...d.color, 230], updateTriggers: { getPath: s } }),
    new deck.SolidPolygonLayer({ id: "an-peoples", data: peoples, parameters: flat, getPolygon: (p) => lift(p, zOf("peoples", s)), getFillColor: [125, 79, 143, 150], updateTriggers: { getPolygon: s } }),
    new deck.ScatterplotLayer({ id: "an-places", data: places, parameters: flat, radiusUnits: "pixels", getRadius: 5, getPosition: (f) => [...f.geometry.coordinates, zOf("places", s)], getFillColor: [138, 75, 42, 255], stroked: true, getLineColor: [255, 253, 248, 255], lineWidthUnits: "pixels", getLineWidth: 1.5, updateTriggers: { getPosition: s } }),
    new deck.ScatterplotLayer({ id: "an-demo", data: demo, parameters: flat, radiusUnits: "pixels", getRadius: (f) => Math.max(4, Math.sqrt(Number(f.properties.population)) / 220), getPosition: (f) => [...f.geometry.coordinates, zOf("demography", s)], getFillColor: [224, 145, 63, 150], updateTriggers: { getPosition: s } }),
    new deck.LineLayer({ id: "an-pillars", data: claims, parameters: flat, widthUnits: "pixels", getWidth: 1.2, getSourcePosition: (f) => [...f.geometry.coordinates, 0], getTargetPosition: (f) => [...f.geometry.coordinates, zOf("claims", s)], getColor: [95, 179, 170, 200], updateTriggers: { getTargetPosition: s } }),
    new deck.ScatterplotLayer({ id: "an-claims", data: claims, parameters: flat, radiusUnits: "pixels", getRadius: 9, getPosition: (f) => [...f.geometry.coordinates, zOf("claims", s)], getFillColor: [42, 111, 106, 235], stroked: true, getLineColor: [255, 253, 248, 255], lineWidthUnits: "pixels", getLineWidth: 2, updateTriggers: { getPosition: s } }),
  ] });
  // ارتفاع ثم ثبات ثم هبوط، والنص يسمّي الصفائح من الأسفل
  const RISE = 2600, HOLD = 3600, FALL = ANATOMY_MS - RISE - HOLD;
  const ease = (t) => t * t * (3 - 2 * t);
  const token = show.token;
  set(`الأرض في الأسفل، وفوقها: ${PLATES.map((p) => p.name).join("، ثم ")}.`);
  await new Promise((resolve) => {
    const t0 = performance.now();
    let last = 0, falling = false;
    const step = (now) => {
      if (token !== show.token) return resolve();
      const t = now - t0;
      if (now - last > 45 || t >= ANATOMY_MS) {
        last = now;
        const s = t < RISE ? ease(t / RISE) : t < RISE + HOLD ? 1 : 1 - ease(Math.min(1, (t - RISE - HOLD) / FALL));
        draw(s * ANATOMY_RISE);
      }
      if (!falling && t >= RISE + HOLD) {
        falling = true;
        set("ثم تلتحم الطبقات على أرض واحدة.");
        map.easeTo({ pitch: 30, bearing: 0, duration: FALL, essential: true });
      }
      if (t < ANATOMY_MS) anatomy.raf = requestAnimationFrame(step); else resolve();
    };
    anatomy.raf = requestAnimationFrame(step);
  });
  if (token !== show.token) return;
  anatomyStop();
  show.leave = null;
}

// ---------- التشغيل ----------
// محتوى المشهد نص، أو { text, facts, quote } حين تصحبه وقائع محسوبة واقتباس موثّق
const scContent = (c) => (typeof c === "string" ? { text: c } : c ?? { text: "" });
// مدة المشهد على قدر ما يُقرأ فيه، ولا تقل عن مدته المقرّرة
function scDuration(scene, c) {
  const len = (c.text ?? "").length + (c.quote ? (c.quote.statement ?? "").length + c.quote.quote.length : 0) + (c.facts ?? []).join("").length / 2;
  return Math.max(scene.duration ?? SC_MS, Math.min(18000, 3000 + len * 45));
}
function scRender(scene, content) {
  const c = scContent(content);
  show.duration = scDuration(scene, c);
  showcaseBox.querySelector("#sc-count").textContent = `${scNum(show.index + 1)} من ${scNum(show.scenes.length)}`;
  showcaseBox.querySelector("#sc-mode").textContent = show.mode;
  showcaseBox.querySelector("#sc-title").textContent = scene.title;
  showcaseBox.querySelector("#sc-text").textContent = c.text ?? "";
  showcaseBox.querySelector("#sc-facts").innerHTML = (c.facts ?? []).map((f) => `<span class="chip">${escapeHtml(f)}</span>`).join("");
  const q = showcaseBox.querySelector("#sc-quote");
  q.hidden = !c.quote;
  if (c.quote) {
    q.innerHTML = (c.quote.statement ? `<div class="sc-q-st">${escapeHtml(c.quote.statement)}</div>` : "") +
      `<blockquote dir="auto">“${escapeHtml(c.quote.quote)}”</blockquote><div class="sc-q-by">— <bdi>${escapeHtml(c.quote.by)}</bdi></div>` +
      (c.quote.hedge ? `<div class="sc-q-hedge">تحفّظ: ${escapeHtml(c.quote.hedge)}</div>` : "");
  }
  showcaseBox.querySelector('[data-sc="pause"]').textContent = show.paused ? "استئناف" : "إيقاف مؤقت";
  showcaseBox.querySelector('[data-sc="prev"]').disabled = show.index === 0;
  const bar = showcaseBox.querySelector("#sc-bar");
  bar.style.transition = "none";
  bar.style.width = "0%";
  if (!show.paused) {
    requestAnimationFrame(() => {
      bar.style.transition = `width ${show.duration / 1000}s linear`;
      bar.style.width = "100%";
    });
  }
}
async function scGo(i) {
  clearTimeout(show.timer);
  if (show.leave) { const leave = show.leave; show.leave = null; try { await leave(); } catch {} }
  show.index = Math.max(0, Math.min(i, show.scenes.length - 1));
  const token = ++show.token;
  const scene = show.scenes[show.index];
  show.content = { text: "" };
  scRender(scene, show.content);
  let content;
  // alive(): هل ما زال هذا المشهد هو المعروض؟ مشهد تُرك أثناء تحميله لا يغيّر الخريطة بعد ذلك
  const alive = () => token === show.token;
  try { content = await scene.run((t) => { if (alive()) showcaseBox.querySelector("#sc-text").textContent = t; }, alive); } catch (err) { content = `تعذّر هذا المشهد: ${err.message}`; }
  if (token !== show.token) return;
  show.content = scContent(content);
  scRender(scene, show.content);
  scSchedule();
}
function scSchedule() {
  clearTimeout(show.timer);
  if (show.paused) return;
  show.timer = setTimeout(() => {
    if (show.index < show.scenes.length - 1) scGo(show.index + 1); else scEnd();
  }, show.duration ?? SC_MS);
}
function scStart(mode) {
  if (show.scenes) return;
  if (typeof journeyState !== "undefined" && journeyState) endJourney();
  closeCard();
  stopPlay();
  show.saved = {
    userOff: new Set(userOff), basemap: basemap.mode, terrain: terrainState.on, border: borderSelect.value, demo: demoSelect.value,
    camera: { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() },
  };
  show.mode = mode === "solo" ? "كل طبقة وحدها" : "صهر الطبقات";
  show.scenes = mode === "solo" ? soloScenes() : fusionScenes();
  show.paused = false;
  document.body.classList.add("showcasing");
  dismissIntro();
  showcaseBox.hidden = false;
  applyPadding();
  scGo(0);
}
// keep: «استكشف من هنا» يُبقي الخريطة كما هي في المشهد ويعيد التحكم إلى القارئ، وبغيره تعود الخريطة إلى حالها قبل العرض
async function scEnd({ keep = false } = {}) {
  if (!show.scenes) return;
  clearTimeout(show.timer);
  show.token++;
  if (show.leave) { const leave = show.leave; show.leave = null; try { await leave(); } catch {} }
  const s = show.saved;
  show.scenes = null;
  showcaseBox.hidden = true;
  document.body.classList.remove("showcasing");
  applyPadding();
  if (keep) {
    syncLayerInputs();
    return;
  }
  userOff.clear();
  for (const g of s.userOff) userOff.add(g);
  syncLayerInputs();
  scBasemap(s.basemap);
  scTerrain(s.terrain);
  await loadBorders(s.border === "modern" ? "modern" : Number(s.border));
  await scDemography(s.demo);
  if (claimPoints) showClaimPoints(false);
  scGroups(Object.keys(LAYER_GROUPS).filter((g) => !userOff.has(g)));
  map.jumpTo(s.camera);
}

document.getElementById("showcase-solo").addEventListener("click", () => scStart("solo"));
document.getElementById("showcase-fusion").addEventListener("click", () => scStart("fusion"));
showcaseBox.addEventListener("click", (e) => {
  const act = e.target.closest("button")?.dataset.sc;
  if (!act || !show.scenes) return;
  if (act === "exit") return scEnd();
  if (act === "explore") { map.stop(); return scEnd({ keep: true }); }
  if (act === "pause") {
    show.paused = !show.paused;
    if (show.paused) { clearTimeout(show.timer); map.stop(); } else scSchedule();
    scRender(show.scenes[show.index], show.content);
    return;
  }
  scGo(show.index + (act === "next" ? 1 : -1));
});
document.addEventListener("keydown", (e) => {
  if (!show.scenes || e.target.closest("input, select, textarea")) return;
  if (e.key === "Escape") return scEnd();
  if (e.key === " ") { e.preventDefault(); showcaseBox.querySelector('[data-sc="pause"]').click(); return; }
  // اتجاه الصفحة عربي: السهم الأيسر يتقدّم
  if (e.key === "ArrowLeft") scGo(show.index + 1);
  else if (e.key === "ArrowRight") scGo(show.index - 1);
});
