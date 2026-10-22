// مطابقة الاقتباسات: هل النص الحرفي للادعاء موجود في المقطع فعلاً؟
// القاعدة من الخطة: تُوحَّد الهمزات والتشكيل والتطويل والأرقام فقط، ولا يُغيَّر شيء آخر.

const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const HAMZA_FORMS = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ؤ": "و", "ئ": "ي" };
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

export function normalizeArabic(text) {
  let out = text.normalize("NFC").replace(DIACRITICS, "").replace(TATWEEL, "");
  out = out.replace(/[أإآٱؤئ]/g, (ch) => HAMZA_FORMS[ch]);
  out = out.replace(/[٠-٩]/g, (ch) => String(ARABIC_INDIC.indexOf(ch)));
  return out.replace(/\s+/g, " ").trim();
}

// يرجع عدد مواضع الظهور في المقطع، وأول موضع. أي حالة غير الظهور الواحد تُرفض أو تُحال.
export function checkQuote(passageText, quote) {
  const haystack = normalizeArabic(passageText);
  const needle = normalizeArabic(quote);
  if (needle.length === 0) return { status: "rejected", reason: "empty_quote", count: 0, index: -1 };

  let count = 0;
  let first = -1;
  let from = 0;
  while (true) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    if (first === -1) first = at;
    count += 1;
    from = at + 1;
  }

  if (count === 0) return { status: "rejected", reason: "not_found", count, index: -1 };
  if (count > 1) return { status: "escalated", reason: "ambiguous", count, index: first };
  return { status: "ok", reason: null, count, index: first };
}
