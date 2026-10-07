// Runs the five spec examples through the real pipeline (live model call, real LCA index)
// and prints each card exactly as produced.
//
//   npm run examples
//
// Credentials: ANTHROPIC_API_KEY, or an `ant auth login` profile.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { buildCard, renderCardText } from "../src/card.js";
import { classifyPosting } from "../src/classify.js";
import { matchHistory } from "../src/match.js";
import { loadShard, meta } from "./node_index.mjs";

const { examples } = JSON.parse(readFileSync(new URL("examples.json", import.meta.url), "utf8"));
const client = new Anthropic();
let failed = 0;

for (const ex of examples) {
  const result = await classifyPosting(client, ex.text);
  const history = await matchHistory(
    { employerName: result.employer_name, jobTitle: result.job_title_normalized || result.job_title },
    loadShard,
    meta,
  );
  const ok = result.label === ex.expectedLabel;
  if (!ok) failed++;
  console.log(`===== Example ${ex.id}: ${ok ? "PASS" : "FAIL"} (expected ${ex.expectedLabel}, got ${result.label}) =====`);
  console.log(renderCardText(buildCard(result, history)));
  console.log("\nModel output after code checks:");
  console.log(JSON.stringify(result, null, 2));
  console.log();
}

console.log(failed ? `${failed} of ${examples.length} examples FAILED` : `All ${examples.length} examples passed`);
process.exit(failed ? 1 : 0);
