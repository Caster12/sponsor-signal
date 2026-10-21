# Vishal: description-only batch v025–v140

116 postings from public Greenhouse employer feeds: 46 tech, 42 finance and 28 consulting, across 43 employers with at most three postings per employer within this batch. Retrieved October 20–21, 2026.

`meta.jsonl` records source URLs and capture provenance; `texts/` has the saved descriptions; `sources/` preserves each Greenhouse API response (fetched October 21, 2026); `postings.jsonl` combines metadata and description text. `labels/vishal.jsonl` uses the existing five-field format. Labels were made by Vishal from the saved descriptions; AI was used only to format the files. They are one labeler's labels and have not been double-labeled yet.

There are no browser-page raw captures or screenshots in this batch. The root `eval:build` does not include these 116; it still covers only the full-page captures v001–v024 in `eval/vishal/`. Collect real `.raw.txt` files before promoting any of these into the page-extraction evaluation. Never substitute API descriptions for raw browser-page captures.

Labels: 90 silent, 20 does_not_sponsor, 6 sponsors.

Notes for the team:

- `page_screening_question` lists the application-form questions returned by the Greenhouse API (106 of 116 postings have one). Per the codebook they do not decide the label.
- v044 returned 404 on October 21, 2026, so it has no `sources/` file and `source_active` is false; its saved text is kept.
- Seven postings are the same jobs as postings in Khushi's p011–p100 batch: v071=p037, v074=p031, v080=p024, v083=p022, v093=p023, v129=p072, v137=p054. Both labelers gave the same label on all seven.
- The three-per-employer cap holds within this batch and against `eval/khushi` and `eval/vishal` full-page postings, but not once Khushi's p011–p100 batch is counted too: several employers (for example Coinbase, Stripe, Brex, Capco) appear in both description-only batches.

Validate: `python3 check_labels.py labels/vishal.jsonl` from this directory. Optional offline scorer: `python3 score_results.py gold.jsonl predictions.jsonl [baseline.jsonl]`.
