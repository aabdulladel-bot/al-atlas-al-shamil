// يبني ملفات الادعاءات للعرض في الواجهة: ادعاء واحد لكل سطر، ولا يُعرض إلا ما طابق نصه (quote_match) ولم يُرفض في المراجعة.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimEras } from "./lib/eras.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "web/data");
fs.mkdirSync(OUT, { recursive: true });

// مجال كل ادعاء (verification/claim_domains.json، بتصنيف scripts/config/domains.json)
const domainsOf = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/claim_domains.json"), "utf8")).claims;
// تقييم المصدر والمعلومة (verification/GRADING.md): حرف المصدر ورقم المعلومة ونطاقها وسببهما
const sourceGrades = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/source_grades.json"), "utf8")).sources;
const claimGrades = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/claim_grades.json"), "utf8")).claims;
const gradeOf = (c, sid) => {
  const g = claimGrades[c.id];
  return g && sourceGrades[sid] ? { source: sid, info: g.info, scope: g.scope, why: g.why, status: g.status, ...(g.review ? { review: g.review } : {}) } : null;
};
const index = [];
const grades = {};
for (const era of claimEras(ROOT)) {
  const dir = path.join(ROOT, "verification", `era${era}`);
  const claims = JSON.parse(fs.readFileSync(path.join(dir, "claims.json"), "utf8"));
  const passages = new Map(JSON.parse(fs.readFileSync(path.join(dir, "passages.json"), "utf8")).map((p) => [p.id, p]));
  for (const c of claims) if (c.checks.quote_match === true && c.status !== "rejected") grades[c.id] = gradeOf(c, passages.get(c.passage_id)?.source_id);
  const shown = claims
    .filter((c) => c.checks.quote_match === true && c.status !== "rejected")
    .map((c) => ({
      id: c.id,
      statement: c.statement,
      quote: c.quote,
      attributed_to: c.attributed_to,
      layer: c.layer,
      type: c.type,
      hedge: c.hedge,
      chapter: passages.get(c.passage_id)?.chapter ?? null,
      domains: domainsOf[c.id]?.domains ?? [],
      domains_status: domainsOf[c.id]?.status ?? null,
      reviewed: c.status === "verified",
    }));
  const out = {
    _meta: {
      era,
      count: shown.length,
      status: "مسودة: تُعرض بعد مطابقة الاقتباس بالنص، وما زالت قيد المراجعة",
    },
    claims: shown,
  };
  fs.writeFileSync(path.join(OUT, `claims_era${era}.json`), JSON.stringify(out, null, 2) + "\n");
  console.log(`حقبة ${era}: ${shown.length} ادعاء`);
  index.push({ era, count: shown.length });
}
fs.writeFileSync(path.join(OUT, "claims_index.json"), JSON.stringify(index) + "\n");
// المجالات للواجهة: التصنيف، ومجال كل ادعاء معروض، وعدد ادعاءات كل مجال
const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/domains.json"), "utf8")).domains;
const shownIds = new Set();
for (const era of claimEras(ROOT)) for (const c of JSON.parse(fs.readFileSync(path.join(OUT, `claims_era${era}.json`), "utf8")).claims) shownIds.add(c.id);
const domClaims = Object.fromEntries(Object.entries(domainsOf).filter(([id]) => shownIds.has(id)).map(([id, v]) => [id, v.domains]));
const counts = Object.fromEntries(taxonomy.map((d) => [d.id, Object.values(domClaims).filter((ds) => ds.includes(d.id)).length]));
fs.writeFileSync(path.join(OUT, "domains.json"), JSON.stringify({ _meta: { source: "scripts/config/domains.json وverification/claim_domains.json", status: "تصنيف بمراجعة مفوَّضة إلى النموذج بتكليف صاحب المشروع: تصنيفان مستقلان والحسم بقاعدة مكتوبة (verification/REVIEW_2026-11-24.md)" }, domains: taxonomy, counts, claims: domClaims }) + "\n");
console.log(`المجالات: ${Object.keys(domClaims).length} ادعاء مصنّف`);
// مقياس التقييم للواجهة (scripts/config/admiralty.json)
// ودرجة كل ادعاء معروض بمعرّفه، فتجدها كل بطاقة أياً كان طريق الادعاء إليها (الحقب، والمواضع، والسنن، والروابط المكانية)
fs.writeFileSync(path.join(OUT, "grading.json"), JSON.stringify({ scale: JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/admiralty.json"), "utf8")), sources: Object.fromEntries([...new Set(Object.values(grades).filter(Boolean).map((g) => g.source))].sort().map((sid) => [sid, sourceGrades[sid]])), claims: grades }) + "\n");
console.log(`التقييم: ${Object.values(grades).filter(Boolean).length} ادعاء مقيَّم`);
