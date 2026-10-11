import unittest

from extract_arabic_genealogy_candidates import (
    candidate_quality,
    candidates_on_page,
    extract_candidate_name,
    text_quality,
)


class ArabicGenealogyExtractionTests(unittest.TestCase):
    def test_extracts_single_word_name_without_following_prose(self):
        rows = list(candidates_on_page("ومن أشهر القبائل قبيلة قريش من العرب"))
        self.assertIn(("قريش", "ومن أشهر القبائل قبيلة قريش من العرب", "TRIBAL_MARKER"), rows)

    def test_extracts_multiword_name(self):
        self.assertEqual(extract_candidate_name(" عبد القيس من ربيعة"), "عبد القيس")

    def test_does_not_turn_grammatical_following_word_into_name(self):
        self.assertEqual(extract_candidate_name(" من العرب في الجاهلية"), "")

    def test_short_ambiguous_candidate_is_low_quality(self):
        self.assertEqual(candidate_quality("التق", "وليضومف قبيلة التق : الؤا"), "LOW")

    def test_quality_report_marks_fragmented_text_low(self):
        report = text_quality("ا م و ١ ٢ ٣ ك ل ب ا د ٧ ن")
        self.assertEqual(report["qualityLabel"], "LOW")
        self.assertGreaterEqual(report["shortWordRatio"], 0.45)

    def test_every_candidate_remains_a_candidate_not_a_verified_entity(self):
        rows = list(candidates_on_page("ورد ذكر قبيلة بني تميم في النص"))
        self.assertTrue(rows)
        self.assertEqual(rows[0][2], "TRIBAL_MARKER")


if __name__ == "__main__":
    unittest.main()
