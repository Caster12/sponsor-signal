# Sponsor Signal

A Chrome extension for international students screening job postings. Click it on a posting and a side panel shows one card with two facts:

1. What the posting itself says about visa sponsorship, with the exact quote.
2. The employer's history of H-1B LCA certifications for similar roles, from Department of Labor public data.

It does not give legal advice and does not predict whether an employer will sponsor. The full spec is in [docs/spec.md](docs/spec.md).

Team: Khushi Advani, Vishal Menon. Product Management with AI, Fall 2026.

## How it works

| Step | Where | What happens |
| --- | --- | --- |
| Capture | [extension/background.js](extension/background.js) | On toolbar click, reads the text of the open tab only. A paste box is the fallback. Optional: the "Auto-check when I switch tabs" box in the side panel (off by default, asks Chrome for permission to read pages) checks each tab you switch to, and sends its text to the API only if it reads like a job posting. |
| Classify and extract | [src/classify.js](src/classify.js) | One Claude call returns a label, the quote, a confidence score, the employer, and a normalized title. Code then checks the quote is in the posting and enforces the rule that a posting excluding sponsorship or requiring citizenship is never labeled Sponsors. |
| Match | [src/match.js](src/match.js) | Plain code looks the employer and title up in an index built from the DOL files. |
| Card | [src/card.js](src/card.js), [extension/src/sidepanel.js](extension/src/sidepanel.js) | Builds and renders the card. |

Labels: Sponsors, Does not sponsor, Citizenship or clearance required, Silent, Unclear.

### Matching rules

- **Records counted:** H-1B cases with status `Certified` in the LCA disclosure files for FY2024, FY2025, and FY2026 Q1 to Q3. One case counts once, however many worker positions it covers.
- **Employer:** names are uppercased and stripped of punctuation and corporate suffixes (Inc, LLC, Corp, and so on). Record names that equal the posting's employer name or start with it are candidates. The largest candidate is used when it holds at least half of the candidates' combined certifications, because postings usually give a brand ("Deloitte") while the records hold legal entities ("Deloitte Consulting LLP"). If none dominates, an exact name match is used; failing that, the card shows "no records found" and lists the near names. The card always names the record it matched.
- **Similar roles:** level words (Senior, II, Associate, and so on) are dropped and a few abbreviations expanded (ML, SWE, QA). A record title is similar when it contains every word of the posting's title, or when the two word sets overlap with a Jaccard score of 0.6 or more.

## Set up

Requires Node 20+ and Python 3.10+.

```sh
npm install
npm run build          # bundles the side panel into extension/dist/
```

Build the records index (about 1 GB of downloads, several minutes):

```sh
LCA_CONTACT_EMAIL=you@example.edu python3 scripts/download_lca.py   # dol.gov requires a contact email
python3 scripts/extract_lca.py                                       # xlsx -> data/lca_slim.csv
npm run build:index                                                  # -> extension/data/
```

Load it in Chrome: open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select the `extension/` folder. Open the extension's **Settings** and paste an Anthropic API key. The key stays in that browser and is sent only to `api.anthropic.com`, along with the text of each posting you check.

## Tests

```sh
npm test               # offline tests of the matching and guard rules
npm run match          # the Match step alone on the five spec examples, against the real index
npm run examples       # the five spec examples end to end; calls the model
```

`npm run examples` needs `ANTHROPIC_API_KEY` set, or an `ant auth login` profile. The five postings in [test/examples.json](test/examples.json) are synthetic.

## Data

Source: [DOL OFLC performance data](https://www.dol.gov/agencies/eta/foreign-labor/performance), LCA Programs disclosure files. An LCA certification is a step an employer takes before an H-1B petition; it is not a petition, an approval, or a hire, and the card says so.
