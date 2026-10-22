// يقارن استخراجين مستقلين لنفس المقاطع. الاتفاق يعني أن الاستخراجين وجدا الاقتباس نفسه تقريباً ونفس النوع.
import { normalizeArabic } from "./normalize.mjs";

const words = (s) => new Set(normalizeArabic(s).split(" ").filter(Boolean));
function jaccard(a, b) {
  const A = words(a), B = words(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

// runA و runB مصفوفتا ادعاءات بالشكل نفسه (quote, type, passage_id)
export function compareRuns(runA, runB, { threshold = 0.8 } = {}) {
  const matched = [];
  const usedB = new Set();
  for (const a of runA) {
    let best = -1, bestScore = 0;
    runB.forEach((b, i) => {
      if (usedB.has(i) || b.passage_id !== a.passage_id) return;
      const score = jaccard(a.quote, b.quote);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0 && bestScore >= threshold) {
      usedB.add(best);
      matched.push({ id: a.id, passage_id: a.passage_id, score: Number(bestScore.toFixed(2)), same_type: a.type === runB[best].type });
    } else {
      matched.push({ id: a.id, passage_id: a.passage_id, score: 0, same_type: false });
    }
  }
  const total = Math.max(runA.length, runB.length);
  const agreed = matched.filter((m) => m.score > 0 && m.same_type).length;
  const rate = total ? agreed / total : 1;
  return { agreed, total, rate: Number(rate.toFixed(2)), status: rate >= 0.9 ? "agree" : "disagree", perClaim: matched, onlyInB: runB.length - usedB.size };
}
