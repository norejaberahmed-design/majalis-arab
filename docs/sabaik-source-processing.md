# Processing the first genealogy source: سبائك الذهب في معرفة قبائل العرب

This is the first-source-only workflow. Do not begin the next book until this source's extraction, review, duplicate resolution, and evidence links are complete.

## Source record

- Title: سبائك الذهب في معرفة قبائل العرب
- Author metadata displayed by Arabic Collections Online: محمد أمين السويدي; the catalogue also lists أحمد بن علي القلقشندي.
- Digital copy: https://sites.dlib.nyu.edu/viewer/books/nyu_aco001225/1?embed=1&lang=ar
- Stable handle: https://hdl.handle.net/2333.1/3j9kd8xq
- Repository statement: NYU says the displayed materials are public domain.
- Record the exact edition and page numbering from the selected PDF. Printed page numbers may differ from PDF page indices.

## Download and extract

Download the low-resolution PDF from the source page above to a local machine; keep it out of Git history. Install Python 3, Poppler utilities, and Tesseract with Arabic language data (ara). Then run:

    python scripts/extract_genealogy_source.py /path/to/sabaik-al-dhahab.pdf

The command creates:

- data/sources/sabaik-al-dhahab/tribe-candidates.tsv: candidate mentions only when a line explicitly says قبيلة/قبائل, with page number, surrounding text, source link, and review status.
- data/sources/sabaik-al-dhahab/page-passages.tsv: extracted page text and source locator for evidence intake.

The script does not claim that every candidate is a tribe. OCR can misread Arabic; every name must be checked against its page image. Generic lineage words such as بني، بنو، and آل are not automatically converted into entity names.

## Completion checklist for this source

1. Confirm PDF edition, page count, and OCR quality; inspect sample pages from the beginning, middle, and end.
2. Review every candidate against its cited page; correct spelling and retain the exact source spelling.
3. Merge only clear spelling variants; preserve variants as aliases in the review sheet until the application's alias model is implemented.
4. For each accepted tribe, create or reuse one shared TribalEntity with kind=TRIBE; do not create a new entity if a normalized match exists.
5. Attach evidence passages to the correct entity and source, preserving page/locator. Do not infer lineage relationships solely from co-occurrence.
6. Keep unverified candidates and claims marked unreviewed. Record contradictory accounts separately.
7. Produce a source report: pages processed, candidates reviewed, accepted distinct tribe names, duplicate variants, unresolved candidates, evidence links, and exceptions.
8. Only after this report is complete should the next source be started.

## Data integrity

No tribe names or lineage claims are pre-populated by this workflow. The outputs become real only after the extraction command runs against the actual PDF and a human checks page-level evidence.
