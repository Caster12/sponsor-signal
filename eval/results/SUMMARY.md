# Eval results, 2026-10-21

Model `claude-opus-5-5`, one call per posting, on all 238 labeled postings (240 minus pilots p001 and p002). Text: the raw page where captured (32 postings), otherwise the employer description (206). Dev set: the 60 ids in `eval/dev_ids.txt`; test: the other 178.

- **v1**: product code before commit e67bbef.
- **v2**: after e67bbef (application-form questions never decide the label; the extension also drops `<form>` text, which saved page texts cannot show).
- **Baseline**: draft keyword rules in `scripts/keyword_baseline.mjs`, run on the description text. Not yet agreed by the team.

| | v1 | v2 | Keyword baseline | Bar |
| --- | --- | --- | --- | --- |
| Accuracy, all 238 | 93.7% (223) | **96.2%** (229) | 93.7% (223) | at least 85% |
| Dev, 60 | 96.7% (58) | 96.7% (58) | 86.7% (52) | |
| Test, 178 | 92.7% (165) | **96.1%** (171) | 96.1% (171) | beat the baseline |
| Gold `does_not_sponsor` predicted `sponsors` | 0 | 0 | 0 | 0 |
| Non-silent quotes found verbatim in the posting | 69 of 69 | 63 of 63 | | |

v2 against v1: fixed v009, v017, v018, v019, v024 (application-form questions) and v047, v049 (export-control notice); broke v048 (export-control notice, confidence 55).

v2 per gold label: `sponsors` 8 of 9, `does_not_sponsor` 43 of 43, `silent` 173 of 179, `unclear` 5 of 7.

v2 confidence: 90-100, 201 postings, all correct; 80-89, 27 postings, 77.8%; 70-79, 5 postings, 100%; under 70, 5 postings, 40%.

## v2 errors

| Id | Split | Gold | v2 | Confidence | Note |
| --- | --- | --- | --- | --- | --- |
| p006 | dev | sponsors | unclear | 62 | "Limited immigration sponsorship may be available." |
| p051 | dev | unclear | silent | 80 | Export-control notice |
| p063 | test | unclear | silent | 80 | Export-control notice |
| v013 | test | silent | unclear | 62 | Clearance only on some projects |
| v048 | test | silent | unclear | 55 | Export-control notice |
| v086 | test | silent | unclear | 80 | "Legal authorization to work in the U.S. is required ... including F-1 students using OPT" |
| v128, v134, v140 | test | silent | unclear | 82-85 | "Proof of eligibility to work in the United States is required." |

Most remaining errors are label-rule questions, not clear model mistakes: export-control notices are labeled `unclear` in Khushi's set and `silent` in Vishal's, and bare work-eligibility statements are `unclear` in the classifier prompt but `silent` in Vishal's labels. Settle these in the codebook before the next run.

## Caveats

- The v2 prompt change was written after seeing v1 errors that are in the test split (v009, v017, v018, v019, v024), so v2's test score is not fully held out.
- 206 of 238 postings are description text only; only 32 are full page captures.
- The baseline rules are a draft.

Files: `gold.jsonl`, `v1-all-raw.jsonl`, `v2-all-raw.jsonl`, `baseline.jsonl`. Re-score with `python3 eval/khushi/description-only/p011-p100/score_results.py eval/results/gold.jsonl eval/results/v2-all-raw.jsonl eval/results/baseline.jsonl`.
