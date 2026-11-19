// يتحقق من عدسة المرجعية (sunan/lenses/authority.json): كل شاهد موجود في الادعاءات، ونوع التصنيف من الأنواع المعتمدة،
// وكل تصنيف له سبب مكتوب، ولا شاهد مكرر. فشل أي شرط يوقف الفحص. الاستعمال: node scripts/check_authority_lens.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimEras } from "./lib/eras.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "sunan/lenses/authority.json"), "utf8"));
const TYPES = new Set(Object.keys(doc._meta.types));
const known = new Set();
for (const era of claimEras(ROOT)) for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, `verification/era${era}/claims.json`), "utf8"))) known.add(c.id);
const errors = [];
const seen = new Set();
for (const e of doc.entries) {
  if (!known.has(e.claim)) errors.push(`${e.claim}: ليس ادعاءً موجوداً`);
  if (seen.has(e.claim)) errors.push(`${e.claim}: مكرر`);
  seen.add(e.claim);
  if (!TYPES.has(e.type)) errors.push(`${e.claim}: نوع غير معتمد ${e.type}`);
  if (!e.basis || e.basis.trim().split(/\s+/).length > 30) errors.push(`${e.claim}: السبب فارغ أو أطول من 30 كلمة`);
}
if (errors.length) { console.error(errors.join("\n")); console.error(`فشل فحص عدسة المرجعية: ${errors.length} خطأ`); process.exit(1); }
console.log(`عدسة المرجعية: مطابقة، ${doc.entries.length} شاهداً`);

// نسخة الموقع يجب أن تطابق المصدر بالحرف، فلا يُعرض تصنيف لم يُراجَع في المصدر
const src = fs.readFileSync(path.join(ROOT, "sunan/lenses/authority.json"), "utf8");
const pub = fs.readFileSync(path.join(ROOT, "web/data/lenses/authority.json"), "utf8");
if (src !== pub) { console.error("نسخة web/data/lenses/authority.json لا تطابق sunan/lenses/authority.json"); process.exit(1); }
