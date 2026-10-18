// Joins eval/meta.jsonl with eval/texts/<id>.{raw,posting}.txt into eval/postings.jsonl
// and prints quota counts. Usage: npm run eval:build
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const INDUSTRIES = ['finance', 'tech', 'consulting'];
const TARGET = { total: 200, perIndustry: 65, maxPerEmployer: 3 };

const read = (p) => readFileSync(p, 'utf8');
const rows = read('eval/meta.jsonl').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const out = [];
const problems = [];
for (const m of rows) {
  const raw = `eval/texts/${m.id}.raw.txt`;
  const posting = `eval/texts/${m.id}.posting.txt`;
  if (!existsSync(raw) || !existsSync(posting)) {
    problems.push(`${m.id}: missing text file`);
    continue;
  }
  if (!INDUSTRIES.includes(m.industry)) problems.push(`${m.id}: industry must be one of ${INDUSTRIES.join(', ')}`);
  if (!['natural', 'targeted'].includes(m.sample_arm)) problems.push(`${m.id}: sample_arm must be natural or targeted`);
  out.push({ ...m, text_raw: read(raw).trim(), text_posting: read(posting).trim() });
}
writeFileSync('eval/postings.jsonl', out.map((r) => JSON.stringify(r)).join('\n') + '\n');

const count = (key) => out.reduce((a, r) => ((a[r[key]] = (a[r[key]] || 0) + 1), a), {});
console.log(`postings: ${out.length} / ${TARGET.total}`);
console.log('by industry:', count('industry'), `(target about ${TARGET.perIndustry} each)`);
console.log('by sample arm:', count('sample_arm'));
const byEmployer = count('employer_as_posted');
for (const [e, n] of Object.entries(byEmployer)) if (n > TARGET.maxPerEmployer) problems.push(`employer cap exceeded: ${e} has ${n}`);
if (problems.length) {
  console.error('\nproblems:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exitCode = 1;
}
