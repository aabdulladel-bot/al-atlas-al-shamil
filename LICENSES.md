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

| المعرّف | الحقبة | الترخيص | شروط الاستخدام | تاريخ التحقق | الحالة |
|---|---|---|---|---|---|
| `tocqueville-reeve-1840-vol3` | 7 | ملك عام: ترجمة Reeve، لندن 1840 (المانيفست) | إسناد | غير مسجّل | غير موثّق |
| `darwin-origin-1859` | 7 | ملك عام: London: John Murray، 1859 (المانيفست) | إسناد | غير مسجّل | غير موثّق |
| `marx-manifesto-moore-1888-mia` | 7 | ترجمة Moore (1888) في الملك العام؛ التفريغ من marxists.org (Copyleft) | إسناد | غير مسجّل | غير موثّق |
| `tahtawi-takhlis-archive` | 7 | ملك عام: الطهطاوي (ت 1873)؛ الطبعة غير مؤرخة في البيانات | إسناد | غير مسجّل | غير موثّق |
| `brinkley-japan-v4-1901` | 7 | ملك عام: كتاب 1901 (المانيفست) | إسناد | غير مسجّل | غير موثّق |
| `smith-wealth-cannan1904-vol2` | 7 | ملك عام: نص Smith (ت 1790)، تحرير Cannan 1904 | إسناد | غير مسجّل | غير موثّق |
| `smith-wealth-oup1904-vol1` | 7 | ملك عام: نص Smith (ت 1790)، طبعة OUP 1904 | إسناد | غير مسجّل | غير موثّق |
| `versailles-1919` | 8 | ملك عام: نص معاهدة 1919 (المانيفست) | إسناد | غير مسجّل | غير موثّق |
| `turath-4129-tibr-masbuk` | 5 | النص في الملك العام؛ النشرة (ضبط أحمد شمس الدين، 1988) من تراث **بإذن شفهي فقط** | الإذن الشفهي لا يكفي: يلزم إذن مكتوب، أو استبدال النشرة بطبعة في الملك العام | غير مسجّل | غير موثّق |
| `turath-30026-sayrafi` | 6 | النص في الملك العام؛ النشرة من تراث **بإذن شفهي فقط**، وبيانات الطبعة غير مقروءة | نفسه: إذن مكتوب أو استبدال النشرة | غير مسجّل | غير موثّق |
| `tabari-turath-9783` | 4 | نشرة من تراث لم تُسجَّل في المانيفست | يُعامَل كنشرة تراث حتى يثبت غير ذلك | غير مسجّل | غير موثّق |
| `tacitus-agricola-la-ws`، `sallust-catilina-la-ws` | 3 | يقابلهما في المانيفست `wikisource-latin-tacitus-sallust` (ويكي مصدر، التفريغ CC BY-SA)، والمعرّف غير موحّد | إسناد؛ يلزم توحيد المعرّف | 2026-10-23 (المانيفست) | غير موثّق |
| `hammurabi`، `ptahhotep`، `gilgamesh` | 1 | غير مسجّل في المانيفست | — | غير مسجّل | غير موثّق |
| `behistun`، `luckenbill`، `kjv1611`، `herodotus`، `kjv1611-1872-vol2`، `kjv1611-1872-vol6` | 2 | غير مسجّل في المانيفست | — | غير مسجّل | غير موثّق |
| `chavannes`، `sima-qian-zh`، `polybius`، `thucydides`، `tacitus`، `asoka`، `hanshu-zh`، `arthashastra`، `polybius-paton-1922`، `polybius-paton-1925` | 3 | غير مسجّل في المانيفست | — | غير مسجّل | غير موثّق |
| `xuanzang-beal`، `gregory-brehaut`، `bede-latin-pl95`، `procopius-dewing-1928` | 4 | غير مسجّل في المانيفست | — | غير مسجّل | غير موثّق |
| `polo-yule-1871`، `battuta-defremery`، `khaldun-slane-1863` | 5 | غير مسجّل في المانيفست | — | غير مسجّل | غير موثّق |
| `garcilaso-rycaut-1688`، `diaz-maudslay`، `gama-hakluyt-1898`، `ricci-trigault-1615`، `evliya-ottoman-1896-v2` | 6 | غير مسجّل في المانيفست | — | غير مسجّل | غير موثّق |
