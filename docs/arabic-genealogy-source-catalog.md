# Arabic genealogy source catalogue and extraction

This repository is building a cumulative, source-backed catalogue of Arabic tribe-name mentions.

## Registered starting sources

The machine-readable registry is `data/sources/arabic-genealogy-books.json`. It includes:
- **سبائك الذهب في معرفة قبائل العرب** — محمد أمين السويدي.
- **معجم قبائل العرب القديمة والحديثة** — عمر رضا كحالة, parts 1 and 2.
- **جمهرة أنساب العرب** — ابن حزم.
- **نهاية الأرب في معرفة أنساب العرب** — القلقشندي.
- **مختلف القبائل ومؤتلفها** — محمد بن حبيب.
- **معجم قبائل المملكة العربية السعودية** — حمد الجاسر.

A registered source is not the same as an extracted source. Each source stays `REGISTERED_NOT_EXTRACTED` or `REGISTERED_NEEDS_EDITION_URL` until an actual copy is processed.

## Extract candidate mentions from a local PDF

Install Python 3 and Poppler utilities. For scanned PDFs, also install Tesseract and its Arabic language pack.

```bash
python scripts/extract_arabic_genealogy_candidates.py /path/to/book.pdf \
  --title "عنوان الكتاب كما في النسخة" \
  --author "اسم المؤلف" \
  --url "https://canonical-source.example/book" \
  --out data/sources/<source-id>
```

The tool writes:
- `tribe-candidates.tsv`: candidate names, page labels, short evidence excerpts, source metadata, and detection method.
- `page-passages.tsv`: page text chunks suitable for evidence intake.

## Rules

1. Candidate extraction is not verification. All generated rows are `UNREVIEWED`.
2. The page label is the PDF page index. Printed page numbering must be checked and stored separately when it differs.
3. Confirm candidates against the page image; OCR may corrupt Arabic names.
4. Preserve the exact spelling in the source. Normalize for search separately and retain variants as aliases.
5. Never merge ambiguous same-name records or infer lineage only because names occur near one another.
6. Before bulk ingestion, verify the edition, source terms, and permitted use. Keep long copyrighted text out of the public repository.
7. Do not mark a source complete until a report records processed pages, candidates reviewed, distinct accepted names, duplicates, unresolved candidates, and evidence links.

## Current status

This change registers source metadata and adds a reusable PDF candidate extractor. It does **not** claim that these books have already been processed or that a verified count of tribe names exists.
