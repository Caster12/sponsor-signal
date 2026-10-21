// Runs the product's classify step (src/classify.js, live model calls) over the labeled postings and
// writes predictions for score_results.py. Calls the API: one request per posting.
//
//   npm run eval:run -- --split dev --dry-run          plan only, no API calls
//   npm run eval:run -- --split dev                    dev set (prompt tuning)
//   npm run eval:run -- --split test --text raw        test set, what the extension would read
//   options: --out eval/results/<name>.jsonl  --gold-out eval/results/gold.jsonl
//            --limit N  --concurrency 3  --text raw|posting  --no-resume
//
// Credentials: ANTHROPIC_API_KEY, or an `ant auth login` profile. Run the TEST split once, after the
// prompt and the baseline are frozen (docs/eval-guide).
//
// Scoring afterwards (from eval/khushi/description-only/p011-p100/):
//   python3 score_results.py <gold> <predictions> [<baseline>]
import { existsSync } from 'node:fs';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadEvalSet, selectSplit, readJsonl, writeJsonl, parseArgs } from './eval_lib.mjs';

const args = parseArgs(process.argv.slice(2));
const split = args.split || 'dev';
const wantRaw = (args.text || 'raw') === 'raw';
const out = args.out || `eval/results/${split}-${wantRaw ? 'raw' : 'posting'}.jsonl`;
const goldOut = args['gold-out'] || 'eval/results/gold.jsonl';
const concurrency = Number(args.concurrency || 3);
const limit = args.limit ? Number(args.limit) : Infinity;

const { items, unlabeled, problems } = loadEvalSet();
if (problems.length) console.error('problems:\n  ' + problems.join('\n  '));
const chosen = selectSplit(items, split).slice(0, limit);

// Gold file for the scorer: only labels made without seeing model output are eligible.
writeJsonl(goldOut, chosen.map((i) => ({ id: i.id, label: i.gold, quote: i.quote, seen_model_output: i.seen_model_output, set: i.set, industry: i.industry, sample_arm: i.sample_arm })));

const done = new Set();
if (existsSync(out) && !args['no-resume']) for (const r of readJsonl(out)) done.add(r.id);
const todo = chosen.filter((i) => !done.has(i.id));
const fallbacks = chosen.filter((i) => wantRaw && !i.text_raw).length;

console.log(`split ${split}: ${chosen.length} postings (${unlabeled.length} unlabeled skipped), ${done.size} already done, ${todo.length} to run`);
console.log(`text: ${wantRaw ? 'raw page text' : 'posting text'}${wantRaw ? ` (${fallbacks} postings have no raw text and use posting text instead)` : ''}`);
console.log(`gold -> ${goldOut}   predictions -> ${out}`);
if (args['dry-run']) {
  console.log('\n(dry run; no API calls made)');
  process.exit(0);
}

const { default: Anthropic } = await import('@anthropic-ai/sdk');
const { classifyPosting, MODEL } = await import('../src/classify.js');
const client = new Anthropic();
mkdirSync(dirname(out), { recursive: true });
const errPath = out.replace(/\.jsonl$/, '') + '.errors.jsonl';
let ok = 0;
let failed = 0;

async function runOne(item) {
  const field = wantRaw && item.text_raw ? 'text_raw' : 'text_posting';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await classifyPosting(client, item[field]);
      appendFileSync(out, JSON.stringify({ id: item.id, label: r.label, confidence: r.confidence, quote: r.quote, quote_verified: r.quote_verified, guard: r.guard, employer_name: r.employer_name, job_title: r.job_title, job_title_normalized: r.job_title_normalized, text_field: field, model: MODEL, ran_at: new Date().toISOString() }) + '\n');
      ok++;
      return;
    } catch (e) {
      if (attempt === 2) {
        failed++;
        appendFileSync(errPath, JSON.stringify({ id: item.id, error: String(e.message || e) }) + '\n');
      }
    }
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (queue.length) {
    await runOne(queue.shift());
    if ((ok + failed) % 10 === 0) console.log(`  ${ok + failed}/${todo.length} (failed ${failed})`);
  }
}));
console.log(`done: ${ok} ok, ${failed} failed${failed ? ` (see ${errPath}; rerun to retry them)` : ''}. Model ${MODEL}.`);
