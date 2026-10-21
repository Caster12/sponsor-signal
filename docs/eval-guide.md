# Evaluation guide

Everything needed to run the evaluation of Sponsor Signal from scratch, written for someone who has not seen the project. Read sections 1 and 2, then jump to the step you are on. Sections marked **Not built yet** describe work that has no script in the repo today; the definitions there are what the team should implement and report.

Related files: [docs/spec.md](spec.md) (the product spec and the pass/fail criteria), [eval/README.md](../eval/README.md) (the data format and codebook, kept short), [README.md](../README.md) (how to run the product).

## 1. What the project is

Sponsor Signal is a Chrome extension for international students (on F-1 status, needing OPT now and H-1B sponsorship later) who are screening many job postings. On a posting page it shows one card with two facts:

1. **What the posting says about visa sponsorship**, as one of four labels plus the exact quote the label rests on and a confidence score.
2. **The employer's history of H-1B LCA certifications** for similar roles, from public Department of Labor (DOL) data. An LCA (Labor Condition Application) is a step an employer takes before filing an H-1B petition. A certified LCA is not a petition, an approval, or a hire, so the product never says "filings", "sponsorships" or "hires".

How the product works, in order (code in `src/`):

| Step | What happens | Done by |
| --- | --- | --- |
| Capture | The extension reads the text of the page the student has open. | `extension/background.js` |
| Classify and extract | One model call returns the label, quote, confidence, employer name and normalized job title. Code then checks the quote really appears in the posting and enforces the hard rule below. | `src/classify.js` (model `claude-opus-5-5`) |
| Match | Plain code, no model, looks the employer and title up in an index built from the DOL files. | `src/match.js` |
| Card | Builds the card. "No records found" is never shown as a "no". | `src/card.js` |

**The four labels** (the spec's final set; `citizenship_or_clearance` was merged into `does_not_sponsor` in PR #4):

| Label | Meaning |
| --- | --- |
| `sponsors` | The posting says the employer will sponsor a work visa for this role. Hedged wording such as "limited immigration sponsorship may be available" is a judgment call, see section 5. |
| `does_not_sponsor` | The posting says sponsorship is not offered, or it requires U.S. citizenship, "U.S. persons" status, or a clearance. The outcome is the same for a student who needs sponsorship. |
| `silent` | The posting says nothing about visas, sponsorship, work authorization, citizenship or clearance. |
| `unclear` | The posting says something on the subject but the wording is ambiguous or conflicting, for example "authorized to work in the United States on a permanent basis". No tie-break toward another label. |

**The hard rule:** a posting that explicitly excludes sponsorship or requires citizenship is never labeled `sponsors`. A wrong `sponsors` costs the student the most.

## 2. What the evaluation has to show

The spec ([Success criteria](spec.md#success-criteria)) defines the pass/fail bar. All of it is measured on **200 hand-labeled postings across finance, tech and consulting**.

**Pass or fail**

| # | Criterion | Measured by |
| --- | --- | --- |
| 1 | Correct sponsorship label on at least **85%** of postings. | Section 8 |
| 2 | Higher accuracy than a **keyword-search baseline** on the same postings. Any margin counts. | Section 9 |
| 3 | Employer matched to the right DOL records at least **90%** of the time, scored on **100 hand-verified companies**. | Section 10 |
| 4 | **Zero** postings that exclude sponsorship or require citizenship labeled `sponsors`. | Section 8 |

**Reported, not pass/fail:** whether confidence scores are honest (90% confident should mean right about 90% of the time); accuracy by label, with `silent`, `unclear` and indirect phrasing called out; how often `unclear` is used and whether the hand labelers agree it was warranted; how often `silent` postings come from employers with substantial LCA history.

The pieces, and how they fit together:

```
collect postings (3)  ->  label by hand, blind (4, 5)  ->  agreement + adjudication (6)
                                                                |
split dev / test (7)  ->  run the product on the test set (8)  ->  score, baseline, matching (8-10)
                                                                |
                                                  report (11)
```

## 3. The evaluation set

### 3.1 Where things live

```
eval/
  README.md          data format and codebook (short version of sections 3 to 5)
  khushi/            one folder per collector; same layout in each
  vishal/
    meta.jsonl            one row per posting, no text
    texts/<id>.raw.txt         the whole page as captured, site chrome included
    texts/<id>.posting.txt     only the employer's job description
    labels/<annotator>.jsonl   one file per labeler
    screenshots/<id>_extension.webp   the page with the extension panel, kept so transcriptions can be checked
    postings.jsonl             generated, never edited by hand
```

Ids are unique across folders: Khushi uses `p001`, `p002`, ... and Vishal uses `v001`, `v002`, ... Run `npm run eval:build` after any change. It regenerates every `postings.jsonl`, prints counts against the targets, and fails if an id is reused, a text file is missing, an industry or sample arm is invalid, or an employer exceeds the cap.

### 3.2 Targets and quotas

- **200 postings in total**, about **65 per industry** (`finance`, `tech`, `consulting`).
- At most **3 postings per employer** (checked by `eval:build`). The 90% matching criterion needs about 100 distinct employers, so 200 postings over at least 100 employers.
- `sample_arm` is `natural` (found by browsing, whatever the label) or `targeted` (found by searching for a rare label, for example "will sponsor H-1B"). Natural postings are mostly `silent`. Use targeted ones to get enough `sponsors`, `does_not_sponsor` and `unclear` cases; keep the arm recorded so the natural share can be reported separately.

### 3.3 What a `meta.jsonl` row contains

```json
{"id":"p010","url":"https://www.amazon.jobs/en/jobs/10461957/...","external_url":null,
 "external_id":"10461957","captured_on":"2026-10-19","source":"company_site",
 "industry":"tech","sample_arm":"natural","employer_as_posted":"Amazon Web Services, Inc.",
 "title_as_posted":"Delivery Consultant- AI/ML, WWPS ProServe","portal_work_authorization":null}
```

`source` is where the page lives (`company_site`, `linkedin`, `12twenty`). Optional fields: `portal_work_authorization` (a portal's structured field, recorded but not used for the label), `page_screening_question` (an application-form question on the page, see section 5), `raw_redactions` (what was removed from the raw text for privacy).

### 3.4 Collecting a posting, step by step

1. Open the posting page in Chrome with the Sponsor Signal panel visible. Take a **screenshot** of the page and panel. **Cover anything personal** (your profile photo, other people's names or photos, email addresses) with solid boxes before committing it. The panel's output also appears in the screenshot, which matters for blind labeling (section 4).
2. Copy the **full page text** into `texts/<id>.raw.txt`, exactly as captured. Remove only things that identify a person: tracking query strings and account ids in links, names of network contacts, email addresses of individual staff. Note the removal in `raw_redactions`.
3. Put **only the employer's job description** in `texts/<id>.posting.txt`: from the job title through the end of the employer's own text (including trailing legal statements such as "Other Employment Statements", which is where sponsorship wording often sits). Leave out site menus, share buttons, "similar jobs", footers and cookie text. **Do not edit the wording.**
4. Add one line to `meta.jsonl`.
5. Run `npm run eval:build`.
6. Label the posting (section 4). Do this **before** looking at what the extension said.

Setup for the commands in this guide: Node 20 or newer, `npm install`, and `npm run build` for the extension bundle. The DOL index is already committed in `extension/data/` (1,014 files, FY2024 to FY2026 Q1-Q3), so nothing needs downloading. Rebuilding the index from DOL files is only needed if the matching data changes (README, "Set up").

## 4. Labeling

Each posting gets a label row in `labels/<annotator>.jsonl`:

```json
{"id":"p010","label":"does_not_sponsor",
 "quote":"This position requires that the candidate to be a US citizen.",
 "seen_model_output":false,"notes":"Labeled blind. ..."}
```

- `label` is one of the four labels.
- `quote` is the **exact words** from the posting that the label rests on, one contiguous passage, as short as carries the meaning. For `silent` the quote is the fixed string `no sponsorship language found`. Check the quote appears word for word in `posting.txt`.
- `seen_model_output` is `true` if you saw the extension's answer before labeling, `false` if you labeled first. **Be honest**; labels with `true` are pilot data and are excluded from the final numbers unless relabeled blind.
- `notes` records anything a later reader needs: wording that was hedged, a disagreement with the model, why a keyword hit was not sponsorship language.

**How to label blind:** read `posting.txt` and decide the label before you open the screenshot or run the model. If your collection workflow makes the panel visible while you browse, take the label from the posting text first and only then look.

**Rules for deciding**

1. The label comes from the **posting's own words**, not from the portal, the model, or what you know about the employer's habits.
2. Read the whole posting, including the end. Sponsorship statements are often in legal boilerplate near the bottom.
3. Boilerplate is **not** sponsorship language: equal-opportunity statements (including the words "citizenship status" in a non-discrimination list), E-Verify notices, "we sponsor training", "labor condition applications" as a site link.
4. If it says something about the subject but the wording does not settle it, it is `unclear`. There is no tie-break toward `sponsors` or `does_not_sponsor`.

## 5. Codebook rules (decisions made so far)

Add new rules to `eval/README.md` the first time a case needs a decision, with the posting id that raised it.

| Situation | Label | Example |
| --- | --- | --- |
| "Will not pursue visa sponsorship" / "not eligible for visa sponsorship", even if the same sentence also requires work eligibility | `does_not_sponsor` | p001 American Express, p009 ZS |
| "Must have work authorization that does not now or in the future require sponsorship" | `does_not_sponsor` | p007 Accenture |
| Requires U.S. citizenship, "U.S. persons only", or a clearance, with no sponsorship wording | `does_not_sponsor` | p010 Amazon Web Services |
| Says nothing on the subject | `silent` | p002 Match Group, p008 EY |
| Only boilerplate that mentions citizenship status or "sponsor training" | `silent` | p005 Qvest US |
| Ambiguous or conflicting wording ("authorized to work on a permanent basis") | `unclear` | spec example 2 |
| A portal's structured field (for example 12twenty "Work Authorization") | Does **not** decide the label. Record it in `portal_work_authorization`. | p001 |
| **An application-form screening question on the page** (for example "Will you now, or in the future, require visa sponsorship to maintain work eligibility?") | Not the employer's posting wording. Does **not** decide the label. Record it in `page_screening_question`. If the extension quotes it, count that as a **model error**. | p004 Artefact |
| Hedged offers ("limited immigration sponsorship may be available") | Labeled `sponsors` in p006, while the extension said `unclear`. Treat hedged offers as a known disagreement area: both labelers should flag them and adjudicate in section 6. | p006 Deloitte |

## 6. Agreement and adjudication

**Not built yet.** The process (also in `eval/README.md`):

1. A second labeler labels postings **independently**, without seeing the first labeler's labels or the model's output, in their own file (`labels/<their name>.jsonl`). Overlap size is a team decision; the more postings are double-labeled, the stronger the agreement number. At minimum double-label the dev set and every posting where one labeler used `unclear` or `sponsors` with hedged wording.
2. Compute **Cohen's kappa** between the two labelers over the double-labeled postings. With observed agreement `p_o` and chance agreement `p_e = sum over labels of (share of labeler A using it) x (share of labeler B using it)`, `kappa = (p_o - p_e) / (1 - p_e)`. Also report the raw agreement rate and the confusion table between the two.
3. **Adjudicate every disagreement together**, reading the quote, and agree a final label. Record it as a third label file (`labels/adjudicated.jsonl`, same format, with a note saying why). Where the disagreement exposes a missing rule, add the rule to section 5.
4. The **gold label** used for scoring is the adjudicated label where one exists, otherwise the single agreed label. Never use model output as ground truth.

## 7. Dev set and test set

Keep about **60 postings as a dev set**: the ones you may read model mistakes on, tune the prompt in `src/classify.js` on, and adjust the codebook from. **Report the final numbers only on the remaining test set** (about 140 postings), and do not change the prompt after the first test-set run. Pick the dev set once, at random, with a fixed seed, balanced across industries and labels (include some of each rare label), write the ids to `eval/dev_ids.txt`, and do not change it afterwards. If you change the prompt after seeing the test results, say so in the report and re-score on fresh postings.

## 8. Running the product and scoring the label (criteria 1 and 4)

**Not built yet:** a script that runs every posting through the product and scores it. The existing runners are `npm run examples` (the five synthetic spec examples; calls the model) and `npm run match` (matching only, no model). The scoring step should do the following.

**Input to give the model.** The extension reads the whole captured page, so evaluate on **`text_raw`** from `postings.jsonl`, which is what the product would see. Also run once on **`text_posting`** to separate "model reads wording wrong" from "page noise confuses the model". Report both; the raw-text result is the one that counts for the criteria.

**How to run each posting.** Use the same functions the product uses, from `test/run_examples.mjs`:

```js
import Anthropic from "@anthropic-ai/sdk";
import { classifyPosting } from "../src/classify.js";
const client = new Anthropic();               // needs ANTHROPIC_API_KEY or an `ant auth login` profile
const result = await classifyPosting(client, posting.text_raw);
// result: { label, quote, confidence, quote_verified, guard, employer_name, job_title, job_title_normalized, ... }
```

Save every result (label, quote, confidence, `guard`, `quote_verified`, employer and title extracted, the model id from `src/classify.js`, the date, and which text field was used) to a results file, for example `eval/results/<run-date>-raw.jsonl`. Model output is not fully deterministic. Run the test set once for the official numbers; if time allows run it three times and report the spread. Cost is one model call per posting.

**Scoring.**

- **Label accuracy** = postings where `result.label` equals the gold label, divided by the number of postings. Pass if at least 85%.
- **Hard rule check:** count postings with gold `does_not_sponsor` whose predicted label is `sponsors`. **Must be 0.** List any offender with its quote. Note that `applyGuards` in `src/classify.js` already turns a `sponsors` result into `unclear` when it finds exclusion wording, so also report how many times the guard fired.
- **Per-label table:** for each gold label, how many postings, how many correct, plus the full confusion matrix (gold rows by predicted columns).
- **Quote check:** share of non-`silent` results where `quote_verified` is true (the quote appears in the posting). Also compare the model's quote with the human quote where the labels agree.
- **Where it fails:** list the wrong ones with the posting id, gold, predicted, and the quote the model used. Known failure types so far: the model quoting an application-form question instead of the posting (p004, p010 pattern) and hedged wording (p006).
- **Natural vs targeted:** report accuracy for each sample arm. Natural postings are mostly `silent`, which can flatter accuracy; the per-label table shows whether the rare labels hold up.

**Confidence honesty (reported).** Bucket results by `confidence` (for example 50-69, 70-79, 80-89, 90-100) and report the accuracy in each bucket next to the bucket's average confidence. Also report how many postings fall under 70, since the product adds a "check with recruiter" flag there.

**`unclear` usage (reported).** Report how many results are `unclear`, how many gold labels are `unclear`, and whether the labelers agree it was warranted on the model's `unclear` cases. There are **no gold `unclear` postings in the set yet**, so the set must include some (targeted search for hedged or ambiguous wording) before this can be reported.

**Indirect phrasing (reported).** The spec asks to call out indirect phrasing. Mark each posting whose sponsorship wording is not a plain sentence (for example hedged, buried in legal text, or only implied) by adding `"indirect": true` to its label row, and report accuracy for that group.

**Silent postings and LCA history (reported).** For postings where the model says `silent`, report how many come from employers whose matched record shows a large LCA count (the card's company-wide count). Choose the threshold before looking, for example 100 or more certifications over the three fiscal periods.

## 9. Keyword-search baseline (criterion 2)

**Not built yet.** The spec requires beating a keyword-search baseline on the same postings but does not define one. The team should fix the definition **before running the product** so it cannot be tuned afterwards. A reasonable definition, to be agreed and then written into the repo (for example `eval/baseline.mjs`):

1. Lowercase the posting. If it matches any exclusion pattern (`sponsor` with `not`, `no`, `unable`, `without`, "not available"; "citizen"; "U.S. persons only"; "clearance"), predict `does_not_sponsor`.
2. Otherwise, if it contains `sponsor`, `visa` or `H-1B` in a positive sentence, predict `sponsors`.
3. Otherwise, if it contains `work authorization`, `authorized to work` or `eligible to work`, predict `unclear`.
4. Otherwise predict `silent`.

Run it on the **same text and same test set**, compute the same accuracy, and report both numbers side by side. The product passes this criterion if its accuracy is higher by any margin. Also report the baseline's per-label table; its weaknesses (negation, hedging, boilerplate) are the argument for using a model.

## 10. Employer matching (criterion 3)

**Not built yet.** This scores step 4 (code, not the model), separately from the label.

1. **Pick 100 employers**: distinct `employer_as_posted` values from the set, spread across the three industries. Include some with brand names that differ from their legal entity (for example "Deloitte" versus "Deloitte & Touche LLP", "Amazon Web Services, Inc.").
2. **Hand-verify the right records.** For each employer, find in the DOL LCA disclosure data (the files `scripts/download_lca.py` fetches, or the committed index) which employer name or names are the correct legal entities for the one that posted the job, and record the answer. Where the true employer has **no** LCA records, record that too: for those the correct card output is "no records found". Save one row per employer, for example in `eval/employer_truth.jsonl`:
   ```json
   {"employer_as_posted":"Deloitte","correct_entities":["DELOITTE & TOUCHE LLP"],"has_records":true,"verified_by":"khushi","notes":""}
   ```
   Do the verification **without looking at what the matcher returned**, then compare.
3. **Run the matcher** on each employer, using the employer name the model extracted (`result.employer_name`) as the product does, plus a second pass using `employer_as_posted` to separate extraction errors from matching errors. Use `matchHistory` from `src/match.js` with `loadShard` and `meta` from `test/node_index.mjs`, exactly as `test/run_match.mjs` does.
4. **Score:** correct when the matched record name equals one of `correct_entities`, or when `has_records` is false and the matcher returns `no_records`. **Match accuracy** = correct over 100 employers. Pass if at least 90%. Report the failures by type: wrong entity picked, true records missed (shown as "no records found" although they exist), or a match shown for an employer that has none.

The matching rules that drive the result are in the README ("Matching rules"): suffix-stripped uppercase names, entities that equal or start with the posting's employer name, the largest entity wins if it holds at least half of the candidates' certifications, and a title is "similar" at Jaccard 0.6 or higher. The spec's criterion scores only the employer match, not the similar-role counts.

## 11. What to report

One table and a short narrative, with the run date, the model id from `src/classify.js`, the commit hash, which text field was scored, and the dev/test split:

| Item | Pass bar | Result |
| --- | --- | --- |
| Label accuracy (test set, raw text) | at least 85% | |
| Same, on posting text only | reported | |
| Keyword baseline accuracy (same set) | below the product | |
| Postings that exclude sponsorship or require citizenship labeled `sponsors` | 0 | |
| Employer match accuracy (100 verified companies) | at least 90% | |
| Cohen's kappa between labelers, and raw agreement | reported | |
| Confidence honesty (accuracy per confidence bucket) | reported | |
| Accuracy per label, with `silent`, `unclear`, indirect phrasing called out | reported | |
| `unclear` rate, and labeler agreement it was warranted | reported | |
| `silent` results from employers with large LCA history | reported | |

Then list: the errors worth reading (with posting ids), which codebook rules were added during labeling, the share of pilot labels (`seen_model_output: true`) excluded, and any caveat (set size by label, natural versus targeted mix, the prompt changed after the dev set).

## 12. Where things stand (snapshot, 2026-10-20; rerun `npm run eval:build` for current counts)

- **34 of 200 postings**: Khushi 10, Vishal 24; finance 8, tech 18, consulting 8; all `natural`; 32 distinct employers.
- **Gold labels so far** (single labeler each): `silent` 25, `does_not_sponsor` 6, `sponsors` 3, `unclear` 0. The set needs many more non-silent and some `unclear` postings.
- **Pilot labels** (`seen_model_output: true`): p001 and p002.
- **Missing before the evaluation can run:** a second labeler's files and the adjudication step; the dev-set list; the scoring script and results folder; the agreed baseline definition and script; the 100-company verification file; the `indirect` tag. Items 3 to 6 of the report table cannot be filled until those exist.
