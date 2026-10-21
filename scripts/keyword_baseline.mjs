// Keyword-search baseline (success criterion 2). DRAFT definition: the team must agree it
// before the product is run on the test set, so it cannot be tuned afterwards (docs/eval-guide).
//
// Rules, applied in order to the lowercased text:
//   1. an exclusion pattern                          -> does_not_sponsor
//   2. "sponsor...", "visa" or "H-1B"                -> sponsors
//   3. a work-authorization phrase                   -> unclear
//   4. none of the above                             -> silent
//
//   npm run eval:baseline                            all labeled postings, posting text
//   npm run eval:baseline -- --split test --text raw
// Writes predictions (id, label) in the format score_results.py reads as the baseline file.
import { pathToFileURL } from 'node:url';
import { loadEvalSet, selectSplit, writeJsonl, parseArgs } from './eval_lib.mjs';

const EXCLUSION = [
  /\b(?:not|no|unable to|cannot|can ?not|won'?t|will not|does not|do not|doesn'?t|don'?t|without)\b[^.\n]{0,60}\bsponsor/,
  /\bsponsorship\b[^.\n]{0,40}\b(?:not|un)\s?(?:available|offered|provided|supported)/,
  /\bu\.?s\.? citizen(?:ship)?\b[^.\n]{0,40}\b(?:required|only|must)/,
  /\b(?:must|required to) be (?:a )?u\.?s\.? citizen/,
  /\bu\.?s\.? persons? only\b/,
  /\b(?:security |secret |top secret )?clearance\b/,
];
const POSITIVE = [/\bsponsor(?:s|ed|ing|ship)?\b/, /\bh-?1b\b/, /\bvisas?\b/];
const WORK_AUTH = [/work authori[sz]ation/, /authori[sz]ed to work/, /(?:eligible|eligibility|right) to work/, /legally authori[sz]ed/];

export function predict(text) {
  const t = String(text).toLowerCase();
  if (EXCLUSION.some((p) => p.test(t))) return 'does_not_sponsor';
  if (POSITIVE.some((p) => p.test(t))) return 'sponsors';
  if (WORK_AUTH.some((p) => p.test(t))) return 'unclear';
  return 'silent';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const split = args.split || 'all';
  const field = args.text === 'raw' ? 'text_raw' : 'text_posting';
  const out = args.out || 'eval/results/baseline.jsonl';
  const { items } = loadEvalSet();
  const rows = selectSplit(items, split).map((i) => ({
    id: i.id,
    label: predict(i[field] || i.text_posting),
    text_field: i[field] ? field : 'text_posting',
  }));
  writeJsonl(out, rows);
  console.log(`wrote ${rows.length} baseline predictions to ${out} (split ${split}, text ${field})`);
}
