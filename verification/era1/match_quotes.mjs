// يطابق اقتباسات حرفية مع نص الطبعة بعد توحيد الهمزات والتشكيل فقط (checkQuote).
import fs from "node:fs";
import path from "node:path";
import { checkQuote } from "../../pipeline/normalize.mjs";

const jsonPath = path.resolve(process.argv[2]);
const baseDir = path.dirname(jsonPath);
const cases = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
for (const c of cases) {
  const raw = fs.readFileSync(path.join(baseDir, c.file), "utf8").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  const r = checkQuote(raw, c.quote);
  console.log(`${r.status.padEnd(9)} ${r.reason ?? "-"} count=${r.count}  ${c.id}`);
}
