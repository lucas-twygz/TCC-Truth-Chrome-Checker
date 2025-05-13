chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getArticle") {
    const doc = new Readability(document.cloneNode(true)).parse();

    if (!doc || !doc.content) {
      sendResponse({ article: "Não foi possível extrair o conteúdo." });
      return;
    }

    const articleBody = document.createElement("div");
    articleBody.innerHTML = doc.content;

    // Remover elementos indesejados dentro da notícia
    const selectorsToRemove = [
      "figure",
      "video",
      "iframe",
      "script",
      "style",
      "footer",
      ".autor",         // autores
      ".creditos",      // créditos da imagem ou matéria
      ".tags",          // tags como "STF", "Lula", etc.
      ".relacionadas",  // matérias relacionadas
      ".mais-lidas",    // lista de mais lidas
      ".midia-wrapper", // vídeos do G1
      ".vjs-player",    // players de vídeo
      ".banner",        // banners publicitários
      ".companions",    // elementos laterais
    ];

    selectorsToRemove.forEach(selector => {
      articleBody.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Extrair o texto limpo
    const cleanText = articleBody.textContent.trim();

    sendResponse({ article: `${doc.title}\n\n${cleanText}` });
  }
});
