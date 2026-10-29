// يبني docs/RIGHTS_REVIEW.md من sources/manifest.json: كل مصدر بمعرّفه ورخصته وطبقته وهل يُجلب وقت العرض وإسناده.
// الأسئلة المفتوحة قبل النشر تُكتب هنا سؤالاً لصاحب المشروع لا قراراً. الاستعمال: node scripts/build_rights_review.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "sources/manifest.json"), "utf8"));
const cell = (v) => String(v ?? "—").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim() || "—";

const rows = manifest.sources.map((s) => `| ${cell(s.id)} | ${cell(s.tier)} | ${cell(s.license)} | ${s.runtime ? "نعم" : "لا"} | ${cell(s.attribution)} |`);
const byTier = (t) => manifest.sources.filter((s) => s.tier === t).length;
const noAttribution = manifest.sources.filter((s) => !s.attribution).map((s) => s.id);

const out = `# مراجعة الحقوق قبل النشر العام

> مولَّد بـ \`scripts/build_rights_review.mjs\` من \`sources/manifest.json\`. لا يُعدَّل يدوياً، ويُعاد بناؤه بعد كل تغيير في المصادر.

## الطبقات

- **A:** ملك عام أو ترخيص مفتوح يسمح بالنشر مع الإسناد. عددها ${byTier("A")}.
- **B:** مرخّص أو بإذن موثّق، يُراجع شرطه قبل النشر. عددها ${byTier("B")}.
- **C:** مرجع فقط بلا استخراج. عددها ${byTier("C")}.
- **بلا إسناد مسجّل في المانيفست:** ${noAttribution.length} مصدراً${noAttribution.length ? `: ${noAttribution.join("، ")}` : ""}. يُكمَل إسناد كل منها قبل النشر.

## المصادر

| المعرّف | الطبقة | الرخصة | يُجلب وقت العرض | الإسناد |
|---|---|---|---|---|
${rows.join("\n")}

## التزامات قبل النشر (أسئلة لصاحب المشروع، لا قرارات)

1. **Historical Basemaps (GPL-3):** نشر ما يُبنى منها (حدود الحقب، والتحولات، والمكعّب) يقتضي الرخصة نفسها لتلك البيانات. هل يُنشر الأطلس بترخيص GPL-3، أم تُستبعد هذه الطبقة من النشر العام؟
2. **Seshat (CC BY-NC-SA):** الاستعمال غير تجاري، والمشتقات تُنشر بالترخيص نفسه. هل الأطلس غير ربحي في نشره؟ وهل يُنشر ما يُشتق من اختبارات Seshat بالشروط نفسها؟
3. **Terrain Tiles:** الإسناد إلزامي. يظهر نصه في أداة الإسناد على الخريطة (\`DEM_ATTRIBUTION\` في \`web/app.js\`)، ولا يرد اسمه في فقرة المصادر في \`web/index.html\`. هل يكفي هذا، أم تُضاف الفقرة إلى المصادر؟
`;

fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs/RIGHTS_REVIEW.md"), out, "utf8");
console.log(`مراجعة الحقوق: ${manifest.sources.length} مصدراً`);
