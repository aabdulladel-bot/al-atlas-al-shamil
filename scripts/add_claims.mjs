// يضيف ادعاءات من ملف مواصفات، ولا يحفظ شيئاً إلا إذا نجحت كل الشروط لكل البنود.
// الاستعمال: node scripts/add_claims.mjs <spec.json> [--dry-run]
//
// شكل ملف المواصفات:
// {
//   "era": 7,
//   "source": { "source_id": "tocqueville-reeve", "file": "verification/era7/tocqueville.txt",
//               "attributed_to": "...", "chapter": "عنوان افتراضي للمقاطع" },
//   "items": [ { "slug": "associations", "quote": "نص حرفي من الملف", "statement": "الادعاء بالعربية",
//                "type": "judgment", "layer": "contemporary_witness", "hedge": "التحفظ",
//                "chapter": "اختياري", "mentions": { "places": [], "persons": [], "dates": [] } } ]
// }
//
// الشروط: الاقتباس موجود في الملف مرة واحدة بالضبط (بعد توحيد المسافات)، ويطابق بـ checkQuote،
// والادعاء صالح بالمدقق الرسمي، والمعرّفات تبدأ بعد أكبر معرّف مستعمل في كل الحقب.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { checkQuote } from "../pipeline/normalize.mjs";
import { validateItems } from "../pipeline/validate.mjs";
import { claimEras } from "./lib/eras.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [specPath, flag] = process.argv.slice(2);
if (!specPath) { console.error("الاستعمال: node scripts/add_claims.mjs <spec.json> [--dry-run]"); process.exit(2); }
const dry = flag === "--dry-run";
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const errors = [];

const squash = (s) => s.replace(/\s+/g, " ").trim();
const srcFile = path.join(ROOT, spec.source.file);
if (!fs.existsSync(srcFile)) { console.error(`ملف المصدر غير موجود: ${spec.source.file}`); process.exit(1); }
const text = squash(fs.readFileSync(srcFile, "utf8"));

let maxId = 0;
const existingPassageIds = new Set();
for (const era of claimEras(ROOT)) {
  const dir = path.join(ROOT, "verification", `era${era}`);
  for (const c of JSON.parse(fs.readFileSync(path.join(dir, "claims.json"), "utf8"))) maxId = Math.max(maxId, Number(c.id.slice(3)));
  const pf = path.join(dir, "passages.json");
  if (fs.existsSync(pf)) for (const p of JSON.parse(fs.readFileSync(pf, "utf8"))) existingPassageIds.add(p.id);
}

const passages = [], claims = [];
let next = maxId + 1;
for (const it of spec.items) {
  const q = squash(it.quote);
  let count = 0, at = -1;
  for (let i = text.indexOf(q); i >= 0; i = text.indexOf(q, i + 1)) { count++; if (at < 0) at = i; }
  if (count === 0) { errors.push(`${it.slug}: الاقتباس غير موجود في الملف. انسخه من الملف نفسه (انتبه لأشكال الحروف وأخطاء OCR وتقسيم الأسطر).`); continue; }
  if (count > 1) { errors.push(`${it.slug}: الاقتباس يتكرر ${count} مرات، فأطِله ليصبح فريداً.`); continue; }
  const start = text.lastIndexOf(" ", Math.max(0, at - 400)) + 1;
  const endSpace = text.indexOf(" ", at + q.length + 400);
  const ptext = text.slice(start, endSpace < 0 ? text.length : endSpace);
  const pid = `${spec.source.source_id}:${it.slug}`;
  if (existingPassageIds.has(pid) || passages.some((p) => p.id === pid)) { errors.push(`${it.slug}: معرّف المقطع ${pid} مستعمل، فغيّر slug.`); continue; }
  const r = checkQuote(ptext, q);
  if (r.status !== "ok") { errors.push(`${it.slug}: checkQuote أعاد ${r.status}`); continue; }
  passages.push({ id: pid, source_id: spec.source.source_id, volume: null, page: null, para: null, chapter: it.chapter || spec.source.chapter, text: ptext, text_hash: crypto.createHash("sha256").update(ptext).digest("hex") });
  claims.push({
    id: "cl_" + String(next++).padStart(9, "0"), passage_id: pid, quote: q, statement: it.statement, type: it.type, layer: it.layer,
    attributed_to: it.attributed_to || spec.source.attributed_to, isnad: null, hedge: it.hedge, author_preference: null,
    mentions: { places: [], persons: [], dates: [], ...(it.mentions || {}) }, links: {},
    checks: { quote_match: true, meaning: { status: "self_reviewed", reviewer: `pilot-era${spec.era}` },
      pass_agreement: { status: "not_run", classification_agree: false, runs: 1, rule: "content-first-v1" }, verified_by: `pilot-era${spec.era}` },
    status: "draft", version: 1,
  });
}
for (const v of validateItems("Claim", claims)) if (!v.ok) errors.push(`${claims[v.index].id}: المخطط: ${JSON.stringify(v.errors.slice(0, 2))}`);
for (const c of claims) {
  if (!c.statement || !c.hedge || !c.attributed_to) errors.push(`${c.id}: statement وhedge وattributed_to إلزامية`);
}

if (errors.length) { console.error("لم يُحفظ شيء. الأخطاء:\n" + errors.join("\n")); process.exit(1); }
for (const c of claims) console.log(`ok ${c.id} ${c.passage_id} :: ${c.quote.slice(0, 70)}`);
if (dry) { console.log(`تجربة فقط: ${claims.length} ادعاء جاهز، لم يُحفظ شيء.`); process.exit(0); }

const dir = path.join(ROOT, "verification", `era${spec.era}`);
fs.mkdirSync(dir, { recursive: true });
const load = (f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) : []);
const P = load("passages.json"), C = load("claims.json");
P.push(...passages); C.push(...claims);
fs.writeFileSync(path.join(dir, "passages.json"), JSON.stringify(P, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "claims.json"), JSON.stringify(C, null, 2) + "\n");
console.log(`حُفظ ${claims.length} ادعاء في era${spec.era} (المجموع فيها ${C.length}).`);
