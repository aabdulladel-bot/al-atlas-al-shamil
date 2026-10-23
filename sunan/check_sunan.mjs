// يتحقق من طبقة السنن ويبني ملف العرض web/data/sunan.json.
// يفشل إن لم يُعثر على اقتباس ابن خلدون في نصه، أو أحال شاهد إلى ادعاء غير موجود أو غير مطابق للنص أو مرفوض.
// "antecedents" (اختياري): صياغات سابقة للفكرة نفسها عند مؤلفين آخرين. تُعرض ولا تُحسب في قوة الشواهد.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkQuote } from "../pipeline/normalize.mjs";
import { claimEras } from "../scripts/lib/eras.mjs";

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
for (const era of claimEras(ROOT)) {
  for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, "verification", `era${era}`, "claims.json"), "utf8"))) claims.set(c.id, { ...c, era });
}

const errors = [];
const expandClaim = (id, extra) => {
  const c = claims.get(id);
  if (!c) { errors.push(`ادعاء غير موجود: ${id}`); return null; }
  if (c.checks.quote_match !== true) { errors.push(`ادعاء غير مطابق للنص: ${id}`); return null; }
  if (c.status === "rejected") { errors.push(`ادعاء مرفوض في المراجعة البشرية: ${id} (القرار في نقله أو إزالته للمراجِع لا للأداة)`); return null; }
  return { id, era: c.era, statement: c.statement, quote: c.quote, attributed_to: c.attributed_to, hedge: c.hedge, ...extra };
};
const checkKhaldun = (k, sid) => {
  const r = checkQuote(bodyOf(k.file), k.quote);
  if (r.status !== "ok") errors.push(`${sid}: اقتباس ابن خلدون ${r.status}: ${k.quote}`);
  return r.status;
};


// ---------- الاختبار الكمي (Seshat): الأرقام تُقرأ من ملف النتائج، والحكم يُشتق من فترة الثقة ----------
const seshatPath = path.join(ROOT, "analysis/seshat_results.json");
const seshat = fs.existsSync(seshatPath) ? JSON.parse(fs.readFileSync(seshatPath, "utf8")) : null;
const pct = (x) => `${Math.round(x * 100)}%`;
const times = (logDiff) => (10 ** logDiff).toFixed(1);
// قاعدة الحكم: فترة الثقة كلها في جهة الفرضية = يؤيد؛ كلها ضدها = لا يؤيد؛ غير ذلك = غير حاسم.
const verdictShare = (ci) => (ci[0] > 0.5 ? "يؤيد" : ci[1] < 0.5 ? "لا يؤيد" : "غير حاسم");
const verdictCoef = (ci) => (ci[0] > 0 ? "يؤيد (ارتباطاً)" : ci[1] < 0 ? "لا يؤيد" : "غير حاسم");
function quantitative(id) {
  if (!seshat) return [];
  const A = seshat.test_a_dynasty_age, B = seshat.test_b_trade_centers, C = seshat.test_c_crafts_urbanism;
  if (id === "sn_dynasty_age") {
    const g = A.all_states_merged, m = A.islamic_world_merged;
    return [
      { scope: "عالمياً", verdict: verdictShare(g.share_le_120_ci95),
        text: `${pct(g.share_le_120)} فقط من ${g.n} دولة لم تتجاوز 120 سنة (فترة الثقة ${pct(g.share_le_120_ci95[0])}–${pct(g.share_le_120_ci95[1])})، والوسيط ${g.median_years} سنة.` },
      { scope: "العالم الإسلامي تقريباً (بعد 650م)", verdict: verdictShare(m.share_le_120_ci95),
        text: `${pct(m.share_le_120)} من ${m.n} دولة لم تتجاوز 120 سنة (فترة الثقة ${pct(m.share_le_120_ci95[0])}–${pct(m.share_le_120_ci95[1])})، والوسيط ${m.median_years} سنة.` },
    ];
  }
  if (id === "sn_trade") {
    const names = { Market: "الأسواق", Port: "الموانئ", Road: "الطرق" };
    return B.controlled_for_population.results.map((r) => ({
      scope: names[r.x], verdict: verdictCoef(r.ci95),
      text: `مع ضبط حجم سكان الكيان والألفية، تكون أكبر مدينة أكبر بنحو ${times(r.coef)} مرة حيث توجد ${names[r.x]} (فترة الثقة ${times(r.ci95[0])}–${times(r.ci95[1])})، في ${r.n} كياناً.`,
    }));
  }
  if (id === "sn_knowledge") {
    const raw = C.cap_vs_info, r = C.controlled_for_population.results[0];
    return [
      { scope: "دون ضبط", verdict: verdictCoef(raw.overall_ci95),
        text: `ارتباط سبيرمان بين حجم أكبر مدينة ومؤشر المعلومات ${raw.overall_rho} (فترة الثقة ${raw.overall_ci95[0]}–${raw.overall_ci95[1]})، في ${raw.n} كياناً، ونحو ${raw.median_within_rho} داخل كل ألفية.` },
      { scope: "مع ضبط حجم السكان", verdict: verdictCoef(r.ci95),
        text: `يبقى الأثر موجباً لكنه صغير: كل تضاعف عشري في حجم المدينة يقترن بزيادة ${r.coef} في مؤشر المعلومات (من 0 إلى 1)، فترة الثقة ${r.ci95[0]}–${r.ci95[1]}.` },
    ];
  }
  return [];
}

const out = [];
for (const s of cfg.sunan) {
  const khaldun = s.khaldun.map((k) => ({ quote: k.quote, location: k.location, match: checkKhaldun(k, s.id) }));
  const supporting = s.supporting.map((x) => expandClaim(x.claim, { why: x.why })).filter(Boolean);
  const limiting = s.limiting.map((x) => {
    if (x.kind === "claim") return expandClaim(x.claim, { kind: "claim", note: x.note });
    if (x.kind === "khaldun") return { kind: "khaldun", quote: x.quote, location: x.location, note: x.note, match: checkKhaldun(x, s.id) };
    return { kind: "caution", note: x.note };
  }).filter(Boolean);
  const antecedents = (s.antecedents ?? []).map((x) => expandClaim(x.claim, { why: x.why })).filter(Boolean);
  const n = supporting.length;
  const strength = n >= 3 ? "شواهد متعددة" : n >= 1 ? "شواهد قليلة" : "بلا شواهد مؤيدة بعد";
  const eras = [...new Set([...supporting, ...limiting].filter((x) => x.era).map((x) => x.era))].sort((a, b) => a - b);
  const quant = quantitative(s.id);
  out.push({ id: s.id, name: s.name, hypothesis: s.hypothesis, khaldun, supporting, limiting, antecedents, modern: s.modern, strength, eras, quantitative: quant });
  console.log(`${s.name}: ابن خلدون ${khaldun.map((k) => k.match).join("/")}، مؤيد ${n}، مقيِّد ${limiting.length}${antecedents.length ? `، سوابق ${antecedents.length}` : ""}، الحقب ${eras.join(",") || "-"}${quant.length ? "، كمي: " + quant.map((q) => q.verdict).join("/") : ""}`);
}

if (errors.length) { console.error("أخطاء:\n" + errors.join("\n")); process.exit(1); }
fs.writeFileSync(path.join(ROOT, "web/data/sunan.json"), JSON.stringify({ _meta: { note: cfg._note, count: out.length, quantitative_source: seshat ? seshat._source : null }, sunan: out }, null, 2) + "\n");
console.log("كُتب web/data/sunan.json");
