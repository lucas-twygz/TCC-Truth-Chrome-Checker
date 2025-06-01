// popup.js

const GEMINI_API_KEY_STORAGE = 'truthCheckerGeminiApiKey';
const CUSTOM_SEARCH_API_KEY_STORAGE = 'truthCheckerCustomSearchApiKey';
const SEARCH_ENGINE_ID_STORAGE = 'truthCheckerSearchEngineId';

document.addEventListener("DOMContentLoaded", function () {
    const mainPageContainer = document.querySelector('.container.main-page');
    const configSection = document.getElementById('configSection');
    // analysisSection é o div dentro de mainPageContainer, não precisa de referência separada para mostrar/ocultar o container
    
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
    
    const percentageTextElement = document.getElementById('percentageText'); 

    function showConfigScreen(message = '') {
        if (mainPageContainer) mainPageContainer.classList.add('hidden'); // Oculta a tela principal
        if (settingsIcon) settingsIcon.classList.add('hidden'); // Oculta o ícone de engrenagem
        
        if (configSection) configSection.classList.remove('hidden'); // Mostra a tela de config
        
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
        if (mainPageContainer) mainPageContainer.classList.remove('hidden'); // Mostra a tela principal
        if (settingsIcon) settingsIcon.classList.remove('hidden'); // Mostra o ícone de engrenagem
        
        if (configSection) configSection.classList.add('hidden'); // Oculta a tela de config
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
    
    if (scrapeButton) scrapeButton.addEventListener("click", scrapePage);
    
    if (settingsIcon) {
        settingsIcon.addEventListener('click', () => {
            showConfigScreen('Altere ou confirme suas chaves de API.');
        });
    }

    if (backButton) {
        backButton.addEventListener('click', () => {
            showMainScreen();
        });
    }

    function openTutorialModal(title, contentHTML) {
        if (tutorialModal && tutorialTitleElement && tutorialBodyElement) {
            tutorialTitleElement.textContent = title;
            tutorialBodyElement.innerHTML = contentHTML; 
            tutorialModal.classList.remove('hidden');
        }
    }

    function closeTutorialModal() {
        if (tutorialModal) {
            tutorialModal.classList.add('hidden');
        }
    }

    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', closeTutorialModal);
    }

    if (tutorialModal) {
        tutorialModal.addEventListener('click', function(event) {
            if (event.target === tutorialModal) { 
                closeTutorialModal();
            }
        });
    }

  const tutorials = {
        gemini: {
            title: "Como Obter a Chave API Gemini",
            content: `
                <p>Siga estes passos para obter sua Chave API do Gemini:</p>
                <ol>
                    <li>Acesse o <a href="https://aistudio.google.com/app/apikey?hl=pt-br" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.</li>
                    <li>Faça login com sua conta Google, se solicitado.</li>
                    <li>Clique em "<strong>+ Criar chave de API</strong>".</li>
                </ol>
                <p><img src="../assets/" alt="Criando a chave API Gemini no AI Studio"></p>
                <ol start="4">
                    <li>Copie a chave API gerada.</li>
                    <li>Cole a chave no campo "Chave API Gemini" na extensão.</li>
                </ol>
                <p><img src="../assets/" alt="Criando a chave API Gemini no AI Studio"></p>
            `
        },
        customSearch: {
            title: "Como Obter a Chave API Custom Search",
            content: `
                <p>Para obter sua Chave API do Custom Search (Pesquisa Personalizada do Google):</p>
                <ol>
                    <li>Acesse o <a href="https://developers.google.com/custom-search/v1/overview?hl=pt-br#api_key" target="_blank" rel="noopener noreferrer">Google Developers (Custom Search API)</a>.</li>
                    <li>Clique em "<strong>Acessar uma chave</strong>" (ou "Get a Key").</li>
                </ol>
                <p><img src="../assets/" alt="Criando a chave API Gemini no AI Studio"></p>
                <ol start="3">
                    <li>Selecione o projeto Gemini API</li>
                    <li>Selecione "Yes" e clique em "NEXT"</li>
                </ol>
                <p><img src="../assets/" alt="Criando a chave API Gemini no AI Studio"></p>
                <ol start="6">
                    <li>Clique em "Show Key" e copie a chave.</li>
                </ol>
                <p><img src="../assets/" alt="Criando a chave API Gemini no AI Studio"></p>
                <ol start="7">
                    <li>Cole a chave no campo "Chave API Custom Search" na extensão.</li>
                </ol>
                <p><em>Lembre-se de restringir sua chave de API no Google Cloud Console para maior segurança.</em></p>
            `
        },
        cxId: {
            title: "Como Obter o ID do Mecanismo de Pesquisa (CX ID)",
            content: `
                <p>Para criar um Mecanismo de Pesquisa Programável e obter seu ID (CX ID):</p>
                <ol>
                    <li>Acesse o <a href="https://programmablesearchengine.google.com/controlpanel/all?hl=pt-br" target="_blank" rel="noopener noreferrer">Painel de Controle do Mecanismo de Pesquisa Programável</a>.</li>
                    <li>Clique em "<strong>Adicionar</strong>".</li>
                    <li>Em "Nome", você pode colocar algo como "TCC".</li>
                    <li>Em "O que pesquisar?", selecione "<strong>Pesquisar em toda a web</strong>".</li>
                    <li>Clique em "<strong>Criar</strong>".</li>
                </ol>
                <p><img src="../assets/" alt="Criando a chave API Gemini no AI Studio"></p>
                <ol start="6">
                    <li>Após a criação clique em "Personalizar"</li>
                    <li>Na seção "<strong>Informações básicas</strong>", você encontrará o "<strong>ID do mecanismo de pesquisa</strong>". Copie este ID.</li>
                    <li>Cole o ID no campo "ID do Mecanismo de Pesquisa (CX ID)" na extensão.</li>
                </ol>
            `
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
}

async function scrapePage() {
    const gaugeBar = document.getElementById('gaugeBar');
    const percentageTextElement = document.getElementById('percentageText');
    const analysisResultTextElement = document.getElementById('analysisResultText');
    const mainPageContainer = document.querySelector('.container.main-page');
    const configSection = document.getElementById('configSection');

    if (gaugeBar) {
        gaugeBar.style.width = '0%';  
        gaugeBar.style.backgroundColor = '#e0e0e0';  
    }
    if (percentageTextElement) {
        percentageTextElement.textContent = 'Analisando...';
        percentageTextElement.style.color = '#333';  
        percentageTextElement.classList.remove('hidden'); 
    }
    if (analysisResultTextElement) {
        analysisResultTextElement.textContent = ''; 
        analysisResultTextElement.style.marginTop = '10px'; 
    }

    chrome.storage.local.get([GEMINI_API_KEY_STORAGE, CUSTOM_SEARCH_API_KEY_STORAGE, SEARCH_ENGINE_ID_STORAGE], async function(keys) {
        if (!keys[GEMINI_API_KEY_STORAGE] || !keys[CUSTOM_SEARCH_API_KEY_STORAGE] || !keys[SEARCH_ENGINE_ID_STORAGE]) {
            if (percentageTextElement) {
                percentageTextElement.textContent = 'Erro de Configuração';
                percentageTextElement.classList.remove('hidden'); 
            }
            if (analysisResultTextElement) analysisResultTextElement.textContent = "Chaves de API não configuradas. Clique no ícone (⚙️) para configurar.";
            
            if (mainPageContainer) mainPageContainer.classList.add('hidden');
            if (configSection) configSection.classList.remove('hidden');
            return;
        }

        const apiKeyGemini = keys[GEMINI_API_KEY_STORAGE];
        const apiKeyCustomSearch = keys[CUSTOM_SEARCH_API_KEY_STORAGE];
        const searchEngineId = keys[SEARCH_ENGINE_ID_STORAGE];

        chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
            if (!tabs || !tabs.length || !tabs[0]?.id) {
                if (percentageTextElement) {
                    percentageTextElement.textContent = 'Erro de Aba';
                    percentageTextElement.classList.remove('hidden');
                }
                if (analysisResultTextElement) analysisResultTextElement.textContent = "Nenhuma aba ativa encontrada ou aba inválida.";
                return;
            }
            
            const pageUrl = tabs[0].url;

            if (pageUrl.startsWith("chrome://") || pageUrl.startsWith("edge://") || pageUrl.startsWith("about:") || pageUrl.startsWith("https://chrome.google.com/webstore")) {
                if (percentageTextElement) {
                    percentageTextElement.textContent = 'Página Indisponível';
                    percentageTextElement.classList.remove('hidden');
                }
                if (analysisResultTextElement) analysisResultTextElement.textContent = "Não é possível analisar este tipo de página especial.";
                return;
            }

            try {
                chrome.tabs.sendMessage(tabs[0].id, { action: "getArticle" }, async (msg) => {
                    if (chrome.runtime.lastError) {
                        console.error("Erro ao enviar mensagem para o content script:", chrome.runtime.lastError.message);
                        if (percentageTextElement) {
                            percentageTextElement.textContent = 'Erro na Página';
                            percentageTextElement.classList.remove('hidden');
                        }
                        if (analysisResultTextElement) analysisResultTextElement.textContent = "Não foi possível comunicar com a página. Tente recarregá-la.";
                        return;
                    }

                    if (!msg || !msg.article) {
                        if (percentageTextElement) {
                             percentageTextElement.textContent = 'Falha na Extração';
                             percentageTextElement.classList.remove('hidden');
                        }
                        if (analysisResultTextElement) analysisResultTextElement.textContent = "Não foi possível extrair o conteúdo da página.";
                        return;
                    }

                    try {
                        const res = await fetch("http://localhost:3000/scrape", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                                url: pageUrl, 
                                content: msg.article,
                                apiKeyGemini: apiKeyGemini,
                                apiKeyCustomSearch: apiKeyCustomSearch,
                                searchEngineId: searchEngineId
                            })
                        });

                        if (!res.ok) {
                            let errorData = { response: `Erro do servidor: ${res.status}`};
                            try { errorData = await res.json(); } catch (e) { /* ignora */ }
                            
                            if (percentageTextElement) {
                                percentageTextElement.textContent = 'Erro Servidor';
                                percentageTextElement.classList.remove('hidden');
                            }
                            let detailedErrorMessage = errorData.response || errorData.error || `Falha na análise: ${res.statusText}`;
                            
                            if ((res.status === 400 || res.status === 401 || res.status === 403) && (detailedErrorMessage.toLowerCase().includes("api key") || detailedErrorMessage.toLowerCase().includes("chave de api") || detailedErrorMessage.toLowerCase().includes("inválid"))) {
                                detailedErrorMessage = "Problema com as chaves de API. Verifique a configuração (⚙️).";
                            }
                            if (analysisResultTextElement) analysisResultTextElement.textContent = detailedErrorMessage;
                            return;
                        }

                        const data = await res.json();
                        const responseTextFromServer = data.response; 
                    
                        if (!responseTextFromServer) {
                            if (percentageTextElement) {
                                percentageTextElement.textContent = 'Sem Resposta';
                                percentageTextElement.classList.remove('hidden');
                            }
                            if (analysisResultTextElement) analysisResultTextElement.textContent = "O servidor não retornou uma análise válida.";
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
                                percentageTextElement.textContent = `Probabilidade de ser verdadeiro: ${percentage}%`; 
                                const hueText = (percentage / 100) * 120;
                                percentageTextElement.style.color = `hsl(${hueText}, 70%, 35%)`;
                            }
                        } else { 
                            if (gaugeBar) {
                                gaugeBar.style.width = '0%'; 
                                gaugeBar.style.backgroundColor = '#e0e0e0';
                            }
                            if (percentageTextElement) { 
                                percentageTextElement.textContent = 'Análise Concluída'; 
                                percentageTextElement.style.color = '#333';
                            }
                        }

                        let cleanedResponseText = responseTextFromServer;
                        if (percentage !== null) { 
                            const lines = responseTextFromServer.split('\n');
                            if (lines.length > 0 && /\d+\s*%/.test(lines[0])) { 
                                cleanedResponseText = lines.slice(1).join('\n').trim(); 
                                if (cleanedResponseText === "") {
                                    cleanedResponseText = "A análise detalhada está contida na porcentagem acima ou não foram fornecidos detalhes adicionais.";
                                }
                            } else {
                                const genericPercentagePattern = new RegExp(`^(Nova chance de ser verdadeiro:|Chance de ser verdadeiro:|Probabilidade de ser verdadeiro:)\\s*${percentage}%\\s*(Verdadeiro)?\\s*`, "i");
                                let tempCleaned = responseTextFromServer.replace(genericPercentagePattern, '').trim();
                                if (tempCleaned !== responseTextFromServer && tempCleaned !== "") { 
                                    cleanedResponseText = tempCleaned;
                                } else if (tempCleaned === "" && responseTextFromServer.includes(percentage + '%')) {
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

                    } catch (fetchError) {
                        console.error("Erro ao fazer fetch para o backend ou processar resposta:", fetchError);
                        if (percentageTextElement) {
                            percentageTextElement.textContent = 'Erro Backend';
                            percentageTextElement.classList.remove('hidden');
                        }
                        if (analysisResultTextElement) analysisResultTextElement.textContent = "Erro ao comunicar com o servidor de análise: " + fetchError.message;
                    }
                });
            } catch (error) { 
                console.error("Erro geral em scrapePage:", error);
                if (percentageTextElement) {
                    percentageTextElement.textContent = 'Erro Inesperado';
                    percentageTextElement.classList.remove('hidden');
                }
                if (analysisResultTextElement) analysisResultTextElement.textContent = "Ocorreu um erro inesperado: " + error.message;
            }
        }); 
    }); 
}