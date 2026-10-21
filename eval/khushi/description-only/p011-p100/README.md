# Khushi: reviewed description-only batch p011–p100

90 postings from public Greenhouse and SmartRecruiters employer feeds: 32 finance, 30 tech and 28 consulting, across 40 employers with at most three postings per employer. Captured October 20, 2026.

`meta.jsonl` records source URLs and capture provenance; `texts/` has full saved descriptions; `sources/` preserves each individual API response; `postings.jsonl` combines metadata and description text. `labels/khushi.jsonl` uses the existing five-field format. Initial text-only annotations were AI-generated, then reviewed and approved by Khushi. They are not independent blind human labels.

There are no browser-page raw captures or screenshots in this batch. The normal root `eval:build` intentionally does not include these 90 yet. They support description-only classification review; collect actual `.raw.txt` files before promoting them into the full page-extraction evaluation. Never substitute API descriptions for raw browser-page captures. Existing p001–p010 remain unchanged.

Labels: 65 silent, 18 does_not_sponsor, 7 unclear, no sponsors. Seven cases need adjudication: p046, p051, p052, p059, p060, p063, p065. The conditional export-control cases especially need a codebook decision.

Validate: `python3 check_labels.py labels/khushi.jsonl` from this directory. Optional offline scorer: `python3 score_results.py gold.jsonl predictions.jsonl [baseline.jsonl]`. Only use a separately frozen held-out set and suitable human ground truth for official accuracy; AI-generated reviewed labels must not be presented as independent human annotations. No model runs or official evaluation results are included.
