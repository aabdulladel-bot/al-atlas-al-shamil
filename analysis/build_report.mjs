// يولّد analysis/README.md من seshat_results.json، فلا تُكتب الأرقام يدوياً.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(fs.readFileSync(path.join(DIR, "seshat_results.json"), "utf8"));
const A = r.test_a_dynasty_age, B = r.test_b_trade_centers, C = r.test_c_crafts_urbanism;
const pct = (x) => `${Math.round(x * 100)}%`;
const ci = (c, f = pct) => `${f(c[0])}–${f(c[1])}`;
const x10 = (v) => (10 ** v).toFixed(1);
const names = { Market: "الأسواق", Port: "الموانئ", Road: "الطرق", SciLit: "الأدب العلمي" };
const rowA = (k) => `| ${A[k].label} | ${A[k].n} | ${A[k].median_years} | ${pct(A[k].share_le_120)} | ${ci(A[k].share_le_120_ci95)} |`;
const md = `# اختبار السنن كمياً ببيانات Seshat

**المصدر:** ${r._source}. **البذرة:** ${r.seed} (التحليل قابل للإعادة).

**تنبيه:** ${r._note}

**إعادة التشغيل:** \`python3 -I analysis/seshat_sunan.py <ملف Equinox xlsx> analysis\` ثم \`node analysis/build_report.mjs\`. الملف الخام مضغوط في \`data/raw/Equinox_Data-v.1.zip\`.

**الترخيص:** بيانات Seshat بترخيص CC BY-NC-SA، فهذه النتائج المشتقة تُنشر بالترخيص نفسه، للاستعمال غير التجاري، مع الإسناد: "This research employed data from the Seshat Databank (seshatdatabank.info) under Creative Commons Attribution Non-Commercial (CC By-NC SA) licensing."

## أ. أعمار الدول

**الفرضية:** ${A.hypothesis}. **تعريف الدولة:** ${A.state_definition}.

| العينة | العدد | الوسيط (سنة) | لم تتجاوز 120 سنة | فترة الثقة 95% |
|---|---|---|---|---|
${rowA("all_states_raw")}
${rowA("all_states_merged")}
${rowA("islamic_world_raw")}
${rowA("islamic_world_merged")}

**القراءة:** عالمياً، أغلب الدول تتجاوز 120 سنة، وفترة الثقة كلها تحت 50%، فالتعميم **لا يصمد**. في العالم الإسلامي تقريباً تقترب النسبة من النصف أو تتجاوزه قليلاً، وفترة الثقة تشمل 50%، فالنتيجة **غير حاسمة**، وهي أقرب إلى قول ابن خلدون في منطقته التي بنى عليها نظريته.

**حدود:** "الكيان" في Seshat وحدة ترميز، وقد يقسم الدولة الواحدة إلى مراحل، فتبدو الأعمار أقصر. دمجت المراحل المرقّمة المتتالية (${A.merged_phase_groups} مجموعة)، ولم أدمج غيرها. تعريف "العالم الإسلامي" تقريبي بالمنطقة والتاريخ.

## ب. التجارة ومراكزها

**الفرضية:** ${B.hypothesis}.

**دون ضبط حجم الدولة** (${B.measure}):

| المتغير | الكيانات | الفرق (أكبر مدينة) | p (اختبار تبديل) |
|---|---|---|---|
${B.results.map((x) => `| ${names[x.variable]} | ${x.n_polities} (${x.n_present} موجود، ${x.n_absent} غائب) | ${x.ratio_largest_city} ضعفاً | ${x.p_one_sided_permutation} |`).join("\n")}

**مع ضبط حجم سكان الكيان والألفية** (${B.controlled_for_population.measure}):

| المتغير | الكيانات | أكبر مدينة أكبر بنحو | فترة الثقة 95% |
|---|---|---|---|
${B.controlled_for_population.results.map((x) => `| ${names[x.x]} | ${x.n} | ${x10(x.coef)} مرة | ${x10(x.ci95[0])}–${x10(x.ci95[1])} |`).join("\n")}

**القراءة:** الفرق الضخم دون ضبط سببه أن الكيانات الكبيرة فيها كل شيء. بعد ضبط حجم الدولة ينكمش الأثر كثيراً، لكنه يبقى موجباً وفترة ثقته بعيدة عن الصفر: حيث توجد الأسواق والطرق والموانئ، تتركز السكان في مدينة كبرى أكبر نسبةً إلى حجم الدولة. هذا **يؤيد السُنّة ارتباطاً**، ولا يحدد اتجاه السببية (قد تجذب المدن الكبرى الأسواق، لا العكس).

## ج. الصنائع والعمران الحضري

**الفرضية:** ${C.hypothesis}.

- **دون ضبط:** ارتباط سبيرمان بين حجم أكبر مدينة ومؤشر المعلومات ${C.cap_vs_info.overall_rho} (فترة الثقة ${C.cap_vs_info.overall_ci95.join("–")})، في ${C.cap_vs_info.n} كياناً. وداخل كل ألفية: ${C.cap_vs_info.within_millennium.map((b) => `${b.bin_start} (${b.rho}، ن=${b.n})`).join("، ")}.
- **الأدب العلمي:** حيث يوجد أدب علمي، أكبر مدينة أكبر بنحو ${C.scilit_presence.ratio_largest_city} ضعفاً داخل الألفية نفسها (p = ${C.scilit_presence.p_one_sided_permutation}، ${C.scilit_presence.n_polities} كياناً)، دون ضبط حجم الدولة.
- **مع ضبط حجم سكان الكيان والألفية:** كل تضاعف عشري في حجم المدينة يقترن بزيادة ${C.controlled_for_population.results[0].coef} في مؤشر المعلومات (من 0 إلى 1)، فترة الثقة ${C.controlled_for_population.results[0].ci95.join("–")}.

**القراءة:** العلاقة قوية جداً دون ضبط، وتصبح **صغيرة لكنها موجبة** بعد ضبط حجم الدولة. هذا يؤيد السُنّة ارتباطاً، بأثر أضعف مما يوحي به الارتباط الخام.

## ما لم يُختبر

- **العصبية، والترف، واقتداء المغلوب، والأمن على الأموال:** لا متغيرات مباشرة لها في Equinox. يحتاج اختبارها بيانات أخرى (مثل مقاييس التماسك عند Turchin).
`;
fs.writeFileSync(path.join(DIR, "README.md"), md);
console.log("كُتب analysis/README.md");
