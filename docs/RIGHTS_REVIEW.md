# مراجعة الحقوق قبل النشر العام

> مولَّد بـ `scripts/build_rights_review.mjs` من `sources/manifest.json`. لا يُعدَّل يدوياً، ويُعاد بناؤه بعد كل تغيير في المصادر.

## الطبقات

- **A:** ملك عام أو ترخيص مفتوح يسمح بالنشر مع الإسناد. عددها 51.
- **B:** مرخّص أو بإذن موثّق، يُراجع شرطه قبل النشر. عددها 20.
- **C:** مرجع فقط بلا استخراج. عددها 0.
- **بلا إسناد مسجّل في المانيفست:** 1 مصدراً: hyde-3.3. يُكمَل إسناد كل منها قبل النشر.

## المصادر

| المعرّف | الطبقة | الرخصة | يُجلب وقت العرض | الإسناد |
|---|---|---|---|---|
| pleiades-places | A | CC BY 3.0 (بحسب سجل Zenodo للإصدار 4.1؛ يُتحقق من ملف الداتا نفسه) | لا | Pleiades (pleiades.stoa.org)، CC BY 3.0 بحسب سجل الإصدار؛ صفحة الموقع تذكر أن المحتوى كله بترخيص Creative Commons Attribution |
| pleiades-names | A | CC BY 3.0 (يُتحقق كما أعلاه) | لا | Pleiades (pleiades.stoa.org)، CC BY 3.0 بحسب سجل الإصدار؛ صفحة الموقع تذكر أن المحتوى كله بترخيص Creative Commons Attribution |
| pleiades-locations | A | CC BY 3.0 (يُتحقق كما أعلاه) | لا | Pleiades (pleiades.stoa.org)، CC BY 3.0 بحسب سجل الإصدار؛ صفحة الموقع تذكر أن المحتوى كله بترخيص Creative Commons Attribution |
| hyde-3.3 | A | CC BY 4.0 (بحسب صفحة الجامعة) | لا | — |
| cdli-text | A | شروط استخدام CDLI (cdli.earth/terms-of-use، اطّلعنا عليها في 2026/10/30): النصوص والترجمات قابلة للنسخ وإعادة الاستعمال وفق الأعراف الأكاديمية، مع طلب الإشارة إلى CDLI وعنوانه عند إعادة استعمال قدر كبير منها. الصور للاستعمال غير التجاري فقط، ولأصحابها شروط. | لا | Cuneiform Digital Library Initiative (cdli.earth)، بحسب شروط الاستخدام |
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
| turath-4129-tibr-masbuk | A | ملك عام بقرار صاحب المشروع (2026-11-09): متن التبر المسبوك (القرن السادس الهجري) ملك عام، والمقتبس من المتن. النشرة من تراث (ضبط أحمد شمس الدين، دار الكتب العلمية، 1988) حديثة، وفي المقاطع تشكيل قليل قد يكون من الضبط. لا إذن مكتوب من تراث. | لا | التبر المسبوك في نصيحة الملوك، عبر تراث (turath.io) |
| turath-30026-sayrafi | A | ملك عام بقرار صاحب المشروع (2026-11-09): متن إنباء الهصر لابن الصيرفي (القرن التاسع الهجري) ملك عام، والمقتبس من المتن. النشرة من تراث، وبيانات الطبعة غير مقروءة، وفي أحد المقاطع تشكيل قد يكون من المحقق. لا إذن مكتوب من تراث. | لا | ابن الصيرفي، إنباء الهصر بأنباء العصر، عبر تراث (turath.io) |
| naturalearth-populated-places-50m | A | ملك عام (Natural Earth) | لا | Natural Earth (public domain): populated places |
| wikidata-islamic-cities | A | CC0 (Wikidata) | لا | Wikidata (CC0) |
| tahtawi-takhlis-archive | A | ملك عام بقرار صاحب المشروع (2026-11-09): المتن لرفاعة الطهطاوي (ت 1873)، ونُشر أول مرة في بولاق سنة 1834، والمقتبس من المتن وحده لا من حواشي المحقق. الطبعة المحفوظة غير معرّفة (الأرشيف بلا بيانات لها)، والطبعات المؤرخة (1834، 1849، 1904) لم تُطابَق بها المقاطع لضعف OCR. | لا | رفاعة الطهطاوي، تخليص الإبريز في تلخيص باريز (نسخة أرشيف الإنترنت) |
| brinkley-japan-v4-1901 | A | ملك عام: كتاب 1901 (المؤلف فرانك بريكلي ت 1912). النص من أرشيف الإنترنت (OCR). | لا | Frank Brinkley، Japan: its history, arts, and literature، المجلد 4 (1901) |
| versailles-1919 | A | ملك عام: نُشر سنة 1919 (London: H.M. Stationery Office، بحسب بيانات الأرشيف)، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. وحقوق التاج البريطانية على العمل المنشور مدتها 50 سنة من نهاية سنة النشر فانتهت سنة 1969، لكن نص القانون (CDPA 1988، المادة 163) لم يُقرأ لأن موقع legislation.gov.uk محجوب عن الجلسة. | لا | The Treaty of Peace between the Allied and Associated Powers and Germany (1919) |
| historical-basemaps | B | GNU GPL v3 (الملف LICENSE في المستودع). لا يُذكر ترخيص البيانات منفصلاً، فتُعامل الملفات بترخيص المستودع. الاستعمال في الأطلس يخضع لشروط GPL-3، ويجب تحديد ذلك عند التوزيع. | لا | Historical Basemaps (aourednik), GPL-3 |
| naturalearth-countries-50m | A | ملك عام (Natural Earth) | لا | Natural Earth (public domain): admin-0 countries |
| aws-terrain-tiles | B | بيانات مفتوحة مع إسناد إلزامي: أغلبها ملك عام (USGS 3DEP وSRTM وGMTED2010، وNOAA ETOPO1)، وبعضها مرخّص بشرط الإسناد (Copernicus EU-DEM، وأستراليا، وكندا OGL، وبريطانيا، والنمسا، والنرويج، ونيوزيلندا، والمكسيك، وArcticDEM) | نعم | https://github.com/tilezen/joerd/blob/master/docs/attribution.md (النص الكامل منقول في تذييل الواجهة) |
| nasa-gibs-bluemarble | A | ملك عام (صور NASA)، مع طلب الإسناد لـ NASA وخدمة GIBS | نعم | NASA Blue Marble: Next Generation, Reto Stöckli, NASA Earth Observatory; imagery via NASA GIBS (ESDIS) |
| nasa-gibs-blackmarble | A | ملك عام (صور NASA)، مع طلب الإسناد لـ NASA وخدمة GIBS | نعم | NASA Black Marble 2016 (VIIRS, Suomi NPP); imagery via NASA GIBS (ESDIS) |
| naturalearth-populated-places-50m-full | A | ملك عام (Natural Earth) | لا | Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com. |
| wikidata-hb-names | A | CC0 1.0 (Wikidata) | لا | Wikidata (CC0) |
| smith-wealth-oup1904-vol1 | A | ملك عام: نص آدم سميث (ت. 1790)، طبعة Oxford University Press، لندن 1904 (منشورة قبل 1929). | لا | Adam Smith, An Inquiry into the Nature and Causes of the Wealth of Nations, vol. 1 (London: Oxford University Press, 1904); scan by UNC Chapel Hill via Internet Archive |
| smith-wealth-cannan1904-vol2 | A | ملك عام: نص آدم سميث (ت. 1790)، تحرير Edwin Cannan (ت. 1935)، Methuen وPutnam، 1904 (منشورة قبل 1929). الأرشيف يصنّفها NOT_IN_COPYRIGHT. | لا | Adam Smith, The Wealth of Nations, ed. Edwin Cannan, vol. 2 (London: Methuen; New York: Putnam, 1904); scan by University of Toronto via Internet Archive |
| maddison-2023-owid | B | CC BY 4.0: «Maddison Project Database, version 2023 by Jutta Bolt and Jan Luiten van Zanden is licensed under a Creative Commons Attribution 4.0 International License» (rug.nl)، وبيانات Dataverse: CC-BY-4.0. ونسخة Our World in Data بترخيص CC BY مع بقاء ترخيص المصدر. | لا | Bolt, J. and van Zanden, J. L. (2024), Maddison style estimates of the evolution of the world economy: A new 2023 update, Journal of Economic Surveys; data via Our World in Data (with minor processing) |
| ucdp-prio-acd-261 | B | CC BY 4.0: «All datasets are free of charge and licensed under CC BY 4.0 — you are free to use and redistribute them provided you cite the relevant publications listed with each dataset» (ucdp.uu.se/downloads، الصفحة نفسها تذكر الإصدار 26.1). | لا | UCDP/PRIO Armed Conflict Dataset version 26.1، Uppsala Conflict Data Program وPRIO. الاستشهاد المدرج في صفحة التنزيلات: Gleditsch, Nils Petter et al. (2002) Armed Conflict 1946-2001: A New Dataset، Journal of Peace Research 39(5)، مع الاستشهاد المحدد في الكودبوك لم يُقرأ بعد. |
| un-wpp-2024-medium | B | CC BY 3.0 IGO: «Copyright © 2024 by United Nations, made available under a Creative Commons license CC BY 3.0 IGO» (مقروء من صفحة التنزيلات الرسمية population.un.org/wpp/downloads، بعد تشغيلها بالمتصفح). | لا | United Nations, Department of Economic and Social Affairs, Population Division (2024). World Population Prospects 2024, Online Edition. |
| ucdp-onesided-261 | B | CC BY 4.0: «All datasets are free of charge and licensed under CC BY 4.0 — you are free to use and redistribute them provided you cite the relevant publications listed with each dataset» (ucdp.uu.se/downloads/، الصفحة نفسها تذكر الإصدار 26.1). | لا | UCDP One-sided Violence Dataset 26.1، Uppsala Conflict Data Program وPRIO. Davies, Shawn, Therése Pettersson & Magnus Öberg (2026)، Organized violence 1989–2025، Journal of Peace Research، doi:10.1093/jopres/xjag046 (الاستشهاد العام الوارد في صفحة التنزيلات؛ الاستشهاد الخاص بكل مجموعة يُقرأ من صفحتها قبل النشر). |
| ucdp-brd-conf-261 | B | CC BY 4.0: «All datasets are free of charge and licensed under CC BY 4.0 — you are free to use and redistribute them provided you cite the relevant publications listed with each dataset» (ucdp.uu.se/downloads/، الصفحة نفسها تذكر الإصدار 26.1). | لا | UCDP Battle-Related Deaths Dataset (conflict-level) 26.1، Uppsala Conflict Data Program وPRIO. Davies, Shawn, Therése Pettersson & Magnus Öberg (2026)، Organized violence 1989–2025، Journal of Peace Research، doi:10.1093/jopres/xjag046 (الاستشهاد العام الوارد في صفحة التنزيلات؛ الاستشهاد الخاص بكل مجموعة يُقرأ من صفحتها قبل النشر). |
| gapminder-systema-globalis | B | CC BY 4.0: «Gapminder created this dataset and provides it under Creative Common Attribution 4.0 International» (README المستودع open-numbers/ddf--gapminder--systema_globalis). هذا الترخيص يغطي تجميع Gapminder. ترخيص البيانات الأصلية (البنك الدولي للضريبة والتجارة، وUNESCO للقراءة) لم يُتحقَّق منه من صفحاته، وقد وافق صاحب المشروع على الاعتماد على ترخيص Gapminder. | لا | Gapminder Foundation، مجموعة Systema Globalis (DDF). المصادر الأصلية: World Development Indicators (البنك الدولي) للضريبة والتجارة، وUNESCO للإلمام بالقراءة، بحسب تعريفات المستودع نفسه. |
| behistun | A | ملك عام: نُشر سنة 1846، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Rawlinson، The Persian cuneiform inscription at Behistun (1846) |
| luckenbill | A | ملك عام: نُشر سنة 1927، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Luckenbill، Ancient Records of Assyria and Babylonia، المجلد II (1927) |
| kjv1611-1872-vol2 | A | ملك عام: نُشر سنة 1872، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | The Holy Bible، Authorized Version (1611)، لندن 1872، المجلد II |
| kjv1611-1872-vol6 | A | ملك عام: نُشر سنة 1876، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | The Holy Bible، Authorized Version (1611)، المجلد VI |
| herodotus | A | ملك عام: نُشر سنة 1861، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Herodotus، History of Herodotus، ترجمة G. Rawlinson، المجلد III (1861) |
| chavannes | A | ملك عام: نُشر سنة 1895، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Chavannes، Les Mémoires historiques de Se-ma Ts'ien (1895-1905) |
| thucydides | A | ملك عام: نُشر سنة 1910، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Thucydides، The Peloponnesian War، ترجمة R. Crawley، Everyman's Library (1910) |
| tacitus | A | ملك عام: نُشر سنة 1921، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Tacitus، The Annals، ترجمة Church وBrodribb (1921) |
| asoka | A | ملك عام: نُشر سنة 1920، والأرشيف يحمل علامة public-domain mark 1.0. | لا | Bhandarkar وMajumdar، The Inscriptions of Asoka (1920) |
| arthashastra | A | ملك عام: نُشر سنة 1929، والمترجم R. Shamasastry توفي سنة 1944، فهو في الملك العام في بلدان life+70 منذ 2015، وفي الولايات المتحدة منذ 2025. | لا | Shamasastry، Kautilya's Arthasastra (1929) |
| polybius | A | ملك عام: نُشر سنة 1889، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Polybius، The Histories، ترجمة E. S. Shuckburgh (1889) |
| polybius-paton-1922 | A | ملك عام: نُشر سنة 1922، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Polybius، The Histories، ترجمة W. R. Paton، Loeb (1922) |
| polybius-paton-1925 | A | ملك عام: نُشر سنة 1925، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Polybius، The Histories، المجلد IV، ترجمة W. R. Paton، Loeb (1925) |
| xuanzang-beal | A | ملك عام: نُشر سنة 1884، والأرشيف يحمل علامة public-domain mark 1.0. | لا | Beal، Si-Yu-Ki: Buddhist Records of the Western World (1884) |
| gregory-brehaut | A | ملك عام: نُشر سنة 1916، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Gregory of Tours، The History of the Franks، ترجمة E. Brehaut (1916) |
| procopius-dewing-1928 | A | ملك عام: الأرشيف يذكر 1914 وREADME يذكر 1928 للمجلد الخامس، وكلاهما ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Procopius، ترجمة H. B. Dewing، Loeb، المجلد V |
| ricci-trigault-1615 | A | ملك عام: نُشر سنة 1615، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Ricci وTrigault، De Christiana expeditione apud Sinas (1615) |
| evliya-ottoman-1896-v2 | A | ملك عام: نُشر سنة 1896، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Evliya Çelebi، Seyahatname، المجلد II (1896) |
| khaldun-slane-1863 | A | ملك عام: نُشر سنة 1863، والأرشيف يحمل علامة public-domain mark 1.0. | لا | Ibn Khaldun، Les Prolégomènes، ترجمة de Slane (1863) |
| hammurabi | A | ملك عام: نُشر سنة 1904، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Harper، The Code of Hammurabi, King of Babylon (1904) |
| ptahhotep | A | ملك عام: نُشر سنة 1912، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. والمترجم B. Gunn توفي سنة 1950. | لا | Gunn، The Instruction of Ptah-hotep (1912، صفحة العنوان 1918) |
| gilgamesh | A | ملك عام: نُشر سنة 1876، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | George Smith، The Chaldean Account of Genesis (1876) |
| kjv1611 | A | ملك عام: نُشر سنة 1611، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | 1611 King James Bible |
| polo-yule-1871 | A | ملك عام: نُشر سنة 1871، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Yule، The Book of Ser Marco Polo، المجلد 1 (1871) |
| battuta-defremery | A | ملك عام: نُشر سنة 1853، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Defrémery وSanguinetti، Voyages d'Ibn Batoutah، المجلد 1 (1853) |
| garcilaso-rycaut-1688 | A | ملك عام: نُشر سنة 1688، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | لا | Garcilaso de la Vega، The Royal Commentaries of Peru، ترجمة Rycaut (1688) |
| diaz-maudslay | A | ملك عام: نُشر سنة 1908، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. والمترجم A. P. Maudslay توفي سنة 1931. | لا | Díaz del Castillo، The True History of the Conquest of New Spain، ترجمة Maudslay، Hakluyt Society، المجلد 2 (1908) |
| sima-qian-zh | B | النص الأصلي ملك عام (سيما تشيان، نحو 90 ق.م). التفريغ في ويكي مصدر بترخيص CC BY-SA 4.0 بحسب تذييل الصفحة. | لا | 史記 卷123 大宛列傳، ويكي مصدر الصيني (CC BY-SA 4.0) |
| hanshu-zh | B | النص الأصلي ملك عام (بان قو، القرن الأول الميلادي). التفريغ في ويكي مصدر بترخيص CC BY-SA 4.0 بحسب تذييل الصفحة. | لا | 漢書 卷96 西域傳 (上 و下)، ويكي مصدر الصيني (CC BY-SA 4.0) |
| bede-latin-pl95 | B | النص الأصلي ملك عام (بيدا، ت 735؛ Patrologia Latina 95). التفريغ في ويكي مصدر بترخيص CC BY-SA 4.0 بحسب تذييل الصفحة. | لا | Beda Venerabilis، Historia Ecclesiastica gentis Anglorum، الكتب I وII وIV، ويكي مصدر اللاتيني (CC BY-SA 4.0) |
| tacitus-agricola-la-ws | B | النص الأصلي ملك عام (تاسيتوس، نحو 98م). التفريغ في ويكي مصدر بترخيص CC BY-SA 4.0 بحسب تذييل الصفحة. | لا | Tacitus، De vita et moribus Iulii Agricolae، ويكي مصدر اللاتيني (CC BY-SA 4.0) |
| sallust-catilina-la-ws | B | النص الأصلي ملك عام (سالوست، نحو 40 ق.م). التفريغ في ويكي مصدر بترخيص CC BY-SA 4.0 بحسب تذييل الصفحة. | لا | Sallustius، De Catilinae coniuratione، ويكي مصدر اللاتيني (CC BY-SA 4.0) |
| gama-hakluyt-1898 | A | ملك عام: نُشر سنة 1898، والأرشيف يحمل علامة public-domain mark 1.0. | لا | A Journal of the First Voyage of Vasco da Gama, 1497-1499، ترجمة E. G. Ravenstein، Hakluyt Society (1898) |
| tabari-turath-9783 | A | ملك عام بقرار صاحب المشروع (2026-11-09): متن تاريخ الطبري (ت 310هـ) ملك عام، والمقتبس من المتن. النشرة من تراث (ط المعارف، المجلدات 1-11) حديثة، والمحقق غير مذكور في البيانات، وREADME الحقبة الرابعة يرجّح أنها محمية. لا إذن مكتوب من تراث. | لا | الطبري، تاريخ الرسل والملوك، عبر تراث (turath.io، الكتاب 9783) |

## التزامات قبل النشر (أسئلة لصاحب المشروع، لا قرارات)

1. **Historical Basemaps (GPL-3):** نشر ما يُبنى منها (حدود الحقب، والتحولات، والمكعّب) يقتضي الرخصة نفسها لتلك البيانات. هل يُنشر الأطلس بترخيص GPL-3، أم تُستبعد هذه الطبقة من النشر العام؟
2. **Seshat (CC BY-NC-SA):** الاستعمال غير تجاري، والمشتقات تُنشر بالترخيص نفسه. هل الأطلس غير ربحي في نشره؟ وهل يُنشر ما يُشتق من اختبارات Seshat بالشروط نفسها؟
3. **Terrain Tiles:** الإسناد إلزامي. يظهر نصه في أداة الإسناد على الخريطة (`DEM_ATTRIBUTION` في `web/app.js`)، ولا يرد اسمه في فقرة المصادر في `web/index.html`. هل يكفي هذا، أم تُضاف الفقرة إلى المصادر؟
