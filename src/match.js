// Step 4, Match. Plain code, no model: employer and title -> LCA certification history.
//
// Index shape (one gzipped JSON shard per two-character employer prefix):
//   { "<normalized employer>": { n: "<name as filed>", t: { "<JOB TITLE AS FILED>": [fy counts...] } } }
import { normalizeEmployer, shardOf, titleTokens } from "./normalize.js";

// A posting title is "similar" to a filed title when every word of the posting title appears
// in the filed title, or the two word sets overlap at this Jaccard score or higher.
export const TITLE_JACCARD_MIN = 0.6;
// When several filed names match or start with the posting's employer name, take the largest
// only if it holds at least this share of their combined certifications.
export const EMPLOYER_DOMINANCE_MIN = 0.5;

export function titlesSimilar(postingTokens, filedTokens) {
  if (!postingTokens.length || !filedTokens.length) return false;
  const filed = new Set(filedTokens);
  const shared = postingTokens.filter((t) => filed.has(t)).length;
  if (shared === postingTokens.length) return true;
  return shared / (postingTokens.length + filed.size - shared) >= TITLE_JACCARD_MIN;
}

const total = (entry) => Object.values(entry.t).reduce((s, c) => s + c.reduce((a, b) => a + b, 0), 0);

// Returns { entry, others } where others are near-miss names shown for transparency.
export function pickEmployer(shard, key) {
  if (!shard || !key) return { entry: null, others: [] };
  const candidates = Object.keys(shard)
    .filter((k) => k === key || k.startsWith(key + " ") || key.startsWith(k + " "))
    .map((k) => ({ key: k, entry: shard[k], total: total(shard[k]) }))
    .sort((a, b) => b.total - a.total);
  if (!candidates.length) return { entry: null, others: [] };
  const names = (list) => list.slice(0, 3).map((c) => c.entry.n);
  const sum = candidates.reduce((s, c) => s + c.total, 0);
  // Postings usually give a brand ("Deloitte") while the records hold legal entities
  // ("Deloitte Consulting LLP"), so the dominant entity wins even over an exact-name match.
  const pick =
    candidates[0].total / sum >= EMPLOYER_DOMINANCE_MIN ? candidates[0] : candidates.find((c) => c.key === key);
  if (!pick) return { entry: null, others: names(candidates) };
  return { entry: pick.entry, others: names(candidates.filter((c) => c !== pick)) };
}

// loadShard(prefix) -> shard object or null. meta is the index's meta.json ({ years: [...] }).
export async function matchHistory({ employerName, jobTitle }, loadShard, meta) {
  const key = normalizeEmployer(employerName);
  const shard = key ? await loadShard(shardOf(key)) : null;
  const { entry, others } = pickEmployer(shard, key);
  if (!entry) return { status: "no_records", matchedEmployer: null, otherNames: others, years: meta.years };

  const posting = titleTokens(jobTitle);
  const byYear = meta.years.map(() => 0);
  const similar = [];
  for (const [title, counts] of Object.entries(entry.t)) {
    if (!titlesSimilar(posting, titleTokens(title))) continue;
    counts.forEach((c, i) => (byYear[i] += c));
    similar.push([title, counts.reduce((a, b) => a + b, 0)]);
  }
  similar.sort((a, b) => b[1] - a[1]);
  const similarCount = byYear.reduce((a, b) => a + b, 0);
  return {
    status: similarCount ? "similar_roles" : "no_similar_roles",
    matchedEmployer: entry.n,
    otherNames: others,
    employerTotal: total(entry),
    similarCount,
    byYear,
    years: meta.years,
    typicalTitles: similar.slice(0, 3).map(([t]) => t),
  };
}
