document.addEventListener("DOMContentLoaded", function () {
    const scrapeButton = document.getElementById("scrapeButton");
    if (scrapeButton) {
        scrapeButton.addEventListener("click", scrapePage);
    } else {
        console.error("Botão 'scrapeButton' não encontrado no DOM.");
    }
    resetUIState();
});

function resetUIState() {
    const gaugeBar = document.getElementById('gaugeBar');
    const percentageTextElement = document.getElementById('percentageText');
    const analysisResultTextElement = document.getElementById('analysisResultText');

    if (gaugeBar) {
        gaugeBar.style.width = '0%';
        gaugeBar.style.backgroundColor = '#e0e0e0';
    }
    if (percentageTextElement) {
        percentageTextElement.textContent = '--% Verificando'; 
        percentageTextElement.style.color = '#333';
    }
    if (analysisResultTextElement) {
        analysisResultTextElement.innerHTML = `Bem-vindo ao Truth Chrome Checker!<br>Clique em "Analisar Página Atual" para começar.`;
    }
}

async function scrapePage() {
    const gaugeBar = document.getElementById('gaugeBar');
    const percentageTextElement = document.getElementById('percentageText');
    const analysisResultTextElement = document.getElementById('analysisResultText');

    if (gaugeBar) {
        gaugeBar.style.width = '0%'; 
        gaugeBar.style.backgroundColor = '#e0e0e0'; 
    }
    if (percentageTextElement) {
        percentageTextElement.textContent = 'Analisando...'; 
        percentageTextElement.style.color = '#333'; 
    }
    if (analysisResultTextElement) {
        analysisResultTextElement.textContent = ''; 
    }

    chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
        if (!tabs || !tabs.length || !tabs[0]?.id) {
            if (percentageTextElement) percentageTextElement.textContent = 'Erro';
            if (analysisResultTextElement) analysisResultTextElement.textContent = "Nenhuma aba ativa encontrada ou aba inválida.";
            return;
        }
        
        const pageUrl = tabs[0].url;

        if (pageUrl.startsWith("chrome://") || pageUrl.startsWith("edge://") || pageUrl.startsWith("about:") || pageUrl.startsWith("https://chrome.google.com/webstore")) {
            if (percentageTextElement) percentageTextElement.textContent = 'Indisponível';
            if (analysisResultTextElement) analysisResultTextElement.textContent = "Não é possível analisar esta página especial (ex: páginas internas do navegador, loja de extensões).";
            return;
        }

        try {
            chrome.tabs.sendMessage(tabs[0].id, { action: "getArticle" }, async (msg) => {
                if (chrome.runtime.lastError) {
                    console.error("Erro ao enviar mensagem para o content script:", chrome.runtime.lastError.message);
                    if (percentageTextElement) percentageTextElement.textContent = 'Erro na Página';
                    if (analysisResultTextElement) analysisResultTextElement.textContent = "Não foi possível comunicar com a página. Tente recarregá-la. Algumas páginas podem ter restrições de segurança.";
                    return;
                }

                if (!msg || !msg.article) {
                    if (percentageTextElement) percentageTextElement.textContent = 'Falha';
                    if (analysisResultTextElement) analysisResultTextElement.textContent = "Não foi possível extrair o conteúdo da página. A página pode não ser um artigo ou pode haver restrições.";
                    return;
                }

                try {
                    const res = await fetch("http://localhost:3000/scrape", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url: pageUrl, content: msg.article })
                    });

                    if (!res.ok) {
                        const errorData = await res.json().catch(() => ({ response: `Erro ${res.status}` }));
                        if (percentageTextElement) percentageTextElement.textContent = 'Erro Servidor';
                        if (analysisResultTextElement) analysisResultTextElement.textContent = `Falha na análise: ${errorData.response || res.statusText}`;
                        return;
                    }

                    const data = await res.json();
                    const responseTextFromServer = data.response; 
                
                    if (!responseTextFromServer) {
                        if (percentageTextElement) percentageTextElement.textContent = 'Sem Resposta';
                        if (analysisResultTextElement) analysisResultTextElement.textContent = "O servidor não retornou uma análise.";
                        return;
                    }
                    
                    const match = responseTextFromServer.match(/(\d+)\s*%/);
                    let percentage = null; 
                    if (match && match[1]) {
                        percentage = parseInt(match[1], 10);
                    }

                    if (percentage !== null) {
                        if (gaugeBar) {
                            gaugeBar.style.width = percentage + '%';
                            const hue = (percentage / 100) * 120;
                            gaugeBar.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
                        }
                        if (percentageTextElement) {
                            percentageTextElement.textContent = `Probabilidade de ser verdadeiro: ${percentage}% Verdadeiro`; 
                            const hueText = (percentage / 100) * 120;
                            percentageTextElement.style.color = `hsl(${hueText}, 70%, 35%)`;
                        }
                    } else {
                        if (gaugeBar) {
                            gaugeBar.style.width = '0%';
                            gaugeBar.style.backgroundColor = '#e0e0e0';
                        }
                        if (percentageTextElement) {
                            percentageTextElement.textContent = 'Concluído'; 
                            percentageTextElement.style.color = '#333';
                        }
                    }

                    let cleanedResponseText = responseTextFromServer;
                    if (percentage !== null) {
                        const regexPattern = new RegExp(`^(Chance de ser verdadeiro:|Probabilidade de ser verdadeiro:)\\s*${percentage}%\\s*`, "i");
                        cleanedResponseText = responseTextFromServer.replace(regexPattern, '').trim();
                        
                        if (cleanedResponseText === "" && responseTextFromServer.includes(percentage + '%')) {
                           cleanedResponseText = "Análise focada na porcentagem. Detalhes adicionais não fornecidos ou já removidos.";
                        } else if (cleanedResponseText === "") { 
                           cleanedResponseText = responseTextFromServer; 
                        }
                    }
                    
                    if (analysisResultTextElement) {
                        analysisResultTextElement.textContent = cleanedResponseText;
                    }

                } catch (fetchError) {
                    console.error("Erro ao fazer fetch para o backend ou processar resposta:", fetchError);
                    if (percentageTextElement) percentageTextElement.textContent = 'Erro Backend';
                    if (analysisResultTextElement) analysisResultTextElement.textContent = "Erro ao comunicar com o servidor de análise: " + fetchError.message;
                }
            });
        } catch (error) { 
            console.error("Erro geral em scrapePage:", error);
            if (percentageTextElement) percentageTextElement.textContent = 'Erro';
            if (analysisResultTextElement) analysisResultTextElement.textContent = "Ocorreu um erro inesperado: " + error.message;
        }
    });
}