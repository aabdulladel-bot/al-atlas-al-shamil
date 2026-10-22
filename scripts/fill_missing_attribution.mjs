// يملأ الحقول الفارغة فقط (attributed_to و hedge) من بيانات الطبعات المسجلة في eras.json.
// لا يغيّر أي حقل مكتوب سابقاً. يُشغَّل مرة، وتُسجَّل نتيجته في review/README.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BY_SOURCE = {
  hammurabi: { attributed_to: "شريعة حمورابي (ترجمة Harper، 1904)", hedge: "نص تشريعي يذكر ما يقرره القانون، ولا يثبت أنه طُبّق بهذه الصورة" },
  ptahhotep: { attributed_to: "تعاليم بتاح حتب (ترجمة Gunn، 1912)", hedge: "أدب حكمة يقدّم توجيهاً أخلاقياً، لا وصفاً لواقع مُثبت" },
  gilgamesh: { attributed_to: "George Smith، The Chaldean Account of Genesis (1876)", hedge: "من مقدمة المترجم في القرن التاسع عشر، لا من نص الملحمة" },
  behistun: { attributed_to: "داريوس الأول، نقش بيستون (ترجمة Rawlinson، 1846)", hedge: "نقش ملكي يعرض رواية داريوس عن نفسه" },
  luckenbill: { attributed_to: "إسارحدون، النقوش الملكية (ترجمة Luckenbill، 1927)", hedge: "حولية ملكية يروي فيها الملك إنجازاته" },
  kjv1611: { attributed_to: "الكتاب المقدس، ترجمة 1611 (ملخص الإصحاح التحريري)", hedge: "ملخص تحريري وليس نص الآية" },
  herodotus: { attributed_to: "هيرودوت، التواريخ (ترجمة Rawlinson، 1858–1861)", hedge: "وصف هيرودوت كما بلغه، وليس مسحاً مباشراً" },
  "sima-qian-zh": { hedge: "رواية المؤرخ الرسمي للهان عن بلاد بعيدة اعتماداً على تقارير المبعوثين؛ نص ويكي مصدر غير مؤكد الطبعة" },
};
const BY_CLAIM = {
  cl_000000110: { hedge: "من فهرس المحرر للوح الحادي عشر، لا من نص الملحمة" },
  cl_000000319: { hedge: "حكم بوليبيوس على مصداقية بيثياس، وليس تحققاً مستقلاً من رحلته" },
  cl_000000323: { hedge: "رواية ثوكيديديس لقرار عسكري، والغاية المذكورة تعليله هو" },
  cl_000000349: { hedge: "سرد غريغوريوس لحادثة بعينها، وليس وصفاً عاماً للتجارة" },
  cl_000000357: { hedge: "رواية بيدا، وترقيم الفصل تقريبي في هذه الطبعة" },
};
const log = [];
for (const era of [1, 2, 3, 4, 5, 6]) {
  const dir = path.join(ROOT, "verification", `era${era}`);
  const claims = JSON.parse(fs.readFileSync(path.join(dir, "claims.json"), "utf8"));
  const passages = new Map(JSON.parse(fs.readFileSync(path.join(dir, "passages.json"), "utf8")).map((p) => [p.id, p]));
  let changed = 0;
  for (const c of claims) {
    const src = passages.get(c.passage_id)?.source_id;
    const fill = { ...(BY_SOURCE[src] || {}), ...(BY_CLAIM[c.id] || {}) };
    for (const field of ["attributed_to", "hedge"]) {
      if (!c[field] && fill[field]) { c[field] = fill[field]; log.push(`${c.id} ${field}`); changed++; }
    }
  }
  if (changed) fs.writeFileSync(path.join(dir, "claims.json"), JSON.stringify(claims, null, 2) + "\n");
}
console.log(`حقول مُلئت: ${log.length}`);
