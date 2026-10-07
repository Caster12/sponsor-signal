// Name and title normalization shared by the index builder and the matcher.

const EMPLOYER_SUFFIXES = new Set([
  "INC", "INCORPORATED", "LLC", "LLP", "LP", "LTD", "LIMITED", "CORP", "CORPORATION",
  "CO", "COMPANY", "PLC", "PC", "PLLC", "NA", "USA", "US",
]);

const TITLE_LEVEL_WORDS = new Set([
  "SENIOR", "SR", "JUNIOR", "JR", "LEAD", "STAFF", "PRINCIPAL", "ASSOCIATE",
  "I", "II", "III", "IV", "V",
]);

const TITLE_ABBREVIATIONS = {
  ML: ["MACHINE", "LEARNING"],
  AI: ["ARTIFICIAL", "INTELLIGENCE"],
  SWE: ["SOFTWARE", "ENGINEER"],
  SDE: ["SOFTWARE", "DEVELOPMENT", "ENGINEER"],
  QA: ["QUALITY", "ASSURANCE"],
  DEV: ["DEVELOPER"],
  ENGR: ["ENGINEER"],
  MGR: ["MANAGER"],
  QUANT: ["QUANTITATIVE"],
};

function words(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\.COM\b/g, " COM")
    .replace(/['’.]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// "Meta Platforms, Inc." -> "META PLATFORMS"
export function normalizeEmployer(name) {
  const w = words(name);
  if (w[0] === "THE" && w.length > 1) w.shift();
  while (w.length > 1 && EMPLOYER_SUFFIXES.has(w[w.length - 1])) w.pop();
  return w.join(" ");
}

// Shard file name for a normalized employer key: its first two characters.
export function shardOf(key) {
  return (key.replace(/ /g, "_") + "__").slice(0, 2);
}

// "Sr. ML Engineer II" -> ["MACHINE", "LEARNING", "ENGINEER"]
export function titleTokens(title) {
  const out = [];
  for (const w of words(title)) {
    if (TITLE_LEVEL_WORDS.has(w) || /^\d+$/.test(w)) continue;
    for (const t of TITLE_ABBREVIATIONS[w] || [w]) {
      // Crude plural fold so ANALYSTS and ANALYST compare equal.
      out.push(t.length > 4 && t.endsWith("S") && !t.endsWith("SS") ? t.slice(0, -1) : t);
    }
  }
  return [...new Set(out)];
}

// Collapse whitespace and typographic quotes so a quote can be checked against the posting.
export function squash(s) {
  return String(s || "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
