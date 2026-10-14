# PDF genealogy ingestion

The source detail page offers an authenticated PDF import for approved catalogue curators.

## Runtime requirements

The Node.js server must also have Python 3, Poppler (pdftotext, pdfinfo, pdftoppm), Tesseract, and the Arabic language pack (ara). Set PYTHON_BIN if the interpreter is not named python3.

The API invokes scripts/extract_arabic_genealogy_candidates.py with a temporary file. PDFs are limited to 20 MiB and removed from the temporary directory after processing. The PDF itself is not stored permanently; extracted page passages and candidate suggestions are stored in the existing database.

## Evidence and review rules

- Text-layer extraction and OCR output are both treated as unreviewed.
- Candidate names become pending research suggestions, not tribal entities, genealogy relationships, or confirmed claims.
- Page labels refer to PDF page numbers; these can differ from printed page numbers.
- OCR quality labels are legibility heuristics, not proof of historical accuracy.
- Deployment platforms without Poppler/Tesseract/Arabic data cannot run this endpoint until those runtime dependencies are provided. In that case, the API reports the missing requirements rather than claiming extraction succeeded.
