// Offline tests for the code-side rules: no model call, no index needed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCard, NO_RECORDS, renderCardText } from "../src/card.js";
import { applyGuards } from "../src/classify.js";
import { matchHistory, pickEmployer, titlesSimilar } from "../src/match.js";
import { normalizeEmployer, titleTokens } from "../src/normalize.js";

const base = {
  label: "sponsors", quote: "We will sponsor H-1B visas", confidence: 97,
  explicitly_excludes_sponsorship: false, requires_citizenship_or_clearance: false,
  employer_name: "Acme", job_title: "Data Analyst", job_title_normalized: "Data Analyst",
};
const meta = { years: ["FY2024", "FY2025", "FY2026 Q1-Q3"] };
const shard = {
  "ACME": { n: "ACME INC", t: { "DATA ANALYST": [3, 2, 1], "SENIOR DATA ANALYST II": [1, 0, 0], "ACCOUNTANT": [5, 5, 5] } },
  "ACME STAFFING": { n: "ACME STAFFING LLC", t: { "RECRUITER": [1, 1, 1] } },
  "GLOBEX HOLDINGS": { n: "GLOBEX HOLDINGS LLC", t: { "ENGINEER": [9, 9, 9] } },
  "GLOBEX PARTNERS": { n: "GLOBEX PARTNERS LP", t: { "ENGINEER": [8, 8, 8] } },
  "GLOBEX IT": { n: "GLOBEX IT INC", t: { "ENGINEER": [8, 8, 8] } },
};
const load = async () => shard;

test("employer names lose punctuation and corporate suffixes", () => {
  assert.equal(normalizeEmployer("Meta Platforms, Inc."), "META PLATFORMS");
  assert.equal(normalizeEmployer("JPMorgan Chase & Co."), "JPMORGAN CHASE AND");
  assert.equal(normalizeEmployer("JPMORGAN CHASE & CO"), "JPMORGAN CHASE AND");
  assert.equal(normalizeEmployer("The Boeing Company"), "BOEING");
  assert.equal(normalizeEmployer("Amazon.com Services LLC"), "AMAZON COM SERVICES");
});

test("titles drop level words and expand abbreviations", () => {
  assert.deepEqual(titleTokens("Sr. ML Engineer II"), ["MACHINE", "LEARNING", "ENGINEER"]);
  assert.deepEqual(titleTokens("Associate Consultant"), ["CONSULTANT"]);
});

test("similar titles: containment or high overlap", () => {
  const ds = titleTokens("Data Scientist");
  assert.ok(titlesSimilar(ds, titleTokens("DATA SCIENTIST, PRODUCT ANALYTICS")));
  assert.ok(!titlesSimilar(ds, titleTokens("DATA ENGINEER")));
  assert.ok(!titlesSimilar(ds, titleTokens("RESEARCH SCIENTIST")));
});

test("the dominant record name is picked, and an exact name breaks a tie", () => {
  assert.equal(pickEmployer(shard, "ACME").entry.n, "ACME INC");
  const family = {
    "INITECH": { n: "INITECH LLP", t: { "PARTNER": [1, 1, 1] } },
    "INITECH CONSULTING": { n: "INITECH CONSULTING LLP", t: { "CONSULTANT": [50, 50, 50] } },
  };
  assert.equal(pickEmployer(family, "INITECH").entry.n, "INITECH CONSULTING LLP");
  const split = { ...shard, "GLOBEX": { n: "GLOBEX INC", t: { "ENGINEER": [1, 0, 0] } } };
  assert.equal(pickEmployer(split, "GLOBEX").entry.n, "GLOBEX INC");
});

test("no employer is picked when no candidate dominates", () => {
  const { entry, others } = pickEmployer(shard, "GLOBEX");
  assert.equal(entry, null);
  assert.equal(others.length, 3);
});

test("history counts only similar titles", async () => {
  const h = await matchHistory({ employerName: "Acme, Inc.", jobTitle: "Data Analyst" }, load, meta);
  assert.equal(h.status, "similar_roles");
  assert.equal(h.similarCount, 7);
  assert.deepEqual(h.byYear, [4, 2, 1]);
  assert.equal(h.employerTotal, 22);
  assert.deepEqual(h.employerByYear, [9, 7, 6]);
});

test("unknown employer reads 'no records found' and never 'does not sponsor'", async () => {
  const h = await matchHistory({ employerName: "Nowhere Labs", jobTitle: "Data Analyst" }, load, meta);
  const text = renderCardText(buildCard(applyGuards({ ...base, label: "unclear", quote: "x" }, "x"), h));
  assert.ok(text.includes(NO_RECORDS));
  assert.ok(text.includes("That is not a no."));
  assert.ok(!/does not sponsor/i.test(text));
});

test("a posting that excludes sponsorship is never labeled sponsors", () => {
  const posting = "We will sponsor H-1B visas. Sponsorship is not available for this role.";
  assert.equal(applyGuards(base, posting).label, "unclear");
  const flagged = { ...base, requires_citizenship_or_clearance: true };
  assert.equal(applyGuards(flagged, "We will sponsor H-1B visas").label, "unclear");
  assert.equal(applyGuards(base, "U.S. citizenship is required. We will sponsor H-1B visas").label, "unclear");
  assert.equal(applyGuards(base, "We will sponsor H-1B visas for qualified candidates.").label, "sponsors");
});

test("a quote that is not in the posting is flagged", () => {
  const h = { status: "no_records", otherNames: [], years: meta.years };
  const card = buildCard(applyGuards({ ...base, quote: "We sponsor visas" }, "We will sponsor H-1B visas"), h);
  assert.ok(card.flags.includes("quote not found word for word in the posting"));
});

test("confidence under 70 adds the recruiter flag; unclear adds the nudge", () => {
  const h = { status: "no_records", otherNames: [], years: meta.years };
  const card = buildCard(applyGuards({ ...base, label: "unclear", confidence: 69 }, base.quote), h);
  assert.ok(card.flags.includes("check with recruiter"));
  assert.equal(card.nudge, "Worth a recruiter question. Don't rule this out.");
  assert.deepEqual(buildCard(applyGuards({ ...base, confidence: 70 }, base.quote), h).flags, []);
});
