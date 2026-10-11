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

A registered source is not the same as an extracted source. The `sabaik-al-dhahab` record now tracks an extraction attempt, but remains **unusable for automatic ingestion** because OCR quality is poor. Other records stay `REGISTERED_NOT_EXTRACTED` or `REGISTERED_NEEDS_EDITION_URL` until an actual copy is processed.

## Extract candidate mentions from a local PDF

Install Python 3 and Poppler utilities. For scanned PDFs, also install Tesseract and its Arabic language pack.

```bash
python scripts/extract_arabic_genealogy_candidates.py /path/to/book.pdf \
  --title "عنوان الكتاب كما في النسخة" \
  --author "اسم المؤلف" \
  --url "https://canonical-source.example/book" \
  --edition "Edition and scan identity" \
  --out data/sources/<source-id>
```

The tool writes:
- `tribe-candidates.tsv`: candidate names, page labels, short evidence excerpts, source title/author/edition/URL, and detection method.
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

The first extraction attempt used the **Bombay edition (1296 AH)** linked from Wikisource (120-page PDF). Run [38157907860](https://github.com/norejaberahmed-design/majalis-arab/actions/runs/38157907860) produced 132 unverified candidate mentions: 0 HIGH, 33 MEDIUM, 99 LOW; 93 of 120 pages were rated LOW for legibility. A diagnostic attempt with the 128-page NYU high-resolution scan, run [38159743368](https://github.com/norejaberahmed-design/majalis-arab/actions/runs/38159743368), produced 138 mentions with 0 HIGH, 33 MEDIUM, 105 LOW; 99 of 128 pages were LOW. The high-resolution scan did not materially improve OCR.

**Decision:** do not ingest either output into the live catalogue. The extracted text contains visibly corrupted Arabic names. Keep the artifacts for diagnosis only; a human must check page images, or the pipeline must use a reliable digital transcription before these candidates can be reviewed. The source registry points to the actual Wikisource scan used, and the NYU catalogue link is retained separately.

## Candidate corpus included in the repository

The `data/seeds/` directory now contains eight source-attributed batches totaling **170 candidate records** from digitized entries associated with *معجم قبائل العرب القديمة والحديثة*. They are review material, not a list of 170 verified independent tribes. Some records may refer to a clan, sub-tribe, person, or unresolved name; several records have a source URL and summary but still need their exact passage checked.

Run the metadata audit with:

```bash
npm run data:audit-genealogy-candidates
```

The audit checks that every record has a name, source URL, and review status, and that no record is marked verified. It does not insert records into the live database. Before any candidate becomes a shared tribe profile, a reviewer must confirm the cited source passage, determine the entity type, resolve spelling variants, and preserve the evidence locator.
