#!/usr/bin/env python3
"""Create a reviewable, page-linked candidate index from one Arabic genealogy PDF.

Requires poppler-utils (pdftotext, pdfinfo, pdftoppm) and Tesseract with ara data.
This does NOT assert lineage or auto-publish candidates. Every row is UNREVIEWED.
"""
from __future__ import annotations
import argparse, csv, re, shutil, subprocess, sys, tempfile
from pathlib import Path

SOURCE_TITLE = "سبائك الذهب في معرفة قبائل العرب"
SOURCE_URL = "https://sites.dlib.nyu.edu/viewer/books/nyu_aco001225/1?embed=1&lang=ar"
MARKERS = re.compile(r"(?:قبيلة|قبائل|بنو|بني|آل|ولد|ذرية|عشيرة)")
ARABIC_LETTERS = re.compile(r"[\u0600-\u06ff]")
SPACE = re.compile(r"\s+")

def run(args: list[str]) -> str:
    proc = subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return proc.stdout

def normalize(text: str) -> str:
    text = re.sub(r"[\u064b-\u065f\u0670ـ]", "", text)
    return SPACE.sub(" ", text).strip()

def read_pdf(pdf: Path) -> list[str]:
    raw = run(["pdftotext", "-layout", str(pdf), "-"])
    pages = [p.strip() for p in raw.split("\f")]
    pages = [p for p in pages if p]
    arabic_count = sum(len(ARABIC_LETTERS.findall(p)) for p in pages)
    if len(pages) >= 5 and arabic_count >= 500:
        return pages
    missing = [tool for tool in ("pdfinfo", "pdftoppm", "tesseract") if not shutil.which(tool)]
    if missing:
        raise RuntimeError("PDF appears scanned; missing tools: " + ", ".join(missing) +
            ". Install poppler-utils and tesseract-ocr-ara.")
    match = re.search(r"^Pages:\s+(\d+)", run(["pdfinfo", str(pdf)]), re.M)
    if not match:
        raise RuntimeError("Could not determine PDF page count.")
    page_count = int(match.group(1))
    result = []
    with tempfile.TemporaryDirectory(prefix="sabaik-ocr-") as temp:
        prefix = str(Path(temp) / "page")
        run(["pdftoppm", "-r", "250", "-jpeg", "-jpegopt", "quality=90", str(pdf), prefix])
        images = sorted(Path(temp).glob("page-*.jpg"))
        if len(images) != page_count:
            raise RuntimeError(f"Rendered {len(images)} pages, expected {page_count}.")
        for image in images:
            result.append(run(["tesseract", str(image), "stdout", "-l", "ara", "--psm", "6"]))
    return result

def candidate_spans(text: str):
    for line in text.splitlines():
        line = normalize(line)
        if len(line) < 8 or not MARKERS.search(line):
            continue
        for match in re.finditer(r"(?:قبيلة|قبائل)\s+([^،؛:.()]{2,70})", line):
            name = normalize(match.group(1)).strip(" -،؛ ")
            if len(name) >= 2 and ARABIC_LETTERS.search(name):
                yield name, line

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="Local PDF of the selected source")
    parser.add_argument("--out", type=Path, default=Path("data/sources/sabaik-al-dhahab"))
    args = parser.parse_args()
    if not args.pdf.is_file():
        parser.error(f"PDF not found: {args.pdf}")
    try:
        pages = read_pdf(args.pdf)
    except (subprocess.CalledProcessError, RuntimeError) as exc:
        print(f"Extraction failed: {exc}", file=sys.stderr)
        return 2
    args.out.mkdir(parents=True, exist_ok=True)
    candidate_path, passage_path = args.out / "tribe-candidates.tsv", args.out / "page-passages.tsv"
    seen, candidates, passages = set(), [], []
    for page_no, page in enumerate(pages, start=1):
        page_text = "\n".join(normalize(line) for line in page.splitlines() if normalize(line))
        if page_text:
            passages.append({"pageLabel": str(page_no), "passageText": page_text[:5000],
                "locator": f"PDF page {page_no}; source: {SOURCE_URL}", "reviewStatus": "UNREVIEWED"})
        for name, excerpt in candidate_spans(page):
            key = (name, page_no)
            if key in seen:
                continue
            seen.add(key)
            candidates.append({"candidateName": name, "pageLabel": str(page_no),
                "evidenceExcerpt": excerpt[:2000], "sourceTitle": SOURCE_TITLE, "sourceUrl": SOURCE_URL,
                "reviewStatus": "UNREVIEWED",
                "reviewNote": "Verify this OCR/text candidate against the cited page before creating or linking a tribe."})
    def write_tsv(path: Path, rows: list[dict], fields: list[str]) -> None:
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t", extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
    write_tsv(candidate_path, candidates, ["candidateName", "pageLabel", "evidenceExcerpt",
        "sourceTitle", "sourceUrl", "reviewStatus", "reviewNote"])
    write_tsv(passage_path, passages, ["pageLabel", "passageText", "locator", "reviewStatus"])
    print(f"Pages processed: {len(pages)}")
    print(f"Candidate mentions (not verified tribes): {len(candidates)}")
    print(f"Page passages: {len(passages)}")
    print(f"Candidates: {candidate_path}")
    print(f"Passages: {passage_path}")
    print("All rows are UNREVIEWED; do not treat OCR candidates as verified facts.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
