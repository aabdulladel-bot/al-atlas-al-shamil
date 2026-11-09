# LICENSES.md: سجل تراخيص المواد المنشورة

يسرد هذا الملف كل مادة تظهر في الملفات المنشورة تحت `web/`، وكل نص مقتبس يصل إليها عبر الادعاءات. القواعد في `CLAUDE.md` تحت «سياسة قبول المواد وإطلاق الموقع».

- **الحالة:** لا تُكتب «موثّق» إلا إذا قُرئ الترخيص من المصدر أو من سجل المانيفست، وله تاريخ تحقق بصيغة `YYYY-MM-DD`. أي حالة أخرى تعني أن المادة غير مرخّصة للإطلاق.
- **التحقق:** `npm run check:launch` يتحقق من هذا الملف، ومن تغطية كل ملف في `web/`، ومن أن كل نص مقتبس له صف موثّق.
- تاريخ «2026-11-08» يعني أن الترخيص قُرئ من الملف أو الترويسة في هذا المستودع في ذلك اليوم.

## أ. الملفات المنشورة

| المسار | المصدر | الترخيص | شروط الاستخدام | تاريخ التحقق | الحالة |
|---|---|---|---|---|---|
| `web/*.js`، `web/index.html` | كود المستودع | GNU GPL v3 (ملف `LICENSE`) | نسخ المصدر مع الترخيص عند التوزيع | 2026-11-08 | موثّق |
| `web/vendor/maplibre-gl.js`، `web/vendor/maplibre-gl.css` | maplibre-gl-js v5.24.0 | BSD-3-Clause (ترويسة الملف) | الإبقاء على نص الترخيص والإسناد | 2026-11-08 | موثّق |
| `web/vendor/deck.gl.min.js`، `web/vendor/deck.gl.LICENSE` | deck.gl (vis.gl) | MIT (نص الترخيص في `deck.gl.LICENSE`) | الإبقاء على نص الترخيص | 2026-11-08 | موثّق |
| `web/data/base/land.geojson`، `web/data/base/ocean.geojson`، `web/data/base/lakes.geojson`، `web/data/base/rivers.geojson` | `naturalearth-50m` | ملك عام (Natural Earth) | إسناد Natural Earth مستحسن | 2026-10-22 | موثّق |
| `web/data/base/regions.json` | `naturalearth-countries-50m` (مشتق من حدود الدول) | ملك عام (Natural Earth) | إسناد مستحسن | غير مسجّل | غير موثّق |
| `web/data/borders/` | `historical-basemaps` (GPL-3، وترخيص البيانات لم يُذكر منفصلاً)، `naturalearth-countries-50m`، إعدادات المشروع في `scripts/config/spatial_rules.json` | GPL v3 للبيانات المعامَلة بترخيص المستودع | يُذكر ترخيص GPL-3 عند التوزيع | غير مسجّل | غير موثّق |
| `web/data/transitions/`، `web/data/stack/`، `web/data/lineage.json`، `web/data/links/` | مشتقة من `historical-basemaps` وإحداثيات Pleiades وتسميات Wikidata (بالبناء في `scripts/`) | تتبع شروط مصادرها | إسناد كل مصدر، وGPL-3 عند التوزيع | غير مسجّل | غير موثّق |
| `web/data/names/hb_names.json` | `wikidata-hb-names` | CC0 1.0 (Wikidata) | لا شرط؛ الإسناد مستحسن | غير مسجّل | غير موثّق |
| `web/data/places_era1.geojson`، `web/data/places_era2.geojson`، `web/data/places_era3.geojson`، `web/data/places_era4.geojson`، `web/data/places_era5.geojson`، `web/data/claim_places.geojson`، `web/data/claim_points.geojson` | `pleiades-places`، `pleiades-names`، `pleiades-locations` | CC BY 3.0 بحسب سجل Zenodo؛ ملف البيانات نفسه لم يُفحص بعد | إسناد Pleiades | 2026-10-20 | موثّق |
| `web/data/places_era6.geojson`، `web/data/places_era7.geojson`، `web/data/places_era8.geojson` | `pleiades-places`، `pleiades-names`، `pleiades-locations`، `naturalearth-populated-places-50m-full` (المدن المأهولة، بلا تاريخ تحقق في المانيفست) | CC BY 3.0 (Pleiades)؛ ملك عام (Natural Earth) | إسناد Pleiades | غير مسجّل | غير موثّق |
| `web/data/demography_*.geojson` | `gapminder-total-population`، `gapminder-country-entities`، `owid-hyde-regional-population` (HYDE عبر OWID) | CC BY 4.0 (Gapminder بحسب README المستودع؛ HYDE عبر OWID بترخيص CC BY 4.0) | إسناد Gapminder وHYDE وOWID | 2026-10-22 | موثّق |
| `web/data/econ/` | `maddison-2023-owid` | CC BY 4.0 (Maddison Project Database 2023 عبر OWID) | إسناد Bolt وvan Zanden (2024) | غير مسجّل | غير موثّق |
| `web/data/observatory.json`، `web/data/khaldun.json`، `web/data/khaldun_sensitivity.json`، `web/data/dossier.json` | `ucdp-prio-acd-261`، `ucdp-onesided-261`، `ucdp-brd-conf-261`، `un-wpp-2024-medium`، `gapminder-systema-globalis`، `naturalearth-countries-50m` | CC BY 4.0 (UCDP)؛ CC BY 3.0 IGO (UN WPP)؛ CC BY 4.0 (Gapminder؛ الأصل من البنك الدولي وUNESCO غير مُتحقَّق، وقد وافق صاحب المشروع على الاعتماد على ترخيص Gapminder)؛ ملك عام (Natural Earth) | إسناد لكل مصدر؛ وإسناد IGO كما يطلبه UN | غير مسجّل | غير موثّق |
| `web/data/sunan.json` | `wikisource-muqaddima-ar`، `seshat-equinox`، والنصوص المرتبطة بالشواهد (القسم ب) | نص ابن خلدون ملك عام والتفريغ CC BY-SA؛ الاختبار الكمي من Seshat بترخيص CC BY-NC-SA (يتوقف على القسم ب) | إسناد؛ غير تجاري لما أُخذ من Seshat؛ المشتق بترخيص النسخة | 2026-10-22 / 2026-10-20 | غير موثّق |
| `web/data/claims_*.json`، `web/data/journeys/`، `web/data/precedents.json`، `web/data/domains.json`، `web/data/layers_info.json`، `web/data/lenses.json` | نصوص الشواهد في `verification/era1` إلى `era8` (القسم ب)؛ ومسارات `dynasty` وknowledge وtrade تشير إلى اختبارات Seshat | تابعة لكل نص في القسم ب؛ Seshat: CC BY-NC-SA | إسناد كل نص وكل مصدر؛ غير تجاري لما فيه Seshat | غير مسجّل | غير موثّق |

## ب. النصوص المقتبسة

تاريخ التحقق هنا هو تاريخ قراءة بيانات الأرشيف للطبعة (وليس تاريخ قراءة الكتاب نفسه). والحكم بالملك العام المبني على تاريخ النشر تُذكر أساسه صراحة في عمود الترخيص.

| المعرّف | الحقبة | الترخيص | شروط الاستخدام | تاريخ التحقق | الحالة |
|---|---|---|---|---|---|
| `gilgamesh` | 1 | لم يُربط نص الحقبة الأولى بطبعة معرّفة في الأرشيف | — | غير مسجّل | غير موثّق |
| `hammurabi` | 1 | لم يُربط نص الحقبة الأولى بطبعة معرّفة في الأرشيف | — | غير مسجّل | غير موثّق |
| `ptahhotep` | 1 | لم يُربط نص الحقبة الأولى بطبعة معرّفة في الأرشيف | — | غير مسجّل | غير موثّق |
| `behistun` | 2 | ملك عام: نُشر سنة 1846، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Rawlinson، The Persian cuneiform inscription at Behistun (1846) | 2026-11-08 | موثّق |
| `herodotus` | 2 | ملك عام: نُشر سنة 1861، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Herodotus، History of Herodotus، ترجمة G. Rawlinson، المجلد III (1861) | 2026-11-08 | موثّق |
| `kjv1611` | 2 | لم يُربط المعرّف بطبعة 1611 محددة في الأرشيف | — | غير مسجّل | غير موثّق |
| `kjv1611-1872-vol2` | 2 | ملك عام: نُشر سنة 1872، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: The Holy Bible، Authorized Version (1611)، لندن 1872، المجلد II | 2026-11-08 | موثّق |
| `kjv1611-1872-vol6` | 2 | ملك عام: نُشر سنة 1876، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: The Holy Bible، Authorized Version (1611)، المجلد VI | 2026-11-08 | موثّق |
| `luckenbill` | 2 | ملك عام: نُشر سنة 1927، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Luckenbill، Ancient Records of Assyria and Babylonia، المجلد II (1927) | 2026-11-08 | موثّق |
| `arthashastra` | 3 | ملك عام: نُشر سنة 1929، والمترجم R. Shamasastry توفي سنة 1944، فهو في الملك العام في بلدان life+70 منذ 2015، وفي الولايات المتحدة منذ 2025. | إسناد: Shamasastry، Kautilya's Arthasastra (1929) | 2026-11-08 | موثّق |
| `asoka` | 3 | ملك عام: نُشر سنة 1920، والأرشيف يحمل علامة public-domain mark 1.0. | إسناد: Bhandarkar وMajumdar، The Inscriptions of Asoka (1920) | 2026-11-08 | موثّق |
| `chavannes` | 3 | ملك عام: نُشر سنة 1895، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Chavannes، Les Mémoires historiques de Se-ma Ts'ien (1895-1905) | 2026-11-08 | موثّق |
| `hanshu-zh` | 3 | ملف hanshu.txt فارغ، والنص الصيني لم يُحفظ | — | غير مسجّل | غير موثّق |
| `polybius` | 3 | ملك عام: نُشر سنة 1889، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Polybius، The Histories، ترجمة E. S. Shuckburgh (1889) | 2026-11-08 | موثّق |
| `polybius-paton-1922` | 3 | ملك عام: نُشر سنة 1922، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Polybius، The Histories، ترجمة W. R. Paton، Loeb (1922) | 2026-11-08 | موثّق |
| `polybius-paton-1925` | 3 | ملك عام: نُشر سنة 1925، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Polybius، The Histories، المجلد IV، ترجمة W. R. Paton، Loeb (1925) | 2026-11-08 | موثّق |
| `sallust-catilina-la-ws` | 3 | لا ملف نص محفوظ، والمانيفست يحمل معرّفاً مختلفاً | — | غير مسجّل | غير موثّق |
| `sima-qian-zh` | 3 | لا ملف نص محفوظ في المستودع | — | غير مسجّل | غير موثّق |
| `tacitus` | 3 | ملك عام: نُشر سنة 1921، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Tacitus، The Annals، ترجمة Church وBrodribb (1921) | 2026-11-08 | موثّق |
| `tacitus-agricola-la-ws` | 3 | لا ملف نص محفوظ، والمانيفست يحمل معرّفاً مختلفاً | — | غير مسجّل | غير موثّق |
| `thucydides` | 3 | ملك عام: نُشر سنة 1910، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Thucydides، The Peloponnesian War، ترجمة R. Crawley، Everyman's Library (1910) | 2026-11-08 | موثّق |
| `bede-latin-pl95` | 4 | ويكي مصدر اللاتيني (التفريغ CC BY-SA، والنص الأصلي ملك عام)، ورابط الصفحة لم يُحفظ | — | غير مسجّل | غير موثّق |
| `gregory-brehaut` | 4 | ملك عام: نُشر سنة 1916، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Gregory of Tours، The History of the Franks، ترجمة E. Brehaut (1916) | 2026-11-08 | موثّق |
| `procopius-dewing-1928` | 4 | ملك عام: نُشر سنة 1928، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Procopius، ترجمة H. B. Dewing، Loeb، المجلد V | 2026-11-08 | موثّق |
| `tabari-turath-9783` | 4 | نشرة من تراث، ولم يُحدَّد ترخيصها | — | غير مسجّل | غير موثّق |
| `xuanzang-beal` | 4 | ملك عام: نُشر سنة 1884، والأرشيف يحمل علامة public-domain mark 1.0. | إسناد: Beal، Si-Yu-Ki: Buddhist Records of the Western World (1884) | 2026-11-08 | موثّق |
| `battuta-defremery` | 5 | طبعة Defrémery على Google Books، والأرشيف لا يعيد بيانات لها | — | غير مسجّل | غير موثّق |
| `khaldun-slane-1863` | 5 | ملك عام: نُشر سنة 1863، والأرشيف يحمل علامة public-domain mark 1.0. | إسناد: Ibn Khaldun، Les Prolégomènes، ترجمة de Slane (1863) | 2026-11-08 | موثّق |
| `polo-yule-1871` | 5 | لا معرّف أرشيف مسجّل للطبعة | — | غير مسجّل | غير موثّق |
| `turath-4129-tibr-masbuk` | 5 | إذن شفهي فقط، والقرار: تبقى الشواهد حتى يُحسم الترخيص | — | غير مسجّل | غير موثّق |
| `diaz-maudslay` | 6 | لا معرّف أرشيف مسجّل للطبعة | — | غير مسجّل | غير موثّق |
| `evliya-ottoman-1896-v2` | 6 | ملك عام: نُشر سنة 1896، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Evliya Çelebi، Seyahatname، المجلد II (1896) | 2026-11-08 | موثّق |
| `gama-hakluyt-1898` | 6 | لا معرّف أرشيف مسجّل، ولا يوجد ملف النص في المستودع | — | غير مسجّل | غير موثّق |
| `garcilaso-rycaut-1688` | 6 | لا معرّف أرشيف مسجّل للطبعة | — | غير مسجّل | غير موثّق |
| `ricci-trigault-1615` | 6 | ملك عام: نُشر سنة 1615، وهو ملك عام في الولايات المتحدة بحسب تاريخ النشر. الأرشيف لا يحمل علامة ترخيص. | إسناد: Ricci وTrigault، De Christiana expeditione apud Sinas (1615) | 2026-11-08 | موثّق |
| `turath-30026-sayrafi` | 6 | إذن شفهي فقط، والقرار: تبقى الشواهد حتى يُحسم الترخيص | — | غير مسجّل | غير موثّق |
| `brinkley-japan-v4-1901` | 7 | ملك عام: كتاب 1901 (المؤلف فرانك بريكلي ت 1912). النص من أرشيف الإنترنت (OCR). | إسناد: Frank Brinkley، Japan: its history, arts, and literature، المجلد 4 (1901) | 2026-11-08 | موثّق |
| `darwin-origin-1859` | 7 | ملك عام: London: John Murray, 1859 (الطبعة الأولى). | إسناد: Darwin, On the Origin of Species, 1st ed., London: John Murray, 1859; scan via Internet Archive | 2026-11-08 | موثّق |
| `marx-manifesto-moore-1888-mia` | 7 | ترجمة Samuel Moore (1888) في الملك العام. التفريغ من أرشيف الماركسيين (marxists.org، Copyleft) عن Progress Publishers 1969. | إسناد: Marx & Engels, Manifesto of the Communist Party, tr. S. Moore 1888; transcription Marxists Internet Archive | 2026-11-08 | موثّق |
| `smith-wealth-cannan1904-vol2` | 7 | ملك عام: نص آدم سميث (ت. 1790)، تحرير Edwin Cannan (ت. 1935)، Methuen وPutnam، 1904 (منشورة قبل 1929). الأرشيف يصنّفها NOT_IN_COPYRIGHT. | إسناد: Adam Smith, The Wealth of Nations, ed. Edwin Cannan, vol. 2 (London: Methuen; New York: Putnam, 1904); scan by University of Toronto via Internet Archive | 2026-11-08 | موثّق |
| `smith-wealth-oup1904-vol1` | 7 | ملك عام: نص آدم سميث (ت. 1790)، طبعة Oxford University Press، لندن 1904 (منشورة قبل 1929). | إسناد: Adam Smith, An Inquiry into the Nature and Causes of the Wealth of Nations, vol. 1 (London: Oxford University Press, 1904); scan by UNC Chapel Hill via Internet Archive | 2026-11-08 | موثّق |
| `tahtawi-takhlis-archive` | 7 | الأرشيف لا يذكر تاريخ النشر، والطبعة غير مؤرخة | — | غير مسجّل | غير موثّق |
| `tocqueville-reeve-1840-vol3` | 7 | ملك عام: ترجمة Henry Reeve، لندن: Saunders and Otley، 1840 (المترجم ت. 1895). | إسناد: Tocqueville, Democracy in America, Part II (vol. III), tr. H. Reeve, 1840; scan by Google via Internet Archive | 2026-11-08 | موثّق |
| `versailles-1919` | 8 | الأرشيف لا يذكر ترخيصاً، وحقوق التاج على الوثيقة تحتاج تحققاً | — | غير مسجّل | غير موثّق |

**قرار صاحب المشروع (2026-11-08):** تبقى شواهد النشرتين `turath-4129-tibr-masbuk` و`turath-30026-sayrafi` في الملفات المنشورة، ولا تُزالان. تبقى البوابة مغلقة عليهما إلى أن يُحسم ترخيصهما بإذن مكتوب أو باستبدال النشرة.
