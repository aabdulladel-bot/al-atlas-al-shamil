// يضيف أماكن إلى mentions.places في ادعاء قائم ويرفع version، ولا يمس غيرهما.
// الاستعمال: node scripts/set_claim_places.mjs <era> <claim_id> <اسم المكان كما في aliases>...
import fs from "node:fs";
const [era, id, ...names] = process.argv.slice(2);
if (!era || !id || !names.length) { console.error("الاستعمال: node scripts/set_claim_places.mjs <era> <claim_id> <مكان>..."); process.exit(2); }
const file = `verification/era${era}/claims.json`;
const claims = JSON.parse(fs.readFileSync(file, "utf8"));
const c = claims.find((x) => x.id === id);
if (!c) { console.error(`لا ادعاء ${id} في ${file}`); process.exit(1); }
c.mentions = c.mentions ?? { places: [], persons: [], dates: [] };
const before = new Set(c.mentions.places);
for (const n of names) c.mentions.places.includes(n) || c.mentions.places.push(n);
if (c.mentions.places.length === before.size) { console.log(`${id}: لا تغيير`); process.exit(0); }
c.version = (c.version ?? 1) + 1;
fs.writeFileSync(file, JSON.stringify(claims, null, 2) + "\n");
console.log(`${id}: الأماكن الآن ${JSON.stringify(c.mentions.places)}، النسخة ${c.version}`);
