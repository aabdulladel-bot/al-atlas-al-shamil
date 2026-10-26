// اختبار دخان للواجهة: يشغّل خادماً محلياً، ويفتح الصفحة بمتصفح Chromium، ويضغط كل زر سُنّة وحقبة
// وطبقة سكان وحقبة ادعاءات، ويفشل إن ظهر خطأ في وحدة التحكم أو فشل تحميل ملف بيانات.
// الاستعمال: node scripts/ui_smoke.mjs   (الصور في out/ui_desktop.png وout/ui_mobile.png)
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

// بلاطة تضاريس مسطحة (ارتفاع صفر بترميز terrarium: أحمر 128) تُقدَّم بدل البلاطات الخارجية،
// فيُختبر مسار التضاريس كاملاً بلا اعتماد على الشبكة.
function flatTerrariumPng() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(256, 0); ihdr.writeUInt32BE(256, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(256 * 3).fill(Buffer.from([128, 0, 0]))]);
  const raw = Buffer.concat(Array.from({ length: 256 }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const FLAT_TILE = flatTerrariumPng();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: path.join(ROOT, "web"), stdio: "ignore" });
const problems = [];
let step = "البداية"; // آخر خطوة بدأت، تُذكر عند الفشل
let browser;
try {
  await new Promise((r) => setTimeout(r, 1500));
  // عرض برمجي بـ SwiftShader عبر ANGLE: المسار الافتراضي بلا معالج رسوميات أبطأ بعشرة أضعاف مع التضاريس،
  // فتنتهي مهلة النقرات قبل أن يفرغ المتصفح (383 مقابل 33 م.ث للإطار)
  browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const [name, viewport] of [["desktop", { width: 1366, height: 860 }], ["mobile", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    await page.route("**/elevation-tiles-prod/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: FLAT_TILE, headers: { "access-control-allow-origin": "*" } }));
    page.on("console", (m) => { if (m.type() === "error") problems.push(`[${name}] console: ${m.text()}`); });
    page.on("pageerror", (e) => problems.push(`[${name}] pageerror: ${e.message}`));
    page.on("response", (r) => { if (r.status() >= 400) problems.push(`[${name}] HTTP ${r.status()} ${r.url()}`); });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll("#sunan-list button").length > 0, null, { timeout: 15000 });
    const counts = {};
    // افتح كل الأقسام المطوية قبل الضغط
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    for (const [sel, key] of [["#sunan-list button", "sunan"], ["#eras button", "eras"], ["#claims-eras button", "claimEras"]]) {
      step = `${name}: ${key}`;
      const btns = await page.$$(sel);
      counts[key] = btns.length;
      for (const b of btns) { await b.click(); await page.waitForTimeout(700); }
    }
    const opts = await page.$$eval("#demo-select option", (os) => os.map((o) => o.value).filter(Boolean));
    counts.demo = opts.length;
    for (const v of opts) { await page.selectOption("#demo-select", v); await page.waitForTimeout(700); }
    step = `${name}: لوحة الطبقات`;
    // لوحة الطبقات: المسطحة ثم الكرة، والتضاريس، وتضخيمها، وكل مجموعة طبقات إطفاءً وإشعالاً
    await page.click('input[name="projection"][value="mercator"]'); await page.waitForTimeout(500);
    await page.click('input[name="projection"][value="globe"]'); await page.waitForTimeout(500);
    await page.click("#terrain-toggle"); await page.waitForTimeout(300);
    await page.click("#terrain-toggle"); await page.waitForTimeout(300);
    await page.$eval("#terrain-exaggeration", (el) => { el.value = "20"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.click("#terrain-auto"); await page.waitForTimeout(300);
    const groups = await page.$$("#layer-panel input[data-group]");
    counts.layerGroups = groups.length;
    for (const g of groups) { await g.click(); await page.waitForTimeout(150); await g.click(); await page.waitForTimeout(150); }
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
    await page.click("#claim-map-btn"); await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ROOT, "out", `ui_${name}.png`) });
    console.log(`${name}: ${JSON.stringify(counts)}`);
    for (const [k, n] of Object.entries(counts)) if (n === 0) problems.push(`[${name}] لا أزرار في ${k}`);
    await page.close();
  }
} catch (e) {
  problems.push(`exception في «${step}»: ${e.message.split("\n")[0]}`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log("الواجهة سليمة: لا أخطاء في وحدة التحكم ولا ملفات مفقودة");
