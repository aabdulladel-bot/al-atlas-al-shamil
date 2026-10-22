import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeArabic, checkQuote } from "./normalize.mjs";

test("يزيل التشكيل والتطويل", () => {
  assert.equal(normalizeArabic("بَغْدَادُ"), "بغداد");
  assert.equal(normalizeArabic("بغــــداد"), "بغداد");
});

test("يوحّد صور الألف والهمزات", () => {
  assert.equal(normalizeArabic("أحمد إبراهيم آمن ؤ ئ"), "احمد ابراهيم امن و ي");
});

test("يحوّل الأرقام الهندية إلى غربية", () => {
  assert.equal(normalizeArabic("سنة ٧٦٢"), "سنة 762");
});

test("لا يغيّر التاء المربوطة ولا الياء والألف المقصورة", () => {
  assert.equal(normalizeArabic("مدينة على"), "مدينة على");
});

test("يقبل اقتباساً حرفياً موجوداً مرة واحدة", () => {
  const passage = "تأسست بغداد سنة مئة وخمسين، وبناها المنصور بالحجر.";
  const r = checkQuote(passage, "وبناها المنصور بالحجر");
  assert.equal(r.status, "ok");
  assert.equal(r.count, 1);
});

test("يقبل الاقتباس مع اختلاف التشكيل والهمزة", () => {
  const passage = "أَسَّسَ المَنْصُورُ بَغْدَادَ سَنَةَ ٧٦٢م";
  const r = checkQuote(passage, "اسس المنصور بغداد سنة 762م");
  assert.equal(r.status, "ok");
});

test("يرفض اقتباساً غير موجود", () => {
  const r = checkQuote("نص مختلف تماماً", "عبارة لم ترد أبداً");
  assert.equal(r.status, "rejected");
  assert.equal(r.reason, "not_found");
});

test("يحيل إلى المراجعة إذا ظهر الاقتباس أكثر من مرة", () => {
  const r = checkQuote("سنة مئة. ثم سنة مئة أخرى.", "سنة مئة");
  assert.equal(r.status, "escalated");
  assert.equal(r.reason, "ambiguous");
  assert.equal(r.count, 2);
});

test("يرفض الاقتباس الفارغ", () => {
  assert.equal(checkQuote("أي نص", "   ").status, "rejected");
});
