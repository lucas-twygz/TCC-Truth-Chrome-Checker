chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getArticle") {
    const doc = new Readability(document.cloneNode(true)).parse();

    if (!doc || !doc.content) {
      sendResponse({ article: "Não foi possível extrair o conteúdo." });
      return;
    }

    const articleBody = document.createElement("div");
    articleBody.innerHTML = doc.content;

    // 🔍 Filtros mais agressivos para remover seções fora da notícia principal
    const selectorsToRemove = [
      "figure",
      "video",
      "iframe",
      "script",
      "style",
      "footer",
      "nav",
      "header",
      "aside",
      "form",
      ".autor", ".creditos", ".tags", ".relacionadas",
      ".mais-lidas", ".midia-wrapper", ".vjs-player",
      ".banner", ".companions", ".share", ".sidebar",
      ".navegacao", ".breadcrumb", ".menu", ".header",
      ".footer", ".social", ".recommendations", ".leia",
      ".publicidade", ".ads", ".anuncio", ".widget",
      ".news-tabs", ".ultimas", ".ultimos", ".recomendado",
      ".barra-superior", ".barra-inferior", ".content-tools"
    ];

    selectorsToRemove.forEach(selector => {
      articleBody.querySelectorAll(selector).forEach(el => el.remove());
    });

    // 🧽 Remove elementos repetidos (por exemplo: "Leia também" em parágrafos)
    articleBody.querySelectorAll("p").forEach(p => {
      if (p.textContent.trim().length < 30) p.remove();
    });

    // 🧹 Texto final limpo
    const cleanText = articleBody.textContent
      .replace(/\\s+/g, " ")
      .replace(/\\n{2,}/g, "\\n")
      .trim();

    sendResponse({ article: `${doc.title}\n\n${cleanText}` });
  }
});
