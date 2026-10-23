// الحقب التي لها ادعاءات: كل مجلد verification/eraN فيه claims.json.
import fs from "node:fs";
import path from "node:path";
export function claimEras(root) {
  const dir = path.join(root, "verification");
  return fs.readdirSync(dir)
    .map((d) => /^era(\d+)$/.exec(d))
    .filter((m) => m && fs.existsSync(path.join(dir, m[0], "claims.json")))
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}
