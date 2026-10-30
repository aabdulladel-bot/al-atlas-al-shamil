// العرض الشامل: جولة سينمائية تعرض كل طبقة وحدها، ثم تصهر الطبقات طبقةً فوق طبقة، ثم تعبر الحقب الثماني بها كلها.
// النصوص هنا وصف للطبقة ومصدرها فقط؛ الأرقام تُحسب من البيانات المحمّلة، والنص التاريخي الوحيد وصف الحقبة من ERAS في app.js.
// يستعمل ما في app.js وcube.js: LAYER_GROUPS وuserOff وwanted وsetVis وapplyBasemap وterrainState وloadEra وloadBorders
// وloadDemography وensureClaimPoints وshowClaimPoints وselectSunna وcubeSetOn، ولا يكرّر منطق أي طبقة.
const showcaseBox = document.getElementById("showcase-box");
const SC_MS = 9000;
const show = { scenes: null, mode: "", index: 0, timer: null, paused: false, token: 0, saved: null, leave: null };
const scNum = (n) => Number(n).toLocaleString("ar");
const scNarrow = () => window.innerWidth < 600;
const scPad = () => (scNarrow() ? { top: 40, bottom: 300, left: 20, right: 20 } : { top: 60, bottom: 230, left: 60, right: 60 });

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
      async run() {
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
      async run() {
        scGroups(["water"]);
        scBasemap("drawn");
        scTerrain(false);
        scFly({ center: [31, 24], zoom: 3.4, pitch: 35, bearing: 0 }, SC_MS);
        return "الأنهار والبحيرات من Natural Earth، وهي ما قامت عليه أكثر مواقع الاستقرار الأولى.";
      },
    },
    {
      title: "حدود الحقب",
      duration: BORDER_YEARS.length * 1300 + 2500,
      async run(set) {
        scGroups(["borders"]);
        scBasemap("drawn");
        scTerrain(false);
        map.flyTo({ center: [35, 28], zoom: 1.9, pitch: 0, bearing: 0, duration: 2000 });
        const token = show.token;
        for (const y of [...BORDER_YEARS, "modern"]) {
          if (token !== show.token) return;
          const data = await loadBorders(y);
          const named = data ? data.features.filter((f) => f.properties.NAME).length : 0;
          set(`الحدود تتبدّل عبر الزمن: ${y === "modern" ? "اليوم" : yearLabel(y)}، ${scNum(named)} كياناً مسمّى. المصدر: Historical Basemaps وNatural Earth.`);
          await scWait(1300);
        }
      },
    },
    {
      title: "الأسماء العربية",
      async run() {
        scGroups(["labels"]);
        scBasemap("drawn");
        scTerrain(false);
        await loadBorders(1600);
        scFly({ center: [40, 32], zoom: 2.7, pitch: 30, bearing: 0 }, SC_MS);
        const ar = countryLabels.length;
        return `أسماء الكيانات على خريطة سنة 1600م بالعربية أولاً: ${scNum(ar)} تسمية، من ويكي بيانات أو تعريب معلن، والإنجليزي في البطاقة.`;
      },
    },
    {
      title: "الشعوب والقبائل",
      async run() {
        scGroups(["peoples", "labels"]);
        scBasemap("drawn");
        scTerrain(false);
        await loadBorders(1600);
        let n = 0;
        try { n = (await getJson("data/borders/peoples_1600.geojson")).features.length; } catch {}
        scFly({ center: [-100, 40], zoom: 3, pitch: 40, bearing: 0 }, SC_MS);
        return `طبقة مستقلة عن الدول: ${scNum(n)} مضلعاً لشعوب وقبائل على خريطة 1600م، بحدود تقريبية كما في المصدر.`;
      },
    },
    {
      title: "مواقع الحقب",
      async run() {
        scGroups(["places"]);
        scBasemap("drawn");
        scTerrain(false);
        const era = ERAS[2];
        await loadEra(era);
        let feats = [];
        try { feats = (await getJson(era.file)).features; } catch {}
        if (!scFitFeatures(feats, 5)) scFly({ center: [20, 38], zoom: 3.4, pitch: 40, bearing: 0 }, SC_MS);
        return `${scNum(feats.length)} موقعاً لحقبة «${era.label}»، بإحداثيات Pleiades أو Natural Earth.`;
      },
    },
    {
      title: "الادعاءات الموثّقة على الأرض",
      async run() {
        scGroups(["claims"]);
        scBasemap("drawn");
        scTerrain(false);
        if (await ensureClaimPoints()) showClaimPoints(true);
        const feats = claimPoints?.features ?? [];
        const total = feats.reduce((s, f) => s + (Number(f.properties.count) || 0), 0);
        if (!scFitFeatures(feats, 4, 30)) scFly({ center: [30, 30], zoom: 2, pitch: 30, bearing: 0 }, SC_MS);
        return `${scNum(feats.length)} مكاناً تحمل ${scNum(total)} ربطاً لادعاءات اقتباسها مطابق لنص المصدر.`;
      },
    },
    {
      title: "السكان",
      async run() {
        scGroups(["demography"]);
        scBasemap("drawn");
        scTerrain(false);
        await scDemography("c8");
        let meta = {};
        try { meta = (await getJson("data/demography_era8.geojson"))._meta ?? {}; } catch {}
        scFly({ center: [20, 20], zoom: 1.6, pitch: 0, bearing: 0 }, SC_MS);
        return `السكان بحسب الدولة سنة ${meta.year ?? ""}، ${meta.countries ? `${scNum(meta.countries)} دولة` : ""}، من Gapminder.`;
      },
    },
    {
      title: "السنن على الخريطة",
      async run() {
        scGroups(["claims", "labels"]);
        scBasemap("drawn");
        scTerrain(false);
        const s = sunanData?.sunan?.find((x) => x.id === "sn_trade");
        if (s) await selectSunna(s);
        const n = claimPoints ? claimPoints.features.filter((f) => [...(s?.supporting ?? []), ...(s?.limiting ?? [])].some((c) => c.id && f.properties.claim_ids.includes(`,${c.id},`))).length : 0;
        scFly({ center: [25, 33], zoom: 2.6, pitch: 35, bearing: 0 }, SC_MS);
        return s ? `«${s.name}»: شواهدها المرتبطة بأماكن تظهر وحدها، ${scNum(n)} مكاناً.` : "لم تُحمَّل السنن بعد.";
      },
    },
    {
      title: "المكعّب الزمكاني",
      duration: SC_MS + 3000,
      async run() {
        scGroups([]);
        scBasemap("drawn");
        try { await cubeSetOn(true); } catch { return "تعذّر تشغيل المكعّب الزمكاني هنا."; }
        show.leave = () => cubeSetOn(false);
        return "الخرائط مكدّسة فوق بعضها عبر الزمن، والخيوط تصل كل كيان بما خلفه.";
      },
    },
  ];
}

// ---------- المشاهد: صهر الطبقات ----------
const FUSION_CAM = { center: [35, 32], zoom: 3.3, pitch: 50, bearing: -10 };
const DEMO_FOR_ERA = { 1: "r1", 2: "r2", 3: "r3", 4: "r4", 5: "r5", 6: "r6", 7: "r7", 8: "c8" };
function fusionScenes() {
  const build = [
    { title: "الأرض", groups: ["hillshade"], text: "تبدأ من الأرض وحدها: الصور والتضاريس." },
    { title: "+ الماء", groups: ["hillshade", "water"], text: "تُضاف الأنهار والبحيرات." },
    { title: "+ الحدود", groups: ["hillshade", "water", "borders"], text: "تُضاف حدود سنة 1200م، والتقريبي منها متقطع." },
    { title: "+ الأسماء", groups: ["hillshade", "water", "borders", "labels"], text: "تُضاف الأسماء العربية للكيانات." },
    { title: "+ الشعوب", groups: ["hillshade", "water", "borders", "labels", "peoples"], text: "تُضاف طبقة الشعوب والقبائل." },
    { title: "+ المواقع", groups: ["hillshade", "water", "borders", "labels", "peoples", "places"], text: "تُضاف مواقع الحقبة." },
    { title: "+ الادعاءات", groups: ["hillshade", "water", "borders", "labels", "peoples", "places", "claims"], text: "تُضاف أماكن الادعاءات الموثّقة." },
    { title: "+ السكان", groups: ["hillshade", "water", "borders", "labels", "peoples", "places", "claims", "demography"], text: "وتُضاف كثافة السكان: الطبقات كلها معاً." },
  ].map((b, i) => ({
    title: b.title,
    duration: 5200,
    async run() {
      if (i === 0) {
        scBasemap("satellite");
        scTerrain(true);
        await loadEra(ERAS[4]);
        await scDemography("r5");
        if (await ensureClaimPoints()) showClaimPoints(true);
        scFly(FUSION_CAM, 5200 * 8);
      }
      scGroups(b.groups);
      return b.text;
    },
  }));
  const ALL = ["hillshade", "water", "borders", "labels", "peoples", "places", "claims", "demography"];
  const eras = ERAS.map((era) => ({
    title: `الحقبة ${scNum(era.id)}: ${era.label}`,
    async run() {
      scGroups(ALL);
      await loadEra(era);
      await scDemography(DEMO_FOR_ERA[era.id]);
      if (await ensureClaimPoints()) showClaimPoints(true);
      let feats = [];
      if (era.file) { try { feats = (await getJson(era.file)).features; } catch {} }
      if (!scFitFeatures(feats, 4.5, 50)) scFly({ center: [30, 30], zoom: 2, pitch: 40, bearing: 0 }, SC_MS);
      return `${era.desc} ${feats.length ? `(${scNum(feats.length)} موقعاً)` : ""}`;
    },
  }));
  const finale = {
    title: "الأطلس كاملاً",
    duration: SC_MS + 2000,
    async run() {
      scGroups(ALL);
      await loadBorders("modern");
      scFly({ center: [30, 20], zoom: 1.7, pitch: 0, bearing: 0 }, SC_MS + 2000);
      const sunanCount = sunanData?.sunan?.length ?? 0;
      return `${scNum(ERAS.length)} حقب، و${scNum(sunanCount)} سنن، وكل طبقة يمكن إخفاؤها أو عرضها وحدها من «الطبقات».`;
    },
  };
  return [...build, ...eras, finale];
}

// ---------- التشغيل ----------
function scRender(scene, text) {
  showcaseBox.querySelector("#sc-count").textContent = `${scNum(show.index + 1)} من ${scNum(show.scenes.length)}`;
  showcaseBox.querySelector("#sc-mode").textContent = show.mode;
  showcaseBox.querySelector("#sc-title").textContent = scene.title;
  showcaseBox.querySelector("#sc-text").textContent = text ?? "";
  showcaseBox.querySelector('[data-sc="pause"]').textContent = show.paused ? "استئناف" : "إيقاف مؤقت";
  showcaseBox.querySelector('[data-sc="prev"]').disabled = show.index === 0;
  const bar = showcaseBox.querySelector("#sc-bar");
  bar.style.transition = "none";
  bar.style.width = "0%";
  if (!show.paused) {
    requestAnimationFrame(() => {
      bar.style.transition = `width ${(scene.duration ?? SC_MS) / 1000}s linear`;
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
  scRender(scene, "");
  let text = "";
  try { text = await scene.run((t) => { if (token === show.token) showcaseBox.querySelector("#sc-text").textContent = t; }); } catch (err) { text = `تعذّر هذا المشهد: ${err.message}`; }
  if (token !== show.token) return;
  if (text) showcaseBox.querySelector("#sc-text").textContent = text;
  scSchedule();
}
function scSchedule() {
  clearTimeout(show.timer);
  if (show.paused) return;
  const scene = show.scenes[show.index];
  show.timer = setTimeout(() => {
    if (show.index < show.scenes.length - 1) scGo(show.index + 1); else scEnd();
  }, scene.duration ?? SC_MS);
}
function scStart(mode) {
  if (show.scenes) return;
  if (typeof journeyState !== "undefined" && journeyState) endJourney();
  show.saved = {
    userOff: new Set(userOff), basemap: basemap.mode, terrain: terrainState.on, border: borderSelect.value, demo: demoSelect.value,
    camera: { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() },
  };
  show.mode = mode === "solo" ? "كل طبقة وحدها" : "صهر الطبقات";
  show.scenes = mode === "solo" ? soloScenes() : fusionScenes();
  show.paused = false;
  document.body.classList.add("showcasing");
  showcaseBox.hidden = false;
  scGo(0);
}
async function scEnd() {
  if (!show.scenes) return;
  clearTimeout(show.timer);
  show.token++;
  if (show.leave) { const leave = show.leave; show.leave = null; try { await leave(); } catch {} }
  const s = show.saved;
  show.scenes = null;
  showcaseBox.hidden = true;
  document.body.classList.remove("showcasing");
  userOff.clear();
  for (const g of s.userOff) userOff.add(g);
  for (const cb of document.querySelectorAll("#layer-panel input[data-group]")) cb.checked = !userOff.has(cb.dataset.group);
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
  if (act === "pause") {
    show.paused = !show.paused;
    if (show.paused) { clearTimeout(show.timer); map.stop(); } else scSchedule();
    scRender(show.scenes[show.index], showcaseBox.querySelector("#sc-text").textContent);
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
