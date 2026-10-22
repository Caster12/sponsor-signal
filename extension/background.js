// Step 1, Capture. Runs only when the student clicks the toolbar button, and reads only that tab.

function readPage() {
  // Application forms hold questions to the candidate ("Will you require sponsorship?"), not the
  // employer's posting, so their text is left out. A form that wraps the whole page is kept.
  const withoutForms = (root) => {
    let text = root.innerText;
    for (const form of root.querySelectorAll("form, [role=form]")) {
      if (form.contains(root) || form.querySelector("h1")) continue;
      const part = form.innerText.trim();
      if (part) text = text.replace(part, "");
    }
    return text.trim();
  };
  const pick = document.querySelector("main, [role=main], article");
  const main = pick ? withoutForms(pick) : "";
  // Fall back to the whole page when the main region is too thin to be the posting.
  return main.length >= 400 ? main : withoutForms(document.body);
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
