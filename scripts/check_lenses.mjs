// يتحقق من كل عدسات الشواهد (sunan/lenses/*.json): كل شاهد موجود في الادعاءات، ونوع التصنيف معتمد في meta،
// ولا شاهد مكرر، وكل سبب مكتوب في 30 كلمة، والتخمينات (analysis) لا تُضاف إلا على «غير واضحة».
// ونسخة الموقع في web/data/lenses/ تطابق المصدر بالحرف. الاستعمال: node scripts/check_lenses.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimEras } from "./lib/eras.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "sunan/lenses");
const known = new Set();
for (const era of claimEras(ROOT)) for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, `verification/era${era}/claims.json`), "utf8"))) known.add(c.id);
const errors = [];
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), "utf8");
  const doc = JSON.parse(src);
  const TYPES = new Set(Object.keys(doc._meta.types));
  const seen = new Set();
  for (const e of doc.entries) {
    if (!known.has(e.claim)) errors.push(`${f} ${e.claim}: ليس ادعاءً موجوداً`);
    if (seen.has(e.claim)) errors.push(`${f} ${e.claim}: مكرر`);
    seen.add(e.claim);
    if (!TYPES.has(e.type)) errors.push(`${f} ${e.claim}: نوع غير معتمد ${e.type}`);
    if (!e.basis || e.basis.trim().split(/\s+/).length > 30) errors.push(`${f} ${e.claim}: السبب فارغ أو أطول من 30 كلمة`);
    if (e.analysis && e.type !== "unclear") errors.push(`${f} ${e.claim}: التخمين مسموح على «غير واضحة» فقط`);
  }
  const pub = path.join(ROOT, "web/data/lenses", f);
  if (!fs.existsSync(pub) || fs.readFileSync(pub, "utf8") !== src) errors.push(`${f}: نسخة الموقع لا تطابق المصدر`);
}
if (errors.length) { console.error(errors.join("\n")); console.error(`فشل فحص العدسات: ${errors.length} خطأ`); process.exit(1); }
console.log(`العدسات: مطابقة (${files.join("، ")})`);
