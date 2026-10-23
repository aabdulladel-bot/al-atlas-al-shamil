// يبحث في لقطة Pleiades المحلية عن أماكن بعنوان أو اسم يطابق تعبيراً.
// الاستعمال: node scripts/find_pleiades.mjs "<تعبير منتظم>" [--exact]
// --exact: يطابق العنوان كاملاً فقط (مفيد لتجنب التطابقات الجزئية).
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [pattern, flag] = process.argv.slice(2);
if (!pattern) { console.error('الاستعمال: node scripts/find_pleiades.mjs "<تعبير>" [--exact]'); process.exit(2); }
const re = new RegExp(flag === "--exact" ? `^(?:${pattern})$` : pattern, "i");
const raw = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, "data/raw/pleiades-places-latest.csv.gz"))).toString("utf8");
const rows = parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true });
const hits = rows.filter((r) => re.test(r.title || "") || (flag !== "--exact" && re.test(r.nameAttested || "")));
for (const r of hits.slice(0, 40)) console.log(`${r.id} | ${r.title} | ${r.locationPrecision || "-"} | ${r.reprLat || "-"},${r.reprLong || "-"} | ${(r.timePeriodsKeys || r.timePeriods || "").slice(0, 40)}`);
console.log(`المطابقات: ${hits.length}${hits.length > 40 ? " (عُرض أول 40)" : ""}`);
