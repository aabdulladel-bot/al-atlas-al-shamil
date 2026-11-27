// يفحص أدوات الباحث في المتصفح: رابط الشاهد الثابت (#c<رقم>) يفتح بطاقته، وزرّا الاستشهاد والرابط ينسخان نصاً
// فيه معرّف الشاهد ورابطه، وروابط تنزيل المكتبة تصل إلى ملفاتها.
// الاستعمال: node scripts/research_tools_check.mjs
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const PORT = 8794;
const BASE = `http://127.0.0.1:${PORT}/`;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", path.join(ROOT, "web")], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE.slice(0, -1) });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // شاهد بلا مكان: يُفتح نصاً
  await page.goto(`${BASE}#c465`, { waitUntil: "load" });
  await page.evaluate(() => document.getElementById("intro")?.remove()).catch(() => {});
  const opened = await page.waitForFunction(() => document.querySelector("#card:not([hidden]) .ev-card")?.textContent.includes("أورليان"), null, { timeout: 90000 }).then(() => true, () => false);
  ok(opened, "الرابط #c465 يفتح بطاقة الشاهد");
  if (opened) {
    await page.click("#card [data-ccite]");
    await page.waitForTimeout(400);
    const cite = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    ok(cite.includes("cl_000000465") && cite.includes("#c465") && cite.includes("غريغوريوس"), "زر الاستشهاد ينسخ النص بإسناده ومعرّفه ورابطه");
    await page.click("#card [data-clink]");
    await page.waitForTimeout(400);
    const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    ok(/#c465$/.test(link), "زر الرابط ينسخ الرابط الثابت");
  }
  // شاهد له مكان: يُفتح على بطاقة مكانه
  const placed = await page.evaluate(async () => {
    await ensureClaimPoints();
    const f = claimPoints.features[0];
    return JSON.parse(f.properties.claims)[0].id;
  });
  await page.goto(`${BASE}#c${Number(placed.slice(3))}`, { waitUntil: "load" });
  await page.evaluate(() => document.getElementById("intro")?.remove()).catch(() => {});
  const placedOpen = await page.waitForSelector("#card:not([hidden]) .ev-card", { timeout: 90000 }).then(() => true, () => false);
  ok(placedOpen, `الرابط إلى شاهد له مكان (${placed}) يفتح بطاقة مكانه`);
  // روابط المكتبة
  const hrefs = await page.$$eval("#library-links a", (as) => as.map((a) => a.getAttribute("href")));
  ok(hrefs.length === 2, "رابطا تنزيل المكتبة في لوحة الادعاءات");
  for (const h of hrefs) {
    const r = await page.request.get(BASE + h);
    ok(r.status() === 200, `ملف المكتبة يصل: ${h}`);
  }
  ok(!errors.length, `لا أخطاء في الصفحة${errors.length ? `: ${errors[0]}` : ""}`);
} finally {
  await browser.close();
  server.kill();
}
console.log(problems.length ? `أدوات الباحث: ${problems.length} مشكلة` : "أدوات الباحث سليمة");
process.exit(problems.length ? 1 : 0);
