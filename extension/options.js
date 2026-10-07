const key = document.getElementById("key");
const saved = document.getElementById("saved");

chrome.storage.local.get("apiKey").then(({ apiKey }) => {
  key.value = apiKey || "";
});

document.getElementById("save").addEventListener("click", async () => {
  const value = key.value.trim();
  if (value) await chrome.storage.local.set({ apiKey: value });
  else await chrome.storage.local.remove("apiKey");
  saved.textContent = value ? "Saved." : "Key removed.";
});
