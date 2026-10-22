# حقول التحقق

كل حقل يجيب عن سؤال واحد، ولا يُفهم "مؤكد" إلا بحقله.

## للمصادر (eras/eras.json)

| الحقل | الحالات الممكنة | المعنى |
|---|---|---|
| `verification.edition.status` | `confirmed` / `not_found` | هل وُجدت الطبعة في الأرشيف بمؤلفها وسنتها؟ لا يعني أن النص قُرئ. |
| `verification.content.status` | `confirmed` / `not_confirmed` / `not_checked` | هل وُجد في نص الطبعة المحتوى الذي تعتمد عليه الحقبة؟ |
| `verification.quotes.status` | `matched` / `corrected` / `not_checked` | هل طُوبق اقتباس حرفي مع نص الطبعة؟ |

## للادعاءات (schemas/atlas.schema.json، Claim.checks)

| الحقل | الحالات الممكنة | المعنى |
|---|---|---|
| `quote_match` | `true` / `false` | هل الاقتباس موجود حرفياً في المقطع؟ |
| `meaning.status` | `not_reviewed` / `self_reviewed` / `independently_reviewed` | من راجع أن الشرح يطابق المعنى؟ `self_reviewed` يعني الكاتب نفسه. |
| `pass_agreement.status` | `not_run` / `agree` / `disagree` | هل وُجدت القضية نفسها عند قارئ مستقل؟ (القاعدة content-first-v1) |
| `pass_agreement.classification_agree` | `true` / `false` | هل اتفق النوع والطبقة؟ يُسجَّل ولا يُسقط الادعاء |

## ما يعنيه كل مستوى

- **المصدر مؤكد** = طبعة موجودة. لا يعني أنه قُرئ أو أن اقتباساته صحيحة.
- **المحتوى مؤكد** = وُجد المضمون المتوقع في نص الطبعة الممسوح.
- **الاقتباس مطابق** = الكلمات موجودة في نص OCR. لم تُطابق الصفحة الورقية بعد.
- **المعنى مراجع** = قارئ ثانٍ قال إن الشرح مطابق. حتى يحدث ذلك، لا يُعرض أي ادعاء كحقيقة.
