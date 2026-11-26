// يبني تقرير الاستشراف الداخلي (analysis/foresight/SCENARIOS.md) من analysis/foresight/scenarios.json.
// لا يُكتب في هذا الملف أي لفظ احتمال: تقدير كل سُنّة يُقرأ من sunan/sunan.json، فلا يتعارض التقرير مع التقدير.
// يفحص: الإحالات إلى السنن والمحاور والإشارات، واكتمال المصفوفة 2×2، ووجود النقد المضاد لكل سيناريو،
// وتغطية كل السنن، وخلو النصوص من الأرقام المكتوبة يدوياً. النص المرسل من ألفاظ الاحتمال يفحصه check_estimative.mjs.
// الاستعمال: node scripts/build_scenarios.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const CHECK = process.argv.includes("--check");
const SRC = "analysis/foresight/scenarios.json";
const OUT = path.join(ROOT, "analysis/foresight/SCENARIOS.md");

const S = read(SRC);
const sunan = read("sunan/sunan.json").sunan;
const EST = read("scripts/config/estimative.json");
const sunaById = new Map(sunan.map((s) => [s.id, s]));
const likelihoodAr = new Map(EST.likelihood.map((l) => [l.id, l.ar]));
const errors = [];
const err = (m) => errors.push(m);

// 1) الوصف المنهجي
if (S._meta?.type !== "analysis") err("_meta.type يجب أن يكون analysis");
if (S._meta?.not_prophecy !== true) err("_meta.not_prophecy يجب أن يكون true: الاستشراف تحليل لا نبوءة");

// 2) الإحالات إلى السنن
const refSunna = (ids, where) => {
  for (const id of ids ?? []) if (!sunaById.has(id)) err(`${where}: سُنّة غير موجودة: ${id}`);
};
for (const d of S.drivers) refSunna(d.sunna, `محرك ${d.id}`);
for (const sg of S.signposts) refSunna(sg.sunna, `إشارة ${sg.id}`);
for (const sc of S.scenarios) for (const im of sc.implications) refSunna([im.sunna], `سيناريو ${sc.id}`);

// 3) المحاور والإشارات
const uById = new Map(S.uncertainties.map((u) => [u.id, u]));
const driverIds = new Set(S.drivers.map((d) => d.id));
for (const u of S.uncertainties) {
  if (u.poles.length !== 2) err(`محور ${u.id}: يجب أن يكون له قطبان بالضبط`);
  for (const d of u.drivers) if (!driverIds.has(d)) err(`محور ${u.id}: محرك غير موجود ${d}`);
}
for (const sg of S.signposts) {
  const u = uById.get(sg.uncertainty);
  if (!u) err(`إشارة ${sg.id}: محور غير موجود ${sg.uncertainty}`);
  else if (!u.poles.some((p) => p.id === sg.pole)) err(`إشارة ${sg.id}: قطب غير موجود ${sg.pole}`);
}

// 4) المصفوفة 2×2 كاملة دون تكرار، ولكل سيناريو نقد مضاد
const expected = S.uncertainties.reduce((n, u) => n * u.poles.length, 1);
if (S.scenarios.length < 3) err(`يجب أن يكون في الاستشراف ثلاثة سيناريوهات على الأقل، والموجود ${S.scenarios.length}`);
if (S.scenarios.length !== expected) err(`المصفوفة ناقصة: ${S.scenarios.length} من ${expected} تركيبة`);
const seenCombo = new Set();
const seenId = new Set();
for (const sc of S.scenarios) {
  if (seenId.has(sc.id)) err(`معرّف سيناريو مكرر: ${sc.id}`);
  seenId.add(sc.id);
  for (const u of S.uncertainties) {
    if (!u.poles.some((p) => p.id === sc.poles?.[u.id])) err(`سيناريو ${sc.id}: لا قطب صالح للمحور ${u.id}`);
  }
  const combo = S.uncertainties.map((u) => sc.poles?.[u.id]).join("|");
  if (seenCombo.has(combo)) err(`سيناريو ${sc.id}: تركيبة مكررة`);
  seenCombo.add(combo);
  if (!sc.implications?.length) err(`سيناريو ${sc.id}: بلا آثار`);
  if (!sc.counter?.length) err(`سيناريو ${sc.id}: بلا نقد مضاد (counter)`);
  if (!sc.falsifiers?.length) err(`سيناريو ${sc.id}: بلا ما يُبطله (falsifiers)`);
  if (!sc.red_team || sc.red_team.length < 40) err(`سيناريو ${sc.id}: قسم النقد الأحمر غائب أو قصير جداً`);
}
if (!S.global_red_team?.length) err("يجب أن يكون للاستشراف نقد أحمر عام");

// 5) تغطية كل السنن: كل سُنّة تظهر في محرك أو إشارة أو أثر
const used = new Set([
  ...S.drivers.flatMap((d) => d.sunna),
  ...S.signposts.flatMap((s) => s.sunna),
  ...S.scenarios.flatMap((sc) => sc.implications.map((i) => i.sunna)),
]);
for (const s of sunan) if (!used.has(s.id)) err(`سُنّة غير مغطاة في الاستشراف: ${s.id}`);

// 6) لا أرقام مكتوبة يدوياً في النصوص (الأرقام تُولَّد من السنن، أو تُحذف)
const NUM = /[0-9٠-٩]/;
const walk = (v, where) => {
  if (typeof v === "string") { if (NUM.test(v)) err(`${where}: رقم مكتوب يدوياً في النص: «${v.slice(0, 60)}…»`); }
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
};
walk({ ...S, _meta: undefined }, "scenarios");

if (errors.length) {
  console.error(`الاستشراف: ${errors.length} خطأ`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

// 7) التقرير المولَّد
const lik = (id) => {
  const a = sunaById.get(id)?.assessment;
  if (!a?.likelihood || a.likelihood === "unassessed") return "لم يُقدَّر بعد";
  return likelihoodAr.get(a.likelihood) ?? "لم يُقدَّر بعد";
};
const nameOf = (id) => sunaById.get(id)?.name ?? id;
const L = [];
L.push("# الاستشراف: سيناريوهات تحليلية داخلية", "");
L.push("> **تحليل لا نبوءة.** كل سيناريو شرطي: «إن صدقت السنن التي يبني عليها». وهذا التقرير داخلي، لا يُنشر على الموقع قبل بوابة التراخيص (`npm run check:launch`).", "");
L.push(`**الوضع:** ${S._meta.status}. **الأفق الزمني:** غير محدد عمداً، لأن السنن لا تحمل مواعيد. **المنهج:** ${S._meta.method}`, "");
L.push("## المحركات", "");
L.push("| المحرك | النوع | السنن | لماذا |", "|---|---|---|---|");
for (const d of S.drivers) L.push(`| ${d.name} | ${d.kind === "constant" ? "ثابت في كل السيناريوهات" : "متغير"} | ${d.sunna.map(nameOf).join("، ")} | ${d.why} |`);
L.push("", "## المحوران الحاسمان", "");
for (const u of S.uncertainties) L.push(`- **${u.name}**: ${u.poles.map((p) => p.ar).join(" / ")}. ${u.note}`);
L.push("", "## الإشارات التي تُرصد", "");
for (const sg of S.signposts) L.push(`- **${uById.get(sg.uncertainty).poles.find((p) => p.id === sg.pole).ar}** (${sg.id}): ${sg.observable} السنن: ${sg.sunna.map(nameOf).join("، ")}.`);
L.push("", "## السيناريوهات", "");
for (const sc of S.scenarios) {
  L.push(`### ${sc.name} (${sc.id})`, "");
  L.push(`**التركيبة:** ${S.uncertainties.map((u) => `${u.name} → ${u.poles.find((p) => p.id === sc.poles[u.id]).ar}`).join("؛ ")}`, "");
  L.push(sc.narrative, "");
  L.push("**الآثار (التقدير من sunan/sunan.json):**", "");
  L.push("| السُّنّة | التقدير الحالي | القراءة في هذا السيناريو |", "|---|---|---|");
  for (const im of sc.implications) L.push(`| ${nameOf(im.sunna)} | ${lik(im.sunna)} | ${im.reading} |`);
  L.push("", "**النقد المضاد:**", ...sc.counter.map((t) => `- ${t}`), "");
  L.push("**ما يُبطله:**", ...sc.falsifiers.map((t) => `- ${t}`), "");
  L.push(`**قسم النقد الأحمر:** ${sc.red_team}`, "");
}
L.push("## النقد الأحمر العام", "", ...S.global_red_team.map((t) => `- ${t}`), "");
const text = L.join("\n");

if (CHECK) {
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text) {
    console.error("analysis/foresight/SCENARIOS.md لا يطابق مولّده: شغّل node scripts/build_scenarios.mjs");
    process.exit(1);
  }
  console.log(`الاستشراف: مطابقة (${S.scenarios.length} سيناريوهات، ${sunan.length} سُنّة مغطّاة)`);
} else {
  fs.writeFileSync(OUT, text);
  console.log(`كُتب ${OUT}: ${S.scenarios.length} سيناريوهات، ${sunan.length} سُنّة مغطّاة`);
}
