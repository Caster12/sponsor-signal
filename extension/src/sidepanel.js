// Side panel: runs Classify, Extract and Match on the captured text and renders the card.
import Anthropic from "@anthropic-ai/sdk";
import { buildCard } from "../../src/card.js";
import { classifyPosting } from "../../src/classify.js";
import { matchHistory } from "../../src/match.js";

const MIN_POSTING_CHARS = 200;
// Same signal as the banner color, spelled out so it never depends on color alone.
const LABEL_ICON = {
  sponsors: "✓",
  does_not_sponsor: "✕",
  citizenship_or_clearance_required: "!",
  silent: "–",
  unclear: "?",
};
const $ = (id) => document.getElementById(id);
let run = 0;
const cache = new Map(); // tab URL -> card, so switching back to a checked tab costs no API call

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

function renderStats(stats) {
  $("stats").replaceChildren(
    ...stats.map((s) => {
      const tile = document.createElement("div");
      tile.className = s.latest ? "stat stat-latest" : "stat";
      const value = document.createElement("div");
      value.className = "stat-value";
      value.textContent = s.value.toLocaleString("en-US");
      const label = document.createElement("div");
      label.className = "stat-label";
      label.textContent = s.label;
      const hint = document.createElement("div");
      hint.className = "stat-hint";
      hint.textContent = s.hint;
      tile.append(value, label, hint);
      return tile;
    }),
  );
  $("stats").hidden = stats.length === 0;
}

function render(card) {
  $("banner").dataset.label = card.label;
  $("banner-icon").textContent = LABEL_ICON[card.label] || "";
  $("label").textContent = card.labelText;
  $("confidence").textContent = `Confidence ${card.confidence}%`;
  $("quote").textContent = card.quoteText;
  showOptional("nudge", card.nudge);
  showOptional("guard", card.guard);
  fill("flags", card.flags);
  $("role").textContent = `${card.employer || "Employer not named"} · ${card.jobTitle}`;
  $("history-heading").textContent = card.historyHeading;
  renderStats(card.stats);
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

async function check(text, url) {
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
    const card = buildCard(result, history);
    if (url) cache.set(url, card);
    render(card);
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

// Auto-check on tab switch. Off by default: it needs permission to read pages without a toolbar click.
const ORIGINS = ["http://*/*", "https://*/*"];
const JOB_WORDS =
  /\b(responsibilities|qualifications|requirements|job description|about the role|about the job|what you['’]ll do|apply now|apply for this job|equal opportunity|years of experience|benefits)\b/gi;
let autoTimer;
let autoToken = 0;
let inflightUrl = "";

// Same logic as readPage in background.js; this copy runs when no toolbar click happened.
function readPage() {
  const pick = document.querySelector("main, [role=main], article");
  const main = pick ? pick.innerText.trim() : "";
  return main.length >= 400 ? main : document.body.innerText.trim();
}

// Page text goes to the API only when it reads like a job posting, so a tab switch never sends email, banking, etc.
function looksLikeJobPosting(text) {
  const hits = new Set((text.match(JOB_WORDS) || []).map((w) => w.toLowerCase()));
  return hits.size >= 3;
}

function idle(message) {
  run++;
  inflightUrl = "";
  $("card").hidden = true;
  setStatus(message);
}

async function autoCheck(tabId) {
  const { autoCheck: on } = await chrome.storage.local.get("autoCheck");
  if (!on) return;
  const token = ++autoToken;
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  if (token !== autoToken || !tab.active) return;
  if (!/^https?:/.test(tab.url || "")) return idle("Switch to a job posting and it will be checked automatically.");
  if (cache.has(tab.url)) {
    run++;
    render(cache.get(tab.url));
    setStatus("");
    return;
  }
  if (inflightUrl === tab.url) return;
  let text = "";
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: readPage });
    text = (r && r.result) || "";
  } catch {
    return idle("This page cannot be read by the extension.");
  }
  if (token !== autoToken) return;
  if (!looksLikeJobPosting(text)) return idle("This tab does not look like a job posting. Nothing was sent to the API.");
  inflightUrl = tab.url;
  await check(text, tab.url);
  if (inflightUrl === tab.url) inflightUrl = "";
}

function scheduleAuto(tabId) {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => autoCheck(tabId), 700);
}

chrome.tabs.onActivated.addListener(({ tabId }) => scheduleAuto(tabId));
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && (info.status === "complete" || info.url)) scheduleAuto(tabId);
});

async function initAutoToggle() {
  const box = $("auto");
  const { autoCheck: on } = await chrome.storage.local.get("autoCheck");
  const granted = await chrome.permissions.contains({ origins: ORIGINS });
  box.checked = !!on && granted;
  if (on && !granted) await chrome.storage.local.set({ autoCheck: false });
  box.addEventListener("change", async () => {
    if (box.checked) {
      // Must run straight from the click so Chrome shows its permission prompt.
      const ok = await chrome.permissions.request({ origins: ORIGINS });
      box.checked = ok;
      await chrome.storage.local.set({ autoCheck: ok });
      if (ok) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) autoCheck(tab.id);
      } else {
        setStatus("Permission was not granted, so automatic checking stays off.", true);
      }
    } else {
      await chrome.storage.local.set({ autoCheck: false });
      await chrome.permissions.remove({ origins: ORIGINS });
      setStatus("Automatic checking is off. Click the toolbar button to check a posting.");
    }
  });
}
initAutoToggle();
