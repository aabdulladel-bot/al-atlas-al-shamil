import fs from "node:fs";
import path from "node:path";
import { checkQuote } from "../../pipeline/normalize.mjs";
const dir = path.resolve("verification/era1");
const claims = JSON.parse(fs.readFileSync(path.join(dir, "reader2.json"), "utf8"));
const passages = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(dir, "passages.json"), "utf8")).map((p) => [p.id, p.text]));
let ok = 0;
for (const c of claims) {
  const r = checkQuote(passages[c.passage_id] ?? "", c.quote);
  if (r.status === "ok") ok++;
  console.log(`${r.status.padEnd(9)} ${r.reason ?? "-"}  ${c.passage_id}  ${c.quote.slice(0, 60)}`);
}
console.log(`reader2 quotes found: ${ok}/${claims.length}`);
