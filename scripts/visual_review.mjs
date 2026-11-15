// مراجعة بصرية ثابتة: لقطات لشاشات محدّدة على الحاسوب والجوال، لتُفحص بالعين قبل كل دمج.
// تكتب لقطات منفردة وورقة واحدة مجمّعة في out/visual_review/ (مفهرسة بالأسماء)، ولا تغيّر شيئاً في المستودع.
// الاستعمال: node scripts/visual_review.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out", "visual_review");
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const PORT = 8787;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", path.join(ROOT, "web")], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));

const SHOTS = [];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const url = `http://127.0.0.1:${PORT}/`;
async function open(vp, name) {
  const p = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: "load" });
  await p.waitForTimeout(3500);
  await p.evaluate(() => document.getElementById("intro")?.remove());
  return p;
}
try {
  // 1) البطاقة مع كومة الشواهد مفتوحة، على الحاسوب والجوال
  for (const [vp, tag] of [[{ width: 1366, height: 860 }, "desk"], [{ width: 390, height: 844 }, "mob"]]) {
    const p = await open(vp, tag);
    await p.evaluate(async () => { await loadBorders(1600); await loadLinks(1600); openEntityCard({ properties: { NAME: "Ming Chinese Empire", BORDERPRECISION: 3 } }, "state"); });
    await p.waitForTimeout(2500);
    const pile = p.locator(".ev-pile").first();
    if (await pile.count()) {
      await pile.scrollIntoViewIfNeeded();
      await p.waitForTimeout(400);
      await pile.screenshot({ path: path.join(OUT, `card_pile_${tag}_closed.png`) });
      await pile.locator("summary").click();
      await p.waitForTimeout(800);
      await pile.screenshot({ path: path.join(OUT, `card_pile_${tag}_open.png`) });
      SHOTS.push(`card_pile_${tag}_open.png`, `card_pile_${tag}_closed.png`);
    }
    await p.close();
  }
  // 2) البحث بعبارة مركّبة، على الحاسوب
  {
    const p = await open({ width: 1366, height: 860 }, "search");
    await p.fill("#q", "ابن خلدون");
    await p.waitForTimeout(1200);
    await p.locator("#q-results").screenshot({ path: path.join(OUT, "search_desk.png") }).catch(() => {});
    SHOTS.push("search_desk.png");
    await p.close();
  }
  // 3) رحلة التجارة في منتصفها، على الجوال
  {
    const p = await open({ width: 390, height: 844 }, "journey");
    // على الجوال تكون اللوحة مطوية، فتُفتح أولاً كما يفعل القارئ، ثم تُفتح قائمة الرحلات
    await p.evaluate(() => { setPanelCollapsed(false); document.getElementById("journey-panel").open = true; });
    await p.waitForTimeout(800);
    await p.click('#journey-list button[data-journey="trade"]');
    await p.waitForSelector('#journey-box button[data-act="next"]', { timeout: 15000 });
    await p.waitForTimeout(1500);
    for (let i = 0; i < 4; i++) { await p.click('#journey-box button[data-act="next"]'); await p.waitForTimeout(900); }
    await p.screenshot({ path: path.join(OUT, "journey_trade_mob_step5.png") });
    SHOTS.push("journey_trade_mob_step5.png");
    await p.close();
  }
} finally {
  await browser.close();
  server.kill();
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ shots: SHOTS }, null, 1), "utf8");
console.log(`لقطات: ${SHOTS.length} في ${path.relative(ROOT, OUT)}`);
console.log(SHOTS.join("\n"));
