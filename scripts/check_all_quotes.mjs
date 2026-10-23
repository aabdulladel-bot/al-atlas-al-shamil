// يطابق اقتباس كل ادعاء في كل الحقب بنص مقطعه، ويكتب quote_match. يفشل إن لم يطابق ادعاء واحد.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkQuote } from "../pipeline/normalize.mjs";
import { claimEras } from "./lib/eras.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
for (const era of claimEras(ROOT)) {
  const dir = path.join(ROOT, "verification", `era${era}`);
  const claims = JSON.parse(fs.readFileSync(path.join(dir, "claims.json"), "utf8"));
  const passages = new Map(JSON.parse(fs.readFileSync(path.join(dir, "passages.json"), "utf8")).map((p) => [p.id, p]));
  let ok = 0;
  for (const c of claims) {
    const r = checkQuote(passages.get(c.passage_id)?.text ?? "", c.quote);
    c.checks.quote_match = r.status === "ok";
    if (c.checks.quote_match) ok++; else { failed++; console.log(`  ${r.status} ${c.id} ${c.passage_id}`); }
  }
  fs.writeFileSync(path.join(dir, "claims.json"), JSON.stringify(claims, null, 2) + "\n");
  console.log(`era${era}: quote_match ok: ${ok}/${claims.length}`);
}
if (failed) { console.error(`اقتباسات غير مطابقة: ${failed}`); process.exit(1); }
