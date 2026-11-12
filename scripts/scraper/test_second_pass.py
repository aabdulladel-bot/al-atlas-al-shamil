#!/usr/bin/env python3
# اختبارات المُصنِّف في الجولة الثانية، على حالات معروفة سلفاً. تفشل إن تغيّر القرار في أي منها.
# الاستعمال: python3 -I -m unittest scripts/scraper/test_second_pass.py
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("second_pass", Path(__file__).with_name("second_pass.py"))
sp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sp)

# (الاسم، سنوات الخريطة، الاسم الإنجليزي في ويكي بيانات، الأنواع، المقالة العربية، من، إلى، القرار المتوقع)
CASES = [
    # ترفض: نوع غير سياسي، أو أسرة، أو لا مقالة عربية، أو لم يوجد الكيان بهذا الاسم
    ("Tunica", [1600], "Tunica", "town in the United States ; county seat", "تونيكا (مسيسيبي)", None, None, "reject"),
    ("Oldenburg", [1800], "House of Oldenburg", "dynasty", "أسرة أولدنبورغ", None, None, "reject"),
    ("Kansa", [1600], "Kaw people", "Native American tribe ; tribe ; federally recognized", "", None, None, "reject"),
    ("Maitraka Kingdom", [700], "Maitraka dynasty", "dynasty ; historical country", "", 475, 767, "reject"),
    ("Persia", [1800, 1914], "Iran", "country ; sovereign state ; successor state", "إيران", 1979, None, "reject"),
    ("Ceylon", [1914], "Sri Lanka", "country ; island country ; sovereign state", "سريلانكا", 1972, None, "reject"),
    # تقبل: الكيان موجود في كل سنوات الخريطة، والتسمية تشترك في كلمة مفتاحية
    ("Macedonia", [2010], "North Macedonia", "sovereign state ; landlocked country ; country",
     "مقدونيا الشمالية", 1991, None, "accept"),
    ("Ayutthaya", [1600], "Ayutthaya Kingdom", "historical country", "مملكة أيوثايا", 1350, 1767, "accept"),
    ("Osage", [1600], "Osage Nation", "federally recognized Native American tribe in the United States",
     "أوساج (قبيلة)", None, None, "accept"),
    ("Waldeck", [1800], "Principality of Waldeck", "countship ; principality ; country ; free state",
     "فالدك", 1180, 1918, "accept"),
    ("Han", [-1], "Han dynasty", "Chinese dynasty ; historical Chinese state", "سلالة هان الحاكمة", -206, 220, "accept"),
    # تُراجع يدوياً: بعض السنوات خارج الفترة، أو التسمية تعريب مختلف
    ("Liao", [1000, 1200], "Liao dynasty", "Chinese dynasty ; historical Chinese state", "مملكة لياو", 916, 1125, "manual"),
    ("Congo", [1600, 1800, 1945, 2010], "Democratic Republic of the Congo", "sovereign state ; country",
     "جمهورية الكونغو الديمقراطية", 1960, None, "manual"),
    ("Annam", [1000, 1945], "French Annam", "protectorate", "أنام (محمية فرنسية)", 1884, 1949, "manual"),
    ("Bagirmi", [1600, 1800], "Kingdom of Baguirmi", "historical country ; sultanate ; kingdom",
     "مملكة باقرمي", 1513, 1897, "manual"),
    ("Asante", [1800], "Ashanti Empire", "historical country", "إمبراطورية آشانتي", 1670, 1902, "manual"),
    ("Wadai", [1600, 1800], "Ouaddai Empire", "historical country", "سلطنة وداي", 1635, 1909, "manual"),
    ("Tufan Empire", [700], "Tibetan Empire", "historical country ; empire", "الإمبراطورية التبتية", 618, 842, "manual"),
    ("Arabia (Nejd)", [1914], "Third Saudi State", "state", "الدولة السعودية الثالثة", 1902, None, "manual"),
    ("Ghaznavid Emirate", [1000, 1200], "Emirate of Multan", "Emirate", "إمارة ملتان", 855, 1010, "manual"),
]


class SecondPassClassifier(unittest.TestCase):
    def test_known_cases(self):
        for name, years, en, types, arwiki, frm, to, want in CASES:
            with self.subTest(name=name):
                got, reasons = sp.classify(name, years, en, types, arwiki, frm, to)
                self.assertEqual(got, want, f"{name}: {got} ({'؛ '.join(reasons)})")

    def test_no_type_rejects(self):
        self.assertEqual(sp.classify("X", [1000], "X", "", "مقالة", None, None)[0], "reject")

    def test_keyword_min_length_keeps_short_names(self):
        self.assertIn("han", sp.keywords("Han"))


if __name__ == "__main__":
    unittest.main()
