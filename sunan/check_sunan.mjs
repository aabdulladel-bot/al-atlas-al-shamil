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

// ---------- التقدير (verification/ESTIMATIVE.md): الاحتمال حكم مكتوب بسببه، والثقة تُحسب من الشواهد ودرجاتها ----------
const EST = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/config/estimative.json"), "utf8"));
const GR = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/claim_grades.json"), "utf8")).claims;
const SG = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/source_grades.json"), "utf8")).sources;
const LK = new Map(EST.likelihood.map((x, i) => [x.id, { ...x, rank: i }]));
const EVEN = LK.get("even").rank, LIKELY = LK.get("likely").rank;
const isDecisive = (v) => !v.startsWith("غير حاسم");
function assess(s, supporting, limiting, quant) {
  const a = s.assessment;
  if (!a) { errors.push(`${s.id}: بلا تقدير`); return null; }
  // وقائع مرجّحة أو مؤكدة: نطاقها واقعة، ودرجة معلومتها ≤ 2، ومصدرها في الدرجات المقبولة. الآراء الموافقة لا تُحسب وقائع
  const facts = supporting.filter((c) => {
    const g = GR[c.id];
    return g && g.scope === "fact" && g.info <= EST.fact_threshold.info_max && EST.fact_threshold.source_grades.includes(SG[g.source]?.grade);
  }).length;
  const views = supporting.filter((c) => GR[c.id]?.scope === "attribution").length;
  const decisive = quant.length > 0 && quant.every((q) => isDecisive(q.verdict));
  const confidence = facts >= 3 && decisive ? "high" : facts >= 3 || decisive ? "moderate" : "low";
  const basis = { facts, views, limiting: limiting.length, quant_total: quant.length, quant_decisive: quant.filter((q) => isDecisive(q.verdict)).length };
  if (a.likelihood === "unassessed") {
    if (supporting.length) errors.push(`${s.id}: لها شواهد مؤيدة ولم تُقدَّر`);
    return { likelihood: "unassessed", likelihood_ar: EST.unassessed, why: a.why, assumptions: [], confidence: null, basis, status: a.status };
  }
  const L = LK.get(a.likelihood);
  if (!L) { errors.push(`${s.id}: احتمال خارج المقياس ${a.likelihood}`); return null; }
  if (!supporting.length) errors.push(`${s.id}: قُدّر احتمالها بلا شواهد مؤيدة`);
  if (!a.why?.trim()) errors.push(`${s.id}: تقدير بلا سبب`);
  if (!a.assumptions?.length) errors.push(`${s.id}: تقدير بلا افتراضات مكتوبة`);
  // اتساق الحكم مع الاختبار الكمي: ما لا يؤيده اختبار لا يُرجَّح، وما يؤيده كل اختبار لا يُستبعد
  if (quant.some((q) => q.verdict === "لا يؤيد") && L.rank > EVEN) errors.push(`${s.id}: «${L.ar}» واختبار كمي لا يؤيدها`);
  if (quant.length && quant.every((q) => q.verdict.startsWith("يؤيد")) && L.rank < LIKELY) errors.push(`${s.id}: «${L.ar}» وكل اختباراتها الكمية تؤيدها`);
  return { likelihood: L.id, likelihood_ar: L.ar, range: L.range, confidence, confidence_ar: EST.confidence[confidence].ar, basis, why: a.why, assumptions: a.assumptions, status: a.status };
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
  const assessment = assess(s, supporting, limiting, quant);
  out.push({ id: s.id, name: s.name, hypothesis: s.hypothesis, khaldun, supporting, limiting, antecedents, modern: s.modern, strength, eras, quantitative: quant, assessment });
  console.log(`${s.name}: ابن خلدون ${khaldun.map((k) => k.match).join("/")}، مؤيد ${n}، مقيِّد ${limiting.length}${antecedents.length ? `، سوابق ${antecedents.length}` : ""}، الحقب ${eras.join(",") || "-"}${quant.length ? "، كمي: " + quant.map((q) => q.verdict).join("/") : ""}، التقدير: ${assessment ? `${assessment.likelihood_ar}${assessment.confidence ? "، " + assessment.confidence_ar : ""}` : "-"}`);
}

if (errors.length) { console.error("أخطاء:\n" + errors.join("\n")); process.exit(1); }
fs.writeFileSync(path.join(ROOT, "web/data/sunan.json"), JSON.stringify({ _meta: { note: cfg._note, count: out.length, quantitative_source: seshat ? seshat._source : null, estimative: { proposition: EST.proposition, likelihood: EST.likelihood, confidence: EST.confidence } }, sunan: out }, null, 2) + "\n");
console.log("كُتب web/data/sunan.json");
