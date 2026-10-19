// For each collector folder eval/<name>/, joins meta.jsonl with texts/<id>.{raw,posting}.txt
// into postings.jsonl, then prints quota counts over all folders. Usage: npm run eval:build
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const INDUSTRIES = ['finance', 'tech', 'consulting'];
const TARGET = { total: 200, perIndustry: 65, maxPerEmployer: 3 };

const read = (p) => readFileSync(p, 'utf8');
const folders = readdirSync('eval', { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`eval/${d.name}/meta.jsonl`))
  .map((d) => `eval/${d.name}`);

const out = [];
const problems = [];
const seenIds = new Map();
for (const dir of folders) {
  const rows = read(`${dir}/meta.jsonl`).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const built = [];
  for (const m of rows) {
    if (seenIds.has(m.id)) problems.push(`${m.id}: id used in both ${seenIds.get(m.id)} and ${dir}`);
    seenIds.set(m.id, dir);
    const raw = `${dir}/texts/${m.id}.raw.txt`;
    const posting = `${dir}/texts/${m.id}.posting.txt`;
    if (!existsSync(raw) || !existsSync(posting)) {
      problems.push(`${dir} ${m.id}: missing text file`);
      continue;
    }
    if (!INDUSTRIES.includes(m.industry)) problems.push(`${dir} ${m.id}: industry must be one of ${INDUSTRIES.join(', ')}`);
    if (!['natural', 'targeted'].includes(m.sample_arm)) problems.push(`${dir} ${m.id}: sample_arm must be natural or targeted`);
    built.push({ ...m, text_raw: read(raw).trim(), text_posting: read(posting).trim() });
  }
  writeFileSync(`${dir}/postings.jsonl`, built.map((r) => JSON.stringify(r) + '\n').join(''));
  console.log(`${dir}: ${built.length} postings`);
  out.push(...built);
}

const count = (key) => out.reduce((a, r) => ((a[r[key]] = (a[r[key]] || 0) + 1), a), {});
console.log(`\npostings: ${out.length} / ${TARGET.total}`);
console.log('by industry:', count('industry'), `(target about ${TARGET.perIndustry} each)`);
console.log('by sample arm:', count('sample_arm'));
const byEmployer = count('employer_as_posted');
for (const [e, n] of Object.entries(byEmployer)) if (n > TARGET.maxPerEmployer) problems.push(`employer cap exceeded: ${e} has ${n}`);
if (problems.length) {
  console.error('\nproblems:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exitCode = 1;
}
