# استخراج الادعاءات: claim_extraction_v1

المهمة: استخرج من المقطع الادعاءات الواقعية والتفسيرية والأحكام كلها، كل ادعاء في عنصر مستقل.

المدخل:
- العنوان: {source_title}
- المؤلف: {author}
- تأليف نحو: {composed_year}
- الفصل: {chapter}
- السنة الحولية إن وُجدت: {annal_year}
- معرّف المقطع: {passage_id}

<passage>
{passage_text}
</passage>

القواعد:
1. الادعاء جملة واحدة تقول شيئاً واحداً: حدث، أو حال، أو عدد، أو سبب، أو وصف، أو حكم، أو نقل لقول غيره.
2. انسخ في quote ما يثبت الادعاء من المقطع حرفاً بحرف، بلا تعديل ولا تشكيل زائد.
3. إذا نسب المؤلف الخبر إلى غيره فاذكر المنسوب إليه في attributed_to، والسند في isnad، وصيغة التحفظ في hedge.
4. إذا روى المؤلف روايتين مختلفتين فاستخرج كلاً منهما ادعاءً مستقلاً، واذكر ترجيحه في author_preference.
5. افصل الحكم عن الواقعة: الحكم ادعاء من نوع judgment.
6. الأسماء والأماكن والتواريخ تُنسخ كما وردت في mentions.
7. إذا لم يكن في المقطع ادعاء تاريخي أو جغرافي أو ثقافي فأعد قائمة فارغة.

الصيغة: أعد JSON فقط، وهو مصفوفة من كائنات بالمفاتيح:
quote, statement, type, layer, attributed_to, isnad, hedge, author_preference, mentions, needs_review, review_reason, sensitivity

القيم المسموحة:
- type: event | state | quantity | cause | description | judgment | reported_belief
- layer: scripture | tradition | contemporary_witness | later_historian | material | modern_scholarship
- author_preference: preferred | rejected | neutral | null
- sensitivity: normal | sensitive
