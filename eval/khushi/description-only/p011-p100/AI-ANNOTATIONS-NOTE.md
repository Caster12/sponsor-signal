# Text-only AI annotations

`my-blind-predictions.jsonl` and `.csv` contain 90 provisional AI-generated annotations requested by Khushi. They were made from saved descriptions with keyword-assisted retrieval, without extension predictions, screenshots, employer-history inference or another annotator’s labels. They are not independent human blind labels and must not be reported as such. Khushi subsequently reviewed and approved all 90 annotations. The five-field reviewed labels are in `eval/khushi/labels/khushi.jsonl`; the browser form remains available for future independent annotation.

`seen_model_output: false` here means no prior extension prediction was consulted by the AI annotator; it does not mean Khushi personally labeled these rows. Always retain `annotation_origin`, `annotator` and `human_validated`. The generic scoring utility does not enforce human provenance, so do not use this AI file as human ground truth for reported project accuracy.

Seven unclear cases are flagged for review, including four conditional export-control notices where the codebook needs a decision. No positive sponsorship statements were identified. Human review is needed before final evaluation.
