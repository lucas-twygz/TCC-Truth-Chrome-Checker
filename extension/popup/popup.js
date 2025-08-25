const GEMINI_API_KEY_STORAGE = 'truthCheckerGeminiApiKey';
const CUSTOM_SEARCH_API_KEY_STORAGE = 'truthCheckerCustomSearchApiKey';
const SEARCH_ENGINE_ID_STORAGE = 'truthCheckerSearchEngineId';
const DRAFT_GEMINI_API_KEY = 'draft_geminiApiKey';
const DRAFT_CUSTOM_SEARCH_API_KEY = 'draft_customSearchApiKey';
const DRAFT_SEARCH_ENGINE_ID = 'draft_searchEngineId';
const DEBUG_MODE_KEY = 'debugModeEnabled';
const HISTORY_KEY = 'analysisHistory';
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

let currentAnalysisParams = null;
let currentCachedData = null;

function showCachePromptModal(cachedHistoryEntry) {
    const cachePromptModal = document.getElementById('cachePromptModal');
    const cachePromptDetailsElement = document.getElementById('cachePromptDetails');

    currentCachedData = cachedHistoryEntry;
    if (cachePromptDetailsElement) {
        const date = new Date(cachedHistoryEntry.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        let previewText = cachedHistoryEntry.resultText || "Resultado anterior indisponível.";
        if (previewText.length > 100) previewText = previewText.substring(0, 100) + "...";
        cachePromptDetailsElement.textContent = `Analisado em ${date}. Resultado: "${previewText}". Deseja usar este resultado ou analisar novamente?`;
    }
    if (cachePromptModal) cachePromptModal.classList.remove('hidden');
}

function hideCachePromptModal() {
    const cachePromptModal = document.getElementById('cachePromptModal');
    if (cachePromptModal) cachePromptModal.classList.add('hidden');
}

document.addEventListener("DOMContentLoaded", function () {
    // Seletores de Elementos
    const mainContainer = document.querySelector('.main-container');
    const configSection = document.getElementById('configSection');
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const customSearchApiKeyInput = document.getElementById('customSearchApiKey');
    const programmableSearchEngineIdInput = document.getElementById('programmableSearchEngineId');
    const debugModeToggle = document.getElementById('debugModeToggle');
    const saveApiKeysButton = document.getElementById('saveApiKeysButton');
    const configStatusElement = document.getElementById('configStatus');
    const scrapeButton = document.getElementById("scrapeButton");
    const settingsIcon = document.getElementById('settingsIcon');
    const backButton = document.getElementById('backButton');
    const analysisTabButton = document.getElementById('analysisTabButton');
    const historyTabButton = document.getElementById('historyTabButton');
    const analysisSection = document.getElementById('analysisSection');
    const historySection = document.getElementById('historySection');
    const useCachedResultButton = document.getElementById('useCachedResultButton');
    const reanalyzeButton = document.getElementById('reanalyzeButton');
    const cachePromptCloseButton = document.getElementById('cachePromptCloseButton');
    const getGeminiKeyButton = document.getElementById('getGeminiKey');
    const getCustomSearchKeyButton = document.getElementById('getCustomSearchKey');
    const getSearchEngineIdButton = document.getElementById('getSearchEngineId');
    const tutorialModal = document.getElementById('tutorialModal');
    const tutorialTitleElement = document.getElementById('tutorialTitle');
    const tutorialBodyElement = document.getElementById('tutorialBody');
    const modalCloseButton = document.getElementById('modalCloseButton');
    const geminiTutorialIcon = document.getElementById('geminiTutorialIcon');
    const customSearchTutorialIcon = document.getElementById('customSearchTutorialIcon');
    const cxIdTutorialIcon = document.getElementById('cxIdTutorialIcon');

    // Funções de UI
    function showScreen(screenToShow) {
        hideCachePromptModal();
        if (screenToShow === 'config') {
            mainContainer.classList.add('hidden');
            settingsIcon.classList.add('hidden');
            configSection.classList.remove('hidden');
        } else {
            mainContainer.classList.remove('hidden');
            settingsIcon.classList.remove('hidden');
            configSection.classList.add('hidden');
            resetUIState();
        }
    }

    function loadConfigScreenData(message = '') {
        if (configStatusElement) {
            configStatusElement.textContent = message;
            configStatusElement.className = 'status-message';
            if (message.toLowerCase().includes('erro') || message.toLowerCase().includes('inválid')) {
                configStatusElement.classList.add('error');
            } else if (message && (message.toLowerCase().includes('sucesso') || message.toLowerCase().includes('salvas'))) {
                configStatusElement.classList.add('success');
            }
        }

        chrome.storage.session.get([DRAFT_GEMINI_API_KEY, DRAFT_CUSTOM_SEARCH_API_KEY, DRAFT_SEARCH_ENGINE_ID], (drafts) => {
            chrome.storage.local.get([GEMINI_API_KEY_STORAGE, CUSTOM_SEARCH_API_KEY_STORAGE, SEARCH_ENGINE_ID_STORAGE, DEBUG_MODE_KEY], (saved) => {
                geminiApiKeyInput.value = drafts[DRAFT_GEMINI_API_KEY] ?? saved[GEMINI_API_KEY_STORAGE] ?? '';
                customSearchApiKeyInput.value = drafts[DRAFT_CUSTOM_SEARCH_API_KEY] ?? saved[CUSTOM_SEARCH_API_KEY_STORAGE] ?? '';
                programmableSearchEngineIdInput.value = drafts[DRAFT_SEARCH_ENGINE_ID] ?? saved[SEARCH_ENGINE_ID_STORAGE] ?? '';
                debugModeToggle.checked = !!saved[DEBUG_MODE_KEY];
            });
        });
    }

    // Lógica Inicial
    chrome.storage.local.get([GEMINI_API_KEY_STORAGE, CUSTOM_SEARCH_API_KEY_STORAGE, SEARCH_ENGINE_ID_STORAGE], function(result) {
        if (!result[GEMINI_API_KEY_STORAGE] || !result[CUSTOM_SEARCH_API_KEY_STORAGE] || !result[SEARCH_ENGINE_ID_STORAGE]) {
            showScreen('config');
            loadConfigScreenData('Por favor, configure suas chaves de API para usar a extensão.');
        } else {
            showScreen('main');
        }
    });

    // Event Listeners para Rascunhos de Chaves
    geminiApiKeyInput.addEventListener('input', () => {
        chrome.storage.session.set({ [DRAFT_GEMINI_API_KEY]: geminiApiKeyInput.value });
    });
    customSearchApiKeyInput.addEventListener('input', () => {
        chrome.storage.session.set({ [DRAFT_CUSTOM_SEARCH_API_KEY]: customSearchApiKeyInput.value });
    });
    programmableSearchEngineIdInput.addEventListener('input', () => {
        chrome.storage.session.set({ [DRAFT_SEARCH_ENGINE_ID]: programmableSearchEngineIdInput.value });
    });

    // Event Listeners Gerais
    if (settingsIcon) settingsIcon.addEventListener('click', () => {
        showScreen('config');
        loadConfigScreenData('Altere ou confirme suas chaves de API.');
    });
    if (backButton) backButton.addEventListener('click', () => showScreen('main'));

    if (saveApiKeysButton) {
        saveApiKeysButton.addEventListener('click', () => {
            const keysToSave = {
                [GEMINI_API_KEY_STORAGE]: geminiApiKeyInput.value.trim(),
                [CUSTOM_SEARCH_API_KEY_STORAGE]: customSearchApiKeyInput.value.trim(),
                [SEARCH_ENGINE_ID_STORAGE]: programmableSearchEngineIdInput.value.trim(),
                [DEBUG_MODE_KEY]: debugModeToggle.checked
            };

            if (!keysToSave[GEMINI_API_KEY_STORAGE] || !keysToSave[CUSTOM_SEARCH_API_KEY_STORAGE] || !keysToSave[SEARCH_ENGINE_ID_STORAGE]) {
                loadConfigScreenData('Erro: Todos os campos de chaves e ID são obrigatórios.');
                return;
            }

            chrome.storage.local.set(keysToSave, function() {
                if (chrome.runtime.lastError) {
                    loadConfigScreenData('Erro ao salvar: ' + chrome.runtime.lastError.message);
                } else {
                    chrome.storage.session.remove([
                        DRAFT_GEMINI_API_KEY, DRAFT_CUSTOM_SEARCH_API_KEY, DRAFT_SEARCH_ENGINE_ID
                    ], () => {
                        loadConfigScreenData('Chaves salvas com sucesso!');
                        setTimeout(() => showScreen('main'), 1500);
                    });
                }
            });
        });
    }
    
    analysisTabButton.addEventListener('click', () => switchTab('analysis'));
    historyTabButton.addEventListener('click', () => switchTab('history'));
    
    function switchTab(tabName) {
        if (tabName === 'history') {
            analysisTabButton.classList.remove('active');
            historyTabButton.classList.add('active');
            analysisSection.classList.add('hidden');
            historySection.classList.remove('hidden');
            renderHistory();
        } else {
            historyTabButton.classList.remove('active');
            analysisTabButton.classList.add('active');
            historySection.classList.add('hidden');
            analysisSection.classList.remove('hidden');
        }
    }

    if (scrapeButton) {
        scrapeButton.addEventListener("click", async () => {
            const keys = await chrome.storage.local.get([GEMINI_API_KEY_STORAGE, CUSTOM_SEARCH_API_KEY_STORAGE, SEARCH_ENGINE_ID_STORAGE]);
            if (!keys[GEMINI_API_KEY_STORAGE] || !keys[CUSTOM_SEARCH_API_KEY_STORAGE] || !keys[SEARCH_ENGINE_ID_STORAGE]) {
                showScreen('config');
                loadConfigScreenData("Erro: Chaves de API não configuradas.");
                return;
            }
            
            currentAnalysisParams = {
                apiKeyGemini: keys[GEMINI_API_KEY_STORAGE],
                apiKeyCustomSearch: keys[CUSTOM_SEARCH_API_KEY_STORAGE],
                searchEngineId: keys[SEARCH_ENGINE_ID_STORAGE]
            };
    
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) {
                displayAnalysisResults("Nenhuma aba ativa encontrada.", true);
                return;
            }
            
            const url = new URL(tab.url);
            if (["chrome:", "edge:", "about:", "https://chrome.google.com"].some(p => url.protocol.startsWith(p.replace(/:$/, '')))) {
                 displayAnalysisResults("Não é possível analisar este tipo de página especial.", true);
                 return;
            }
            currentAnalysisParams.url = url.href;

            const recentEntry = await findInHistory(currentAnalysisParams.url);
            if (recentEntry) {
                showCachePromptModal(recentEntry);
                return;
            }

            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: "getArticle" });
                if (!response || !response.article) {
                    displayAnalysisResults("Não foi possível extrair o conteúdo da página.", true);
                    return;
                }
                currentAnalysisParams.content = response.article;
                performAnalysisRequest();
            } catch (error) {
                displayAnalysisResults("Falha ao comunicar com a página. Recarregue-a e tente novamente.", true);
            }
        });
    }

    if (cachePromptCloseButton) cachePromptCloseButton.addEventListener('click', () => {
        hideCachePromptModal();
        resetUIState();
    });

    if (useCachedResultButton) {
        useCachedResultButton.addEventListener('click', () => {
            if (currentCachedData && currentCachedData.resultText) {
                displayAnalysisResults(currentCachedData.resultText, false);
            } else {
                displayAnalysisResults("Erro ao carregar resultado do cache.", true);
            }
            hideCachePromptModal();
        });
    }
    
    if (reanalyzeButton) {
        reanalyzeButton.addEventListener('click', async () => {
            hideCachePromptModal();
            if (!currentAnalysisParams) {
                displayAnalysisResults("Erro: Parâmetros de análise não encontrados.", true);
                return;
            }
            
            // CORREÇÃO: Busca o conteúdo da página ANTES de chamar a análise.
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const response = await chrome.tabs.sendMessage(tab.id, { action: "getArticle" });
                if (!response || !response.article) {
                    displayAnalysisResults("Não foi possível extrair o conteúdo para reanálise.", true);
                    return;
                }
                currentAnalysisParams.content = response.article;
                performAnalysisRequest();
            } catch (error) {
                displayAnalysisResults("Falha ao obter conteúdo para reanálise. Recarregue a página.", true);
            }
        });
    }

    const historySearchInput = document.getElementById('historySearchInput');
    historySearchInput.addEventListener('input', () => renderHistory(historySearchInput.value));

    document.getElementById('exportHistoryButton').addEventListener('click', exportHistory);
    document.getElementById('importHistoryButton').addEventListener('click', () => document.getElementById('importHistoryInput').click());
    document.getElementById('importHistoryInput').addEventListener('change', importHistory);
    
    if (getGeminiKeyButton) getGeminiKeyButton.addEventListener('click', () => chrome.tabs.create({ url: 'https://aistudio.google.com/app/apikey?hl=pt-br' }));
    if (getCustomSearchKeyButton) getCustomSearchKeyButton.addEventListener('click', () => chrome.tabs.create({ url: 'https://developers.google.com/custom-search/v1/overview?hl=pt-br#api_key' }));
    if (getSearchEngineIdButton) getSearchEngineIdButton.addEventListener('click', () => chrome.tabs.create({ url: 'https://programmablesearchengine.google.com/controlpanel/all?hl=pt-br' }));

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
    
    const tutorials = {
        gemini: {
            title: "Como Obter a Chave API do Gemini",
            content: `<p>Siga estes passos para obter sua Chave API do Gemini:</p><ol><li>Acesse o <a href="https://aistudio.google.com/app/apikey?hl=pt-br" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.</li><li>Faça login com sua conta Google, se necessário.</li><li>Clique em <strong>"+ Criar chave de API"</strong>.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/gemini_criar_chave.jpeg" alt="Criar chave API Gemini"></div><ol start="4"><li>Copie a chave API gerada.</li><li>Cole a chave no campo <strong>"Chave API Gemini"</strong> na extensão.</li></ol>`
        },
        customSearch: {
            title: "Como Obter a Chave API Custom Search",
            content: `<p>Para obter sua Chave API do Custom Search (Pesquisa Personalizada do Google):</p><ol><li>Acesse o <a href="https://developers.google.com/custom-search/v1/overview?hl=pt-br#api_key" target="_blank" rel="noopener noreferrer">Google Developers (Custom Search API)</a>.</li><li>Clique em <strong>"Acessar uma chave"</strong>.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/custom_search_acessar_chave.jpeg" alt="Acessar chave Custom Search API"></div><ol start="3"><li>Selecione o projeto <strong>"Gemini API"</strong>.</li><li>Selecione <strong>"Yes"</strong> e clique em <strong>"NEXT"</strong>.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/custom_search_confirmar_projeto.jpeg" alt="Confirmar projeto Gemini API"></div><ol start="5"><li>Clique em <strong>"Show Key"</strong> e copie a chave.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/custom_search_mostrar_chave.jpeg" alt="Mostrar chave da API"></div><ol start="6"><li>Cole a chave no campo <strong>"Chave API Custom Search"</strong> na extensão.</li></ol>`
        },
        cxId: {
            title: "Como Obter o ID do Mecanismo de Pesquisa (CX ID)",
            content: `<p>Para criar um Mecanismo de Pesquisa Programável e obter seu ID (CX ID):</p><ol><li>Acesse o <a href="https://programmablesearchengine.google.com/controlpanel/all?hl=pt-br" target="_blank" rel="noopener noreferrer">Painel do Mecanismo de Pesquisa</a>.</li><li>Clique em <strong>"Adicionar"</strong>.</li><li>Em <strong>"Nome"</strong>, coloque algo como <strong>"TCC"</strong>.</li><li>Em <strong>"O que pesquisar?"</strong>, selecione <strong>"Pesquisar em toda a web"</strong>.</li><li>Clique em <strong>"Criar"</strong>.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/programmable_search_criar.jpeg" alt="Criar mecanismo de pesquisa"></div><ol start="6"><li>Clique em <strong>"Personalizar"</strong>.</li><li>Na seção <strong>"Informações básicas"</strong>, copie o <strong>"ID do mecanismo de pesquisa"</strong>.</li></ol><div class="tutorial-step"><img src="../assets/tutorial/programmable_search_id.jpeg" alt="ID do Mecanismo de Pesquisa"></div><ol start="8"><li>Cole o ID no campo <strong>"ID do Mecanismo de Pesquisa (CX ID)"</strong> na extensão.</li></ol>`
        }
    };

    if (geminiTutorialIcon) geminiTutorialIcon.addEventListener('click', (event) => { event.stopPropagation(); openTutorialModal(tutorials.gemini.title, tutorials.gemini.content); });
    if (customSearchTutorialIcon) customSearchTutorialIcon.addEventListener('click', (event) => { event.stopPropagation(); openTutorialModal(tutorials.customSearch.title, tutorials.customSearch.content); });
    if (cxIdTutorialIcon) cxIdTutorialIcon.addEventListener('click', (event) => { event.stopPropagation(); openTutorialModal(tutorials.cxId.title, tutorials.cxId.content); });
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
        percentageTextElement.classList.add('hidden');
    }
    if (analysisResultTextElement) {
        analysisResultTextElement.textContent = `Clique em "Analisar Página Atual" para começar.`;
    }
    if (scrapeButton) scrapeButton.disabled = false;
}

function extractPercentage(responseText) {
    if (!responseText) return null;
    const chanceMatch = responseText.match(/(\d+)\s*%/);
    return chanceMatch && chanceMatch[1] ? parseInt(chanceMatch[1], 10) : null;
}

async function performAnalysisRequest() {
    const scrapeButton = document.getElementById("scrapeButton");
    scrapeButton.disabled = true;

    const percentageTextElement = document.getElementById('percentageText');
    percentageTextElement.textContent = 'Analisando...';
    percentageTextElement.classList.remove('hidden');
    
    const analysisResultTextElement = document.getElementById('analysisResultText');
    analysisResultTextElement.textContent = 'Buscando fontes e preparando a análise inicial...';
    
    try {
        const { apiKeyGemini, apiKeyCustomSearch, searchEngineId, url, content } = currentAnalysisParams;
        const currentDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const titleLine = content.split("\n")[0].trim();
        
        const initialExternalEvidence = await collectExternalEvidence(titleLine, apiKeyCustomSearch, searchEngineId);
        
        const initialEvidenceText = initialExternalEvidence.length
            ? initialExternalEvidence.map(e => {
                const confiavelLabel = e.isTrusted ? "[FONTE CONFIÁVEL]" : "[OUTRA FONTE]";
                return `${confiavelLabel}\nTítulo: ${e.title}\nLink: ${e.link}\nResumo: ${e.snippet}`;
            }).join("\n\n")
            : "Nenhuma fonte externa inicial foi localizada.";

        const firstAnalysisPrompt = `Você é um especialista em checagem de fatos. Sua função é analisar notícias e determinar a probabilidade de serem VERDADEIRAS, não apenas no fato que foi dito, mas também se a pessoa que disse o fato realmente disse aquilo por exemplo "padre fabio de melo disse que todo brasileiro é sulamericano" o fato está correto, mas ele não disse isso.
- A data atual é "${currentDate}".
- Sua análise deve ter no máximo 240 caracteres.
- Dê uma porcentagem estimada de CHANCE DE SER VERDADEIRO. (Ex: "Chance de ser verdadeiro: 70%")
- Se não for uma notícia, retorne: "Insira uma página de notícia válida."
- Explique o porquê da sua conclusão.
- Após a porcentagem, coloque uma quebra de linha antes da explicação.

Notícia original (primeiros 1000 caracteres):
"${content.substring(0, 1000)}"

Fontes externas para comparação:
${initialEvidenceText}`;

        await saveDebugLog('1_initial_prompt.json', { url, prompt: firstAnalysisPrompt, evidence: initialExternalEvidence });
        analysisResultTextElement.textContent = 'Analisando o conteúdo com a IA...';
        let firstResponseText = await callGeminiAPI(firstAnalysisPrompt, apiKeyGemini);
        await saveDebugLog('2_initial_response.json', { response: firstResponseText });

        const chance = extractPercentage(firstResponseText);
        let finalResponseText = firstResponseText;

        if (chance !== null && chance <= 40) {
            analysisResultTextElement.textContent = 'Baixa confiança. Investigando pontos de suspeita...';
            const getSuspicionPointPrompt = `A análise anterior desta notícia indicou uma baixa probabilidade (${chance}%) de ser verdadeira.
Notícia Original: "${content.substring(0, 1000)}"
Por favor, retorne APENAS o principal fato ou termo específico DENTRO da notícia que causa a MAIOR SUSPEITA. O termo deve ser curto (máximo 7 palavras) e pesquisável. Se não houver, retorne "N/A".`;

            await saveDebugLog('3_suspicion_prompt.json', { prompt: getSuspicionPointPrompt });
            let searchableSuspicion = await callGeminiAPI(getSuspicionPointPrompt, apiKeyGemini);
            searchableSuspicion = searchableSuspicion.trim().replace(/^["']|["']$/g, "");
            await saveDebugLog('4_suspicion_term.json', { term: searchableSuspicion });

            if (searchableSuspicion.toLowerCase() !== "n/a" && searchableSuspicion.length > 0) {
                const suspicionEvidenceResults = await collectExternalEvidence(searchableSuspicion, apiKeyCustomSearch, searchEngineId);
                const suspicionEvidenceText = suspicionEvidenceResults.length ? suspicionEvidenceResults.map(e => `[${e.isTrusted ? "FONTE CONFIÁVEL" : "OUTRA FONTE"}] Título: ${e.title}\nResumo: ${e.snippet}`).join("\n\n") : "Nenhuma fonte adicional encontrada.";

                const reAnalysisPrompt = `REAVALIAÇÃO DE NOTÍCIA. A análise inicial indicou ${chance}% de chance de ser verdadeira. O ponto de suspeita foi: "${searchableSuspicion}".
Sua tarefa é REAVALIAR, considerando TODAS as fontes.
- Dê uma NOVA porcentagem de chance de ser VERDADEIRO.
- Máximo 240 caracteres.
- Após a porcentagem, coloque uma quebra de linha antes da explicação.

Notícia original: "${content.substring(0, 1000)}"
Fontes iniciais: ${initialEvidenceText}
Fontes adicionais (sobre "${searchableSuspicion}"): ${suspicionEvidenceText}
Sua nova análise e porcentagem:`;
                
                await saveDebugLog('5_reanalysis_prompt.json', { prompt: reAnalysisPrompt, new_evidence: suspicionEvidenceResults });
                analysisResultTextElement.textContent = 'Reavaliando com as novas informações...';
                finalResponseText = await callGeminiAPI(reAnalysisPrompt, apiKeyGemini);
                await saveDebugLog('6_reanalysis_response.json', { response: finalResponseText });
            }
        }

        await saveToHistory(url, titleLine, finalResponseText);
        displayAnalysisResults(finalResponseText, false);

    } catch (error) {
        console.error("Erro no fluxo de análise:", error);
        displayAnalysisResults(`Erro na análise: ${error.message}`, true);
    } finally {
        scrapeButton.disabled = false;
    }
}

function displayAnalysisResults(responseTextFromServer, isError = false) {
    const gaugeBar = document.getElementById('gaugeBar');
    const percentageTextElement = document.getElementById('percentageText');
    const analysisResultTextElement = document.getElementById('analysisResultText');

    if (isError) {
        gaugeBar.style.width = '0%';
        percentageTextElement.textContent = 'Erro na Análise';
        percentageTextElement.style.color = '#c0392b';
        analysisResultTextElement.textContent = responseTextFromServer;
        percentageTextElement.classList.remove('hidden');
        return;
    }
    
    if (!responseTextFromServer) {
        displayAnalysisResults("A IA não retornou uma resposta.", true);
        return;
    }

    const percentage = extractPercentage(responseTextFromServer);

    if (percentage !== null) {
        gaugeBar.style.width = percentage + '%';
        const hue = (percentage / 100) * 120;
        gaugeBar.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
        percentageTextElement.textContent = `Probabilidade de ser verdadeiro: ${percentage}%`;
        const hueText = (percentage / 100) * 120;
        percentageTextElement.style.color = `hsl(${hueText}, 70%, 35%)`;
    } else {
        gaugeBar.style.width = '0%';
        percentageTextElement.textContent = 'Análise Concluída';
        percentageTextElement.style.color = '#333';
    }
    percentageTextElement.classList.remove('hidden');

    let cleanedResponseText = String(responseTextFromServer);
    const lines = cleanedResponseText.split('\n');
    if (lines.length > 1 && /\d+\s*%/.test(lines[0])) {
        cleanedResponseText = lines.slice(1).join('\n').trim();
    }
    
    analysisResultTextElement.textContent = cleanedResponseText || "Análise concluída sem detalhes adicionais.";
}

async function getHistory() {
    const result = await chrome.storage.local.get(HISTORY_KEY);
    return result[HISTORY_KEY] || [];
}

async function saveToHistory(url, title, resultText) {
    const history = await getHistory();
    const newEntry = { url, title, resultText, timestamp: new Date().toISOString() };
    const updatedHistory = [newEntry, ...history.filter(item => item.url !== url).slice(0, 99)];
    await chrome.storage.local.set({ [HISTORY_KEY]: updatedHistory });
}

async function findInHistory(url) {
    const history = await getHistory();
    const entry = history.find(item => item.url === url);
    if (entry && (Date.now() - new Date(entry.timestamp).getTime()) < ONE_DAY_IN_MS) {
        return entry;
    }
    return null;
}

async function renderHistory(searchTerm = '') {
    const history = await getHistory();
    const container = document.getElementById('historyListContainer');
    container.innerHTML = '';

    const filteredHistory = history.filter(item =>
        (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.url || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.resultText || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredHistory.length === 0) {
        container.textContent = 'Nenhum registro encontrado.';
        return;
    }

    filteredHistory.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.addEventListener('click', () => restoreAnalysisFromHistory(item));
        
        const titleEl = document.createElement('h3');
        titleEl.className = 'history-item-title';
        titleEl.textContent = item.title || "Título indisponível";
        
        const urlEl = document.createElement('div');
        urlEl.className = 'history-item-url';
        urlEl.textContent = item.url;
        
        const dateEl = document.createElement('div');
        dateEl.className = 'history-item-date';
        dateEl.textContent = new Date(item.timestamp).toLocaleString('pt-BR');

        const resultEl = document.createElement('p');
        resultEl.className = 'history-item-result';
        resultEl.textContent = item.resultText;

        div.appendChild(titleEl);
        div.appendChild(urlEl);
        div.appendChild(dateEl);
        div.appendChild(resultEl);
        container.appendChild(div);
    });
}

function restoreAnalysisFromHistory(historyItem) {
    document.getElementById('analysisTabButton').click();
    displayAnalysisResults(historyItem.resultText, false);
}

async function exportHistory() {
    const history = await getHistory();
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
        url: url,
        filename: 'truth_checker_history.json'
    });
}

function importHistory(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const history = JSON.parse(e.target.result);
            if (Array.isArray(history) && (history.length === 0 || (history[0].url && history[0].timestamp && history[0].resultText))) {
                await chrome.storage.local.set({ [HISTORY_KEY]: history });
                renderHistory();
                alert('Histórico importado com sucesso!');
            } else {
                throw new Error('Formato de arquivo inválido. O arquivo deve conter título, url, data e resultado.');
            }
        } catch (error) {
            alert('Erro ao importar histórico: ' + error.message);
        }
    };
    reader.readAsText(file);
}

async function saveDebugLog(filename, content) {
    const { [DEBUG_MODE_KEY]: isEnabled } = await chrome.storage.local.get(DEBUG_MODE_KEY);
    if (!isEnabled) return;

    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    chrome.downloads.download({
        url: url,
        filename: `TCC_Debug_${timestamp}_${filename}`
    });
}