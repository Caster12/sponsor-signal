// Step 1, Capture. Runs only when the student clicks the toolbar button, and reads only that tab.

function readPage() {
  const pick = document.querySelector("main, [role=main], article");
  const main = pick ? pick.innerText.trim() : "";
  // Fall back to the whole page when the main region is too thin to be the posting.
  return main.length >= 400 ? main : document.body.innerText.trim();
}

chrome.action.onClicked.addListener((tab) => {
  // sidePanel.open must be called directly in the click handler, before any await.
  chrome.sidePanel.open({ tabId: tab.id });
  const capture = { at: Date.now(), url: tab.url || "", pageTitle: tab.title || "", text: "", error: null };
  chrome.scripting
    .executeScript({ target: { tabId: tab.id }, func: readPage })
    .then(([r]) => {
      capture.text = (r && r.result) || "";
    })
    .catch((e) => {
      capture.error = String(e.message || e);
    })
    .finally(() => chrome.storage.session.set({ capture }));
});
