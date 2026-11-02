// يتحقق من العدسات (scripts/config/lenses.json) ويبني web/data/lenses.json للواجهة.
// كل حقل يُفحص مقابل الأطلس نفسه: الطبقات من وسوم data-group في index.html، والأزمنة من ملفات الحدود،
// والسُّنن من sunan/sunan.json. فشل أي حقل يوقف البناء.
// الاستعمال: node scripts/build_lenses.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/lenses.json"), "utf8"));
const html = fs.readFileSync(path.join(ROOT, "web/index.html"), "utf8");
const groups = new Set([...html.matchAll(/data-group="([a-z]+)"/g)].map((m) => m[1]));
const bordersDir = path.join(ROOT, "web/data/borders");
const times = new Set(fs.readdirSync(bordersDir).map((f) => /^borders_(-?\d+)\.geojson$/.exec(f)?.[1]).filter(Boolean));
if (fs.existsSync(path.join(bordersDir, "modern_countries.geojson"))) times.add("modern");
const sunanIds = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "sunan/sunan.json"), "utf8")).sunan.map((s) => s.id));
const errors = [];
const ids = new Set();

if (!Array.isArray(cfg.lenses) || cfg.lenses.length < 2) errors.push("يلزم عدستان على الأقل");
for (const L of cfg.lenses ?? []) {
  const where = `عدسة «${L.id}»`;
  if (!/^[a-z]+$/.test(L.id ?? "")) errors.push(`${where}: المعرّف أحرف إنجليزية صغيرة فقط`);
  if (ids.has(L.id)) errors.push(`${where}: معرّف مكرر`);
  ids.add(L.id);
  if (!L.ar?.trim()) errors.push(`${where}: الاسم العربي فارغ`);
  if (!L.about?.trim()) errors.push(`${where}: الوصف فارغ`);
  for (const [g, on] of Object.entries(L.layers ?? {})) {
    if (!groups.has(g)) errors.push(`${where}: طبقة «${g}» غير موجودة في index.html`);
    if (typeof on !== "boolean") errors.push(`${where}: قيمة الطبقة «${g}» ليست true أو false`);
  }
  if (!L.layers || Object.keys(L.layers).length < 3) errors.push(`${where}: يلزم تحديد ثلاث طبقات على الأقل`);
  const t = String(L.time);
  if (!times.has(t)) errors.push(`${where}: الزمن «${L.time}» لا خريطة له في web/data/borders`);
  if (L.sunna != null && !sunanIds.has(L.sunna)) errors.push(`${where}: السُّنّة «${L.sunna}» غير موجودة في sunan/sunan.json`);
  if (!Array.isArray(L.questions) || L.questions.length < 2 || L.questions.length > 4) errors.push(`${where}: يلزم بين سؤالين وأربعة أسئلة`);
  for (const q of L.questions ?? []) if (!q.trim().endsWith("؟")) errors.push(`${where}: السؤال «${q}» لا ينتهي بعلامة استفهام`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

const out = JSON.stringify({ _meta: { note: "مولَّد من scripts/config/lenses.json. لا يُعدَّل يدوياً." }, lenses: cfg.lenses.map(({ id, ar, about, layers, time, sunna, questions }) => ({ id, ar, about, layers, time, sunna: sunna ?? null, questions })) }, null, 1) + "\n";
const target = path.join(ROOT, "web/data/lenses.json");
if (process.argv.includes("--check")) {
  const cur = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (cur !== out) { console.error("web/data/lenses.json لا يطابق مولّده: شغّل npm run build:lenses"); process.exit(1); }
  console.log(`العدسات: ${cfg.lenses.length} عدسة، مطابقة`);
} else {
  fs.writeFileSync(target, out);
  console.log(`العدسات: ${cfg.lenses.length} عدسة`);
}
