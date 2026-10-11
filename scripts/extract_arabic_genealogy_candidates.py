#!/usr/bin/env python3
"""Create a page-linked, human-reviewable candidate index from an Arabic genealogy PDF.

Text extraction is heuristic only. Candidate names and OCR passages are never verified facts.
Requires Poppler and Tesseract with Arabic language data for scanned/poor-quality pages.
"""
from __future__ import annotations

import argparse
import csv
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ARABIC = re.compile(r"[\u0600-\u06ff]")
ARABIC_WORD = re.compile(r"[\u0621-\u064a]+")
SPACE = re.compile(r"\s+")
DIACRITICS = re.compile(r"[\u064b-\u065f\u0670ـ]")
MARKER = re.compile(r"(?:قبيلة|قبائل|بطن|بطون|فخذ|أفخاذ|عشيرة|عشائر)")
HEADING = re.compile(r"^([\u0621-\u064a][\u0621-\u064a\sـًٌٍَُِّْٰ()«»\-]{1,70}?)\s*[:：]")
STOP_WORDS = {
    "من", "في", "على", "الى", "إلى", "عن", "أن", "إن", "هو", "هي", "وهو", "وهي",
    "الذي", "التي", "الذين", "اللاتي", "كان", "كانت", "يكون", "تكون", "ثم", "حيث",
    "كما", "اذا", "إذا", "وذلك", "وهي", "وله", "لها", "له", "عند", "بين", "بعد",
    "قبل", "حتى", "اما", "أما", "فقد", "وقد", "وهي", "وهم", "فهي", "فهو", "يقال",
    "تسمى", "المعروفة", "المعروف", "المشهورة", "المشهور", "قبيلة", "قبائل", "بطن",
    "بطون", "فخذ", "أفخاذ", "عشيرة", "عشائر",
}


def run(args: list[str]) -> str:
    proc = subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return proc.stdout


def normalize(text: str) -> str:
    text = DIACRITICS.sub("", text)
    return SPACE.sub(" ", text).strip()


def text_quality(text: str) -> dict:
    """A transparent OCR-legibility proxy, not a measure of historical truth."""
    words = ARABIC_WORD.findall(text)
    arabic_chars = len(ARABIC.findall(text))
    non_space = [char for char in text if not char.isspace()]
    digit_count = sum(char.isdigit() for char in non_space)
    short_ratio = sum(len(word) <= 2 for word in words) / max(1, len(words))
    digit_ratio = digit_count / max(1, len(non_space))
    arabic_ratio = arabic_chars / max(1, len(non_space))
    score = max(0.0, min(1.0, 0.55 * (1 - short_ratio) + 0.25 * arabic_ratio + 0.20 * (1 - digit_ratio)))
    label = "LOW" if len(words) < 20 or short_ratio >= 0.45 or digit_ratio >= 0.12 else (
        "MEDIUM" if short_ratio >= 0.32 or arabic_ratio < 0.65 else "HIGH"
    )
    return {
        "arabicWordCount": len(words),
        "shortWordRatio": round(short_ratio, 3),
        "digitRatio": round(digit_ratio, 3),
        "arabicCharacterRatio": round(arabic_ratio, 3),
        "qualityScore": round(score, 3),
        "qualityLabel": label,
    }


def pages_from_pdf(pdf: Path) -> tuple[list[str], str]:
    raw = run(["pdftotext", "-layout", str(pdf), "-"])
    embedded_pages = [page.strip() for page in raw.split("\f") if page.strip()]
    total_arabic = sum(len(ARABIC.findall(page)) for page in embedded_pages)
    qualities = [text_quality(page) for page in embedded_pages]
    low_ratio = sum(q["qualityLabel"] == "LOW" for q in qualities) / max(1, len(qualities))
    median_short = sorted(q["shortWordRatio"] for q in qualities)[len(qualities) // 2] if qualities else 1.0

    # Arabic glyph count alone is not enough: scanned PDFs sometimes contain a broken OCR layer.
    # Re-OCR when the text layer is sparse or its token statistics indicate substantial corruption.
    if len(embedded_pages) >= 5 and total_arabic >= 500 and low_ratio < 0.35 and median_short < 0.42:
        return embedded_pages, "embedded-text"

    missing = [tool for tool in ("pdfinfo", "pdftoppm", "tesseract") if not shutil.which(tool)]
    if missing:
        raise RuntimeError("Poor/scanned PDF text detected; missing tools: " + ", ".join(missing))
    match = re.search(r"^Pages:\s+(\d+)", run(["pdfinfo", str(pdf)]), re.M)
    if not match:
        raise RuntimeError("Could not read the PDF page count.")
    page_count = int(match.group(1))
    result: list[str] = []
    with tempfile.TemporaryDirectory(prefix="arabic-genealogy-") as temp:
        prefix = str(Path(temp) / "page")
        run(["pdftoppm", "-r", "300", "-gray", "-jpeg", "-jpegopt", "quality=92", str(pdf), prefix])
        images = sorted(
            Path(temp).glob("page-*.jpg"),
            key=lambda p: int(re.search(r"-(\d+)\.jpg$", p.name).group(1))
        )
        if len(images) != page_count:
            raise RuntimeError(f"Rendered {len(images)} pages, expected {page_count}.")
        for image in images:
            attempts = [
                run(["tesseract", str(image), "stdout", "-l", "ara", "--psm", str(psm)])
                for psm in (4, 6)
            ]
            result.append(max(attempts, key=lambda candidate: text_quality(candidate)["qualityScore"]))
    return result, "tesseract-ara-psm4-or-6"


def extract_candidate_name(text: str) -> str:
    """Capture a short name phrase after a tribal marker; stop before prose."""
    words = ARABIC_WORD.findall(text)
    selected: list[str] = []
    for word in words:
        if word in STOP_WORDS:
            break
        if len(word) < 2:
            break
        selected.append(word)
        if len(selected) == 4:
            break
    return " ".join(selected).strip()


def candidates_on_page(page: str):
    seen = set()
    for raw_line in page.splitlines():
        line = normalize(raw_line)
        if len(line) < 4 or not ARABIC.search(line):
            continue
        for match in MARKER.finditer(line):
            name = extract_candidate_name(line[match.end():]).strip(" -،؛:")
            if len(name) < 2:
                continue
            words = name.split()
            # Don't turn common grammatical words or obvious OCR fragments into name candidates.
            if any(word in STOP_WORDS or len(word) < 2 for word in words):
                continue
            key = (name, "TRIBAL_MARKER")
            if key not in seen:
                seen.add(key)
                yield name, line[:2000], "TRIBAL_MARKER"
        heading = HEADING.match(line)
        if heading:
            name = normalize(heading.group(1)).strip(" -،؛:")
            if 3 <= len(name) <= 60 and len(name.split()) <= 5:
                key = (name, "DICTIONARY_HEADING_CANDIDATE")
                if key not in seen:
                    seen.add(key)
                    yield name, line[:2000], "DICTIONARY_HEADING_CANDIDATE"


def candidate_quality(name: str, excerpt: str) -> str:
    tokens = name.split()
    excerpt_quality = text_quality(excerpt)
    if len(tokens) == 1 and len(tokens[0]) <= 3:
        return "LOW"
    if excerpt_quality["qualityLabel"] == "LOW" or len(tokens) == 1:
        return "LOW" if excerpt_quality["qualityLabel"] == "LOW" else "MEDIUM"
    if any(len(token) <= 2 for token in tokens):
        return "LOW"
    return "MEDIUM"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--title", required=True, help="Exact book/source title")
    parser.add_argument("--url", required=True, help="Canonical source URL")
    parser.add_argument("--author", default="")
    parser.add_argument("--out", type=Path, required=True, help="Output directory")
    args = parser.parse_args()
    if not args.pdf.is_file():
        parser.error(f"PDF not found: {args.pdf}")
    try:
        pages, extraction_mode = pages_from_pdf(args.pdf)
    except (subprocess.CalledProcessError, RuntimeError) as exc:
        print(f"Extraction failed: {exc}", file=sys.stderr)
        return 2

    args.out.mkdir(parents=True, exist_ok=True)
    candidate_file = args.out / "tribe-candidates.tsv"
    passage_file = args.out / "page-passages.tsv"
    quality_file = args.out / "page-quality.tsv"
    candidates, passages, page_quality_rows = [], [], []
    seen = set()
    for pdf_page, text in enumerate(pages, start=1):
        quality = text_quality(text)
        page_quality_rows.append({"pageLabel": str(pdf_page), **quality, "extractionMode": extraction_mode})
        clean_lines = [normalize(line) for line in text.splitlines() if normalize(line)]
        page_text = "\n".join(clean_lines)
        if page_text:
            for chunk_no, start in enumerate(range(0, len(page_text), 4800), start=1):
                chunk = page_text[start:start + 4800].strip()
                if chunk:
                    passages.append({
                        "pageLabel": str(pdf_page),
                        "passageText": chunk,
                        "locator": f"PDF page {pdf_page}; chunk {chunk_no}; source: {args.url}",
                        "reviewStatus": "UNREVIEWED"
                    })
        for name, excerpt, method in candidates_on_page(text):
            key = (name, pdf_page, method)
            if key in seen:
                continue
            seen.add(key)
            candidates.append({
                "candidateName": name,
                "pageLabel": str(pdf_page),
                "evidenceExcerpt": excerpt,
                "sourceTitle": args.title,
                "sourceAuthor": args.author,
                "sourceUrl": args.url,
                "detectionMethod": method,
                "extractionQuality": candidate_quality(name, excerpt),
                "pageQuality": quality["qualityLabel"],
                "reviewStatus": "UNREVIEWED",
                "reviewNote": "Heuristic candidate only. Verify the cited scan and printed page before accepting or linking."
            })

    def write_tsv(path: Path, rows: list[dict], fields: list[str]) -> None:
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t", extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)

    write_tsv(candidate_file, candidates, [
        "candidateName", "pageLabel", "evidenceExcerpt", "sourceTitle", "sourceAuthor",
        "sourceUrl", "detectionMethod", "extractionQuality", "pageQuality", "reviewStatus", "reviewNote"
    ])
    write_tsv(passage_file, passages, ["pageLabel", "passageText", "locator", "reviewStatus"])
    write_tsv(quality_file, page_quality_rows, [
        "pageLabel", "arabicWordCount", "shortWordRatio", "digitRatio",
        "arabicCharacterRatio", "qualityScore", "qualityLabel", "extractionMode"
    ])
    quality_counts = {label: sum(row["qualityLabel"] == label for row in page_quality_rows)
                      for label in ("HIGH", "MEDIUM", "LOW")}
    candidate_quality_counts = {label: sum(row["extractionQuality"] == label for row in candidates)
                                for label in ("HIGH", "MEDIUM", "LOW")}
    print(f"PDF pages processed: {len(pages)}")
    print(f"Extraction mode: {extraction_mode}")
    print(f"Candidate mentions (unverified): {len(candidates)}")
    print(f"Candidate extraction-quality counts (not verification): {candidate_quality_counts}")
    print(f"Page text-quality counts (legibility proxy): {quality_counts}")
    print(f"Evidence passages: {len(passages)}")
    print(f"Output: {args.out}")
    print("Printed book page numbers may differ from PDF page numbers.")
    print("All extracted candidates and passages are UNREVIEWED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
