import json
import unittest
from pathlib import Path

from extract_arabic_genealogy_candidates import (
    candidate_quality,
    candidates_on_page,
    extract_candidate_name,
    text_quality,
    pages_from_pdf,
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
        self.assertEqual(candidate_quality("التق", "HIGH"), "LOW")

    def test_readable_multiword_candidate_is_still_unverified_medium_quality(self):
        self.assertEqual(candidate_quality("عبد القيس", "HIGH"), "MEDIUM")

    def test_short_readable_text_layer_pdf_does_not_require_ocr(self):
        readable = ("قبيلة عبد القيس من قبائل العرب المعروفة في كتب الأنساب " * 4)
        # Exercise the embedded-text decision through a mocked pdftotext result.
        from unittest.mock import patch
        with patch("extract_arabic_genealogy_candidates.run", return_value=readable + "\f"):
            with patch("extract_arabic_genealogy_candidates.shutil.which", return_value=None):
                extracted, mode = pages_from_pdf(Path("unused.pdf"))
        self.assertEqual(mode, "embedded-text")
        self.assertEqual(len(extracted), 1)

    def test_quality_report_marks_fragmented_text_low(self):
        report = text_quality("ا م و ١ ٢ ٣ ك ل ب ا د ٧ ن")
        self.assertEqual(report["qualityLabel"], "LOW")
        self.assertGreaterEqual(report["shortWordRatio"], 0.45)

    def test_every_candidate_remains_a_candidate_not_a_verified_entity(self):
        rows = list(candidates_on_page("ورد ذكر قبيلة بني تميم في النص"))
        self.assertTrue(rows)
        self.assertEqual(rows[0][2], "TRIBAL_MARKER")


class SourceProvenanceTests(unittest.TestCase):
    def test_sabaik_source_url_matches_the_actual_downloaded_scan(self):
        root = Path(__file__).resolve().parents[1]
        registry = json.loads((root / "data/sources/arabic-genealogy-books.json").read_text(encoding="utf-8"))
        source = next(item for item in registry if item["id"] == "sabaik-al-dhahab")
        workflow = (root / ".github/workflows/extract-sabaik-source.yml").read_text(encoding="utf-8")
        self.assertIn(source["source_url"], workflow)
        self.assertIn("--edition 'Bombay edition, 1296 AH; 120-page Wikisource PDF scan'", workflow)
        self.assertEqual(source["status"], "EXTRACTED_CANDIDATES_NEEDS_HUMAN_REVIEW")
        self.assertIn("edition", source)

    def test_source_url_is_not_mislabeled_as_the_nyu_1980_catalogue_copy(self):
        root = Path(__file__).resolve().parents[1]
        workflow = (root / ".github/workflows/extract-sabaik-source.yml").read_text(encoding="utf-8")
        self.assertIn("upload.wikimedia.org/wikisource", workflow)
        self.assertIn("ar.wikisource.org/wiki/", workflow)
        self.assertNotIn("--url 'https://sites.dlib.nyu.edu/viewer/books/nyu_aco001225/", workflow)


if __name__ == "__main__":
    unittest.main()
