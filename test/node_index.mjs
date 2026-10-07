// Node-side loader for the index the extension ships in extension/data/.
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const DATA = new URL("../extension/data/", import.meta.url);

export const meta = JSON.parse(readFileSync(new URL("meta.json", DATA), "utf8"));

export async function loadShard(prefix) {
  const file = new URL(`${prefix}.json.gz`, DATA);
  return existsSync(file) ? JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) : null;
}
