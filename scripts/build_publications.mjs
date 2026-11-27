// يولّد أوراق التقدير الداخلية (analysis/publications/*.md) من الشواهد الموثّقة والسنن، بإعداد analysis/publications/papers.json.
// كل ما في الورقة مولَّد إلا العنوان والسؤال ونص «النقد المحرَّر»، وهي تُعرض منفصلة ومعلَّمة بأنها رأي لا شاهد.
// المصادر: web/data/sunan.json (التقدير والثقة المحسوبة والشواهد والاختبارات)، وweb/data/grading.json (درجات الادعاءات)،
// وanalysis/foresight/scenarios.json (صلة السنن بالسيناريوهات). لا رقم يُكتب في الإعداد يدوياً.
// الفحص: كل سُنّة في ورقة واحدة على الأقل، ولكل ورقة نقد محرَّر، ولا أرقام في النصوص المكتوبة، والمخرجات تطابق مولّدها.
// الاستعمال: node scripts/build_publications.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const CHECK = process.argv.includes("--check");
const DIR = path.join(ROOT, "analysis/publications");

const P = read("analysis/publications/papers.json");
const web = new Map(read("web/data/sunan.json").sunan.map((s) => [s.id, s]));
const grading = read("web/data/grading.json");
const scen = read("analysis/foresight/scenarios.json");
const errors = [];

// 1) الإعداد
const NUM = /[0-9٠-٩]/;
const ids = new Set();
for (const p of P.papers) {
  if (ids.has(p.id)) errors.push(`ورقة مكررة: ${p.id}`);
  ids.add(p.id);
  if (!p.title || !p.question) errors.push(`${p.id}: بلا عنوان أو سؤال`);
  if (!p.sunan?.length) errors.push(`${p.id}: بلا سنن`);
  for (const s of p.sunan ?? []) if (!web.has(s)) errors.push(`${p.id}: سُنّة غير موجودة ${s}`);
  if (!p.red_team || p.red_team.length < 80) errors.push(`${p.id}: النقد المحرَّر غائب أو قصير جداً`);
  for (const [k, t] of [["title", p.title], ["question", p.question], ["red_team", p.red_team]]) if (NUM.test(t ?? "")) errors.push(`${p.id}.${k}: رقم مكتوب يدوياً`);
}
for (const id of web.keys()) if (!P.papers.some((p) => p.sunan.includes(id))) errors.push(`سُنّة لا تغطيها أي ورقة: ${id}`);
if (errors.length) { console.error(`الإصدارات: ${errors.length} خطأ`); for (const e of errors) console.error("  - " + e); process.exit(1); }

// 2) التوليد
const SCOPE = { fact: "واقعة", attribution: "نسبة" };
const gradeCode = (cid) => {
  const g = grading.claims[cid];
  if (!g) return "بلا درجة";
  return `${grading.sources[g.source]?.grade ?? "?"}${g.info} (${SCOPE[g.scope] ?? g.scope})`;
};
const disagreed = (cid) => grading.claims[cid]?.review && grading.claims[cid].review.agree === false;
const weak = (cid) => (grading.claims[cid]?.info ?? 6) >= 3 || ["D", "E", "F"].includes(grading.sources[grading.claims[cid]?.source]?.grade);
const esc = (t) => String(t ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
const sourceOf = (cid) => grading.claims[cid]?.source;

function paper(p) {
  const S = p.sunan.map((id) => web.get(id));
  const claimIds = new Set(S.flatMap((s) => [...s.supporting.map((x) => x.id), ...s.limiting.filter((x) => x.kind === "claim").map((x) => x.id)]));
  const sources = new Map();
  for (const s of S) for (const x of [...s.supporting, ...s.limiting.filter((l) => l.kind === "claim")]) {
    const sid = sourceOf(x.id);
    if (sid && !sources.has(sid)) sources.set(sid, x.attributed_to);
  }
  const L = [];
  L.push(`# ورقة تقدير: ${p.title}`, "");
  L.push("> **تحليل مولَّد من الشواهد، لا نبوءة ولا رأي كاتب.** كل ما في الورقة مولَّد من الادعاءات الموثّقة والسنن، إلا العنوان والسؤال وقسم «النقد المحرَّر»، وهو معلَّم بأنه رأي. والورقة داخلية لا تُنشر قبل بوابة التراخيص وقرار صاحب المشروع.", "");
  L.push(`**السؤال:** ${p.question}`, "");
  L.push(`**الحالة:** ${P._meta.status}. **الأساس:** ادعاءات موثّقة: ${claimIds.size}، مصادرها: ${sources.size}، السنن: ${S.length}.`, "");
  L.push("## الخلاصة", "");
  L.push("| السُّنّة | الاحتمال | الثقة | وقائع | آراء موافقة | مقيِّد | اختبارات حاسمة |", "|---|---|---|---|---|---|---|");
  for (const s of S) {
    const a = s.assessment, b = a.basis ?? {};
    L.push(`| ${s.name} | ${a.likelihood_ar ?? "لم يُقدَّر"} | ${a.confidence_ar ?? "—"} | ${b.facts ?? 0} | ${b.views ?? 0} | ${b.limiting ?? 0} | ${b.quant_decisive ?? 0} من ${b.quant_total ?? 0} |`);
  }
  L.push("", "## الأحكام الرئيسة", "");
  for (const s of S) {
    const a = s.assessment;
    L.push(`### ${s.name}`, "", `**الفرضية:** ${s.hypothesis}`, "");
    L.push(`**الحكم:** ${a.likelihood_ar ?? "لم يُقدَّر"}${a.confidence_ar ? `، ب${a.confidence_ar}` : ""}. ${a.why ?? ""}`, "");
    if (a.assumptions?.length) L.push("**الافتراضات:**", ...a.assumptions.map((x) => `- ${x}`), "");
    L.push("**نص ابن خلدون:**", ...s.khaldun.map((k) => `- «${k.quote}» (${k.location})`), "");
  }
  L.push("## الأدلة", "");
  for (const s of S) {
    L.push(`### ${s.name}`, "", "**المؤيدة:**", "");
    L.push("| الادعاء | المصدر | الدرجة | الاقتباس |", "|---|---|---|---|");
    for (const x of s.supporting) L.push(`| ${esc(x.statement)} (${x.id}) | ${esc(x.attributed_to)} | ${gradeCode(x.id)} | «${esc(x.quote)}» |`);
    const lim = s.limiting.filter((x) => x.kind === "claim");
    if (lim.length) {
      L.push("", "**المقيِّدة:**", "", "| الادعاء | المصدر | الدرجة | وجه التقييد |", "|---|---|---|---|");
      for (const x of lim) L.push(`| ${esc(x.statement)} (${x.id}) | ${esc(x.attributed_to)} | ${gradeCode(x.id)} | ${esc(x.note)} |`);
    }
    if (s.quantitative?.length) {
      L.push("", "**الاختبارات الكمية (Seshat، ارتباطية لا سببية):**", ...s.quantitative.map((q) => `- ${q.scope}: ${q.verdict}. ${q.text}`));
    }
    L.push("");
  }
  const links = scen.scenarios.flatMap((sc) => sc.implications.filter((i) => p.sunan.includes(i.sunna)).map((i) => ({ sc, i })));
  if (links.length) {
    L.push("## الصلة بالاستشراف", "", "قراءات السنن في سيناريوهات `analysis/foresight/`، وهي شرطية:", "");
    for (const { sc, i } of links) L.push(`- **${sc.name}** (${web.get(i.sunna).name}): ${i.reading}`);
    L.push("");
  }
  L.push("## فجوات المعلومات", "");
  const gaps = [];
  for (const s of S) {
    if (s.assessment.confidence !== "high") gaps.push(`${s.name}: الثقة ${s.assessment.confidence_ar ?? "غير محسوبة"}.`);
    if (!s.quantitative?.length) gaps.push(`${s.name}: لا اختبار كمي.`);
  }
  L.push(...(gaps.length ? gaps.map((g) => `- ${g}`) : ["- لا فجوات محسوبة."]), "");
  L.push("## قسم الفريق الأحمر", "");
  L.push("### ما يُضعف هذه الأحكام (مولَّد)", "");
  const red = [];
  for (const s of S) for (const x of s.limiting) red.push(`${s.name}: ${x.note}${x.kind === "claim" ? ` (${x.id}، ${gradeCode(x.id)})` : ""}`);
  for (const s of S) for (const x of s.supporting) if (weak(x.id)) red.push(`${s.name}: شاهد مؤيد ضعيف الدرجة (${x.id}، ${gradeCode(x.id)}): ${x.statement}`);
  const dis = [...claimIds].filter(disagreed).sort();
  if (dis.length) red.push(`ادعاءات اختلف فيها التقييمان المستقلان، وحُسم كل خلاف بسبب مكتوب (عددها ${dis.length}): ${dis.join("، ")}.`);
  for (const s of S) if (s.assessment.review?.agree === false) red.push(`${s.name}: اختلف التقديران المستقلان، والحسم: ${s.assessment.review.resolution}`);
  L.push(...red.map((r) => `- ${r}`), "");
  L.push("### نقد محرَّر (رأي، لا مولَّد من الشواهد)", "", `> ${p.red_team}`, "");
  L.push("## المصادر", "", "| المعرّف | الإسناد | درجة المصدر |", "|---|---|---|");
  for (const [sid, att] of [...sources.entries()].sort()) L.push(`| ${sid} | ${esc(att)} | ${grading.sources[sid]?.grade ?? "?"} |`);
  L.push("", "الدرجات بنظام الأدميرالية (`verification/GRADING.md`)، والاحتمال والثقة باللغة التقديرية الموحدة (`verification/ESTIMATIVE.md`). وتراخيص المصادر في `LICENSES.md`.", "");
  return L.join("\n");
}

const out = new Map();
for (const p of P.papers) out.set(`${p.id}.md`, paper(p));
const idx = ["# أوراق التقدير (داخلية)", "", "مولَّدة بـ `node scripts/build_publications.mjs` من `analysis/publications/papers.json`. لا تُنشر قبل بوابة التراخيص وقرار صاحب المشروع.", "", "| الورقة | السؤال | السنن |", "|---|---|---|",
  ...P.papers.map((p) => `| [${p.title}](${p.id}.md) | ${p.question} | ${p.sunan.map((id) => web.get(id).name).join("، ")} |`), ""].join("\n");
out.set("README.md", idx);

if (CHECK) {
  const bad = [...out].filter(([f, t]) => !fs.existsSync(path.join(DIR, f)) || fs.readFileSync(path.join(DIR, f), "utf8") !== t).map(([f]) => f);
  if (bad.length) { console.error(`الإصدارات لا تطابق مولّدها: ${bad.join("، ")}. شغّل node scripts/build_publications.mjs`); process.exit(1); }
  console.log(`الإصدارات: مطابقة (${P.papers.length} أوراق، ${web.size} سُنّة مغطّاة)`);
} else {
  for (const [f, t] of out) fs.writeFileSync(path.join(DIR, f), t);
  console.log(`كُتبت ${P.papers.length} أوراق تقدير وفهرسها في analysis/publications/، ${web.size} سُنّة مغطّاة`);
}
