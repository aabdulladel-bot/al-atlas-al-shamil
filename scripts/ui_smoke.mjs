// اختبار دخان للواجهة: يشغّل خادماً محلياً، ويفتح الصفحة بمتصفح Chromium، ويضغط كل زر سُنّة وحقبة
// وطبقة سكان وحقبة ادعاءات، ويفشل إن ظهر خطأ في وحدة التحكم أو فشل تحميل ملف بيانات.
// الاستعمال: node scripts/ui_smoke.mjs   (الصور في out/ui_desktop.png وout/ui_mobile.png)
// ويقارن لقطات ثابتة بلقطات مرجعية في scripts/visual_ref/ (انظر visualCheck). لتحديث المرجع بعد تغيير بصري مقصود:
// UPDATE_VISUAL=1 node scripts/ui_smoke.mjs   (وVISUAL_ONLY=1 يقتصر على اللقطات المرجعية)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node-tools/node_modules/playwright");
const PORT = 8765;
const URL = `http://127.0.0.1:${PORT}/`;
fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });

// بلاطات بديلة بلون واحد تُقدَّم بدل البلاطات الخارجية، فيُختبر مسار التضاريس والصور كاملاً بلا اعتماد على الشبكة:
// تضاريس مسطحة (ارتفاع صفر بترميز terrarium: أحمر 128)، وصورة فضائية بلون البحر. ليست صوراً حقيقية.
function solidPng([r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(256, 0); ihdr.writeUInt32BE(256, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(256 * 3).fill(Buffer.from([r, g, b]))]);
  const raw = Buffer.concat(Array.from({ length: 256 }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const FLAT_TILE = solidPng([128, 0, 0]);
const SAT_STANDIN = solidPng([12, 28, 64]);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: path.join(ROOT, "web"), stdio: "ignore" });
const problems = [];
// ---------- اللقطات المرجعية ----------
// حالات ثابتة بلا حركة (تقليل الحركة، والافتتاحية مُتجاوزة، والكاميرا محددة، والبلاطات البديلة نفسها)، تُقارن بالمرجع
// بكسلاً بكسلاً في المتصفح. البكسل مختلف إن تجاوز فرق إحدى قنواته 40، والفشل إن اختلف أكثر من 2% من البكسلات.
// المرجع مأخوذ في بيئة هذا الاختبار (Chromium وSwiftShader وخطوطها)، فلا يُقارن بلقطات من جهاز آخر.
const VISUAL_DIR = path.join(ROOT, "scripts/visual_ref");
const VISUAL_MAX = 0.02;
const counts_visual = {};
async function visualCheck(browser, name, viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  await page.addInitScript(() => { try { localStorage.setItem("atlas-intro-seen", "1"); } catch {} });
  await page.route("**/elevation-tiles-prod/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: FLAT_TILE, headers: { "access-control-allow-origin": "*" } }));
  await page.route("**/gibs.earthdata.nasa.gov/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: SAT_STANDIN, headers: { "access-control-allow-origin": "*" } }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: "window.__settle = () => new Promise((res) => { if (map.loaded() && !map.isMoving()) return res(); const t = setTimeout(res, 60000); map.once('idle', () => { clearTimeout(t); res(); }); });" });
  await page.waitForFunction(() => typeof time !== "undefined" && time.key === 1200 && document.querySelectorAll("#sunan-list button").length > 0, null, { timeout: 90000 });
  const settle = async () => { await page.evaluate(() => window.__settle()); await page.waitForTimeout(400); await page.evaluate(() => window.__settle()); };
  await page.evaluate(() => { terrainState.on = false; applyTerrain(); });
  const states = [
    ["landing", async () => { await page.evaluate(() => map.jumpTo({ center: [35, 32], zoom: 2.8, pitch: 30, bearing: 0 })); }],
    ["card", async () => {
      await page.evaluate(() => loadBorders(1600));
      await page.evaluate(() => map.jumpTo({ center: [32, 39.5], zoom: 4.2, pitch: 0, bearing: 0 }));
      await settle();
      const xy = await page.evaluate(() => { const q = map.project([32, 39.5]); return [q.x, q.y]; });
      await page.mouse.click(xy[0], xy[1]);
      await page.waitForFunction(() => !document.getElementById("card").hidden && !document.getElementById("card-body").textContent.includes("جارٍ التحميل"), null, { timeout: 20000 });
    }],
    ["drawn", async () => {
      await page.evaluate(() => closeCard());
      // اللوحة مطويّة على الجوال، فيُبدَّل الأساس مباشرة (زرّه مختبر في خطوة لوحة الطبقات)
      await page.evaluate(() => { document.querySelector('input[name="basemap"][value="drawn"]').checked = true; applyBasemap("drawn"); map.jumpTo({ center: [40, 33], zoom: 3.4, pitch: 20, bearing: 0 }); });
    }],
  ];
  for (const [state, setup] of states) {
    step = `${name}: لقطة ${state}`;
    await setup();
    await settle();
    const shot = await page.screenshot();
    const ref = path.join(VISUAL_DIR, `${state}_${name}.png`);
    if (process.env.UPDATE_VISUAL || !fs.existsSync(ref)) {
      fs.mkdirSync(VISUAL_DIR, { recursive: true });
      fs.writeFileSync(ref, shot);
      counts_visual[`${state}_${name}`] = "مرجع جديد";
      continue;
    }
    fs.writeFileSync(path.join(ROOT, "out", `visual_${state}_${name}.png`), shot);
    const ratio = await page.evaluate(async ([a, b]) => {
      const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 1;
      const px = (im) => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
      const da = px(ia), db = px(ib);
      let diff = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 40 || Math.abs(da[i + 1] - db[i + 1]) > 40 || Math.abs(da[i + 2] - db[i + 2]) > 40) diff++;
      return diff / (da.length / 4);
    }, [`data:image/png;base64,${fs.readFileSync(ref).toString("base64")}`, `data:image/png;base64,${shot.toString("base64")}`]);
    counts_visual[`${state}_${name}`] = `${(ratio * 100).toFixed(2)}%`;
    if (ratio > VISUAL_MAX) problems.push(`[${name}] لقطة «${state}» تختلف عن المرجع بنسبة ${(ratio * 100).toFixed(1)}% (out/visual_${state}_${name}.png مقابل ${path.relative(ROOT, ref)})`);
  }
  await page.close();
}
let step = "البداية"; // آخر خطوة بدأت، تُذكر عند الفشل
let browser;
try {
  await new Promise((r) => setTimeout(r, 1500));
  // عرض برمجي بـ SwiftShader عبر ANGLE: المسار الافتراضي بلا معالج رسوميات أبطأ بعشرة أضعاف مع التضاريس،
  // فتنتهي مهلة النقرات قبل أن يفرغ المتصفح (383 مقابل 33 م.ث للإطار)
  browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const [name, viewport] of [["desktop", { width: 1366, height: 860 }], ["mobile", { width: 390, height: 844 }]]) {
    if (process.env.VISUAL_ONLY) {
      await visualCheck(browser, name, viewport);
      console.log(`${name} لقطات: ${JSON.stringify(counts_visual)}`);
      continue;
    }
    const page = await browser.newPage({ viewport });
    await page.route("**/elevation-tiles-prod/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: FLAT_TILE, headers: { "access-control-allow-origin": "*" } }));
    await page.route("**/gibs.earthdata.nasa.gov/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: SAT_STANDIN, headers: { "access-control-allow-origin": "*" } }));
    // خطوط Google تُستبدل بلا شيء، فتُرسم بخطوط النظام نفسها في كل تشغيل
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
    page.on("console", (m) => { if (m.type() === "error") problems.push(`[${name}] console: ${m.text()}`); });
    page.on("pageerror", (e) => problems.push(`[${name}] pageerror: ${e.message}`));
    page.on("response", (r) => { if (r.status() >= 400) problems.push(`[${name}] HTTP ${r.status()} ${r.url()}`); });
    await page.goto(URL, { waitUntil: "networkidle" });
    // انتظار سكون الخريطة (انتهاء الحركة وتحميل البلاطات) بعد كل نقرة، كما ينتظر القارئ، بدل مهلة ثابتة:
    // في العرض البرمجي تستغرق أُولى إطارات التضاريس في منطقة جديدة ثوانيَ، فكانت النقرة التالية تقع وسطها.
    // map معرّفة في نطاق الصفحة لا في window، فتُعرَّف دالة الانتظار بوسم سكربت.
    await page.addScriptTag({ content: "window.__settle = () => new Promise((res) => { if (map.loaded() && !map.isMoving()) return res(); const t = setTimeout(res, 60000); map.once('idle', () => { clearTimeout(t); res(); }); });" });
    const settle = () => page.evaluate(() => window.__settle());
    // التضاريس تُطفأ لبقية الفحوص (غايتها أخطاء الواجهة لا سرعة الرسم البرمجي)، وتُختبر وحدها في خطوة لوحة الطبقات
    await page.waitForFunction(() => document.querySelectorAll("#sunan-list button").length > 0, null, { timeout: 60000 });
    // اللوحة مطويّة على الجوال؛ والفحص يمرّ بأقسام الباحث كلها
    const togglePanel = async (open) => {
      if (!(await page.isVisible("#panel-toggle"))) return; // على المكتب لا تُطوى اللوحة
      if ((await page.$eval("#panel", (p) => p.classList.contains("collapsed"))) === open) await page.click("#panel-toggle");
    };
    // الافتتاحية تظهر في الزيارة الأولى: أبوابها الثلاثة وزر الدخول، ثم تُغلق
    await page.waitForSelector("#intro.on", { timeout: 15000 });
    const counts = { intro: await page.$$eval("#intro .intro-doors [data-door]", (b) => b.length) };
    await page.click('#intro [data-door="skip"]');
    await page.waitForSelector("#intro", { state: "hidden", timeout: 15000 }); // الإخفاء بمؤقّت قد يتأخر تحت العرض البرمجي
    await togglePanel(true);
    await page.click('.mode button[data-mode="research"]');
    await page.evaluate(() => { document.getElementById("layer-panel").open = true; });
    await page.click("#terrain-toggle"); await settle();
    await page.waitForFunction(() => document.querySelectorAll("#sunan-list button").length > 0, null, { timeout: 60000 });
    // افتح كل الأقسام المطوية قبل الضغط
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    for (const [sel, key] of [["#sunan-list button", "sunan"], ["#eras button", "eras"], ["#claims-eras button", "claimEras"]]) {
      step = `${name}: ${key}`;
      const btns = await page.$$(sel);
      counts[key] = btns.length;
      for (const b of btns) { await b.click(); await page.waitForTimeout(300); await settle(); }
    }
    const opts = await page.$$eval("#demo-select option", (os) => os.map((o) => o.value).filter(Boolean));
    counts.demo = opts.length;
    for (const v of opts) { await page.selectOption("#demo-select", v); await page.waitForTimeout(300); await settle(); }
    // أسماء الدول بالعربية: يجب أن يظهر بعضها على الكرة عند التحميل
    counts.labels = await page.$$eval(".country-label", (e) => e.filter((x) => x.style.visibility !== "hidden" && x.style.opacity !== "0").length);
    step = `${name}: لوحة الطبقات`;
    // لوحة الطبقات: المسطحة ثم الكرة، والتضاريس، وتضخيمها، وكل مجموعة طبقات إطفاءً وإشعالاً
    await page.click('input[name="basemap"][value="drawn"]'); await page.waitForTimeout(400);
    await page.click('input[name="basemap"][value="satellite"]'); await page.waitForTimeout(400);
    await page.click('input[name="projection"][value="mercator"]'); await page.waitForTimeout(500);
    await page.click('input[name="projection"][value="globe"]'); await page.waitForTimeout(500);
    await page.click("#terrain-toggle"); await page.waitForTimeout(300); await settle();
    await page.click("#terrain-toggle"); await page.waitForTimeout(300);
    await page.$eval("#terrain-exaggeration", (el) => { el.value = "20"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.click("#terrain-auto"); await page.waitForTimeout(300);
    const groups = await page.$$("#layer-panel input[data-group]");
    counts.layerGroups = groups.length;
    for (const g of groups) { await g.click(); await page.waitForTimeout(150); await g.click(); await page.waitForTimeout(150); }
    step = `${name}: المكعّب الزمكاني`;
    // المكعّب: تشغيله وانتظار طبقاته، ثم كل مفاتيحه، والتركيز على كيان، ثم إطفاؤه
    await page.click("#cube-toggle");
    await page.waitForFunction(() => document.getElementById("cube-status").textContent === "", null, { timeout: 120000 });
    for (const id of ["fill", "edges", "same", "succ", "change", "places"]) { await page.click(`#cube-show-${id}`); await page.waitForTimeout(150); await page.click(`#cube-show-${id}`); }
    await page.click("#cube-slices-none"); await page.waitForTimeout(200); await page.click("#cube-slices-all"); await page.waitForTimeout(300);
    await page.click('input[name="cube-axis"][value="years"]'); await page.waitForTimeout(300); await page.click('input[name="cube-axis"][value="even"]');
    await page.$eval("#cube-spacing", (el) => { el.value = "300"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.addScriptTag({ content: 'cubeSetFocus("1800", "Ottoman Empire");' }); await page.waitForTimeout(800);
    counts.cubeFocus = await page.$$eval("#cube-focus li", (li) => li.length);
    await page.click('input[name="cube-lineage"][value="wide"]'); await page.waitForTimeout(500);
    await page.click("#cube-focus-clear"); await page.waitForTimeout(300);
    await page.click("#cube-toggle"); await page.waitForTimeout(800);
    step = `${name}: قائمة الحدود`;
    // قائمة الحدود: كل السنوات والدول اليوم
    const borderOpts = await page.$$eval("#border-select option", (os) => os.map((o) => o.value));
    counts.borders = borderOpts.length;
    for (const v of borderOpts) { await page.selectOption("#border-select", v); await page.waitForTimeout(500); }
    step = `${name}: لوحة التحولات`;
    // لوحة التحولات: زوجان من السنين، أحدهما معكوس الترتيب، ثم الضغط على اسم
    for (const [a, b] of [["1800", "1945"], ["modern", "1200"], ["-4000", "-1000"]]) {
      await page.selectOption("#tr-from", a); await page.selectOption("#tr-to", b); await page.waitForTimeout(800);
    }
    await page.selectOption("#tr-from", "1800"); await page.selectOption("#tr-to", "1945"); await page.waitForTimeout(800);
    counts.transitions = await page.$$eval("#tr-result button.ent", (bs) => bs.length);
    await page.evaluate(() => document.querySelectorAll("#tr-result details").forEach((d) => (d.open = true)));
    const ent = await page.$('#tr-result button.ent[data-name="Ottoman Empire"]');
    if (ent) { await ent.click(); await page.waitForTimeout(1200); } else problems.push(`[${name}] لا زر للدولة العثمانية في لوحة التحولات`);
    await page.click("#claim-map-btn"); await page.waitForTimeout(300); await settle();
    await page.click("#claim-map-btn"); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ROOT, "out", `ui_${name}.png`) });
    step = `${name}: شريط الزمن`;
    // كل محطات الزمن، ثم لوحة المفاتيح ونقرة على الشريط
    counts.timeStops = await page.evaluate(async () => { let n = 0; for (const k of TIME_STOPS) { await loadBorders(k); n++; } return n; });
    await page.focus("#tb-track"); await page.keyboard.press("Home"); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(600);
    const track = await page.$eval("#tb-track", (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.click(track[0], track[1]); await page.waitForTimeout(600); await settle();
    step = `${name}: البطاقات`;
    // البطاقات: حَكَم النقر يفتح بطاقة الشاهد قبل بطاقة الكيان تحته، ثم بطاقة كيان وتتبّعه إلى سنة أخرى
    await togglePanel(false);
    const clickAt = async (lngLat) => {
      const xy = await page.evaluate((c) => { const q = map.project(c); return [q.x, q.y]; }, lngLat);
      await page.mouse.click(xy[0], xy[1]);
      await page.waitForSelector("#card:not([hidden]) #card-body h2", { timeout: 15000 });
    };
    await page.evaluate(() => loadBorders(1200)); await settle();
    const claimAt = await page.evaluate(async () => {
      await ensureClaimPoints(); applyClaimView();
      const f = claimPoints.features.find((x) => x.properties.eras.includes(",5,"));
      map.jumpTo({ center: f.geometry.coordinates, zoom: 5, pitch: 0, bearing: 0 });
      return f.geometry.coordinates;
    });
    await settle();
    await clickAt(claimAt);
    counts.claimCard = await page.$$eval("#card-body .ev-card", (e) => e.length);
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    if (!(await page.$eval("#card", (c) => c.hidden))) problems.push(`[${name}] البطاقة لم تُغلق بالهروب`);
    await page.evaluate(() => loadBorders(1600)); await page.evaluate(() => map.jumpTo({ center: [32, 39.5], zoom: 4.5, pitch: 0, bearing: 0 })); await settle();
    await clickAt([32, 39.5]);
    // الشواهد تُحمَّل بعد فتح البطاقة وتعيد رسمها
    await page.waitForFunction(() => !document.getElementById("card-body").textContent.includes("جارٍ التحميل"), null, { timeout: 15000 });
    counts.entityLife = await page.$$eval("#card-body .life-dot.on", (e) => e.length);
    const follow = await page.$("#card-body [data-follow]");
    counts.follow = follow ? 1 : 0;
    if (follow) { await follow.click(); await page.waitForTimeout(800); await settle(); }
    await page.screenshot({ path: path.join(ROOT, "out", `card_${name}.png`) });
    await page.click("#card .card-close"); await page.waitForTimeout(300);
    if (!(await page.$eval("#card", (c) => c.hidden))) problems.push(`[${name}] البطاقة لم تُغلق بزرها`);
    step = `${name}: البحث`;
    // البحث: اسم عربي يفتح بطاقته، وسنة مكتوبة تقترح محطتها، والهروب يغلق النتائج
    await page.fill("#q", "العثمانية");
    await page.waitForSelector("#q-results .qr", { timeout: 60000 });
    counts.search = await page.$$eval("#q-results .qr", (b) => b.length);
    await page.keyboard.press("Enter");
    await page.waitForSelector("#card:not([hidden]) #card-body h2", { timeout: 30000 });
    await settle();
    counts.searchCard = (await page.$eval("#card-body h2", (h) => h.textContent)).includes("العثمانية") ? 1 : 0;
    await page.click("#card .card-close"); await page.waitForTimeout(300);
    await page.fill("#q", "500 ق.م");
    await page.waitForSelector("#q-results .qr", { timeout: 30000 });
    counts.searchYear = (await page.$eval("#q-results .qr", (b) => b.textContent)).includes("انتقل") ? 1 : 0;
    await page.keyboard.press("Escape");
    if (!(await page.$eval("#q-results", (r) => r.hidden))) problems.push(`[${name}] نتائج البحث لم تُغلق بالهروب`);
    await page.fill("#q", "");
    step = `${name}: القارات`;
    await page.click('#rail button[data-region="africa"]'); await page.waitForTimeout(800); await settle();
    counts.rail = await page.$$eval("#rail button", (b) => b.length);
    // بطاقة المنطقة: رسم الكيانات عبر الزمن، وتشغيل المنطقة عبر الزمن ثم إيقافه
    await page.waitForSelector("#card:not([hidden]) .rg-bar", { timeout: 30000 });
    counts.regionBars = await page.$$eval("#card .rg-bar", (b) => b.length);
    await page.click("#card [data-rplay]");
    await page.waitForFunction(() => playTimer && String(time.key) !== "-4000", null, { timeout: 30000 });
    await page.click("#card [data-rplay]");
    if (await page.evaluate(() => playTimer !== null)) problems.push(`[${name}] العرض الزمني للمنطقة لم يتوقف`);
    await settle();
    // على الجوال يختفي الشريط والبطاقة مفتوحة (مكان الورقة السفلية)، فتُغلق أولاً كما يفعل القارئ
    await page.click("#card .card-close"); await page.waitForTimeout(300);
    await page.click('#rail button[data-region="world"]'); await page.waitForTimeout(800); await settle();
    await togglePanel(true);
    step = `${name}: العالم في هذه الحقبة`;
    await page.evaluate(() => loadBorders(1200)); await settle();
    await page.click("#tab-list");
    await page.waitForSelector("#list-body .li", { timeout: 30000 });
    counts.list = await page.$$eval("#list-body .li", (b) => b.length);
    await page.click("#list-body .li");
    await page.waitForSelector("#card:not([hidden]) #card-body h2", { timeout: 30000 });
    await settle();
    await page.click("#card .card-close"); await page.waitForTimeout(300);
    await togglePanel(true);
    step = `${name}: التحدي`;
    await page.click("#tab-quiz");
    await page.waitForSelector("#quiz-body .qz-o", { timeout: 30000 });
    await page.click("#quiz-body .qz-o");
    counts.quiz = (await page.$eval("#quiz-body .qz-why", (p) => !p.hidden)) ? 1 : 0;
    await page.click("#qz-next");
    await page.waitForSelector("#quiz-body .qz-o:not([disabled])", { timeout: 30000 });
    await page.click("#tab-over");
    step = `${name}: جواز المستكشف`;
    if (await page.isVisible("#passport-btn")) {
      await page.click("#passport-btn");
      await page.waitForSelector("#modal:not([hidden]) .tile", { timeout: 10000 });
      counts.passport = await page.$$eval("#modal .tile", (t) => t.length);
      await page.keyboard.press("Escape");
      if (!(await page.$eval("#modal", (m) => m.hidden))) problems.push(`[${name}] جواز المستكشف لم يُغلق`);
    }
    step = `${name}: المشاركة والاختصارات`;
    await page.click("#share-btn");
    await page.waitForSelector("#toast:not([hidden])", { timeout: 10000 });
    counts.share = (await page.evaluate(() => location.hash)).startsWith("#t") ? 1 : 0;
    if (await page.isVisible("#keys-btn")) {
      await page.click("#keys-btn");
      await page.waitForSelector("#modal:not([hidden]) kbd", { timeout: 10000 });
      counts.keys = await page.$$eval("#modal kbd", (k) => k.length);
      await page.keyboard.press("Escape");
    }
    step = `${name}: الرحلات`;
    // الرحلة: تُفتح أول رحلة، وتُجتاز خطواتها بالتالي حتى آخرها، ثم تُغلق بزر «إنهاء»
    await page.evaluate(() => { document.getElementById("journey-panel").open = true; });
    await page.waitForSelector("#journey-list button", { timeout: 15000 });
    await page.click("#journey-list button");
    // صندوق الخطوة يُملأ بعد تحميل ملف الرحلة، وسكون الخريطة قد يقع قبل ذلك
    await page.waitForSelector('#journey-box button[data-act="next"]', { timeout: 15000 });
    await settle();
    let passed = 1;
    while (await page.$eval('#journey-box button[data-act="next"]', (b) => !b.disabled)) {
      await page.click('#journey-box button[data-act="next"]');
      await settle();
      passed++;
    }
    counts.journeySteps = passed;
    await page.screenshot({ path: path.join(ROOT, "out", `journey_${name}.png`) });
    await page.click('#journey-box button[data-act="exit"]');
    await page.waitForTimeout(300);
    if (!(await page.$eval("#journey-box", (b) => b.hidden))) problems.push(`[${name}] صندوق الرحلة لم يُغلق`);
    // لكل سُنّة رحلة، وزرّها في تفاصيل السُّنّة يبدؤها
    counts.journeys = await page.$$eval("#journey-list button", (b) => b.length);
    await page.evaluate(() => { clearSunna(); document.getElementById("sunan-list").closest("details").open = true; });
    await page.click('#sunan-list button[data-sunna="sn_luxury"]');
    await page.waitForSelector("#sunan-detail [data-start-journey]", { timeout: 30000 });
    // لغة الطبقات: أماكن الشواهد بدورها في السُّنّة المختارة، والمفتاح الحيّ يذكر الأدوار، والمواقع رموز بحسب نوعها
    await page.waitForFunction(() => document.getElementById("legend-body").textContent.includes("مقيِّد"), null, { timeout: 10000 }).catch(() => {});
    const lg = await page.evaluate(() => ({
      rows: [...document.querySelectorAll("#legend-body .lg-row")].map((r) => r.textContent),
      color: JSON.stringify(map.getPaintProperty("claim-points", "circle-color")),
      places: map.getLayer("places")?.type ?? null,
      limited: claimPoints.features.filter((f) => f.properties.lim.length > 2).length,
    }));
    if (!lg.rows.some((t) => t.includes("مقيِّد"))) problems.push(`[${name}] المفتاح لا يذكر الشاهد المقيِّد في السُّنّة المختارة: ${lg.rows.join(" | ")}`);
    if (!lg.color.includes("sn_luxury")) problems.push(`[${name}] أماكن الشواهد لم تُلوَّن بدورها في السُّنّة المختارة`);
    if (lg.places && lg.places !== "symbol") problems.push(`[${name}] المواقع ليست رموزاً بحسب نوعها: ${lg.places}`);
    if (!lg.limited) problems.push(`[${name}] لا مكان شاهد يحمل دوراً مقيِّداً لأي سُنّة`);
    counts.legend = lg.rows.length;
    counts.limitedPlaces = lg.limited;
    await page.click("#sunan-detail [data-start-journey]");
    await page.waitForSelector('#journey-box button[data-act="next"]', { timeout: 15000 });
    counts.sunnaJourney = (await page.evaluate(() => journeyState?.journey.id)) === "luxury" ? 1 : 0;
    await settle();
    await page.click('#journey-box button[data-act="exit"]');
    await page.waitForTimeout(300);
    step = `${name}: العرض الشامل`;
    // العرض الشامل: كل نمط يبدأ، ويتقدّم مشهدين، ثم يُغلق ويعيد اللوحة
    for (const [btn, key] of [["#showcase-solo", "showcaseSolo"], ["#showcase-fusion", "showcaseFusion"]]) {
      await page.evaluate(() => { document.getElementById("showcase-panel").open = true; });
      await page.click(btn);
      await page.waitForSelector("#showcase-box:not([hidden])", { timeout: 15000 });
      await page.click('#showcase-box [data-sc="pause"]');
      counts[key] = await page.evaluate(() => show.scenes.length);
      for (let i = 0; i < 2; i++) {
        await page.click('#showcase-box [data-sc="next"]');
        await page.waitForTimeout(1500);
        await settle();
      }
      await page.click('#showcase-box [data-sc="exit"]');
      await page.waitForTimeout(1500);
      if (!(await page.$eval("#showcase-box", (b) => b.hidden))) problems.push(`[${name}] العرض الشامل لم يُغلق`);
      if (await page.$eval("#panel", (p) => getComputedStyle(p).display === "none")) problems.push(`[${name}] اللوحة لم تعد بعد العرض`);
    }
    console.log(`${name}: ${JSON.stringify(counts)}`);
    for (const [k, n] of Object.entries(counts)) if (n === 0) problems.push(`[${name}] لا أزرار في ${k}`);
    await page.close();
    if (name === "desktop") {
      // رابط منظر مشارَك يعيد السنة والمنطقة والسُّنّة
      step = `${name}: رابط المنظر`;
      const hp = await browser.newPage({ viewport });
      await hp.addInitScript(() => { try { localStorage.setItem("atlas-intro-seen", "1"); } catch {} });
      await hp.route("**/elevation-tiles-prod/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: FLAT_TILE, headers: { "access-control-allow-origin": "*" } }));
      await hp.route("**/gibs.earthdata.nasa.gov/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: SAT_STANDIN, headers: { "access-control-allow-origin": "*" } }));
      await hp.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
      hp.on("pageerror", (e) => problems.push(`[${name}] رابط المنظر pageerror: ${e.message}`));
      await hp.goto(`${URL}#t1600-rmena-strade`, { waitUntil: "load" });
      await hp.waitForFunction(() => typeof time !== "undefined" && time.key === 1600 && activeRegion?.id === "mena" && activeSunna?.id === "sn_trade", null, { timeout: 90000 });
      counts.hashView = 1;
      await hp.close();
      // الحركة والسرعة (بحركة حقيقية، ودون «تقليل الحركة»): مدتا الكاميرا، ونبضة الوصول، ودوران الخمول وشروط إيقافه، والجلب المسبق، وجودة العرض
      step = `${name}: الحركة والسرعة`;
      const mp = await browser.newPage({ viewport, reducedMotion: "no-preference" });
      await mp.addInitScript(() => { try { localStorage.setItem("atlas-intro-seen", "1"); } catch {} });
      await mp.route("**/elevation-tiles-prod/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: FLAT_TILE, headers: { "access-control-allow-origin": "*" } }));
      await mp.route("**/gibs.earthdata.nasa.gov/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: SAT_STANDIN, headers: { "access-control-allow-origin": "*" } }));
      await mp.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
      mp.on("pageerror", (e) => problems.push(`[${name}] الحركة pageerror: ${e.message}`));
      await mp.goto(URL, { waitUntil: "load" });
      await mp.waitForFunction(() => typeof time !== "undefined" && time.key === 1200 && document.querySelectorAll("#sunan-list button").length > 0, null, { timeout: 90000 });
      await mp.evaluate(() => { terrainState.on = false; applyTerrain(); });
      await mp.evaluate(() => window.__settle?.()).catch(() => {});
      await mp.waitForFunction(() => map.loaded() && !map.isMoving(), null, { timeout: 90000 });
      // الخريطة تبلغ السكون وتبقى ساكنة: لا حركة مستمرة تُبقيها ترسم بلا قارئ (كان نبض الهالة اللانهائي يمنع ذلك)
      await mp.waitForTimeout(3500);
      const stable = await mp.evaluate(() => map.loaded() && !map.isMoving());
      if (!stable) problems.push(`[${name}] الخريطة لا تبقى ساكنة بعد انتهاء التحميل: ثمة حركة أو تحديث مستمر`);
      counts.idleStable = stable ? 1 : 0;
      const caps = await mp.evaluate(() => ({ fast: CAM_FAST, region: CAM_REGION, cinema: CAM_CINEMA, reduce: reduceMotion }));
      if (caps.reduce) problems.push(`[${name}] الحركة: reduceMotion مفعّل رغم no-preference`);
      if (!(caps.fast <= 800 && caps.region <= 1200 && caps.cinema >= 1500)) problems.push(`[${name}] مدتا الكاميرا خرجتا عن حدّيهما: ${JSON.stringify(caps)}`);
      // نبضة الوصول: تظهر بعد انتهاء الكاميرا ثم تُزال
      await mp.evaluate(() => { map.flyTo({ center: [44, 33], zoom: 4, duration: camMs(CAM_FAST), essential: true }); arriveAfterMove([44, 33]); });
      await mp.waitForSelector(".arrive i", { state: "attached", timeout: 20000 });
      await mp.waitForSelector(".arrive", { state: "detached", timeout: 10000 });
      counts.arrivePulse = 1;
      // زمن الإطار أثناء حركة كاميرا: للمتابعة لا للحكم، فالعرض هنا برمجي (SwiftShader) أبطأ بكثير من معالج رسوميات
      const fr = await mp.evaluate(() => new Promise((res) => {
        const d = []; let last = performance.now(); const t0 = last;
        map.easeTo({ center: [60, 20], duration: 1200 });
        (function f(now) { d.push(now - last); last = now; if (now - t0 < 1300) requestAnimationFrame(f); else res(d); })(last);
      }));
      fr.sort((a, b) => a - b);
      counts.frames = fr.length;
      counts.frameP95Ms = Math.round(fr[Math.floor(fr.length * 0.95)] ?? 0);
      // العرض البرمجي يرسم نحو ثلاثة إطارات فقط في ثانية وثلث، فالحدّ إطاران لئلا يفشل الاختبار بتذبذب السرعة؛ والقياس للمتابعة لا للحكم
      if (fr.length < 2) problems.push(`[${name}] الحركة: لم يُرصد أكثر من ${fr.length} إطاراً في ثانية وثلث`);
      // دوران الخمول: يتحرك المركز، ويتوقف مع بطاقة مفتوحة
      const spin = await mp.evaluate(() => {
        map.jumpTo({ center: [10, 20], zoom: 1.8, pitch: 0 });
        idleSpin.on = true; idleSpin.started = idleSpin.last = performance.now() - 1000;
        const before = map.getCenter().lng;
        spinFrame(performance.now());
        const moved = map.getCenter().lng - before;
        spinStop();
        document.body.classList.add("card-open");
        const blockedByCard = spinBlocked();
        document.body.classList.remove("card-open");
        map.jumpTo({ zoom: 6 });
        const blockedByZoom = spinBlocked();
        return { moved, blockedByCard, blockedByZoom };
      });
      if (!(spin.moved > 0)) problems.push(`[${name}] دوران الخمول لم يحرّك الكرة: ${JSON.stringify(spin)}`);
      if (!spin.blockedByCard || !spin.blockedByZoom) problems.push(`[${name}] دوران الخمول لا يتوقف مع بطاقة مفتوحة أو تقريب: ${JSON.stringify(spin)}`);
      counts.idleSpin = 1;
      // الجلب المسبق: يُحفظ ثم يُستهلك مرة واحدة ويُمحى
      const pf = await mp.evaluate(async () => {
        const u = "data/borders/borders_1600.geojson";
        prefetchStop(1600);
        const had = prefetched.has(u);
        const d = await getJson(u);
        return { had, left: prefetched.has(u), n: d.features.length };
      });
      if (!pf.had || pf.left || pf.n < 100) problems.push(`[${name}] الجلب المسبق: ${JSON.stringify(pf)}`);
      counts.prefetch = 1;
      // جودة العرض
      const q = await mp.evaluate(() => { applyQuality("eco"); const e = map.getPixelRatio(); applyQuality("sharp"); const sh = map.getPixelRatio(); applyQuality("balanced"); return { e, sh, b: map.getPixelRatio(), dpr: window.devicePixelRatio, saved: localStorage.getItem("atlas-quality") }; });
      if (q.e !== 1 || q.sh < q.b || q.b !== Math.min(q.dpr, 2) || q.saved !== "balanced") problems.push(`[${name}] جودة العرض: ${JSON.stringify(q)}`);
      counts.quality = 1;
      // «عن الطبقة»: زرّ لكل بطاقة طبقة، وبطاقة بمصادرها من المانيفست
      step = `${name}: عن الطبقة`;
      await mp.evaluate(() => { closeCard(); document.querySelector('.mode button[data-mode="research"]')?.click(); });
      const nLc = await mp.$$eval("#layer-panel .layer-cards .lc", (e) => e.length);
      const nBtn = await mp.$$eval("#layer-panel .layer-cards .lc .lc-i", (e) => e.length);
      if (!nLc || nLc !== nBtn) problems.push(`[${name}] أزرار «عن الطبقة» ${nBtn} من ${nLc} بطاقة`);
      await mp.evaluate(() => document.querySelector('#layer-panel .lc:has(input[data-group="borders"]) .lc-i').click());
      await mp.waitForFunction(() => !document.getElementById("card").hidden && document.getElementById("card-body").textContent.includes("المصادر"), null, { timeout: 15000 });
      const li = await mp.evaluate(() => ({ h: document.querySelector("#card-body h2")?.textContent, txt: document.getElementById("card-body").textContent, srcs: document.querySelectorAll("#card-body .src").length, checked: document.querySelector('input[data-group="borders"]').checked }));
      if (!li.txt.includes("historical-basemaps") || !li.txt.includes("GPL") || li.srcs < 1 || !li.checked) problems.push(`[${name}] بطاقة «عن الطبقة»: ${JSON.stringify({ h: li.h, srcs: li.srcs, checked: li.checked })}`);
      counts.layerInfo = li.srcs;
      // الأوامر في البحث: «>» تعرضها كلها، وأمر الإظهار يغيّر الطبقة، وCtrl+K يركّز الخانة
      step = `${name}: الأوامر`;
      await mp.evaluate(() => closeCard());
      await mp.keyboard.press("Control+k");
      if ((await mp.evaluate(() => document.activeElement?.id)) !== "q") problems.push(`[${name}] Ctrl+K لا يركّز البحث`);
      await mp.fill("#q", ">");
      await mp.waitForSelector("#q-results .qr", { timeout: 60000 });
      counts.commands = await mp.$$eval("#q-results .qr", (b) => b.length);
      if (counts.commands < 10) problems.push(`[${name}] «>» تعرض ${counts.commands} أمراً فقط`);
      await mp.fill("#q", ">اظهار السكان");
      await mp.waitForFunction(() => [...document.querySelectorAll("#q-results .qr")].some((b) => b.textContent.includes("إظهار طبقة") && b.textContent.includes("السكان")), null, { timeout: 60000 });
      const demoBefore = await mp.evaluate(() => userOff.has("demography"));
      await mp.evaluate(() => [...document.querySelectorAll("#q-results .qr")].find((b) => b.textContent.includes("إظهار طبقة") && b.textContent.includes("السكان")).click());
      await mp.waitForFunction(() => !userOff.has("demography"), null, { timeout: 15000 });
      if (!demoBefore) problems.push(`[${name}] طبقة السكان كانت ظاهرة قبل الأمر`);
      // الرابط يحمل الطبقة والكاميرا ويعيدهما
      step = `${name}: رابط الطبقات والكاميرا`;
      await mp.evaluate(() => { map.jumpTo({ center: [44, 33], zoom: 3, pitch: 0 }); writeHash(); });
      const hash = await mp.evaluate(() => location.hash);
      if (!/kdemography/.test(hash) || !/-p\d+_\d+_\d+/.test(hash)) problems.push(`[${name}] الرابط لا يحمل الطبقة والكاميرا: ${hash}`);
      const rp = await browser.newPage({ viewport, reducedMotion: "no-preference" });
      await rp.addInitScript(() => { try { localStorage.setItem("atlas-intro-seen", "1"); } catch {} });
      await rp.route("**/elevation-tiles-prod/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: FLAT_TILE, headers: { "access-control-allow-origin": "*" } }));
      await rp.route("**/gibs.earthdata.nasa.gov/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: SAT_STANDIN, headers: { "access-control-allow-origin": "*" } }));
      await rp.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
      rp.on("pageerror", (e) => problems.push(`[${name}] رابط الطبقات pageerror: ${e.message}`));
      await rp.goto(`${URL}${hash}`, { waitUntil: "load" });
      await rp.waitForFunction(() => typeof userOff !== "undefined" && !userOff.has("demography"), null, { timeout: 90000 });
      await rp.waitForTimeout(3000);
      const back = await rp.evaluate(() => ({ lng: map.getCenter().lng, lat: map.getCenter().lat, z: map.getZoom() }));
      if (Math.abs(back.lng - 44) > 1 || Math.abs(back.lat - 33) > 1 || Math.abs(back.z - 3) > 0.3) problems.push(`[${name}] الكاميرا لم تُستعد من الرابط: ${JSON.stringify(back)}`);
      counts.shareLink = 1;
      await rp.close();
      // سرعة التشغيل: ×1 ← ×2 ← ×0.5 ← ×1
      step = `${name}: سرعة التشغيل`;
      const sp = [];
      for (let i = 0; i < 3; i++) { await mp.click("#tb-speed"); sp.push(await mp.$eval("#tb-speed", (b) => b.textContent)); }
      if (sp.join("|") !== "×2|×0.5|×1") problems.push(`[${name}] دورة السرعة: ${sp.join("|")}`);
      counts.playSpeed = 1;
      // سلسلة الكيان: السعودية اليوم تعرض سبقها، وتنتقل إلى الخريطة التي تذكرها، والوضعان يختلفان
      step = `${name}: سلسلة الكيان`;
      await mp.evaluate(() => { closeCard(); loadBorders("modern"); });
      await mp.waitForFunction(() => time.key === "modern" && bordersShown?.features.some((f) => f.properties.NAME === "Saudi Arabia"), null, { timeout: 60000 });
      await mp.evaluate(() => { const x = bordersShown.features.find((f) => f.properties.NAME === "Saudi Arabia"); cardCurrent = { c: CLICKABLE.find((c) => c.layer === "borders-fill"), f: x }; cardAlso = []; openEntityCard(x, "state"); });
      await mp.waitForFunction(() => document.querySelector("#card-body .lineage .lin-btn") !== null, null, { timeout: 60000 });
      const strong = await mp.$$eval("#card-body .lin-btn", (b) => b.length);
      await mp.evaluate(() => document.querySelector('#card-body [data-lmode="all"]').click());
      await mp.waitForFunction(() => document.querySelectorAll("#card-body .lin-btn").length > 1, null, { timeout: 60000 });
      const all = await mp.$$eval("#card-body .lin-btn", (b) => b.length);
      if (!(strong >= 1 && all > strong && all <= 80)) problems.push(`[${name}] سلسلة الكيان: أقوى صلة ${strong} وكل الصلات ${all}`);
      await mp.evaluate(() => document.querySelector('#card-body [data-lmode="strong"]').click());
      await mp.waitForFunction((n) => document.querySelectorAll("#card-body .lin-btn").length === n, strong, { timeout: 60000 });
      // ما لا نعرفه يظهر بعد وصول الشواهد والسلسلة معاً
      await mp.waitForSelector("#card-body .gaps", { timeout: 60000 });
      // زر النسخ مع الإسناد موجود في القسم
      if (!(await mp.$("#card-body .lineage [data-lcopy]"))) problems.push(`[${name}] سلسلة الكيان: لا زر نسخ مع الإسناد`);
      // كل صلة تحمل نوعها: شاهد على الأرض المشتركة أو تطابق أرض فقط
      const typed = await mp.$$eval("#card-body .lin-btn", (b) => b.every((x) => x.querySelector(".chip")));
      if (!typed) problems.push(`[${name}] سلسلة الكيان: صلة بلا نوع`);
      await mp.evaluate(() => document.querySelector("#card-body .lin-btn").click());
      await mp.waitForFunction(() => time.key !== "modern", null, { timeout: 60000 });
      // الرجوع: يعيد الكيان والزمن اللذين فُتح منهما
      await mp.waitForSelector("#card-body [data-lback]", { timeout: 60000 });
      await mp.evaluate(() => document.querySelector("#card-body [data-lback]").click());
      // الشرط يطلب بطاقة السعودية الحديثة نفسها (facts.key)، لا السعودية في 2010 التي تحمل الاسم نفسه
      await mp.waitForFunction(() => time.key === "modern" && cardEntity?.facts?.key === "modern" && lastEntityCard?.f?.properties?.NAME === "Saudi Arabia", null, { timeout: 60000 });
      // مقارنة السلسلتين: تثبيت السعودية، ثم فتح كيان من سلسلتها يُعرض جدول مقابلتهما عبر الزمن
      await mp.evaluate(() => document.querySelector("#card-body [data-pin]").click());
      const pinState = async () => mp.evaluate(() => ({ pins: [...document.querySelectorAll("#card-body [data-pin]")].map((b) => b.dataset.pin), pinned: pinned ? `${pinned.name}|${pinned.key}` : null, card: lastEntityCard?.f?.properties?.NAME ?? null, key: time.key }));
      try { await mp.waitForSelector('#card-body [data-pin="off"]', { timeout: 60000 }); } catch (err) { throw new Error(`تثبيت: ${JSON.stringify(await pinState())}`); }
      await mp.evaluate(() => document.querySelector("#card-body .lin-btn").click());
      try { await mp.waitForSelector("#card-body .lin-compare", { timeout: 60000 }); } catch (err) { throw new Error(`مقارنة: ${JSON.stringify(await pinState())}`); }
      const cmpRows = await mp.$$eval("#card-body .lin-compare tr", (r) => r.length);
      if (cmpRows < 2) problems.push(`[${name}] مقارنة السلسلتين: ${cmpRows} صفوف`);
      await mp.evaluate(() => { pinned = null; });
      counts.lineageBack = true;
      counts.lineageStrong = strong;
      counts.lineageAll = all;
      await mp.evaluate(() => closeCard());
      // العدسات: تضع الوضع والطبقات والزمن والسُّنّة، وتُحفظ في الرابط، وتُستعاد منه، وتظهر في الأوامر
      step = `${name}: العدسات`;
      await mp.evaluate(() => { closeCard(); document.querySelector('.mode button[data-mode="simple"]')?.click(); });
      await mp.evaluate(() => document.querySelector('.mode button[data-mode="research"]').click());
      await mp.waitForSelector('#lens-list button[data-lens="political"]', { state: "attached", timeout: 60000 });
      await mp.evaluate(() => document.querySelector('#lens-list button[data-lens="political"]').click());
      await mp.waitForFunction(() => activeLens === "political" && time.key === 1600 && activeSunna?.id === "sn_asabiyya" && !document.getElementById("lens-about").hidden, null, { timeout: 60000 });
      const lensState = await mp.evaluate(() => ({
        mode: document.body.dataset.mode,
        borders: document.querySelector('input[data-group="borders"]').checked,
        peoples: document.querySelector('input[data-group="peoples"]').checked,
        demography: userOff.has("demography") ? false : document.querySelector('input[data-group="demography"]').checked,
        hash: location.hash,
        pressed: document.querySelector('#lens-list button[data-lens="political"]').getAttribute("aria-pressed"),
        questions: document.querySelectorAll("#lens-about li").length,
      }));
      if (lensState.mode !== "research" || !lensState.borders || lensState.peoples || lensState.pressed !== "true" || lensState.questions < 2 || !lensState.hash.includes("gpolitical")) problems.push(`[${name}] العدسة لم تضع الحالة: ${JSON.stringify(lensState)}`);
      counts.lens = lensState.questions;
      // الرابط يستعيد العدسة: الزمن والسُّنّة والطبقات
      const lp = await browser.newPage({ viewport, reducedMotion: "no-preference" });
      await lp.addInitScript(() => { try { localStorage.setItem("atlas-intro-seen", "1"); } catch {} });
      await lp.route("**/elevation-tiles-prod/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: FLAT_TILE, headers: { "access-control-allow-origin": "*" } }));
      await lp.route("**/gibs.earthdata.nasa.gov/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: SAT_STANDIN, headers: { "access-control-allow-origin": "*" } }));
      await lp.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
      lp.on("pageerror", (e) => problems.push(`[${name}] العدسة من الرابط pageerror: ${e.message}`));
      await lp.goto(`${URL}${lensState.hash}`, { waitUntil: "load" });
      await lp.waitForFunction(() => typeof activeLens !== "undefined" && activeLens === "political" && time.key === 1600 && activeSunna?.id === "sn_asabiyya", null, { timeout: 90000 });
      counts.lensLink = 1;
      await lp.close();
      // الأوامر: كل عدسة أمر
      await mp.keyboard.press("Control+k");
      await mp.fill("#q", ">عدسة");
      await mp.waitForFunction(() => [...document.querySelectorAll("#q-results .qr")].filter((b) => b.textContent.includes("عدسة")).length >= 6, null, { timeout: 60000 });
      counts.lensCommands = await mp.$$eval("#q-results .qr", (b) => b.filter((x) => x.textContent.includes("عدسة")).length);
      if (counts.lensCommands < 6) problems.push(`[${name}] الأوامر لا تعرض العدسات الست: ${counts.lensCommands}`);
      await mp.evaluate(() => closeCard());
      console.log(`${name} حركة: ${JSON.stringify({ arrivePulse: counts.arrivePulse, frames: counts.frames, frameP95Ms: counts.frameP95Ms, idleSpin: counts.idleSpin, prefetch: counts.prefetch, quality: counts.quality, idleStable: counts.idleStable, layerInfo: counts.layerInfo, commands: counts.commands, shareLink: counts.shareLink, playSpeed: counts.playSpeed, lens: counts.lens, lensLink: counts.lensLink, lensCommands: counts.lensCommands, lineageStrong: counts.lineageStrong, lineageAll: counts.lineageAll })}`);
      await mp.close();
    }
    await visualCheck(browser, name, viewport);
    console.log(`${name} لقطات: ${JSON.stringify(counts_visual)}`);
  }
} catch (e) {
  problems.push(`exception في «${step}»: ${e.message.split("\n")[0]}`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log("الواجهة سليمة: لا أخطاء في وحدة التحكم ولا ملفات مفقودة");
