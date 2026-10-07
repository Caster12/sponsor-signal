// Steps 2 and 3, Classify and Extract: one model call, then code-side checks.
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { squash } from "./normalize.js";

export const MODEL = "claude-opus-5-5";

export const LABELS = {
  sponsors: "Sponsors",
  does_not_sponsor: "Does not sponsor",
  citizenship_or_clearance_required: "Citizenship or clearance required",
  silent: "Silent",
  unclear: "Unclear",
};

const Output = z.object({
  label: z.enum(["sponsors", "does_not_sponsor", "citizenship_or_clearance_required", "silent", "unclear"]),
  quote: z.string().describe("Exact words copied from the posting that the label rests on. Empty string when the label is silent."),
  confidence: z.number().describe("Integer from 0 to 100: how likely the label is correct."),
  explicitly_excludes_sponsorship: z.boolean(),
  requires_citizenship_or_clearance: z.boolean(),
  employer_name: z.string().describe("Hiring employer as written in the posting. Empty string if the posting does not name one."),
  job_title: z.string().describe("Job title as written in the posting."),
  job_title_normalized: z.string().describe("The title without level, team, location, or requisition detail, e.g. 'Data Scientist II, Ads' becomes 'Data Scientist'."),
});

const SYSTEM = `You read one job posting for an international student who will need an employer to sponsor an H-1B visa later. You report what the posting itself says about visa sponsorship, and you pull out the employer and job title so that separate code can look up public Labor Department records. The student uses your label to decide whether to spend an hour applying, so a wrong "sponsors" costs them the most and must never come from a posting that rules sponsorship out.

Pick exactly one label:

- sponsors: the posting states the employer will sponsor a work visa for this role.
- does_not_sponsor: the posting explicitly says sponsorship is not offered, now or in the future, for this role.
- citizenship_or_clearance_required: the posting requires U.S. citizenship, "U.S. persons" status, or a security clearance.
- silent: the posting says nothing about visas, sponsorship, work authorization, citizenship, or clearance.
- unclear: the posting does say something on the subject, but the wording is ambiguous or conflicting. "Must be authorized to work in the United States on a permanent basis" is unclear: it may or may not exclude someone on OPT, and it does not mention sponsorship. A bare "must be authorized to work in the U.S." is also unclear. A posting that both offers sponsorship and excludes it is unclear.

Do not break ties toward any label. When the wording does not settle the question, the answer is unclear.

Judge only the posting text. Do not use what you know about the employer's general sponsorship practice. Boilerplate equal-opportunity statements and E-Verify notices are not sponsorship language.

Set explicitly_excludes_sponsorship to true whenever the posting contains a statement that sponsorship is not available, and requires_citizenship_or_clearance to true whenever it requires citizenship, U.S. person status, or a clearance. Set these independently of the label.

The quote must be copied character for character from the posting, one contiguous passage, as short as carries the meaning. Code will check that it appears in the posting.`;

// Backstop for the one hard rule: wording like this can never sit under a "sponsors" label.
const EXCLUSION_PATTERNS = [
  /\b(?:not|no|unable to|cannot|can ?not|won'?t|will not|does not|do not|doesn'?t|don'?t)\b[^.\n]{0,60}\bsponsor/i,
  /\bsponsorship\b[^.\n]{0,40}\b(?:not|un)\s?(?:available|offered|provided|supported)/i,
  /\bwithout\b[^.\n]{0,40}\bsponsorship\b/i,
  /\bu\.?s\.? citizen(?:ship)?\b[^.\n]{0,40}\b(?:required|only|must)/i,
  /\b(?:must|required to) be (?:a )?u\.?s\.? citizen/i,
  /\bu\.?s\.? persons? only\b/i,
  /\b(?:security )?clearance\b[^.\n]{0,30}\brequired\b/i,
];

export function applyGuards(result, postingText) {
  const out = { ...result, guard: null, quote_verified: true };
  out.confidence = Math.max(0, Math.min(100, Math.round(Number(out.confidence) || 0)));
  if (out.label === "silent") {
    out.quote = "";
  } else {
    out.quote_verified = out.quote.length > 0 && squash(postingText).includes(squash(out.quote));
  }
  if (out.label === "sponsors") {
    const flagged = out.explicitly_excludes_sponsorship || out.requires_citizenship_or_clearance;
    const hit = EXCLUSION_PATTERNS.find((p) => p.test(postingText));
    if (flagged || hit) {
      out.label = "unclear";
      out.guard = "The posting also contains wording that excludes sponsorship or requires citizenship, so it cannot be labeled Sponsors.";
    }
  }
  return out;
}

// client is an Anthropic SDK client. Returns the guarded classification plus extracted employer and title.
export async function classifyPosting(client, postingText) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(Output) },
    // If the model declines a request, the API re-runs it on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: `<posting>\n${postingText}\n</posting>` }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to read this posting.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("The model did not return a complete answer. Try again.");
  }
  return applyGuards(response.parsed_output, postingText);
}
