// فحص البحث: يشغّل دالة البحث نفسها في المتصفح على أسئلة القارئ المعتادة، ويتحقق أن أول نتيجة في المجموعة المتوقعة صحيحة.
// الأسئلة من تجربة صاحب المشروع (الأندلس، الأمويون، العباسيون، ابن خلدون، الحرير، روما...).
// الاستعمال: node scripts/search_check.mjs   (أو npm run test:search)
import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const PORT = 8766;

// كل حالة: السؤال، والمجموعة التي يُنتظر أن تظهر فيها النتيجة، ونمط عنوان أول نتيجة فيها
const CASES = [
  ["الأمويون", "entity", /الأموية/],
  ["الدولة الأموية", "entity", /الأموية/],
  ["روما", "entity", /الرومانية/],
  ["الأندلس", "region", /الأندلس/],
  ["بلاد الشام", "region", /الشام/],
  ["العباسيون", "absent", /عباس/],
  ["الدولة العباسية", "absent", /عباس/],
  ["المماليك", "absent", /مملوك|مماليك/],
  ["ابن خلدون", "sunna", /./],
  ["الحرير", "claim", /حرير/],
  ["بغداد", "place", /بغداد/],
  ["مكة", "place", /مكة/],
  ["الساميون", "people", /سامية|ساميون/],
  ["1492", "year", /1600/],
];

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: path.join(ROOT, "web"), stdio: "ignore" });
const fails = [];
try {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("atlas-intro-seen", "1"); } catch {} });
  for (let i = 0; i < 30; i++) {
    try { await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle", timeout: 60000 }); break; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  await page.waitForFunction(() => typeof search === "function" && document.querySelectorAll("#sunan-list button").length > 0, null, { timeout: 90000 });
  for (const [q, type, re] of CASES) {
    const groups = await page.evaluate(async (q) => (await search(q)).map(([t, list]) => [t, list.map((it) => it.title)]), q);
    const got = groups.find(([t]) => t === type);
    const first = got?.[1]?.[0];
    const ok = first != null && re.test(first);
    console.log(`${ok ? "✓" : "✗"} «${q}» → ${type}: ${first ?? "لا نتيجة"}`);
    if (!ok) fails.push(`«${q}»: المنتظر في «${type}» عنوان يطابق ${re}، والموجود: ${first ?? "لا شيء"} (المجموعات: ${groups.map(([t]) => t).join("، ") || "لا شيء"})`);
  }
  await browser.close();
} finally {
  server.kill();
}
if (fails.length) {
  console.error(`\nالبحث: ${fails.length} حالة لم تطابق`);
  for (const f of fails) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`\nالبحث: ${CASES.length} حالة مطابقة`);
