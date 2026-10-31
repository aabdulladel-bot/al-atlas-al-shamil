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
    await page.waitForSelector("#intro", { state: "hidden", timeout: 5000 });
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
    await togglePanel(true);
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
