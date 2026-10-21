// Picks the dev set (about 60 postings for prompt tuning) with a fixed seed, stratified by gold label
// and balanced across industries. Dry run by default; --write saves eval/dev_ids.txt.
//
//   npm run eval:dev                       preview
//   npm run eval:dev -- --write            save (refuses to overwrite without --force)
//   options: --size 60  --seed sponsor-signal-dev-1  --min-per-label 5
//
// Pick the dev set ONCE, after the 200 postings are final, then never change it (docs/eval-guide).
import { writeFileSync, existsSync } from 'node:fs';
import { loadEvalSet, seededRandom, shuffle, parseArgs, DEV_IDS_PATH, LABELS } from './eval_lib.mjs';

const args = parseArgs(process.argv.slice(2));
const size = Number(args.size || 60);
const seed = String(args.seed || 'sponsor-signal-dev-1');
const minPer = Number(args['min-per-label'] || 5);

const { items, unlabeled, problems } = loadEvalSet();
if (problems.length) console.error('problems:\n  ' + problems.join('\n  '));
if (items.length < size) throw new Error(`only ${items.length} labeled postings, need at least ${size}`);

const byLabel = Object.fromEntries(LABELS.map((l) => [l, items.filter((i) => i.gold === l)]));

// Proportional quota per label, at least minPer, but never more than half of a label's postings,
// so rare labels keep some postings for the test set. Quotas sum to `size`.
const cap = (l) => Math.ceil(byLabel[l].length / 2);
const floor = (l) => Math.min(minPer, cap(l));
const quota = {};
for (const l of LABELS) quota[l] = Math.min(cap(l), Math.max(minPer, Math.round((byLabel[l].length / items.length) * size)));
let total = LABELS.reduce((s, l) => s + quota[l], 0);
const bySize = [...LABELS].sort((a, b) => byLabel[b].length - byLabel[a].length);
while (total !== size) {
  const step = total > size ? -1 : 1;
  const l = bySize.find((x) => (step < 0 ? quota[x] > floor(x) : quota[x] < cap(x)));
  if (!l) break;
  quota[l] += step;
  total += step;
}

const rand = seededRandom(seed);
const picked = [];
for (const l of LABELS) {
  // Round-robin across industries so each label's picks are spread over finance, tech and consulting.
  const groups = {};
  for (const i of shuffle(byLabel[l], rand)) (groups[i.industry] ||= []).push(i);
  const lists = Object.values(groups);
  let n = 0;
  while (n < quota[l] && lists.some((g) => g.length)) {
    for (const g of lists) if (g.length && n < quota[l]) (picked.push(g.shift()), n++);
  }
}

const count = (rows, key) => rows.reduce((a, r) => ((a[r[key]] = (a[r[key]] || 0) + 1), a), {});
console.log(`labeled postings: ${items.length} (unlabeled, skipped: ${unlabeled.length}); dev size ${picked.length}; seed "${seed}"`);
console.log('gold label, all vs dev:');
for (const l of LABELS) console.log(`  ${l.padEnd(18)} ${String(byLabel[l].length).padStart(4)}  dev ${picked.filter((p) => p.gold === l).length}`);
console.log('industry, dev:', count(picked, 'industry'));
console.log('sample arm, dev:', count(picked, 'sample_arm'));
console.log('text kind, dev:', count(picked, 'text_kind'));
console.log('distinct employers in dev:', new Set(picked.map((p) => p.employer_as_posted)).size);

if (args.write) {
  if (existsSync(DEV_IDS_PATH) && !args.force) throw new Error(`${DEV_IDS_PATH} exists. The dev set is frozen; pass --force only if the team agreed to re-pick.`);
  const ids = picked.map((p) => p.id).sort();
  writeFileSync(DEV_IDS_PATH, `# Dev set: seed "${seed}", size ${ids.length}. Frozen. Do not edit.\n${ids.join('\n')}\n`);
  console.log(`wrote ${DEV_IDS_PATH}`);
} else {
  console.log('\n(dry run; add --write to save)');
}
