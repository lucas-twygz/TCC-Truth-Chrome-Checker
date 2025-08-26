// --- CONSTANTES ---
const STORAGE_KEYS = {
    GEMINI_API_KEY: 'truthCheckerGeminiApiKey',
    CUSTOM_SEARCH_API_KEY: 'truthCheckerCustomSearchApiKey',
    SEARCH_ENGINE_ID: 'truthCheckerSearchEngineId',
    USER_NAME: 'truthCheckerUserName',
    HISTORY: 'analysisHistory'
};
const FAKE_NEWS_THRESHOLD = 40;
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

// --- VARIÁVEIS GLOBAIS ---
let currentAnalysisParams = {};
let currentCachedData = null;

// --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", () => {
    // --- SELEÇÃO DE ELEMENTOS ---
    const navButtons = document.querySelectorAll('.nav-button');
    const analysisButtons = document.querySelectorAll('.analysis-button');
    const lastAnalysisCard = document.getElementById('lastAnalysisCard');
    const saveSettingsButton = document.getElementById('saveApiKeysButton');
    const useCachedResultButton = document.getElementById('useCachedResultButton');
    const reanalyzeButton = document.getElementById('reanalyzeButton');
    
    // --- EVENT LISTENERS ---
    navButtons.forEach(button => button.addEventListener('click', () => {
        const tabName = button.id.replace('nav', '').toLowerCase();
        switchTab(tabName);
    }));

    analysisButtons.forEach(button => button.addEventListener('click', handleStartAnalysis));
    if (lastAnalysisCard) lastAnalysisCard.addEventListener('click', handleLastAnalysisClick);
    if (saveSettingsButton) saveSettingsButton.addEventListener('click', handleSaveSettings);
    
    if(useCachedResultButton) useCachedResultButton.addEventListener('click', () => {
        if(currentCachedData) {
            switchTab('analysis');
            displayAnalysisResults(currentCachedData.resultText, false);
        }
        hideCachePromptModal();
    });

    if(reanalyzeButton) reanalyzeButton.addEventListener('click', async () => {
        hideCachePromptModal();
        switchTab('analysis');
        try {
            displayAnalysisResults("Extraindo conteúdo para reanálise...", false, true);
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: "getArticle" });
            if (!response || !response.article) return displayAnalysisResults("Não foi possível extrair o conteúdo para reanálise.", true);
            
            currentAnalysisParams.content = response.article;
            performAnalysisRequest(currentAnalysisParams);
        } catch(e) {
            displayAnalysisResults("Falha ao obter conteúdo para reanálise. Recarregue a página.", true);
        }
    });

    // --- LÓGICA DE INICIALIZAÇÃO ---
    const init = async () => {
        const keys = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
        if (!keys[STORAGE_KEYS.GEMINI_API_KEY] || !keys[STORAGE_KEYS.CUSTOM_SEARCH_API_KEY] || !keys[STORAGE_KEYS.SEARCH_ENGINE_ID]) {
            switchTab('settings');
            updateConfigStatus('Por favor, configure suas chaves de API para começar.', 'error');
        } else {
            switchTab('home');
        }
        loadSettingsScreenData();
    };
    init();
});

// --- LÓGICA DE NAVEGAÇÃO ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-button').forEach(n => n.classList.remove('active'));

    const sectionId = `${tabName}Section`;
    const navId = `nav${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;

    document.getElementById(sectionId)?.classList.add('active');
    document.getElementById(navId)?.classList.add('active');

    if (tabName === 'home') loadHomepageData();
    if (tabName === 'history') renderHistory();
}


// --- LÓGICA DA HOMEPAGE ---
async function loadHomepageData() {
    const { [STORAGE_KEYS.USER_NAME]: userName, [STORAGE_KEYS.HISTORY]: history = [] } = await chrome.storage.local.get([STORAGE_KEYS.USER_NAME, STORAGE_KEYS.HISTORY]);
    
    const greetingText = document.getElementById('greetingText');
    const hour = new Date().getHours();
    let greeting = (hour < 12) ? 'Bom dia,' : (hour < 18) ? 'Boa tarde,' : 'Boa noite,';
    greetingText.textContent = userName ? `${greeting} ${userName}.` : greeting.replace(',', '!');

    const curiosityText = document.getElementById('curiosityText');
    if (typeof curiosities !== 'undefined' && curiosities.length > 0) {
        curiosityText.textContent = curiosities[Math.floor(Math.random() * curiosities.length)];
    }

    const oneWeekAgo = Date.now() - 7 * ONE_DAY_IN_MS;
    const weeklyAnalyses = history.filter(item => new Date(item.timestamp).getTime() >= oneWeekAgo);
    const fakeNewsEvaded = history.filter(item => extractPercentage(item.resultText) <= FAKE_NEWS_THRESHOLD);
    
    document.getElementById('weeklyCount').textContent = weeklyAnalyses.length;
    document.getElementById('fakeNewsCount').textContent = fakeNewsEvaded.length;

    updateLastAnalysisCard(history.length > 0 ? history[0] : null);
}

function updateLastAnalysisCard(lastEntry) {
    const gaugeFill = document.getElementById('gaugeFill');
    const percentText = document.getElementById('gaugePercent');
    const urlText = document.getElementById('lastAnalysisUrl');
    if(!gaugeFill || !percentText || !urlText) return;

    if (!lastEntry) {
        percentText.textContent = '--%';
        urlText.textContent = 'Nenhuma análise recente.';
        gaugeFill.style.transform = 'rotate(0deg)';
        gaugeFill.style.backgroundColor = '#ecf0f1';
        return;
    }
    const percentage = extractPercentage(lastEntry.resultText);
    if (percentage !== null) {
        percentText.textContent = `${percentage}%`;
        // CORREÇÃO DA LÓGICA DE ROTAÇÃO
        const degrees = (percentage / 100) * 180;
        gaugeFill.style.transform = `rotate(${degrees}deg)`;
        
        if (percentage <= FAKE_NEWS_THRESHOLD) gaugeFill.style.backgroundColor = 'var(--red-light)';
        else if (percentage < 75) gaugeFill.style.backgroundColor = 'var(--yellow-light)';
        else gaugeFill.style.backgroundColor = 'var(--green-light)';
    } else {
        percentText.textContent = 'N/A';
        gaugeFill.style.transform = 'rotate(0deg)';
        gaugeFill.style.backgroundColor = '#ecf0f1';
    }
    try {
        urlText.textContent = new URL(lastEntry.url).hostname.replace('www.', '');
    } catch {
        urlText.textContent = lastEntry.url;
    }
}


// --- LÓGICA DE ANÁLISE ---
async function handleStartAnalysis() {
    const keys = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
        switchTab('analysis');
        return displayAnalysisResults("Nenhuma aba ativa encontrada.", true);
    }
    if (["chrome:", "about:", "edge:"].some(p => tab.url.startsWith(p))) {
        switchTab('analysis');
        return displayAnalysisResults("Não é possível analisar este tipo de página especial.", true);
    }
    
    currentAnalysisParams = { ...keys, url: tab.url };

    const recentEntry = await findInHistory(tab.url);
    if(recentEntry) {
        currentCachedData = recentEntry;
        showCachePromptModal(recentEntry);
        return;
    }
    
    switchTab('analysis');
    try {
        displayAnalysisResults("Extraindo conteúdo da página...", false, true);
        const response = await chrome.tabs.sendMessage(tab.id, { action: "getArticle" });
        if (!response || !response.article) return displayAnalysisResults("Não foi possível extrair o conteúdo da página.", true);
        
        currentAnalysisParams.content = response.article;
        performAnalysisRequest(currentAnalysisParams);
    } catch (error) {
        displayAnalysisResults("Falha ao comunicar com a página. Recarregue a extensão e a página e tente novamente.", true);
    }
}

async function performAnalysisRequest(params) {
    displayAnalysisResults("Buscando fontes externas...", false, true);
    document.querySelectorAll('.analysis-button').forEach(btn => btn.disabled = true);

    try {
        const { truthCheckerGeminiApiKey, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, url, content } = params;
        const titleLine = content.split("\n")[0].trim();
        
        const initialExternalEvidence = await collectExternalEvidence(titleLine, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId);
        const initialEvidenceText = initialExternalEvidence.length ? initialExternalEvidence.map(e => `[${e.isTrusted ? "FONTE CONFIÁVEL" : "OUTRA FONTE"}] Título: ${e.title}\nResumo: ${e.snippet}`).join("\n\n") : "Nenhuma fonte externa inicial.";

        displayAnalysisResults("Analisando com IA...", false, true);
        const firstAnalysisPrompt = `Você é um checador de fatos. A data é ${new Date().toLocaleDateString('pt-BR')}. Dê uma porcentagem de CHANCE DE SER VERDADEIRO (Ex: "Chance de ser verdadeiro: 70%"). Máximo 240 caracteres. Após a %, pule uma linha. Se não for notícia, avise.\n\nNotícia:\n"${content.substring(0, 1000)}"\n\nFontes externas:\n${initialEvidenceText}`;
        let finalResponseText = await callGeminiAPI(firstAnalysisPrompt, truthCheckerGeminiApiKey);

        const chance = extractPercentage(finalResponseText);
        if (chance !== null && chance <= FAKE_NEWS_THRESHOLD) {
            displayAnalysisResults("Baixa confiança. Investigando pontos de suspeita...", false, true);
            const getSuspicionPointPrompt = `Análise inicial: ${chance}% de chance. Notícia: "${content.substring(0, 1000)}". Retorne APENAS o principal fato suspeito da notícia (máx 7 palavras). Se não houver, retorne "N/A".`;
            let suspicion = (await callGeminiAPI(getSuspicionPointPrompt, truthCheckerGeminiApiKey)).trim().replace(/^["']|["']$/g, "");
            if (suspicion.toLowerCase() !== "n/a" && suspicion.length > 0) {
                const suspicionEvidence = await collectExternalEvidence(suspicion, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId);
                const suspicionEvidenceText = suspicionEvidence.length ? suspicionEvidence.map(e => `[${e.isTrusted ? "FONTE CONFIÁVEL" : "OUTRA FONTE"}] Título: ${e.title}\nResumo: ${e.snippet}`).join("\n\n") : "Nenhuma fonte adicional encontrada.";
                const reAnalysisPrompt = `REAVALIAÇÃO. Análise inicial: ${chance}%. Ponto suspeito: "${suspicion}". Reavalie com TODAS as fontes. Dê uma NOVA porcentagem. Máximo 240 caracteres. Após a %, pule uma linha.\n\nNotícia: "${content.substring(0, 1000)}"\nFontes iniciais: ${initialEvidenceText}\nFontes adicionais: ${suspicionEvidenceText}\nNova análise:`;
                finalResponseText = await callGeminiAPI(reAnalysisPrompt, truthCheckerGeminiApiKey);
            }
        }
        await saveToHistory(url, titleLine, finalResponseText);
        displayAnalysisResults(finalResponseText, false, false);
    } catch (error) {
        displayAnalysisResults(`Erro na análise: ${error.message}`, true, false);
    } finally {
        document.querySelectorAll('.analysis-button').forEach(btn => btn.disabled = false);
    }
}

// --- LÓGICA DAS CONFIGURAÇÕES ---
function handleSaveSettings() {
    const settingsToSave = {
        [STORAGE_KEYS.GEMINI_API_KEY]: document.getElementById('geminiApiKey').value.trim(),
        [STORAGE_KEYS.CUSTOM_SEARCH_API_KEY]: document.getElementById('customSearchApiKey').value.trim(),
        [STORAGE_KEYS.SEARCH_ENGINE_ID]: document.getElementById('programmableSearchEngineId').value.trim(),
        [STORAGE_KEYS.USER_NAME]: document.getElementById('userName').value.trim()
    };
    chrome.storage.local.set(settingsToSave, () => {
        if (chrome.runtime.lastError) updateConfigStatus('Erro ao salvar: ' + chrome.runtime.lastError.message, 'error');
        else updateConfigStatus('Configurações salvas com sucesso!', 'success');
    });
}
async function loadSettingsScreenData() {
    const data = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
    document.getElementById('geminiApiKey').value = data[STORAGE_KEYS.GEMINI_API_KEY] || '';
    document.getElementById('customSearchApiKey').value = data[STORAGE_KEYS.CUSTOM_SEARCH_API_KEY] || '';
    document.getElementById('programmableSearchEngineId').value = data[STORAGE_KEYS.SEARCH_ENGINE_ID] || '';
    document.getElementById('userName').value = data[STORAGE_KEYS.USER_NAME] || '';
}
function updateConfigStatus(message, type) {
    const statusEl = document.getElementById('configStatus');
    if (statusEl) { statusEl.textContent = message; statusEl.className = `status-message ${type}`; }
}

// --- LÓGICA DO HISTÓRICO E UTILITÁRIOS ---
async function handleLastAnalysisClick() {
    if ((await getHistory()).length > 0) switchTab('history');
}
async function getHistory() {
    return (await chrome.storage.local.get(STORAGE_KEYS.HISTORY))[STORAGE_KEYS.HISTORY] || [];
}
async function saveToHistory(url, title, resultText) {
    const history = await getHistory();
    const newEntry = { url, title, resultText, timestamp: new Date().toISOString() };
    const updatedHistory = [newEntry, ...history.filter(item => item.url !== url).slice(0, 99)];
    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updatedHistory });
}
function extractPercentage(responseText) {
    if (!responseText) return null;
    const chanceMatch = responseText.match(/(\d+)\s*%/);
    return chanceMatch ? parseInt(chanceMatch[1], 10) : null;
}
function displayAnalysisResults(responseText, isError = false, inProgress = false) {
    const gaugeBar = document.getElementById('gaugeBar');
    const percentageTextEl = document.getElementById('percentageText');
    const analysisResultTextEl = document.getElementById('analysisResultText');
    
    percentageTextEl.classList.remove('hidden');
    analysisResultTextEl.textContent = ''; // Limpa o texto anterior

    if (isError) {
        gaugeBar.style.width = '0%';
        percentageTextEl.textContent = 'Erro na Análise';
        analysisResultTextEl.textContent = responseText;
        return;
    }
    
    if (inProgress) {
        gaugeBar.style.width = '100%';
        gaugeBar.style.backgroundColor = '#7f8c8d';
        percentageTextEl.textContent = responseText;
        analysisResultTextEl.textContent = "Por favor, aguarde...";
        return;
    }

    const percentage = extractPercentage(responseText);
    if (percentage !== null) {
        gaugeBar.style.width = percentage + '%';
        gaugeBar.style.backgroundColor = `hsl(${(percentage/100)*120}, 70%, 50%)`;
        percentageTextEl.textContent = `Probabilidade de ser verdadeiro: ${percentage}%`;
    } else {
        gaugeBar.style.width = '0%';
        percentageTextEl.textContent = 'Análise Concluída';
    }
    
    analysisResultTextEl.textContent = String(responseText).split('\n').slice(1).join('\n').trim() || responseText;
}
async function renderHistory(searchTerm = '') {
    const history = await getHistory();
    const container = document.getElementById('historyListContainer');
    container.innerHTML = '';

    const filtered = searchTerm ? history.filter(item => JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())) : history;
    if (filtered.length === 0) {
        container.textContent = 'Nenhum registro encontrado.';
        return;
    }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.addEventListener('click', () => {
             switchTab('analysis');
             displayAnalysisResults(item.resultText, false);
        });
        div.innerHTML = `<h3 class="history-item-title">${item.title || "Título indisponível"}</h3><div class="history-item-url">${item.url}</div><div class="history-item-date">${new Date(item.timestamp).toLocaleString('pt-BR')}</div><p class="history-item-result">${item.resultText}</p>`;
        container.appendChild(div);
    });
}

// --- LÓGICA DO MODAL DE CACHE ---
function showCachePromptModal(cachedEntry) {
    const modal = document.getElementById('cachePromptModal');
    const details = document.getElementById('cachePromptDetails');
    const date = new Date(cachedEntry.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    let preview = cachedEntry.resultText || "Resultado anterior indisponível.";
    if (preview.length > 100) preview = preview.substring(0, 100) + "...";
    details.textContent = `Analisado em ${date}. Resultado: "${preview}". Deseja usar este resultado ou analisar novamente?`;
    modal.classList.remove('hidden');
}
function hideCachePromptModal() {
    document.getElementById('cachePromptModal').classList.add('hidden');
}
async function findInHistory(url) {
    const history = await getHistory();
    const entry = history.find(item => item.url === url);
    if (entry && (Date.now() - new Date(entry.timestamp).getTime()) < ONE_DAY_IN_MS) {
        return entry;
    }
    return null;
}