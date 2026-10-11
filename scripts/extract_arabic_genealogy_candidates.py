#!/usr/bin/env python3
"""Build a page-linked candidate index from an Arabic genealogy PDF.

Candidates are only name mentions for human review, not verified tribes or lineage.
Requires Poppler (pdftotext, pdfinfo, pdftoppm) and, for scanned PDFs,
Tesseract with Arabic language data installed.
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
SPACE = re.compile(r"\s+")
DIACRITICS = re.compile(r"[\u064b-\u065f\u0670ـ]")
EXPLICIT_TRIBE = re.compile(r"(?:قبيلة|قبائل)\s+([^،؛:.()]{2,70})")
# Conservative dictionary-entry headings such as "بنو فلان:" or "الفلانيّة:"
HEADING = re.compile(r"^([\u0621-\u064a][\u0621-\u064a\sـًٌٍَُِّْٰ()«»\-]{1,70}?)\s*[:：]")

def run(args: list[str]) -> str:
    proc = subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return proc.stdout

def normalize(text: str) -> str:
    text = DIACRITICS.sub("", text)
    return SPACE.sub(" ", text).strip()

def pdf_pages(pdf: Path) -> list[str]:
    raw = run(["pdftotext", "-layout", str(pdf), "-"])
    pages = [p.strip() for p in raw.split("\f")]
    arabic_count = sum(len(ARABIC.findall(p)) for p in pages)
    pages = [p for p in pages if p]
    if len(pages) >= 2 and arabic_count >= 500:
        return pages

    missing = [tool for tool in ("pdfinfo", "pdftoppm", "tesseract") if not shutil.which(tool)]
    if missing:
        raise RuntimeError("Scanned PDF detected; missing tools: " + ", ".join(missing))
    match = re.search(r"^Pages:\s+(\d+)", run(["pdfinfo", str(pdf)]), re.M)
    if not match:
        raise RuntimeError("Could not read the PDF page count.")
    page_count = int(match.group(1))
    result = []
    with tempfile.TemporaryDirectory(prefix="arabic-genealogy-") as temp:
        prefix = str(Path(temp) / "page")
        run(["pdftoppm", "-r", "250", "-jpeg", "-jpegopt", "quality=90", str(pdf), prefix])
        # Natural numeric sort: page-2.jpg must precede page-10.jpg.
        images = sorted(
            Path(temp).glob("page-*.jpg"),
            key=lambda p: int(re.search(r"-(\d+)\.jpg$", p.name).group(1))
        )
        if len(images) != page_count:
            raise RuntimeError(f"Rendered {len(images)} pages, expected {page_count}.")
        for image in images:
            result.append(run(["tesseract", str(image), "stdout", "-l", "ara", "--psm", "6"]))
    return result

def candidates_on_page(page: str):
    seen = set()
    for raw_line in page.splitlines():
        line = normalize(raw_line)
        if len(line) < 4 or not ARABIC.search(line):
            continue
        matches = []
        for match in EXPLICIT_TRIBE.finditer(line):
            matches.append((normalize(match.group(1)).strip(" -،؛ "), line, "EXPLICIT_TRIBE_WORDING"))
        heading = HEADING.match(line)
        if heading:
            name = normalize(heading.group(1)).strip(" -،؛:")
            if 2 <= len(name) <= 80:
                matches.append((name, line, "DICTIONARY_HEADING_CANDIDATE"))
        for name, excerpt, method in matches:
            key = (name, method)
            if len(name) >= 2 and key not in seen:
                seen.add(key)
                yield name, excerpt[:2000], method

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
        pages = pdf_pages(args.pdf)
    except (subprocess.CalledProcessError, RuntimeError) as exc:
        print(f"Extraction failed: {exc}", file=sys.stderr)
        return 2

    args.out.mkdir(parents=True, exist_ok=True)
    candidate_file = args.out / "tribe-candidates.tsv"
    passage_file = args.out / "page-passages.tsv"
    candidates, passages = [], []
    seen = set()
    for pdf_page, text in enumerate(pages, start=1):
        clean_lines = [normalize(line) for line in text.splitlines() if normalize(line)]
        page_text = "\n".join(clean_lines)
        if page_text:
            # Keep the app's maximum passage size (5,000 chars) with margin.
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
                "reviewStatus": "UNREVIEWED",
                "reviewNote": "Verify against the page image and printed page number before accepting or linking."
            })

    def write_tsv(path: Path, rows: list[dict], fields: list[str]) -> None:
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t", extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)

    write_tsv(candidate_file, candidates, [
        "candidateName", "pageLabel", "evidenceExcerpt", "sourceTitle",
        "sourceAuthor", "sourceUrl", "detectionMethod", "reviewStatus", "reviewNote"
    ])
    write_tsv(passage_file, passages, ["pageLabel", "passageText", "locator", "reviewStatus"])
    print(f"PDF pages processed: {len(pages)}")
    print(f"Candidate mentions (unverified): {len(candidates)}")
    print(f"Evidence passages: {len(passages)}")
    print(f"Output: {args.out}")
    print("Printed book page numbers may differ from PDF page numbers.")
    print("All extracted candidates and passages are UNREVIEWED.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
