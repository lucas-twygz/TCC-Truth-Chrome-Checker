document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("scrapeButton").addEventListener("click", scrapePage);
});

async function scrapePage() {
    const responseElement = document.getElementById("result");
    responseElement.textContent = "Carregando...";

    chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
        if (!tabs.length) {
            responseElement.textContent = "Nenhuma aba ativa encontrada.";
            return;
        }
        
        const pageUrl = tabs[0].url;
        try {
            const res = await fetch("http://localhost:3000/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: pageUrl })
            });
            
            const data = await res.json();
            responseElement.textContent = data.response || "Erro ao obter resposta.";
        } catch (error) {
            console.error("Erro:", error);
            responseElement.textContent = "Erro ao conectar com o servidor.";
        }
    });
}
