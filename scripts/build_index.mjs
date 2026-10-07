// Build the matcher's index from data/lca_slim.csv into extension/data/.
// Counts H-1B cases with status "Certified" per employer, job title, and fiscal year.
import { createReadStream, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { normalizeEmployer, shardOf } from "../src/normalize.js";

const SRC = new URL("../data/lca_slim.csv", import.meta.url);
const OUT = new URL("../extension/data/", import.meta.url);
// The latest fiscal year is published one cumulative file at a time, so label how far it runs.
const YEAR_LABELS = { 2024: "FY2024", 2025: "FY2025", 2026: "FY2026 Q1-Q3" };
const YEARS = Object.keys(YEAR_LABELS).map(Number);

async function* csvRows(url) {
  let field = "", row = [], quoted = false, prev = "";
  for await (const chunk of createReadStream(url, "utf8")) {
    for (const ch of chunk) {
      if (quoted) {
        if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') {
        if (prev === '"') field += '"';
        quoted = true;
      } else if (ch === ",") {
        row.push(field); field = "";
      } else if (ch === "\n") {
        row.push(field); field = "";
        yield row; row = [];
      } else if (ch !== "\r") field += ch;
      prev = ch;
    }
  }
}

const employers = new Map(); // key -> { names: Map(raw -> count), t: Map(title -> counts[]) }
let read = 0, kept = 0;
for await (const [fy, visa, status, employer, title] of csvRows(SRC)) {
  if (fy === "fy") continue;
  read++;
  const yi = YEARS.indexOf(Number(fy));
  if (yi < 0 || visa !== "H-1B" || status !== "Certified") continue;
  const key = normalizeEmployer(employer);
  if (!key) continue;
  kept++;
  let e = employers.get(key);
  if (!e) employers.set(key, (e = { names: new Map(), t: new Map() }));
  e.names.set(employer, (e.names.get(employer) || 0) + 1);
  const t = title.toUpperCase().replace(/\s+/g, " ").trim();
  let counts = e.t.get(t);
  if (!counts) e.t.set(t, (counts = YEARS.map(() => 0)));
  counts[yi]++;
}

const shards = new Map();
for (const [key, e] of employers) {
  const n = [...e.names].sort((a, b) => b[1] - a[1])[0][0];
  const s = shardOf(key);
  if (!shards.has(s)) shards.set(s, {});
  shards.get(s)[key] = { n, t: Object.fromEntries(e.t) };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const [s, obj] of shards) {
  const gz = gzipSync(JSON.stringify(obj), { level: 9 });
  bytes += gz.length;
  writeFileSync(new URL(`${s}.json.gz`, OUT), gz);
}
const meta = {
  source: "U.S. Department of Labor, OFLC LCA disclosure data (H-1B, case status Certified)",
  years: YEARS.map((y) => YEAR_LABELS[y]),
  rowsRead: read,
  certifications: kept,
  employers: employers.size,
  shards: [...shards.keys()].sort(),
};
writeFileSync(new URL("meta.json", OUT), JSON.stringify(meta));
console.log({ ...meta, shards: shards.size, megabytes: +(bytes / 1e6).toFixed(1) });
