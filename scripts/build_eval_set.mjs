// For each collector folder eval/<name>/, joins its posting list (meta.jsonl, or sources/urls.jsonl)
// with texts/<id>.{raw,posting}.txt into postings.jsonl, then prints quota counts over all folders.
// Postings with raw_page_status "not_captured" are description-only: they need only a posting text.
// Usage: npm run eval:build
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const INDUSTRIES = ['finance', 'tech', 'consulting'];
const TARGET = { total: 200, perIndustry: 65, maxPerEmployer: 3 };

const read = (p) => readFileSync(p, 'utf8');
const listFile = (dir) => [`${dir}/meta.jsonl`, `${dir}/sources/urls.jsonl`].find((p) => existsSync(p));
const folders = readdirSync('eval', { withFileTypes: true })
  .filter((d) => d.isDirectory() && listFile(`eval/${d.name}`))
  .map((d) => `eval/${d.name}`);

const out = [];
const problems = [];
const seenIds = new Map();
for (const dir of folders) {
  const rows = read(listFile(dir)).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const built = [];
  for (const m of rows) {
    if (seenIds.has(m.id)) problems.push(`${m.id}: id used in both ${seenIds.get(m.id)} and ${dir}`);
    seenIds.set(m.id, dir);
    const descriptionOnly = m.raw_page_status === 'not_captured';
    const raw = `${dir}/texts/${m.id}.raw.txt`;
    const posting = `${dir}/texts/${m.id}.posting.txt`;
    if (!existsSync(posting) || (!descriptionOnly && !existsSync(raw))) {
      problems.push(`${dir} ${m.id}: missing text file`);
      continue;
    }
    if (m.source_file && !existsSync(`${dir}/${m.source_file}`)) problems.push(`${dir} ${m.id}: missing ${m.source_file}`);
    if (!INDUSTRIES.includes(m.industry)) problems.push(`${dir} ${m.id}: industry must be one of ${INDUSTRIES.join(', ')}`);
    if (!['natural', 'targeted'].includes(m.sample_arm)) problems.push(`${dir} ${m.id}: sample_arm must be natural or targeted`);
    built.push({ ...m, text_raw: descriptionOnly ? null : read(raw).trim(), text_posting: read(posting).trim() });
  }
  writeFileSync(`${dir}/postings.jsonl`, built.map((r) => JSON.stringify(r) + '\n').join(''));
  const full = built.filter((r) => r.text_raw !== null).length;
  console.log(`${dir}: ${built.length} postings (${full} full-page, ${built.length - full} description-only)`);
  out.push(...built);
}

const count = (rows, key) => rows.reduce((a, r) => ((a[r[key]] = (a[r[key]] || 0) + 1), a), {});
const fullPage = out.filter((r) => r.text_raw !== null);
console.log(`\npostings: ${out.length} / ${TARGET.total} (${fullPage.length} full-page, ${out.length - fullPage.length} description-only)`);
console.log('by industry:', count(out, 'industry'), `(target about ${TARGET.perIndustry} each)`);
console.log('by sample arm:', count(out, 'sample_arm'));
const byEmployer = count(out, 'employer_as_posted');
for (const [e, n] of Object.entries(byEmployer)) if (n > TARGET.maxPerEmployer) problems.push(`employer cap exceeded: ${e} has ${n}`);
if (problems.length) {
  console.error('\nproblems:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exitCode = 1;
}
