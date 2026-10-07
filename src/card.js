// Step 5, Card: turn the classification and the record match into the card the student reads.
import { LABELS } from "./classify.js";

export const CONFIDENCE_FLAG_BELOW = 70;
export const NO_RECORDS = "no records found";
export const RECORD_NOTE =
  "An LCA certification is a Labor Department step an employer takes before an H-1B petition. It is not a petition, an approval, or a hire.";

const plural = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
const lastOf = (arr) => arr[arr.length - 1];

function historyLines(h) {
  if (h.status === "no_records") {
    const lines = [NO_RECORDS, "The public record has nothing under this employer name. That is not a no."];
    if (h.otherNames.length) lines.push(`Similar names in the records, not matched: ${h.otherNames.join("; ")}`);
    return lines;
  }
  const lines = [`Matched to ${h.matchedEmployer}`];
  if (h.status === "no_similar_roles") {
    lines.push("None of this employer's LCA certifications were for similar roles.");
  } else {
    lines.push(`Typical titles: ${h.typicalTitles.join("; ")}`);
  }
  if (h.otherNames.length) lines.push(`Other similar names in the records, not counted: ${h.otherNames.join("; ")}`);
  return lines;
}

// Numeric stat tiles for the side panel. employerTotal/employerByYear are company-wide, across
// every title on file; similarCount/byYear are filtered to titles similar to the posting's role.
// Both come straight from the DOL LCA disclosure data: there is no employee-count field in that
// data, so a headcount stat is never shown here (see docs/spec.md, Data sources).
function historyStats(h) {
  if (h.status === "no_records") return [];
  const latestYear = lastOf(h.years);
  const span = h.years.length > 1 ? `${h.years[0]}–${latestYear}` : latestYear;
  const stats = [
    { label: "Company-wide LCA filings", value: h.employerTotal, hint: `all titles, ${span}` },
  ];
  if (h.status === "similar_roles") {
    stats.push({ label: "Similar-role filings", value: h.similarCount, hint: span });
    stats.push({
      label: `Latest cycle · ${latestYear}`,
      value: lastOf(h.byYear),
      hint: "similar roles",
      latest: true,
    });
  } else {
    stats.push({
      label: `Latest cycle · ${latestYear}`,
      value: lastOf(h.employerByYear),
      hint: "company-wide — no similar-role matches",
      latest: true,
    });
  }
  return stats;
}

export function buildCard(c, h) {
  const flags = [];
  if (c.confidence < CONFIDENCE_FLAG_BELOW) flags.push("check with recruiter");
  if (!c.quote_verified) flags.push("quote not found word for word in the posting");
  return {
    label: c.label,
    labelText: LABELS[c.label],
    quote: c.label === "silent" ? null : c.quote,
    quoteText: c.label === "silent" ? "no sponsorship language found" : `"${c.quote}"`,
    confidence: c.confidence,
    flags,
    nudge: c.label === "unclear" ? "Worth a recruiter question. Don't rule this out." : null,
    guard: c.guard,
    employer: c.employer_name,
    jobTitle: c.job_title,
    jobTitleNormalized: c.job_title_normalized,
    historyHeading: "History for similar roles",
    history: historyLines(h),
    stats: historyStats(h),
    recordNote: h.status === "no_records" ? null : RECORD_NOTE,
  };
}

// Plain-text rendering, used by the test runner. The side panel renders the same fields as HTML.
export function renderCardText(card) {
  const lines = [
    `${card.labelText.toUpperCase()}  (confidence ${card.confidence}%)`,
    card.quoteText,
  ];
  if (card.nudge) lines.push(card.nudge);
  if (card.guard) lines.push(card.guard);
  for (const f of card.flags) lines.push(`Flag: ${f}`);
  lines.push("", `${card.employer || "(employer not named)"} · ${card.jobTitle}`, `${card.historyHeading}:`);
  for (const l of card.history) lines.push(`  ${l}`);
  for (const s of card.stats) lines.push(`  ${s.label}: ${s.value.toLocaleString("en-US")} (${s.hint})`);
  if (card.recordNote) lines.push(`  ${card.recordNote}`);
  return lines.join("\n");
}
