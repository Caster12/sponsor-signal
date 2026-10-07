// Step 5, Card: turn the classification and the record match into the card the student reads.
import { LABELS } from "./classify.js";

export const CONFIDENCE_FLAG_BELOW = 70;
export const NO_RECORDS = "no records found";
export const RECORD_NOTE =
  "An LCA certification is a Labor Department step an employer takes before an H-1B petition. It is not a petition, an approval, or a hire.";

const plural = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

function historyLines(h) {
  if (h.status === "no_records") {
    const lines = [NO_RECORDS, "The public record has nothing under this employer name. That is not a no."];
    if (h.otherNames.length) lines.push(`Similar names in the records, not matched: ${h.otherNames.join("; ")}`);
    return lines;
  }
  const lines = [`Matched to ${h.matchedEmployer}`];
  if (h.status === "no_similar_roles") {
    lines.push(`${plural(h.employerTotal, "LCA certification")} for this employer, none for similar roles.`);
  } else {
    const years = h.years.map((y, i) => `${y}: ${h.byYear[i].toLocaleString("en-US")}`).join(", ");
    lines.push(`${plural(h.similarCount, "LCA certification")} for similar roles (${years}).`);
    lines.push(`Typical titles: ${h.typicalTitles.join("; ")}`);
  }
  if (h.otherNames.length) lines.push(`Other similar names in the records, not counted: ${h.otherNames.join("; ")}`);
  return lines;
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
  if (card.recordNote) lines.push(`  ${card.recordNote}`);
  return lines.join("\n");
}
