// اختبار ثابت لترتيب البحث: استعلامات معروفة، وأول نتيجة لكل منها يجب أن تحمل علامة نوعها ونصّها.
// يشغّل خادماً محلياً لمجلد web/، ويفتح الصفحة في المتصفح المثبّت، ويكتب الخانة كما يكتب المستخدم.
// الاستعمال: node scripts/search_golden.mjs
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

// [الاستعلام، علامة أول نتيجة ونصّها، اختياري: يجب ألا تظهر هذه العبارة بين أول ثلاث نتائج]
const CASES = [
  ["ابن خلدون", "✦"],
  ["الحرير", "❝"],
  ["فارس", "◼ فارس"],
  ["العثمانية", "◼ الدولة العثمانية"],
  ["الصين", "◼ الصين"],
  ["1600", "انتقل إلى 1600م"],
  ["الاتحاد السوفيتي", "◼ الاتحاد السوفيتي"],
  ["الشام", "◎ الشام"],
  ["شام", "◎ الشام", "تشامبا"],
  ["خراسان", "◎ خراسان"],
  ["الإسكندرية", "● الإسكندرية"],
  ["طريق الحرير", "❝"],
  ["دمشق", "● دمشق"],
  ["الهند", "◼ الهند"],
];

const PORT = 8789;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", path.join(ROOT, "web")], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));

let failures = 0;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  await page.evaluate(() => document.getElementById("intro")?.remove());
  // الاختبار لترتيب النتائج لا لزمن بناء الفهرس: ينتظر اكتمال الفهرس قبل أول استعلام
  await page.evaluate(() => buildIndex());
  for (const [q, want, banned] of CASES) {
    await page.fill("#q", "");
    await page.waitForFunction(() => document.getElementById("q-results").hidden, null, { timeout: 5000 }).catch(() => {});
    await page.click("#q");
    await page.fill("#q", q);
    // ينتظر ظهور نتائج هذا الاستعلام نفسه (لا رسالة الانتظار)، لا مهلة ثابتة: البحث يبطؤ على متصفح بلا معالج رسوم
    await page.waitForFunction(() => { const r = document.getElementById("q-results"); return !r.hidden && r.innerHTML && !r.querySelector('[role="status"]'); }, null, { timeout: 20000 }).catch(() => {});
    const rows = await page.$$eval("#q-results .qr", (els) => els.slice(0, 3).map((e) => e.innerText.replace(/\s+/g, " ").trim()));
    const first = rows[0] ?? "";
    const ok = first.includes(want) && (!banned || !rows.some((r) => r.includes(banned)));
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "FAIL"} ${q} => ${JSON.stringify(first.slice(0, 70))}${banned ? ` (ممنوع بين الأوائل: ${banned})` : ""}`);
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failures ? `فشل ${failures} من ${CASES.length}` : `ناجح: ${CASES.length} من ${CASES.length}`);
process.exit(failures ? 1 : 0);
