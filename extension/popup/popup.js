const GEMINI_API_KEY_STORAGE = 'truthCheckerGeminiApiKey';
const CUSTOM_SEARCH_API_KEY_STORAGE = 'truthCheckerCustomSearchApiKey';
const SEARCH_ENGINE_ID_STORAGE = 'truthCheckerSearchEngineId';

let currentCachedData = null;
let currentAnalysisParams = null;

function showCachePromptModal(cachedDataFromServer) {
    const cachePromptModal = document.getElementById('cachePromptModal');
    const mainPageContainer = document.querySelector('.container.main-page');
    const cachePromptDetailsElement = document.getElementById('cachePromptDetails');

    currentCachedData = cachedDataFromServer;
    if (cachePromptDetailsElement) {
        const date = new Date(cachedDataFromServer.timestamp).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
        let previewText = cachedDataFromServer.response || "Resultado anterior não disponível para visualização.";
        if (previewText.length > 100) previewText = previewText.substring(0, 100) + "...";
        cachePromptDetailsElement.textContent = `Analisado em ${date}. Resultado: "${previewText}". Deseja usar este resultado ou analisar novamente?`;
    }
    if (cachePromptModal) cachePromptModal.classList.remove('hidden');
    if (mainPageContainer) mainPageContainer.classList.add('hidden');
}

function hideCachePromptModal() {
    const cachePromptModal = document.getElementById('cachePromptModal');
    const mainPageContainer = document.querySelector('.container.main-page');
    if (cachePromptModal) cachePromptModal.classList.add('hidden');
    if (mainPageContainer) mainPageContainer.classList.remove('hidden');
}

document.addEventListener("DOMContentLoaded", function () {
    const mainPageContainer = document.querySelector('.container.main-page');
    const configSection = document.getElementById('configSection');

    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const customSearchApiKeyInput = document.getElementById('customSearchApiKey');
    const programmableSearchEngineIdInput = document.getElementById('programmableSearchEngineId');

    const getGeminiKeyButton = document.getElementById('getGeminiKey');
    const getCustomSearchKeyButton = document.getElementById('getCustomSearchKey');
    const getSearchEngineIdButton = document.getElementById('getSearchEngineId');
    const saveApiKeysButton = document.getElementById('saveApiKeysButton');
    const configStatusElement = document.getElementById('configStatus');

    const scrapeButton = document.getElementById("scrapeButton");
    const settingsIcon = document.getElementById('settingsIcon');
    const backButton = document.getElementById('backButton');

    const tutorialModal = document.getElementById('tutorialModal');
    const tutorialTitleElement = document.getElementById('tutorialTitle');
    const tutorialBodyElement = document.getElementById('tutorialBody');
    const modalCloseButton = document.getElementById('modalCloseButton');

    const geminiTutorialIcon = document.getElementById('geminiTutorialIcon');
    const customSearchTutorialIcon = document.getElementById('customSearchTutorialIcon');
    const cxIdTutorialIcon = document.getElementById('cxIdTutorialIcon');

    const useCachedResultButton = document.getElementById('useCachedResultButton');
    const reanalyzeButton = document.getElementById('reanalyzeButton');
    const cachePromptCloseButton = document.getElementById('cachePromptCloseButton');

    function showConfigScreen(message = '') {
        if (mainPageContainer) mainPageContainer.classList.add('hidden');
        if (settingsIcon) settingsIcon.classList.add('hidden');
        if (configSection) configSection.classList.remove('hidden');
        hideCachePromptModal();

        if (configStatusElement) {
            configStatusElement.textContent = message;
            configStatusElement.className = 'status-message';
            if (message.toLowerCase().includes('erro') || message.toLowerCase().includes('inválid')) {
                configStatusElement.classList.add('error');
            } else if (message && (message.toLowerCase().includes('sucesso') || message.toLowerCase().includes('salvas'))) {
                configStatusElement.classList.add('success');
            } else if (message) {
                configStatusElement.classList.remove('error', 'success');
            }
        }

        chrome.storage.local.get([GEMINI_API_KEY_STORAGE, CUSTOM_SEARCH_API_KEY_STORAGE, SEARCH_ENGINE_ID_STORAGE], function(keys) {
            if (geminiApiKeyInput) geminiApiKeyInput.value = keys[GEMINI_API_KEY_STORAGE] || '';
            if (customSearchApiKeyInput) customSearchApiKeyInput.value = keys[CUSTOM_SEARCH_API_KEY_STORAGE] || '';
            if (programmableSearchEngineIdInput) programmableSearchEngineIdInput.value = keys[SEARCH_ENGINE_ID_STORAGE] || '';
        });
    }

    function showMainScreen() {
        if (mainPageContainer) mainPageContainer.classList.remove('hidden');
        if (settingsIcon) settingsIcon.classList.remove('hidden');
        if (configSection) configSection.classList.add('hidden');
        hideCachePromptModal();
        resetUIState();
    }

    chrome.storage.local.get([GEMINI_API_KEY_STORAGE, CUSTOM_SEARCH_API_KEY_STORAGE, SEARCH_ENGINE_ID_STORAGE], function(result) {
        if (result[GEMINI_API_KEY_STORAGE] && result[CUSTOM_SEARCH_API_KEY_STORAGE] && result[SEARCH_ENGINE_ID_STORAGE]) {
            showMainScreen();
        } else {
            showConfigScreen('Por favor, configure suas chaves de API para usar a extensão.');
        }
    });

    if (getGeminiKeyButton) getGeminiKeyButton.addEventListener('click', () => chrome.tabs.create({ url: 'https://aistudio.google.com/app/apikey?hl=pt-br' }));
    if (getCustomSearchKeyButton) getCustomSearchKeyButton.addEventListener('click', () => chrome.tabs.create({ url: 'https://developers.google.com/custom-search/v1/overview?hl=pt-br#api_key' }));
    if (getSearchEngineIdButton) getSearchEngineIdButton.addEventListener('click', () => chrome.tabs.create({ url: 'https://programmablesearchengine.google.com/controlpanel/all?hl=pt-br' }));

    if (saveApiKeysButton) {
        saveApiKeysButton.addEventListener('click', () => {
            const geminiKey = geminiApiKeyInput.value.trim();
            const customSearchKey = customSearchApiKeyInput.value.trim();
            const searchEngineIdVal = programmableSearchEngineIdInput.value.trim();

            if (!geminiKey || !customSearchKey || !searchEngineIdVal) {
                if (configStatusElement) {
                    configStatusElement.textContent = 'Erro: Todos os campos são obrigatórios.';
                    configStatusElement.className = 'status-message error';
                }
                return;
            }

            chrome.storage.local.set({
                [GEMINI_API_KEY_STORAGE]: geminiKey,
                [CUSTOM_SEARCH_API_KEY_STORAGE]: customSearchKey,
                [SEARCH_ENGINE_ID_STORAGE]: searchEngineIdVal
            }, function() {
                if (chrome.runtime.lastError) {
                    if (configStatusElement) {
                        configStatusElement.textContent = 'Erro ao salvar: ' + chrome.runtime.lastError.message;
                        configStatusElement.className = 'status-message error';
                    }
                } else {
                    if (configStatusElement) {
                        configStatusElement.textContent = 'Chaves salvas com sucesso!';
                        configStatusElement.className = 'status-message success';
                    }
                    setTimeout(() => showMainScreen(), 1500);
                }
            });
        });
    }

    if (scrapeButton) scrapeButton.addEventListener("click", () => {
        chrome.storage.local.get([GEMINI_API_KEY_STORAGE, CUSTOM_SEARCH_API_KEY_STORAGE, SEARCH_ENGINE_ID_STORAGE], async function(keys) {
            if (!keys[GEMINI_API_KEY_STORAGE] || !keys[CUSTOM_SEARCH_API_KEY_STORAGE] || !keys[SEARCH_ENGINE_ID_STORAGE]) {
                showConfigScreen("Chaves de API não configuradas. Clique no ícone (⚙️) para configurar.");
                return;
            }
            currentAnalysisParams = {
                apiKeyGemini: keys[GEMINI_API_KEY_STORAGE],
                apiKeyCustomSearch: keys[CUSTOM_SEARCH_API_KEY_STORAGE],
                searchEngineId: keys[SEARCH_ENGINE_ID_STORAGE]
            };

            chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
                if (!tabs || !tabs.length || !tabs[0]?.id) {
                    displayAnalysisResults("Nenhuma aba ativa encontrada ou aba inválida.", true);
                    return;
                }
                currentAnalysisParams.url = tabs[0].url;

                if (currentAnalysisParams.url.startsWith("chrome://") || currentAnalysisParams.url.startsWith("edge://") || currentAnalysisParams.url.startsWith("about:") || currentAnalysisParams.url.startsWith("https://chrome.google.com/webstore")) {
                    displayAnalysisResults("Não é possível analisar este tipo de página especial.", true);
                    return;
                }

                try {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "getArticle" }, async (msg) => {
                        if (chrome.runtime.lastError) {
                            console.error("Erro ao enviar mensagem para o content script:", chrome.runtime.lastError.message);
                            displayAnalysisResults("Não foi possível comunicar com a página. Tente recarregá-la.", true);
                            return;
                        }
                        if (!msg || !msg.article) {
                            displayAnalysisResults("Não foi possível extrair o conteúdo da página.", true);
                            return;
                        }
                        currentAnalysisParams.content = msg.article;
                        performAnalysisRequest(false);
                    });
                } catch (error) {
                    console.error("Erro geral em scrapePage ao obter conteúdo:", error);
                    displayAnalysisResults("Ocorreu um erro inesperado ao obter conteúdo: " + error.message, true);
                }
            });
        });
    });

    if (settingsIcon) settingsIcon.addEventListener('click', () => showConfigScreen('Altere ou confirme suas chaves de API.') );
    if (backButton) backButton.addEventListener('click', () => showMainScreen() );

    function openTutorialModal(title, contentHTML) {
        if (tutorialTitleElement) tutorialTitleElement.textContent = title;
        if (tutorialBodyElement) tutorialBodyElement.innerHTML = contentHTML;
        if (tutorialModal) tutorialModal.classList.remove('hidden');
    }
    function _closeTutorialModal() {
        if (tutorialModal) tutorialModal.classList.add('hidden');
    }
    if (modalCloseButton) modalCloseButton.addEventListener('click', _closeTutorialModal);
    if (tutorialModal) tutorialModal.addEventListener('click', (event) => { if (event.target === tutorialModal) _closeTutorialModal(); });
    
    const tutorials = {};
        tutorials.gemini = {
            title: "Como Obter a Chave API Gemini",
            content: `
                <p>Siga estes passos para obter sua Chave API do Gemini:</p>
                <ol>
                    <li>Acesse o <a href="https://aistudio.google.com/app/apikey?hl=pt-br" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.</li>
                    <li>Faça login com sua conta Google, se solicitado.</li>
                    <li>Clique em "<strong>+ Criar chave de API</strong>".</li>
                </ol>
                <p><img src="../assets/gemini_create_key.gif" alt="Criando a chave API Gemini no AI Studio"></p>
                <ol start="4">
                    <li>Copie a chave API gerada.</li>
                    <li>Cole a chave no campo "Chave API Gemini" na extensão.</li>
                </ol>
            `
        };
        tutorials.customSearch = {
            title: "Como Obter a Chave API Custom Search",
            content: `
                <p>Para obter sua Chave API do Custom Search (Pesquisa Personalizada do Google):</p>
                <ol>
                    <li>Acesse o <a href="https://developers.google.com/custom-search/v1/overview?hl=pt-br#api_key" target="_blank" rel="noopener noreferrer">Google Developers (Custom Search API)</a>.</li>
                    <li>Clique em "<strong>Acessar uma chave</strong>" (ou "Get a Key").</li>
                    <li>Selecione ou crie um projeto no Google Cloud Platform.</li>
                    <li>Ative a "Custom Search API" para o projeto selecionado, se ainda não estiver ativa.</li>
                    <li>No painel de "Credenciais" do seu projeto, crie uma nova chave de API ou use uma existente que esteja habilitada para a Custom Search API.</li>
                    <li>Copie a chave.</li>
                    <li>Cole a chave no campo "Chave API Custom Search" na extensão.</li>
                </ol>
                <p><img src="../assets/custom_search_get_key.gif" alt="Obtendo a chave API Custom Search"></p>
                <p><em>Lembre-se de restringir sua chave de API no Google Cloud Console para maior segurança.</em></p>
            `
        };
        tutorials.cxId = {
            title: "Como Obter o ID do Mecanismo de Pesquisa (CX ID)",
            content: `
                <p>Para criar um Mecanismo de Pesquisa Programável e obter seu ID (CX ID):</p>
                <ol>
                    <li>Acesse o <a href="https://programmablesearchengine.google.com/controlpanel/all?hl=pt-br" target="_blank" rel="noopener noreferrer">Painel de Controle do Mecanismo de Pesquisa Programável</a>.</li>
                    <li>Clique em "<strong>Adicionar</strong>".</li>
                    <li>Em "Nome", você pode colocar algo como "TCC_Checker_Search".</li>
                    <li>Em "O que pesquisar?", selecione "<strong>Pesquisar em toda a web</strong>".</li>
                    <li>Ative a opção "Pesquisa de imagens" se desejar (opcional).</li>
                    <li>Ative a opção "SafeSearch" se desejar (recomendado).</li>
                    <li>Clique em "<strong>Criar</strong>".</li>
                    <li>Após a criação, você será levado ao painel do seu mecanismo.</li>
                    <li>Na seção "<strong>Informações básicas</strong>" da aba "Visão Geral", você encontrará o "<strong>ID do mecanismo de pesquisa</strong>". Copie este ID.</li>
                </ol>
                <p><img src="../assets/programmable_search_cx_id.gif" alt="Obtendo o ID do Mecanismo de Pesquisa"></p>
                <ol start="9">
                    <li>Cole o ID no campo "ID do Mecanismo de Pesquisa" na extensão.</li>
                </ol>
            `
        };

    if (geminiTutorialIcon) geminiTutorialIcon.addEventListener('click', (event) => { event.stopPropagation(); openTutorialModal(tutorials.gemini.title, tutorials.gemini.content); });
    if (customSearchTutorialIcon) customSearchTutorialIcon.addEventListener('click', (event) => { event.stopPropagation(); openTutorialModal(tutorials.customSearch.title, tutorials.customSearch.content); });
    if (cxIdTutorialIcon) cxIdTutorialIcon.addEventListener('click', (event) => { event.stopPropagation(); openTutorialModal(tutorials.cxId.title, tutorials.cxId.content); });

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

    if (!currentAnalysisParams || !currentAnalysisParams.url || !currentAnalysisParams.content ||
        !currentAnalysisParams.apiKeyGemini || !currentAnalysisParams.apiKeyCustomSearch || !currentAnalysisParams.searchEngineId) {
        displayAnalysisResults("Erro: Parâmetros de análise ausentes. Tente novamente.", true);
        if(scrapeButton) scrapeButton.disabled = false;
        return;
    }

    try {
        const requestBody = {
            url: currentAnalysisParams.url,
            content: currentAnalysisParams.content,
            apiKeyGemini: currentAnalysisParams.apiKeyGemini,
            apiKeyCustomSearch: currentAnalysisParams.apiKeyCustomSearch,
            searchEngineId: currentAnalysisParams.searchEngineId
        };
        if (forceReanalyze) {
            requestBody.force_reanalyze = true;
        }

        const res = await fetch("http://localhost:3000/scrape", {
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
            if ((res.status === 400 || res.status === 401 || res.status === 403) && (detailedErrorMessage.toLowerCase().includes("api key") || detailedErrorMessage.toLowerCase().includes("chave de api") || detailedErrorMessage.toLowerCase().includes("inválid"))) {
                detailedErrorMessage = "Problema com as chaves de API. Verifique a configuração (⚙️).";
                document.querySelector('.container.main-page').classList.add('hidden');
                const configSectionEl = document.getElementById('configSection');
                if(configSectionEl) configSectionEl.classList.remove('hidden');
                const configStatusEl = document.getElementById('configStatus');
                if(configStatusEl) {
                    configStatusEl.textContent = detailedErrorMessage;
                    configStatusEl.className = 'status-message error';
                }
            }
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
            const genericPercentagePattern = new RegExp(`^(Nova chance de ser verdadeiro:|Chance de ser verdadeiro:|Probabilidade de ser verdadeiro:)\\s*${percentage}%\\s*(Verdadeiro)?\\s*, "im"`);
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