# خطة تنفيذ: الجولة التالية من الأطلس الشامل

هذه تعليمات لوكيل منفِّذ. نفّذ المهام **بالترتيب**، ولا تنتقل إلى مهمة قبل أن تتحقق شروط قبول التي قبلها. كل ما تحتاجه من نصوص ومعرّفات وأوامر مكتوب هنا ومُتحقَّق منه مسبقاً، فلا تخمّن ولا تبحث عن بدائل.

اقرأ `CLAUDE.md` قبل البدء. قواعده تعلو على أي شيء في هذه الخطة.

---

## القواعد الحاكمة (تُطبَّق في كل مهمة)

1. **لا تكتب اقتباساً من ذاكرتك.** كل اقتباس يُنسخ من الملف المصدر عبر `scripts/quote_context.mjs`، حرفاً بحرف، **بأخطاء OCR كما هي** (مثل `con- stantly` و`equaUty` و`tenn- cious`). لا تصحّحها.
2. **لا تكتب رقماً بيدك** في أي ملف عرض أو توثيق. الأعداد تأتي من مخرجات الأوامر.
3. **لا تحذف شاهداً مقيِّداً** ولا تعدّل ادعاءً موجوداً إلا حيث تقول الخطة ذلك صراحة.
4. **لا تعدّل `sunan/sunan.json`** إلا في المهمة T2. اقتراحات ربط الادعاءات بالسنن تُكتب في `review/sunan_proposals.md` فقط.
5. **لا تجلب أي نص** غير المذكور هنا. لا مواد الأمم المتحدة (الطبقة C)، ولا الشاملة، ولا كتب حديثة محمية.
6. **الشبكة:** استعمل `curl` لا `fetch` في Node. لا تتجاوز أي حجب أو رفض صلاحية؛ سجّله في التقرير وتوقف عند تلك الخطوة.
7. **الخوادم المحلية:** لا تستعمل `pkill -f` أبداً. `scripts/ui_smoke.mjs` يشغّل خادمه ويوقفه بنفسه.
8. **قبل كل commit:** `npm run check:all` يجب أن ينتهي برمز 0. إن فشل، لا تعمل commit. أنهِ كل رسالة commit بسطور الإسناد التي تحددها بيئتك.
9. **قاعدة التوقف:** إذا فشلت خطوة مرتين بالسبب نفسه، توقف عن تلك المهمة، واكتب السبب في التقرير، وانتقل إلى المهمة التالية إن كانت مستقلة عنها.
10. **الصدق في التقرير:** لا تقل "تم التحقق" عن شيء لم تشغّل أمره. انسخ المخرجات الفعلية.
11. **المعرّفات:** لا تكتب معرّف ادعاء بيدك عند الإضافة. `scripts/add_claims.mjs` يعطيه. اقرأ المعرّفات الجديدة من مخرجاته.

---

## T0. التهيئة وخط الأساس

```bash
cd /home/user/al-atlas-al-shamil
git fetch origin
git checkout haiku-plan 2>/dev/null || git checkout main
git pull
test -f scripts/add_claims.mjs && test -f scripts/quote_context.mjs && echo "الأدوات موجودة"
git checkout -b haiku/era7-ghazali-places
npm ci
npm run check:all
```

**القبول:**
- طُبع "الأدوات موجودة".
- `check:all` انتهى برمز 0، وطبع `المخطط: 138/138 صالح، معرّفات مكررة: 0`.
- `node scripts/ui_smoke.mjs` طبع "الواجهة سليمة".

سجّل في التقرير عدد الادعاءات لكل حقبة كما طبعه `check:all`.

**توقف إن:** فشل `check:all` قبل أي تعديل منك. لا تحاول إصلاحه؛ أبلغ بالمخرجات.

---

## T1. ادعاءات الحقبة السابعة (توكفيل، داروين، البيان الشيوعي)

**الطبعات (مؤكدة من صفحات العنوان، ومسجلة في `sources/manifest.json`):**

| الملف | المصدر |
|---|---|
| `verification/era7/tocqueville_reeve1840_vol3.txt` | توكفيل، الديمقراطية في أمريكا، الجزء الثاني، ترجمة Henry Reeve، المجلد III، لندن 1840 |
| `verification/era7/darwin_murray1859.txt` | داروين، أصل الأنواع، الطبعة الأولى، لندن: John Murray، 1859 |
| `verification/era7/marx_moore1888_mia.txt` | البيان الشيوعي، ترجمة Samuel Moore 1888، تفريغ أرشيف الماركسيين |

### الخطوة 1: تحقق من كل اقتباس قبل الكتابة

لكل بند في المواصفات أدناه، شغّل:

```bash
node scripts/quote_context.mjs <الملف> "<أول 6 كلمات من الاقتباس>" 0
```

**يجب** أن يطبع `مرات الورود: 1`، وأن تكون "الجملة" المطبوعة مطابقة لحقل `quote` في المواصفات. إن اختلفت، انسخ الجملة المطبوعة إلى `quote` (لا العكس). إن طبع 0 أو أكثر من 1، احذف ذلك البند من المواصفات وسجّله في التقرير.

### الخطوة 2: أنشئ ملفات المواصفات

أنشئ المجلد `verification/era7/specs/` وفيه الملفات الثلاثة التالية **بمحتواها حرفياً**.

**`verification/era7/specs/tocqueville.json`**

```json
{
  "era": 7,
  "source": {
    "source_id": "tocqueville-reeve-1840-vol3",
    "file": "verification/era7/tocqueville_reeve1840_vol3.txt",
    "attributed_to": "توكفيل، الديمقراطية في أمريكا، الجزء الثاني (ترجمة Henry Reeve، لندن 1840، المجلد الثالث)",
    "chapter": "Democracy in America, Part II"
  },
  "items": [
    {
      "slug": "associations-everywhere",
      "quote": "Americans of all ages, all conditions, and all dispositions, con- stantly form associations.",
      "statement": "يلاحظ توكفيل أن الأمريكيين على اختلاف أعمارهم وأحوالهم وطباعهم يؤلفون الجمعيات باستمرار",
      "type": "description",
      "layer": "contemporary_witness",
      "hedge": "ملاحظة زائر فرنسي بعد رحلته في 1831–1832، وتعميم على مجتمع كامل لا إحصاء",
      "mentions": { "places": ["الولايات المتحدة"], "persons": [], "dates": [] }
    },
    {
      "slug": "association-equality-law",
      "quote": "If men are to remain civilized, or to become so, the art of associating together must grow and improve, in the same ratio in which the equaUty of conditions is in- creased.",
      "statement": "يقرر توكفيل قاعدة عامة: إن أراد الناس أن يبقوا متحضرين فلا بد أن ينمو فن الاجتماع في جمعيات بقدر ما تزداد المساواة في الأحوال",
      "type": "rule",
      "layer": "contemporary_witness",
      "hedge": "قاعدة يصوغها توكفيل بنفسه عن المجتمعات الديمقراطية، وهي فرضية لم يختبرها بقياس"
    },
    {
      "slug": "individualism-new-word",
      "quote": "Individualism is a novel expres- sion to which a novel idea has given birth.",
      "statement": "يصف توكفيل الفردانية بأنها لفظ جديد ولّدته فكرة جديدة",
      "type": "judgment",
      "layer": "contemporary_witness",
      "hedge": "حكم توكفيل على مصطلح عصره، والنص ترجمة إنجليزية لا الأصل الفرنسي"
    },
    {
      "slug": "manufacturing-aristocracy",
      "quote": "I am of opinion, upon the whole, that the manufacturing aristocracy which is growing up under our eyes, is one of the harshest which ever existed in the world ; but at the same time it is one of the most confined and least danger- ous.",
      "statement": "يرى توكفيل أن الأرستقراطية الصناعية الناشئة في عصره من أقسى ما عرفه العالم، لكنها في الوقت نفسه من أضيقها نطاقاً وأقلها خطراً",
      "type": "judgment",
      "layer": "contemporary_witness",
      "hedge": "رأي يقدّمه توكفيل بصيغة الظن (I am of opinion)، ويقيّده هو نفسه في الجملة ذاتها"
    },
    {
      "slug": "love-of-wellbeing",
      "quote": "The love of well-being is there displayed as a tenn- cious, exclusive, universal passion ; but its range is confined.",
      "statement": "يرى توكفيل أن حب الرفاه في المجتمع الديمقراطي شغف عنيد شامل يستأثر بالناس، لكن مداه محدود",
      "type": "judgment",
      "layer": "contemporary_witness",
      "hedge": "حكم عام على الشعوب الديمقراطية مستمد من ملاحظة أمريكا، و'tenn- cious' خطأ OCR لكلمة tenacious"
    }
  ]
}
```

**`verification/era7/specs/darwin.json`**

```json
{
  "era": 7,
  "source": {
    "source_id": "darwin-origin-1859",
    "file": "verification/era7/darwin_murray1859.txt",
    "attributed_to": "داروين، أصل الأنواع (لندن: John Murray، 1859، الطبعة الأولى)",
    "chapter": "On the Origin of Species"
  },
  "items": [
    {
      "slug": "natural-selection-term",
      "quote": "I have called this principle, by which each slight variation, if useful, is preserved, by the term of Natural Selection, in order to mark its relation to man’s power of selection.",
      "statement": "يسمّي داروين مبدأ حفظ كل تغيّر طفيف إذا كان نافعاً «الانتقاء الطبيعي»، ليبيّن صلته بانتقاء الإنسان",
      "type": "description",
      "layer": "contemporary_witness",
      "hedge": "تعريف داروين لمصطلحه في الطبعة الأولى، وقد عدّل صياغات كثيرة في الطبعات اللاحقة"
    },
    {
      "slug": "malthus-applied",
      "quote": "It is the doctrine of Malthus applied with manifold force to the whole animal and vegetable kingdoms ;",
      "statement": "يعدّ داروين صراع البقاء تطبيقاً لمذهب مالثوس على الممالك الحيوانية والنباتية كلها بقوة مضاعفة",
      "type": "judgment",
      "layer": "contemporary_witness",
      "hedge": "داروين يصف مصدر فكرته بنفسه، والسياق في الفصل الثالث عن صراع البقاء"
    },
    {
      "slug": "isolation-element",
      "quote": "Isolation, also, is an important element in the process of natural selection.",
      "statement": "يرى داروين أن العزلة عنصر مهم في عملية الانتقاء الطبيعي",
      "type": "judgment",
      "layer": "contemporary_witness",
      "hedge": "فرضية علمية في 1859، والتفصيل في علم الأحياء الحديث تجاوز صياغتها"
    },
    {
      "slug": "struggle-from-increase",
      "quote": "The struggle for exist- ence inevitably follows from the high geometrical ratio of increase which is common to all organic beings.",
      "statement": "يقرر داروين أن صراع البقاء ينتج حتماً عن ارتفاع معدل التكاثر الهندسي المشترك بين الكائنات الحية",
      "type": "rule",
      "layer": "contemporary_witness",
      "hedge": "خلاصة داروين في الفصل الأخير، وهي قاعدة نظرية لا قياس"
    }
  ]
}
```

**`verification/era7/specs/marx.json`**

```json
{
  "era": 7,
  "source": {
    "source_id": "marx-manifesto-moore-1888-mia",
    "file": "verification/era7/marx_moore1888_mia.txt",
    "attributed_to": "ماركس وإنجلز، بيان الحزب الشيوعي (ترجمة Samuel Moore 1888، تفريغ أرشيف الماركسيين)",
    "chapter": "I. Bourgeois and Proletarians"
  },
  "items": [
    {
      "slug": "class-struggles",
      "quote": "The history of all hitherto existing society 1 is the history of class struggles.",
      "statement": "يقرر البيان أن تاريخ كل مجتمع حتى الآن هو تاريخ صراع الطبقات",
      "type": "rule",
      "layer": "contemporary_witness",
      "hedge": "أطروحة في بيان سياسي تعبوي لا دراسة تاريخية، والرقم 1 إحالة إلى هامش إنجلز (1888) الذي يقيّدها بالتاريخ المكتوب"
    },
    {
      "slug": "revolutionising-production",
      "quote": "The bourgeoisie cannot exist without constantly revolutionising the instruments of production, and thereby the relations of production, and with them the whole relations of society.",
      "statement": "يرى البيان أن البرجوازية لا تبقى إلا بتثوير أدوات الإنتاج باستمرار، ومعها علاقات الإنتاج وعلاقات المجتمع كلها",
      "type": "judgment",
      "layer": "contemporary_witness",
      "hedge": "حكم تحليلي من مؤلفَين لهما موقف سياسي معلن"
    },
    {
      "slug": "solid-melts",
      "quote": "All that is solid melts into air, all that is holy is profaned, and man is at last compelled to face with sober senses his real conditions of life, and his relations with his kind.",
      "statement": "يصف البيان عصر البرجوازية بأنه يذيب كل ثابت ويدنّس كل مقدس، فيضطر الإنسان إلى مواجهة ظروف حياته الحقيقية",
      "type": "judgment",
      "layer": "contemporary_witness",
      "hedge": "صياغة بلاغية في بيان سياسي، والترجمة الإنجليزية لـ Moore تتصرف في الأصل الألماني"
    },
    {
      "slug": "expanding-market",
      "quote": "The need of a constantly expanding market for its products chases the bourgeoisie over the entire surface of the globe.",
      "statement": "يرى البيان أن حاجة البرجوازية إلى سوق تتسع باستمرار تدفعها إلى الانتشار في أرجاء الأرض",
      "type": "cause",
      "layer": "contemporary_witness",
      "hedge": "تفسير سببي من مؤلفَين لهما موقف سياسي معلن، لا وصف محايد"
    },
    {
      "slug": "cosmopolitan-production",
      "quote": "The bourgeoisie has through its exploitation of the world market given a cosmopolitan character to production and consumption in every country.",
      "statement": "يرى البيان أن استغلال البرجوازية للسوق العالمية أعطى الإنتاج والاستهلاك طابعاً عالمياً في كل بلد",
      "type": "judgment",
      "layer": "contemporary_witness",
      "hedge": "حكم عام في بيان سياسي سنة 1848، قبل كثير من التحولات التي يصفها"
    }
  ]
}
```

### الخطوة 3: تجربة ثم حفظ

```bash
for s in tocqueville darwin marx; do node scripts/add_claims.mjs verification/era7/specs/$s.json --dry-run || break; done
```

**يجب** أن يطبع كل ملف سطراً يبدأ بـ `ok` لكل بند، ثم "تجربة فقط". إن رفض أي بند، اقرأ سبب الرفض:
- "غير موجود" أو "أكثر من مرة": أعد الخطوة 1 لذلك البند.
- خطأ مخطط: صحّح الحقل المذكور فقط.

ثم احفظ **ملفاً ملفاً** (الترتيب مهم لتتابع المعرّفات):

```bash
node scripts/add_claims.mjs verification/era7/specs/tocqueville.json
node scripts/add_claims.mjs verification/era7/specs/darwin.json
node scripts/add_claims.mjs verification/era7/specs/marx.json
npm run check:all
npm run build:all
node scripts/ui_smoke.mjs
```

سجّل المعرّفات المطبوعة (يُتوقع أن تبدأ من `cl_000000407`، لكن اعتمد المطبوع لا التوقع).

### الخطوة 4: اقتراحات الربط بالسنن (لا تعدّل sunan.json)

أنشئ `review/sunan_proposals.md` بجدول فيه هذه الأعمدة: المعرّف، السُّنّة المقترحة (`id` من `sunan/sunan.json`)، الدور (مؤيد / مقيِّد / سابقة)، السبب في جملة واحدة. اقترح فقط ما يلي، بالمعرّفات الفعلية:

| البند | السُّنّة | الدور | السبب |
|---|---|---|---|
| tocqueville:association-equality-law | sn_asabiyya | مقيِّد | توكفيل يجعل الجمعية الطوعية بديلاً عن رابطة النسب في المجتمع المتساوي، وهذا يقيّد حصر التماسك في العصبية |
| tocqueville:love-of-wellbeing | sn_luxury | مقيِّد | حب الرفاه عنده "محدود المدى" ولا يقود بالضرورة إلى الانحلال |
| marx:expanding-market | sn_trade | مؤيد | يربط اتساع التجارة بالانتشار الجغرافي للمراكز |
| marx:cosmopolitan-production | sn_trade | مؤيد | السوق العالمية تعيد تشكيل الإنتاج في كل بلد |

اكتب فوق الجدول: "مقترحات للمراجع البشري، لم تُدخل في السنن."

**القبول (T1):**
- `check:all` رمز 0، والمخطط يطبع العدد الجديد كله صالحاً.
- `web/data/claims_era7.json` موجود، وأزرار الحقب في قسم الادعاءات صارت 7 في مخرجات `ui_smoke` (`claimEras: 7`).
- `review/sunan_proposals.md` موجود.

**Commit:**
```bash
git add -A && git commit -m "الحقبة السابعة: ادعاءات من توكفيل وداروين والبيان الشيوعي"
```

---

## T2. سابقة نصية لسُنّة الأمن: «التبر المسبوك» (عبر تراث)

**الخلفية:** سُنّة `sn_security` تنقصها شواهد عن الظلم تحديداً. هذا النص **ليس شاهداً واقعياً** بل صياغة سابقة لفكرة ابن خلدون، فيدخل في حقل `antecedents` الذي يُعرض ولا يُحسب في قوة الشواهد (الحقل مدعوم في `sunan/check_sunan.mjs` و`web/app.js`).

**الحقوق:** الطبقة B. المستخدم قرر: "نستمر بالإذن الشفهي من تراث... الموقع متاح للاستخدام والاقتباس دون أذونات". يُحفظ **نص الصفحة الواحدة فقط**، لا الكتاب.

### الخطوة 1: اجلب الصفحة واحفظها

```bash
SCR=$(mktemp -d)
curl -sS -m 90 "https://files.turath.io/books-v3/4129.json" -o "$SCR/4129.json"
node -e '
const fs=require("fs");const b=JSON.parse(fs.readFileSync(process.argv[1]));
const p=b.pages.find(x=>x.vol==="1"&&x.page===44||x.vol==1&&x.page==44);
if(!p){console.error("الصفحة غير موجودة");process.exit(1)}
const t=p.text.replace(/<[^>]+>/g,"");
for(const q of ["والسلطان الظالم شؤم لا يبقى ملكه ولا يدوم","الملك يبقى مع الكفر ولا يبقى مع الظلم"]) if(t.split(q).length!==2){console.error("الاقتباس لا يرد مرة واحدة: "+q);process.exit(1)}
fs.writeFileSync(process.argv[2],t+"\n");console.log("حُفظ",t.length,"حرفاً")
' "$SCR/4129.json" verification/era5/ghazali_tibr_turath4129_v1p44.txt
sha256sum verification/era5/ghazali_tibr_turath4129_v1p44.txt; wc -c verification/era5/ghazali_tibr_turath4129_v1p44.txt
rm -rf "$SCR"
```

**توقف إن:** فشل الجلب مرتين، أو طبع "الصفحة غير موجودة" أو "لا يرد مرة واحدة".

### الخطوة 2: سجّل المصدر في `sources/manifest.json`

أضف إلى نهاية مصفوفة `sources` هذا الكائن، بعد أن تضع التجزئة والحجم من مخرجات الخطوة 1 (لا تكتبهما من عندك):

```json
{
  "id": "turath-4129-tibr-masbuk",
  "file": "verification/era5/ghazali_tibr_turath4129_v1p44.txt",
  "url": "https://app.turath.io/book/4129",
  "license": "النص الأصلي من القرن السادس الهجري في الملك العام. النشرة: ضبط أحمد شمس الدين، دار الكتب العلمية، بيروت 1988. الاقتباس بإذن شفهي من تراث (قرار المستخدم).",
  "tier": "B",
  "landing": "https://app.turath.io/book/4129",
  "attribution": "التبر المسبوك في نصيحة الملوك، عبر تراث (turath.io)",
  "note": "صفحة واحدة فقط (ج1 ص44). الكتاب الترجمة العربية لـ«نصيحة الملوك» الفارسي المنسوب إلى الغزالي.",
  "status": "ok",
  "files": [{ "file": "verification/era5/ghazali_tibr_turath4129_v1p44.txt", "sha256": "<من sha256sum>", "bytes": <من wc -c> }]
}
```

تحقق: `node -e 'require("./sources/manifest.json")' && echo صالح`

### الخطوة 3: المواصفات والإضافة

أنشئ `verification/era5/specs/tibr.json`:

```json
{
  "era": 5,
  "source": {
    "source_id": "turath-4129-tibr-masbuk",
    "file": "verification/era5/ghazali_tibr_turath4129_v1p44.txt",
    "attributed_to": "التبر المسبوك في نصيحة الملوك، المنسوب إلى الغزالي (ت 505هـ)، ضبط أحمد شمس الدين، بيروت 1988، ج1 ص44",
    "chapter": "في ذكر العدل والسياسة وذكر الملوك وسيرهم"
  },
  "items": [
    {
      "slug": "unjust-ruler",
      "quote": "والسلطان الظالم شؤم لا يبقى ملكه ولا يدوم",
      "statement": "يقرر نص التبر المسبوك أن ملك السلطان الظالم لا يبقى ولا يدوم",
      "type": "judgment",
      "layer": "tradition",
      "hedge": "حكم وعظي في كتاب نصيحة للملوك لا رصد تاريخي، وهذا الفصل يقابل في الغالب القسم الثاني من «نصيحة الملوك» الذي يشكّ باحثون في نسبته إلى الغزالي"
    },
    {
      "slug": "kingship-and-injustice",
      "quote": "الملك يبقى مع الكفر ولا يبقى مع الظلم",
      "statement": "يورد النص قولاً ينسبه إلى النبي ﷺ: الملك يبقى مع الكفر ولا يبقى مع الظلم",
      "type": "reported_belief",
      "layer": "tradition",
      "hedge": "النص ينسب القول إلى النبي ﷺ، ولم تُتحقق هذه النسبة في كتب الحديث، فلا يُعرض حديثاً"
    }
  ]
}
```

```bash
node scripts/add_claims.mjs verification/era5/specs/tibr.json --dry-run
node scripts/add_claims.mjs verification/era5/specs/tibr.json
```

### الخطوة 4: أضف السابقتين إلى السُّنّة

في `sunan/sunan.json`، داخل الكائن الذي `id` فيه `sn_security`، أضف بعد مصفوفة `limiting` مباشرة حقلاً جديداً (المعرّفان من مخرجات الخطوة 3):

```json
"antecedents": [
  { "claim": "<معرّف unjust-ruler>", "why": "صياغة سابقة لربط بقاء الملك بالعدل، قبل ابن خلدون بنحو ثلاثة قرون" },
  { "claim": "<معرّف kingship-and-injustice>", "why": "قول متداول يقدّم العدل على الدين في بقاء الملك، ونسبته غير محققة" }
]
```

لا تغيّر أي حقل آخر في الملف.

```bash
npm run check:all
npm run build:all
node scripts/ui_smoke.mjs
```

**القبول (T2):** سطر سُنّة الأمن في مخرجات `check_sunan` يحوي `سوابق 2`، وعدد "مؤيد" فيه **لم يتغير** عمّا كان في T0.

**Commit:** `"سُنّة الأمن: سابقتان نصيتان من التبر المسبوك (تراث)"`.

### الخطوة 5: بحث استطلاعي فقط (لا إضافة)

ابحث في تراث عن **شواهد واقعية** (أحداث موصوفة لا مواعظ) يربط فيها مؤرخ معاصر بين الظلم أو المصادرة وخراب العمران. ابدأ بهذه الاستعلامات، بتمهّل 3 ثوانٍ بين كل طلب:

```bash
for q in "فخربت البلاد من كثرة المظالم" "وكثرت المصادرات فخرب" "ورحل الفلاحون من الظلم"; do
  curl -sS -m 30 -G "https://api.turath.io/search" --data-urlencode "q=$q" | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);for(const x of (a.data||a).slice(0,8)){const m=JSON.parse(x.meta);console.log(x.book_id,"|",m.book_name,"|",m.author_name,"| ج",m.vol,"ص",m.page,"|",x.text.replace(/<[^>]+>/g,"").slice(0,200))}})'
  sleep 3
done
```

اكتب النتائج في `review/candidates_security.md`: لكل نتيجة رقم الكتاب، والعنوان، والمؤلف، والجزء والصفحة، والمقطع، وهل المؤلف معاصر للحدث (إن كان معروفاً من بيانات الكتاب). **لا تضف أي ادعاء منها.** القرار للمراجع.

---

## T3. أداة استيراد المراجعة البشرية

**الهدف:** حين يعيد المراجع ملف `review/sunan_evidence_review.csv` معبّأً، تُحدَّث الادعاءات آلياً.

أنشئ `scripts/import_review.mjs` بهذه المواصفات بالضبط:

- **الاستعمال:** `node scripts/import_review.mjs --reviewer "<اسم المراجع>" [--csv <مسار>] [--dry-run]`. المسار الافتراضي `review/sunan_evidence_review.csv`. بلا `--reviewer` يخرج برمز 2.
- **القراءة:** `csv-parse/sync` مع `{ columns: true, bom: true, skip_empty_lines: true }`. الأعمدة: `المعرّف`، و`حكم المراجع (صحيح / يحتاج تعديلاً / خطأ)`، و`ملاحظات المراجع`.
- **تحميل الادعاءات:** عبر `claimEras(ROOT)` من `scripts/lib/eras.mjs`، كما في `scripts/check_schema.mjs`.
- **لكل سطر حكمه غير فارغ** (بعد `trim()`):
  - `صحيح`: `checks.meaning = { status: "independently_reviewed", reviewer }`، و`status = "verified"` إن كان `checks.quote_match === true`، و`version += 1`.
  - `خطأ`: `checks.meaning = { status: "independently_reviewed", reviewer }`، و`status = "rejected"`، و`version += 1`.
  - `يحتاج تعديلاً`: لا يُغيَّر الادعاء. يُضاف `{ id, reviewer, note: <الملاحظات>, date: <تاريخ اليوم YYYY-MM-DD> }` إلى `review/pending_edits.json` (مصفوفة، يُنشأ إن لم يوجد).
  - أي نص آخر، أو معرّف غير موجود: خطأ.
- **الذرّية:** إن وُجد أي خطأ، اطبع الأخطاء كلها واخرج برمز 1 **دون كتابة أي ملف**.
- **بعد النجاح:** اكتب ملفات `claims.json` المتغيرة فقط (بصيغة `JSON.stringify(x, null, 2) + "\n"`)، ثم شغّل التحقق من المخطط بـ `validateItems("Claim", ...)` على كل ادعاء متغير، واطبع ملخصاً: كم صحيح، وكم خطأ، وكم يحتاج تعديلاً.
- `--dry-run`: كل ما سبق دون كتابة.
- أضف إلى `package.json` في `scripts`: `"review:import": "node scripts/import_review.mjs"`.

**الاختبار (لا يمس ملفات المشروع):**

```bash
SCR=$(mktemp -d)
python3 -I - "$SCR" <<'PY'
import csv, sys
src = open("review/sunan_evidence_review.csv", encoding="utf-8-sig", newline="")
rows = list(csv.reader(src))
head, body = rows[0], rows[1:4]
col = head.index("حكم المراجع (صحيح / يحتاج تعديلاً / خطأ)")
for r, v in zip(body, ["صحيح", "خطأ", "يحتاج تعديلاً"]):
    r[col] = v
w = csv.writer(open(sys.argv[1] + "/test.csv", "w", encoding="utf-8-sig", newline=""), quoting=csv.QUOTE_ALL)
w.writerows([head] + body)
bad = [list(r) for r in body[:1]]; bad[0][col] = "ربما"
w2 = csv.writer(open(sys.argv[1] + "/bad.csv", "w", encoding="utf-8-sig", newline=""), quoting=csv.QUOTE_ALL)
w2.writerows([head] + bad)
PY
node scripts/import_review.mjs --reviewer "اختبار" --csv "$SCR/test.csv" --dry-run; echo "رمز الخروج $?"   # المتوقع 0 وملخص: 1 صحيح، 1 خطأ، 1 يحتاج تعديلاً
node scripts/import_review.mjs --reviewer "اختبار" --csv "$SCR/bad.csv" --dry-run; echo "رمز الخروج $?"    # المتوقع 1
node scripts/import_review.mjs --csv "$SCR/test.csv" --dry-run; echo "رمز الخروج $?"                       # المتوقع 2
git status --short   # يجب ألا يظهر أي تغيير في verification/ أو review/
rm -rf "$SCR"
```

**القبول (T3):** رموز الخروج الثلاثة كما هو متوقع، و`git status` نظيف إلا من الملفات الجديدة للأداة، و`check:all` رمز 0.

**Commit:** `"أداة استيراد المراجعة البشرية"`.

---

## T4. مواقع الحقبتين الثالثة والرابعة على الخريطة

كل معرّف وعنوان أدناه مُتحقَّق منه في لقطة Pleiades المحلية. `scripts/build_places.mjs` يرفض أي موقع لا يطابق عنوانه المتوقع حرفياً، فلا تعدّل العناوين.

### الخطوة 1: ملف الحقبة الثالثة

أنشئ `scripts/config/places_era3.json`:

```json
{
  "_note": "مواقع الحقبة الثالثة: الإمبراطوريات الكبرى (500 ق.م-300م). كل معرّف Pleiades مطابق لعنوان متوقع. لا مواقع تقديرية في هذه الطبقة.",
  "era": 3,
  "places": [
    { "slug": "athens", "name_ar": "أثينا", "name_en": "Athens", "pleiades_id": "579885", "expected_title": "Athenae" },
    { "slug": "rome", "name_ar": "روما", "name_en": "Rome", "pleiades_id": "423025", "expected_title": "Roma" },
    { "slug": "carthage", "name_ar": "قرطاج", "name_en": "Carthage", "pleiades_id": "314921", "expected_title": "Carthago" },
    { "slug": "syracuse", "name_ar": "سرقوسة", "name_en": "Syracuse", "pleiades_id": "462503", "expected_title": "Syracusae/Syrakousai" },
    { "slug": "alexandria", "name_ar": "الإسكندرية", "name_en": "Alexandria", "pleiades_id": "727070", "expected_title": "Alexandria" },
    { "slug": "jerusalem", "name_ar": "القدس", "name_en": "Jerusalem", "pleiades_id": "687928", "expected_title": "Ierusalem/Hierosolyma/Col. Aelia Capitolina" },
    { "slug": "persepolis", "name_ar": "برسبوليس", "name_en": "Persepolis", "pleiades_id": "922695", "expected_title": "Persepolis/Parsa/Persai/Sat Setun" },
    { "slug": "babylon", "name_ar": "بابل", "name_en": "Babylon", "pleiades_id": "893951", "expected_title": "Babylon" },
    { "slug": "ctesiphon", "name_ar": "طيسفون (المدائن)", "name_en": "Ctesiphon", "pleiades_id": "893976", "expected_title": "Ctesiphon" },
    { "slug": "palmyra", "name_ar": "تدمر", "name_en": "Palmyra", "pleiades_id": "668331", "expected_title": "Palmyra" },
    { "slug": "petra", "name_ar": "البتراء", "name_en": "Petra", "pleiades_id": "697725", "expected_title": "Petra" },
    { "slug": "ephesus", "name_ar": "أفسس", "name_en": "Ephesus", "pleiades_id": "599612", "expected_title": "Ephesus/Arsinoe(ia)" },
    { "slug": "gades", "name_ar": "قادس", "name_en": "Gades", "pleiades_id": "256177", "expected_title": "Gadeira/Gades/Col. Augusta Gaditana" },
    { "slug": "lepcis", "name_ar": "لبدة الكبرى", "name_en": "Lepcis Magna", "pleiades_id": "344448", "expected_title": "Neapolis/Lepcis Magna" },
    { "slug": "londinium", "name_ar": "لوندينيوم (لندن)", "name_en": "Londinium", "pleiades_id": "79574", "expected_title": "Londinium/Augusta" },
    { "slug": "pataliputra", "name_ar": "باتاليبوترا", "name_en": "Pataliputra", "pleiades_id": "59978", "expected_title": "Palibothra" },
    { "slug": "taxila", "name_ar": "تكسيلا", "name_en": "Taxila", "pleiades_id": "60083", "expected_title": "Taxila" },
    { "slug": "marakanda", "name_ar": "مرقندة (سمرقند)", "name_en": "Marakanda", "pleiades_id": "59915", "expected_title": "Marakanda" }
  ]
}
```

### الخطوة 2: ملف الحقبة الرابعة

أنشئ `scripts/config/places_era4.json`:

```json
{
  "_note": "مواقع الحقبة الرابعة (300-1000م). المدن المؤسسة في العصر الإسلامي (بغداد، الكوفة، البصرة، الفسطاط، القيروان، سامراء العباسية) ليست في Pleiades، ولم تُضف لأن لا معجم أماكن مفتوحاً معتمداً لها بعد.",
  "era": 4,
  "places": [
    { "slug": "constantinople", "name_ar": "القسطنطينية", "name_en": "Constantinople", "pleiades_id": "520998", "expected_title": "Constantinopolis" },
    { "slug": "ctesiphon", "name_ar": "طيسفون (المدائن)", "name_en": "Ctesiphon", "pleiades_id": "893976", "expected_title": "Ctesiphon" },
    { "slug": "damascus", "name_ar": "دمشق", "name_en": "Damascus", "pleiades_id": "678106", "expected_title": "Damascus" },
    { "slug": "jerusalem", "name_ar": "القدس", "name_en": "Jerusalem", "pleiades_id": "687928", "expected_title": "Ierusalem/Hierosolyma/Col. Aelia Capitolina" },
    { "slug": "alexandria", "name_ar": "الإسكندرية", "name_en": "Alexandria", "pleiades_id": "727070", "expected_title": "Alexandria" },
    { "slug": "ravenna", "name_ar": "رافينا", "name_en": "Ravenna", "pleiades_id": "393480", "expected_title": "Ravenna" },
    { "slug": "cordoba", "name_ar": "قرطبة", "name_en": "Córdoba", "pleiades_id": "256128", "expected_title": "Corduba/Col. Patricia" },
    { "slug": "toledo", "name_ar": "طليطلة", "name_en": "Toledo", "pleiades_id": "266066", "expected_title": "Toletum" },
    { "slug": "edessa", "name_ar": "الرُّها", "name_en": "Edessa", "pleiades_id": "658457", "expected_title": "Edessa/Antiochia ad Callirhoem" },
    { "slug": "bostra", "name_ar": "بصرى", "name_en": "Bostra", "pleiades_id": "678073", "expected_title": "Bostra/Col. Nova Traiana Alexandriana" }
  ]
}
```

### الخطوة 3: البناء

```bash
node scripts/build_places.mjs scripts/config/places_era3.json data/raw/pleiades-places-latest.csv.gz web/data/places_era3.geojson
node scripts/build_places.mjs scripts/config/places_era4.json data/raw/pleiades-places-latest.csv.gz web/data/places_era4.geojson
```

إن رفض موقعاً لعدم مطابقة العنوان، **احذف ذلك الموقع** من الإعداد (لا تعدّل عنوانه)، وسجّله في التقرير، وأعد البناء.

### الخطوة 4: الربط في `package.json` و`web/app.js`

1. في `package.json`، ألحق بنهاية قيمة `build:places` (داخل علامتي التنصيص):
   ```
    && node scripts/build_places.mjs scripts/config/places_era3.json data/raw/pleiades-places-latest.csv.gz web/data/places_era3.geojson && node scripts/build_places.mjs scripts/config/places_era4.json data/raw/pleiades-places-latest.csv.gz web/data/places_era4.geojson
   ```
2. في `web/app.js`، داخل مصفوفة `const ERAS = [`، أضف بعد سطر الحقبة 2:
   ```js
     { id: 3, label: "الإمبراطوريات الكبرى", file: "data/places_era3.geojson", desc: "الحقبة الثالثة: الإمبراطوريات الكبرى (500 ق.م-300م)." },
     { id: 4, label: "الأديان الكبرى", file: "data/places_era4.geojson", desc: "الحقبة الرابعة: الأديان الكبرى وتشكّل العالم القديم المتأخر (300-1000م). مدن العصر الإسلامي المؤسسة حديثاً ليست في هذه الطبقة بعد." },
   ```

```bash
npm run build:all
npm run check:all
node scripts/ui_smoke.mjs
```

**القبول (T4):** `ui_smoke` يطبع `"eras":4` في الحاسوب والهاتف، و"الواجهة سليمة". افتح `out/ui_desktop.png` بأداة القراءة وتأكد أن الخريطة ظاهرة.

**Commit:** `"مواقع الحقبتين الثالثة والرابعة من Pleiades"`.

---

## T5. التوثيق والرفع والتقرير

1. حدّث `README.md` في القسم الذي يذكر الحقب والمواقع: الحقب ذات المواقع صارت 1–4، والحقبة 7 لها ادعاءات. لا تكتب أعداداً؛ أحل إلى `web/data/claims_index.json`.
2. حدّث `verification/era7/README.md`: أضف سطراً "الاقتباسات الحرفية: فُحصت بـ add_claims.mjs وcheckQuote" مع تاريخ اليوم.
3. أضف إلى `review/README.md` في "سجل التصحيحات" سطراً عن ادعاءات الحقبة السابعة والتبر المسبوك، وأنها تنتظر المراجعة البشرية أيضاً، ثم شغّل `npm run build:review` ليدخلها في ورقة المراجعة إن كانت مستعملة في السنن.
4. `npm run check:all` ثم commit: `"توثيق الجولة"`.
5. الرفع:
   ```bash
   git push -u origin haiku/era7-ghazali-places
   ```
   عند فشل شبكي فقط أعد المحاولة حتى 4 مرات بانتظار 2 ثم 4 ثم 8 ثم 16 ثانية. ثم افتح طلب دمج مسودة:
   ```bash
   gh pr create --draft --base main --title "الحقبة السابعة، سوابق سُنّة الأمن، استيراد المراجعة، مواقع الحقبتين 3 و4" --body-file <ملف فيه ملخص التقرير>
   ```

### صيغة التقرير النهائي (إلزامية)

```
## تقرير التنفيذ
| المهمة | الحالة (تم / جزئي / متوقف) | الدليل (أمر ومخرجه المختصر) |
|---|---|---|
| T0 | | |
| T1 | | المعرّفات: ... |
| T2 | | المعرّفان: ...؛ سطر check_sunan لسُنّة الأمن: ... |
| T3 | | |
| T4 | | المواقع المحذوفة لعدم المطابقة: ... |
| T5 | | رابط طلب الدمج: ... |

### ما لم يُنفَّذ ولماذا
### ما يحتاج قراراً بشرياً
- مقترحات review/sunan_proposals.md
- مرشحو review/candidates_security.md
### آخر مخرجات check:all (آخر 10 أسطر حرفياً)
```

---

## خارج نطاق هذه الجولة (لا تلمسه)

- الحقبة الثامنة: نصوص الأمم المتحدة في الطبقة C، فلا استخراج منها.
- أوليا جلبي المجلد الأول (OCR رديء)، والباحث الذكي، وبيانات السكان على مستوى الدول قبل 1800.
- مدن العصر الإسلامي في الحقبتين 4 و5: تحتاج معجم أماكن مفتوحاً (مثل الثريا) بعد التحقق من ترخيصه.
- إعادة تحليل Seshat (`npm run analyze:seshat`).
- أي تعديل على ادعاءات قائمة أو نصوص ابن خلدون في `sunan/sunan.json`.
