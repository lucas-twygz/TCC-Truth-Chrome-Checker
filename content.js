chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getArticle") {
      const doc = new Readability(document.cloneNode(true)).parse();
      sendResponse({ article: `${doc.title}\n\n${doc.textContent}` });
    }
  });
  