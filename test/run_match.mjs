// Runs only the Match step (no model call) on the employer and title of each spec example,
// against the real LCA index, and prints the history lines the card would show.
import { readFileSync } from "node:fs";
import { buildCard } from "../src/card.js";
import { matchHistory } from "../src/match.js";
import { loadShard, meta } from "./node_index.mjs";

const { examples } = JSON.parse(readFileSync(new URL("examples.json", import.meta.url), "utf8"));
const stub = { label: "silent", quote: "", confidence: 100, quote_verified: true, guard: null };

for (const ex of examples) {
  const [employer, title] = ex.text.split("\n");
  const history = await matchHistory({ employerName: employer, jobTitle: title.split(",")[0] }, loadShard, meta);
  console.log(`===== Example ${ex.id}: ${employer} · ${title} =====`);
  for (const line of buildCard(stub, history).history) console.log(`  ${line}`);
  console.log();
}
