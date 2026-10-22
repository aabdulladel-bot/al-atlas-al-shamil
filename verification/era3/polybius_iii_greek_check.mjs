// مقارنة ادعاءات الكتاب III (المعاهدات) باليوناني من Hultsch (الأرشيف: polybiihistoria05polygoog).
import fs from "node:fs";
import crypto from "node:crypto";
import { checkQuote } from "../../pipeline/normalize.mjs";

const DIR = new URL(".", import.meta.url).pathname;
const greek = fs.readFileSync(DIR + "hultsch_i_iii_greek.txt", "utf8");
const CHECKS = [
  { claim: "cl_000000383", quote: "μακραῖς ναυσὶ", note: "τοὺς Ῥωμαίους μακραῖς ναυσὶ … ἐπέχεινα πλεῖν … τοῦ Καλοῦ ἀκρωτηρίου؛ وفي الموضع نفسه: ὑπὸ χειμῶνος ἢ πολεμίων" },
  { claim: "cl_000000384", quote: "ἔνια μόλις ἐξ ἐπιστάσεως", note: "τηλικαύτη γὰρ ἡ διαφορὰ … ὥστε τοὺς συνετωτάτους ἔνια μόλις ἐξ ἐπιστάσεως διευκρινεῖν" },
  { claim: "cl_000000385", quote: "μηδὲ πόλιν κτίξειν", note: "μὴ λήξεσϑαι ἐπέκεινα Ῥωμαίους μηδ᾽ ἐμπορεύεσϑαι μηδὲ πόλιν κτίξειν، بعد الرأس الجميل وماستيا وتارسيوم" },
];
const results = [];
for (const c of CHECKS) {
  const idx = greek.indexOf(c.quote);
  const window = idx < 0 ? "" : greek.slice(Math.max(0, idx - 350), idx + 350);
  const r = window ? checkQuote(window, c.quote) : { status: "rejected" };
  results.push({ claim: c.claim, greek_quote: c.quote, note: c.note, status: r.status, window_sha256: crypto.createHash("sha256").update(window).digest("hex") });
  console.log(c.claim, r.status, c.quote);
}
fs.writeFileSync(DIR + "polybius_iii_greek_check.json", JSON.stringify({ source: "Hultsch، Polybii Historiae، الكتب I–III (archive: polybiihistoria05polygoog)", results }, null, 2) + "\n");
const ok = results.filter((r) => r.status === "ok").length;
console.log("greek quote_match", ok + "/" + results.length);
process.exit(ok === results.length ? 0 : 1);
