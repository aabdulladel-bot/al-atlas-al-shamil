// يتحقق من طبقة السنن ويبني ملف العرض web/data/sunan.json.
// يفشل إن لم يُعثر على اقتباس ابن خلدون في نصه، أو أحال شاهد إلى ادعاء غير موجود أو غير مطابق للنص.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkQuote } from "../pipeline/normalize.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "sunan/sunan.json"), "utf8"));
const srcDir = path.join(ROOT, cfg.khaldun_source);

// نص الفصل بعد قالب ويكي مصدر (روابط التنقل في القالب تكرر العناوين)
const bodyOf = (file) => {
  const t = fs.readFileSync(path.join(srcDir, file), "utf8");
  const i = t.indexOf("{{نثر}}");
  return (i >= 0 ? t.slice(i) : t).replace(/\s+/g, " ");
};

const claims = new Map();
for (const era of [1, 2, 3, 4, 5, 6]) {
  for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, "verification", `era${era}`, "claims.json"), "utf8"))) claims.set(c.id, { ...c, era });
}

const errors = [];
const expandClaim = (id, extra) => {
  const c = claims.get(id);
  if (!c) { errors.push(`ادعاء غير موجود: ${id}`); return null; }
  if (c.checks.quote_match !== true) { errors.push(`ادعاء غير مطابق للنص: ${id}`); return null; }
  return { id, era: c.era, statement: c.statement, quote: c.quote, attributed_to: c.attributed_to, hedge: c.hedge, ...extra };
};
const checkKhaldun = (k, sid) => {
  const r = checkQuote(bodyOf(k.file), k.quote);
  if (r.status !== "ok") errors.push(`${sid}: اقتباس ابن خلدون ${r.status}: ${k.quote}`);
  return r.status;
};

const out = [];
for (const s of cfg.sunan) {
  const khaldun = s.khaldun.map((k) => ({ quote: k.quote, location: k.location, match: checkKhaldun(k, s.id) }));
  const supporting = s.supporting.map((x) => expandClaim(x.claim, { why: x.why })).filter(Boolean);
  const limiting = s.limiting.map((x) => {
    if (x.kind === "claim") return expandClaim(x.claim, { kind: "claim", note: x.note });
    if (x.kind === "khaldun") return { kind: "khaldun", quote: x.quote, location: x.location, note: x.note, match: checkKhaldun(x, s.id) };
    return { kind: "caution", note: x.note };
  }).filter(Boolean);
  const n = supporting.length;
  const strength = n >= 3 ? "شواهد متعددة" : n >= 1 ? "شواهد قليلة" : "بلا شواهد مؤيدة بعد";
  const eras = [...new Set([...supporting, ...limiting].filter((x) => x.era).map((x) => x.era))].sort((a, b) => a - b);
  out.push({ id: s.id, name: s.name, hypothesis: s.hypothesis, khaldun, supporting, limiting, modern: s.modern, strength, eras });
  console.log(`${s.name}: ابن خلدون ${khaldun.map((k) => k.match).join("/")}، مؤيد ${n}، مقيِّد ${limiting.length}، الحقب ${eras.join(",") || "-"}`);
}

if (errors.length) { console.error("أخطاء:\n" + errors.join("\n")); process.exit(1); }
fs.writeFileSync(path.join(ROOT, "web/data/sunan.json"), JSON.stringify({ _meta: { note: cfg._note, count: out.length }, sunan: out }, null, 2) + "\n");
console.log("كُتب web/data/sunan.json");
