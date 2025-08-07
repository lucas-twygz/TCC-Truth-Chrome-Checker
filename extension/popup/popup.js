document.addEventListener("DOMContentLoaded", function () {
    const scrapeButton = document.getElementById("scrapeButton");
    // ...existing code...


    if (cachePromptCloseButton) cachePromptCloseButton.addEventListener('click', () => {
        hideCachePromptModal();
        resetUIState();
        currentCachedData = null;
    });

    if (useCachedResultButton) {
        useCachedResultButton.addEventListener('click', () => {
            if (currentCachedData && currentCachedData.response) {
                displayAnalysisResults(currentCachedData.response, false);
            } else {
                displayAnalysisResults("Erro ao carregar resultado do cache.", true);
            }
            hideCachePromptModal();
            currentCachedData = null;
        });
    }

    if (reanalyzeButton) {
        reanalyzeButton.addEventListener('click', () => {
            hideCachePromptModal();
            resetUIState(); 
            if (currentAnalysisParams) {
                const percentageTextElement = document.getElementById('percentageText');
                if (percentageTextElement) {
                    percentageTextElement.textContent = 'Analisando...';
                    percentageTextElement.style.color = '#333';
                    percentageTextElement.classList.remove('hidden');
                }
                const analysisResultTextElement = document.getElementById('analysisResultText');
                if (analysisResultTextElement) analysisResultTextElement.textContent = '';
                performAnalysisRequest(true);
            } else {
                displayAnalysisResults("Erro: Não foi possível iniciar a reanálise. Tente novamente.", true);
            }
            currentCachedData = null;
        });
    }
});

function resetUIState() {
    const gaugeBar = document.getElementById('gaugeBar');
    const percentageTextElement = document.getElementById('percentageText');
    const analysisResultTextElement = document.getElementById('analysisResultText');
    const scrapeButton = document.getElementById("scrapeButton");

    if (gaugeBar) {
        gaugeBar.style.width = '0%';
        gaugeBar.style.backgroundColor = '#e0e0e0';
    }
    if (percentageTextElement) {
        percentageTextElement.textContent = '--% Verificando';
        percentageTextElement.style.color = '#333';
        percentageTextElement.classList.add('hidden');
    }
    if (analysisResultTextElement) {
        analysisResultTextElement.innerHTML = `Clique em "Analisar Página Atual" para começar.`;
        analysisResultTextElement.style.marginTop = '10px';
    }
    if (scrapeButton) scrapeButton.disabled = false;
}

async function performAnalysisRequest(forceReanalyze = false) {
    const scrapeButton = document.getElementById("scrapeButton");
    if(scrapeButton) scrapeButton.disabled = true;

    const percentageTextElement = document.getElementById('percentageText');
    const analysisResultTextElement = document.getElementById('analysisResultText');

    if (percentageTextElement) {
        percentageTextElement.textContent = 'Analisando...';
        percentageTextElement.style.color = '#333';
        percentageTextElement.classList.remove('hidden');
    }
    if (analysisResultTextElement) analysisResultTextElement.textContent = '';

    if (!currentAnalysisParams || !currentAnalysisParams.url || !currentAnalysisParams.content) {
        displayAnalysisResults("Erro: Parâmetros de análise ausentes. Tente novamente.", true);
        if(scrapeButton) scrapeButton.disabled = false;
        return;
    }

    try {
        const requestBody = {
            url: currentAnalysisParams.url,
            content: currentAnalysisParams.content
        };
        if (forceReanalyze) {
            requestBody.force_reanalyze = true;
        }

        const res = await fetch("http://localhost.com:3000/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        const responseText = await res.text();
        let data;
        try {
            data = JSON.parse(responseText);
            console.log("Dados recebidos do servidor:", data);
        } catch (e) {
            console.error("Erro ao parsear JSON da resposta do servidor:", e);
            console.error("Texto da resposta do servidor:", responseText);
            displayAnalysisResults("Erro de comunicação com o servidor (resposta inválida).", true);
            return;
        }

        if (!res.ok) {
            let detailedErrorMessage = data.response || data.error || `Falha na análise: ${res.statusText}`;
            displayAnalysisResults(detailedErrorMessage, true);
            return;
        }

        if (data.status === "cached_recent") {
            showCachePromptModal(data.data);
        } else if (data.status === "analyzed" && typeof data.response === 'string') {
            displayAnalysisResults(data.response, false);
        } else if (data.status === "error" && typeof data.response === 'string') {
            displayAnalysisResults(data.response, true);
        } else {
            console.warn("Estrutura de resposta inesperada do servidor:", data);
            displayAnalysisResults("O servidor retornou uma resposta inesperada ou vazia.", true);
        }

    } catch (fetchError) {
        console.error("Erro de fetch para o backend ou processamento:", fetchError);
        displayAnalysisResults("Erro ao comunicar com o servidor: " + fetchError.message, true);
    } finally {
        const cacheModal = document.getElementById('cachePromptModal');
        const scrapeButtonEl = document.getElementById("scrapeButton");
        if (scrapeButtonEl && (!cacheModal || cacheModal.classList.contains('hidden'))) {
            scrapeButtonEl.disabled = false;
        }
    }
}

function displayAnalysisResults(responseTextFromServer, isError = false) {
    const gaugeBar = document.getElementById('gaugeBar');
    const percentageTextElement = document.getElementById('percentageText');
    const analysisResultTextElement = document.getElementById('analysisResultText');
    const scrapeButton = document.getElementById("scrapeButton");

    if (isError) {
        if (gaugeBar) {
            gaugeBar.style.width = '0%';
            gaugeBar.style.backgroundColor = '#e0e0e0';
        }
        if (percentageTextElement) {
            percentageTextElement.textContent = 'Erro na Análise';
            percentageTextElement.style.color = '#c0392b';
            percentageTextElement.classList.remove('hidden');
        }
        if (analysisResultTextElement) {
            analysisResultTextElement.textContent = responseTextFromServer;
        }
        if(scrapeButton) scrapeButton.disabled = false;
        return;
    }

    if (!responseTextFromServer && responseTextFromServer !== 0) {
        if (percentageTextElement) {
             percentageTextElement.textContent = 'Sem Resposta';
             percentageTextElement.style.color = '#333';
             percentageTextElement.classList.remove('hidden');
        }
        if (analysisResultTextElement) {
            analysisResultTextElement.textContent = "O servidor não retornou uma análise válida ou a análise está vazia.";
        }
        if (gaugeBar) {
            gaugeBar.style.width = '0%';
            gaugeBar.style.backgroundColor = '#e0e0e0';
        }
        if(scrapeButton) scrapeButton.disabled = false;
        return;
    }

    const match = String(responseTextFromServer).match(/(\d+)\s*%/);
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
            percentageTextElement.textContent = `Probabilidade de ser verdadeiro: ${percentage}%`;
            const hueText = (percentage / 100) * 120;
            percentageTextElement.style.color = `hsl(${hueText}, 70%, 35%)`;
            percentageTextElement.classList.remove('hidden');
        }
    } else {
        if (gaugeBar) {
            gaugeBar.style.width = '0%';
            gaugeBar.style.backgroundColor = '#e0e0e0';
        }
        if (percentageTextElement) {
            percentageTextElement.textContent = 'Análise Concluída';
            percentageTextElement.style.color = '#333';
            percentageTextElement.classList.remove('hidden');
        }
    }

    let cleanedResponseText = String(responseTextFromServer);
    if (percentage !== null) {
        const lines = cleanedResponseText.split('\n');
        if (lines.length > 0 && /\d+\s*%/.test(lines[0])) {
            cleanedResponseText = lines.slice(1).join('\n').trim();
            if (cleanedResponseText === "") {
                cleanedResponseText = "A análise detalhada está contida na porcentagem acima ou não foram fornecidos detalhes adicionais.";
            }
        } else {
            const genericPercentagePattern = new RegExp(`^(Nova chance de ser verdadeiro:|Chance de ser verdadeiro:|Probabilidade de ser verdadeiro:)\\s*${percentage}%\\s*(Verdadeiro)?\\s*`, "im");
            let tempCleaned = cleanedResponseText.replace(genericPercentagePattern, '').trim();
            if (tempCleaned !== cleanedResponseText && tempCleaned !== "") {
                cleanedResponseText = tempCleaned;
            } else if (tempCleaned === "" && cleanedResponseText.includes(percentage + '%')) {
                 cleanedResponseText = "Detalhes da análise focados na porcentagem.";
            }
        }
    }
    if (cleanedResponseText.startsWith(". ")) {
        cleanedResponseText = cleanedResponseText.substring(2);
    } else if (cleanedResponseText.startsWith(".")) {
        cleanedResponseText = cleanedResponseText.substring(1);
    }

    if (analysisResultTextElement) {
        analysisResultTextElement.textContent = cleanedResponseText.trim();
    }
}