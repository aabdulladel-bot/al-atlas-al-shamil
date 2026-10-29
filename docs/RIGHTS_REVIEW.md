# مراجعة الحقوق قبل النشر العام

> مولَّد بـ `scripts/build_rights_review.mjs` من `sources/manifest.json`. لا يُعدَّل يدوياً، ويُعاد بناؤه بعد كل تغيير في المصادر.

## الطبقات

- **A:** ملك عام أو ترخيص مفتوح يسمح بالنشر مع الإسناد. عددها 17.
- **B:** مرخّص أو بإذن موثّق، يُراجع شرطه قبل النشر. عددها 11.
- **C:** مرجع فقط بلا استخراج. عددها 0.
- **بلا إسناد مسجّل في المانيفست:** 5 مصدراً: pleiades-places، pleiades-names، pleiades-locations، hyde-3.3، cdli-text. يُكمَل إسناد كل منها قبل النشر.

## المصادر

| المعرّف | الطبقة | الرخصة | يُجلب وقت العرض | الإسناد |
|---|---|---|---|---|
| pleiades-places | A | CC BY 3.0 (بحسب سجل Zenodo للإصدار 4.1؛ يُتحقق من ملف الداتا نفسه) | لا | — |
| pleiades-names | A | CC BY 3.0 (يُتحقق كما أعلاه) | لا | — |
| pleiades-locations | A | CC BY 3.0 (يُتحقق كما أعلاه) | لا | — |
| hyde-3.3 | A | CC BY 4.0 (بحسب صفحة الجامعة) | لا | — |
| cdli-text | A | CC BY 4.0 (الصفحة الرسمية؛ الصور لها شروطها) | لا | — |
| seshat-equinox | B | CC BY-NC-SA بحسب README الأرشيف ومستودع Seshat. الاستخدام غير تجاري مسموح بإسناد وبنفس الترخيص للمشتق. ملف LICENSE المرفق (CC0) وسجل Zenodo (cc-by) متعارضان، والاعتماد على الأشد. المالك: الأطلس غير تجاري. | لا | This research employed data from the Seshat Databank (seshatdatabank.info) under Creative Commons Attribution Non-Commercial (CC By-NC SA) licensing. |
| gapminder-total-population | B | CC BY 4.0 (بحسب README المستودع: Gapminder created this dataset and provides it under CC BY 4.0) | لا | Population data from Gapminder (Systema Globalis, CC BY 4.0). https://www.gapminder.org |
| gapminder-country-entities | B | CC BY 4.0 (بحسب README المستودع نفسه) | لا | Country entities from Gapminder (Systema Globalis, CC BY 4.0). |
| owid-hyde-regional-population | B | CC BY 4.0 (OWID للبيانات المنشورة؛ HYDE: CC BY 4.0 بحسب فهرس DataHub) | لا | Population data from HYDE (Klein Goldewijk et al., 2016), via Our World in Data (CC BY 4.0). |
| wikisource-muqaddima-ar | B | النص الأصلي في الملك العام (ابن خلدون، ت 808هـ). التفريغ في ويكي مصدر بترخيص CC BY-SA. | لا | نص مقدمة ابن خلدون من ويكي مصدر العربي (CC BY-SA)، https://ar.wikisource.org |
| naturalearth-50m | A | Public domain (Natural Earth) | لا | Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com. |
| wikisource-latin-tacitus-sallust | B | النصان الأصليان في الملك العام (تاسيتوس نحو 98م، سالوست نحو 40 ق.م). التفريغ في ويكي مصدر بترخيص CC BY-SA. | لا | Latin texts from Wikisource (CC BY-SA) |
| tocqueville-reeve-1840-vol3 | A | ملك عام: ترجمة Henry Reeve، لندن: Saunders and Otley، 1840 (المترجم ت. 1895). | لا | Tocqueville, Democracy in America, Part II (vol. III), tr. H. Reeve, 1840; scan by Google via Internet Archive |
| darwin-origin-1859 | A | ملك عام: London: John Murray, 1859 (الطبعة الأولى). | لا | Darwin, On the Origin of Species, 1st ed., London: John Murray, 1859; scan via Internet Archive |
| marx-manifesto-moore-1888-mia | B | ترجمة Samuel Moore (1888) في الملك العام. التفريغ من أرشيف الماركسيين (marxists.org، Copyleft) عن Progress Publishers 1969. | لا | Marx & Engels, Manifesto of the Communist Party, tr. S. Moore 1888; transcription Marxists Internet Archive |
| turath-4129-tibr-masbuk | B | النص الأصلي من القرن السادس الهجري في الملك العام. النشرة: ضبط أحمد شمس الدين، دار الكتب العلمية، بيروت 1988. الاقتباس بإذن شفهي من تراث (قرار المستخدم). | لا | التبر المسبوك في نصيحة الملوك، عبر تراث (turath.io) |
| turath-30026-sayrafi | B | النص من تاريخ مصر المملوكية (القرن التاسع الهجري)، في الملك العام. النشرة من تراث بإذن شفهي من المستخدم (قرار المستخدم). بيانات الطبعة غير مقروءة في الاستجابة المحفوظة. | لا | ابن الصيرفي، إنباء الهصر بأنباء العصر، عبر تراث (turath.io) |
| naturalearth-populated-places-50m | A | ملك عام (Natural Earth) | لا | Natural Earth (public domain): populated places |
| wikidata-islamic-cities | A | CC0 (Wikidata) | لا | Wikidata (CC0) |
| tahtawi-takhlis-archive | A | ملك عام: تأليف رفاعة الطهطاوي (ت 1873)، والطبعة غير مؤرخة في بيانات هذه النسخة. النص من أرشيف الإنترنت (OCR). | لا | رفاعة الطهطاوي، تخليص الإبريز في تلخيص باريز (نسخة أرشيف الإنترنت) |
| brinkley-japan-v4-1901 | A | ملك عام: كتاب 1901 (المؤلف فرانك بريكلي ت 1912). النص من أرشيف الإنترنت (OCR). | لا | Frank Brinkley، Japan: its history, arts, and literature، المجلد 4 (1901) |
| versailles-1919 | A | ملك عام: نص معاهدة منشورة سنة 1919 من حكومة بريطانيا (HMSO)، وحقوق التاج على الوثائق الحكومية انتهت. النص من أرشيف الإنترنت. | لا | The Treaty of Peace between the Allied and Associated Powers and Germany (1919) |
| historical-basemaps | B | GNU GPL v3 (الملف LICENSE في المستودع). لا يُذكر ترخيص البيانات منفصلاً، فتُعامل الملفات بترخيص المستودع. الاستعمال في الأطلس يخضع لشروط GPL-3، ويجب تحديد ذلك عند التوزيع. | لا | Historical Basemaps (aourednik), GPL-3 |
| naturalearth-countries-50m | A | ملك عام (Natural Earth) | لا | Natural Earth (public domain): admin-0 countries |
| aws-terrain-tiles | B | بيانات مفتوحة مع إسناد إلزامي: أغلبها ملك عام (USGS 3DEP وSRTM وGMTED2010، وNOAA ETOPO1)، وبعضها مرخّص بشرط الإسناد (Copernicus EU-DEM، وأستراليا، وكندا OGL، وبريطانيا، والنمسا، والنرويج، ونيوزيلندا، والمكسيك، وArcticDEM) | نعم | https://github.com/tilezen/joerd/blob/master/docs/attribution.md (النص الكامل منقول في تذييل الواجهة) |
| nasa-gibs-bluemarble | A | ملك عام (صور NASA)، مع طلب الإسناد لـ NASA وخدمة GIBS | نعم | NASA Blue Marble: Next Generation, Reto Stöckli, NASA Earth Observatory; imagery via NASA GIBS (ESDIS) |
| naturalearth-populated-places-50m-full | A | ملك عام (Natural Earth) | لا | Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com. |
| wikidata-hb-names | A | CC0 1.0 (Wikidata) | لا | Wikidata (CC0) |

## التزامات قبل النشر (أسئلة لصاحب المشروع، لا قرارات)

1. **Historical Basemaps (GPL-3):** نشر ما يُبنى منها (حدود الحقب، والتحولات، والمكعّب) يقتضي الرخصة نفسها لتلك البيانات. هل يُنشر الأطلس بترخيص GPL-3، أم تُستبعد هذه الطبقة من النشر العام؟
2. **Seshat (CC BY-NC-SA):** الاستعمال غير تجاري، والمشتقات تُنشر بالترخيص نفسه. هل الأطلس غير ربحي في نشره؟ وهل يُنشر ما يُشتق من اختبارات Seshat بالشروط نفسها؟
3. **Terrain Tiles:** الإسناد إلزامي. يظهر نصه في أداة الإسناد على الخريطة (`DEM_ATTRIBUTION` في `web/app.js`)، ولا يرد اسمه في فقرة المصادر في `web/index.html`. هل يكفي هذا، أم تُضاف الفقرة إلى المصادر؟
