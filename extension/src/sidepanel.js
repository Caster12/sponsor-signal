// Side panel: runs Classify, Extract and Match on the captured text and renders the card.
import Anthropic from "@anthropic-ai/sdk";
import { buildCard } from "../../src/card.js";
import { classifyPosting } from "../../src/classify.js";
import { matchHistory } from "../../src/match.js";

const MIN_POSTING_CHARS = 200;
const $ = (id) => document.getElementById(id);
let run = 0;

function setStatus(text, isError = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", isError);
  $("status").hidden = !text;
}

function fill(listId, items) {
  $(listId).replaceChildren(...items.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
}

function showOptional(id, text) {
  $(id).textContent = text || "";
  $(id).hidden = !text;
}

function render(card) {
  $("label").textContent = card.labelText;
  $("label").dataset.label = card.label;
  $("confidence").textContent = `Confidence ${card.confidence}%`;
  $("quote").textContent = card.quoteText;
  showOptional("nudge", card.nudge);
  showOptional("guard", card.guard);
  fill("flags", card.flags);
  $("role").textContent = `${card.employer || "Employer not named"} · ${card.jobTitle}`;
  $("history-heading").textContent = card.historyHeading;
  fill("history", card.history);
  showOptional("record-note", card.recordNote);
  $("card").hidden = false;
}

async function loadShard(prefix) {
  const meta = await loadMeta();
  if (!meta.shards.includes(prefix)) return null;
  const res = await fetch(chrome.runtime.getURL(`data/${prefix}.json.gz`));
  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json();
}

let metaPromise;
function loadMeta() {
  metaPromise ||= fetch(chrome.runtime.getURL("data/meta.json")).then((r) => r.json());
  return metaPromise;
}

function explain(err) {
  if (err instanceof Anthropic.AuthenticationError) return "The API key was rejected. Check it in Settings.";
  if (err instanceof Anthropic.RateLimitError) return "The API is rate limiting this key. Wait a moment and try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the API. Check your connection and try again.";
  if (err instanceof Anthropic.APIError) return `The API returned an error (${err.status}). Try again.`;
  return err.message || String(err);
}

async function check(text) {
  const mine = ++run;
  $("card").hidden = true;
  if (text.trim().length < MIN_POSTING_CHARS) {
    setStatus("Could not read a job description from this page. Paste the posting text below.", true);
    $("paste").open = true;
    return;
  }
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) {
    setStatus("Add your Anthropic API key in Settings, then click the toolbar button again.", true);
    return;
  }
  setStatus("Reading the posting…");
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const result = await classifyPosting(client, text);
    const history = await matchHistory(
      { employerName: result.employer_name, jobTitle: result.job_title_normalized || result.job_title },
      loadShard,
      await loadMeta(),
    );
    if (mine !== run) return;
    render(buildCard(result, history));
    setStatus("");
  } catch (err) {
    if (mine === run) setStatus(explain(err), true);
  }
}

function onCapture(capture) {
  if (!capture) return;
  if (capture.error) {
    setStatus("This page cannot be read by the extension. Paste the posting text below.", true);
    $("card").hidden = true;
    $("paste").open = true;
    return;
  }
  check(capture.text);
}

chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.capture) onCapture(changes.capture.newValue);
});
// The click that opened the panel may have stored its capture before this script loaded.
chrome.storage.session.get("capture").then(({ capture }) => {
  if (capture && Date.now() - capture.at < 15000) onCapture(capture);
});

$("paste-go").addEventListener("click", () => check($("paste-text").value));
