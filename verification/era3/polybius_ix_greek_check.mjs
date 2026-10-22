// مقارنة ادعاءات الكتاب IX باليوناني من Hultsch (المجلد VI في الأرشيف: polybiihistoria06polygoog).
// كل اقتباس يوناني يُطابَق بالنص نفسه عبر checkQuote، ولا يُقبل إلا إذا وُجد في نافذة النص اليوناني.
import fs from "node:fs";
import crypto from "node:crypto";
import { checkQuote } from "../../pipeline/normalize.mjs";

const DIR = new URL(".", import.meta.url).pathname;
const greek = fs.readFileSync(DIR + "hultsch_ix_greek.txt", "utf8").replace(/\s+/g, " ");
const CHECKS = [
  { claim: "cl_000000392", quote: "τῶν οἰκούντων ἀρετῆς", note: "Οὐκ ἐκ τῶν ἔξω κοσμεῖται πόλις، ἀλλ' ἐκ τῆς τῶν οἰκούντων ἀρετῆς" },
  { claim: "cl_000000393", quote: "ὀργή τις ἐκκαίεται πρὸς τοὺς εὐτυχοῦντας", note: "οὐ μόνον φϑόνος، ἀλλ᾽ οἷον ὀργή τις ἐκκαίεται πρὸς τοὺς εὐτυχοῦντας … τὸ κατὰ τῶν πραξάντων μῖσος" },
  { claim: "cl_000000394", quote: "ἕν καὶ τὸ τυχὸν", note: "ἡ φύσις πρὸς τὰς ἀποτυχίας τῶν ἐπινοηθέντων ἱκανὸν ἕν καὶ τὸ τυχὸν ἐποίησε" },
  { claim: "cl_000000395", quote: "τὴν ἐναντίαν τῇ φύσει", note: "ἀναγκαζόμενοι ταῖς τῶν πραγμάτων μεταβολαῖς συμμετατίθεσθαι τὴν ἐναντίαν τῇ φύσει" },
  { claim: "cl_000000396", quote: "ἐὰν μόνον σὺν νῷ γένηται", note: "ἐὰν μόνον σὺν νῷ γένηται τὰ πραττόμενα" },
  { claim: "cl_000000400", quote: "τὰ τῶν νικώντων ἔϑη", note: "τὸ γὰρ ἀπολιπόντας τὰ τῶν νικώντων ἔθη τὸν τῶν ἡττωμένων ζῆλον ἀναλαμβάνειν" },
  { claim: "cl_000000401", quote: "ἁπλουστάτοις χρώμενοι βίοις", note: "ἁπλουστάτοις χρώμενοι βίοις … ὅμως ἐπεκράτουν τούτων αἰεὶ" },
];
const results = [];
for (const c of CHECKS) {
  const idx = greek.indexOf(c.quote);
  const window = idx < 0 ? "" : greek.slice(Math.max(0, idx - 300), idx + 300);
  const r = window ? checkQuote(window, c.quote) : { status: "rejected" };
  results.push({ claim: c.claim, greek_quote: c.quote, note: c.note, status: r.status, window_sha256: crypto.createHash("sha256").update(window).digest("hex") });
  console.log(c.claim, r.status, c.quote);
}
fs.writeFileSync(DIR + "polybius_ix_greek_check.json", JSON.stringify({ source: "Hultsch، Polybii Historiae (archive: polybiihistoria06polygoog)", results }, null, 2) + "\n");
const ok = results.filter((r) => r.status === "ok").length;
console.log("greek quote_match", ok + "/" + results.length);
process.exit(ok === results.length ? 0 : 1);
