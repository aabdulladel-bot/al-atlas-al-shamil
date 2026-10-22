// يبني ملفات الادعاءات للعرض في الواجهة: ادعاء واحد لكل سطر، ولا يُعرض إلا ما طابق نصه (quote_match).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "web/data");
fs.mkdirSync(OUT, { recursive: true });

for (const era of [1, 2, 3, 4, 5, 6]) {
  const dir = path.join(ROOT, "verification", `era${era}`);
  const claims = JSON.parse(fs.readFileSync(path.join(dir, "claims.json"), "utf8"));
  const passages = new Map(JSON.parse(fs.readFileSync(path.join(dir, "passages.json"), "utf8")).map((p) => [p.id, p]));
  const shown = claims
    .filter((c) => c.checks.quote_match === true)
    .map((c) => ({
      id: c.id,
      statement: c.statement,
      quote: c.quote,
      attributed_to: c.attributed_to,
      layer: c.layer,
      type: c.type,
      hedge: c.hedge,
      chapter: passages.get(c.passage_id)?.chapter ?? null,
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
}
