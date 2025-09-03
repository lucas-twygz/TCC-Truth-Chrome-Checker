import { elements } from './view/domElements.js';
import * as ui from './view/ui.js';
import { displayImageAnalysisResults } from './view/ui.js';
import * as storage from './infrastructure/storageService.js';
import { analyzeNews, analyzeImage } from './application/analysisUseCase.js';
import { STORAGE_KEYS, ONE_DAY_IN_MS, FAKE_NEWS_THRESHOLD } from './config.js';
import { extractPercentage } from './utils/textUtils.js';
import { openTutorialModal, closeTutorialModal } from './view/tutorial.js';

let currentAnalysisParams = {};
let currentCachedData = null;

document.addEventListener("DOMContentLoaded", () => {
    
    let currentFilter = 'all';
    let currentHistory = [];

    const onHistoryClick = (item) => {
        if (item.type === 'image') {
            ui.switchTab('imageAnalysis');
            ui.displayImageAnalysisResults(item.resultText, false);
        } else {
            ui.switchTab('analysis');
            ui.displayAnalysisResults(item.resultText, false);
        }
    };

    const setActiveFilterButton = (activeId) => {
        ['filterAll', 'filterText', 'filterImages'].forEach(id => {
            if (id === activeId) {
                elements.history[id].classList.add('active');
            } else {
                elements.history[id].classList.remove('active');
            }
        });
    };

    const handleNavigation = (tabName) => {
        ui.switchTab(tabName);
        // Salvar aba atual no armazenamento
        chrome.storage.local.set({ lastActiveTab: tabName });
        if (tabName === 'home') loadHomepageData();
        if (tabName === 'history') {
            storage.getHistory().then(history => {
                currentHistory = history;
                ui.renderHistory(currentHistory, onHistoryClick, currentFilter);
            });
        }
    };


    
    const handleStartAnalysis = async () => {
        const allData = await storage.getAllData();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            ui.switchTab('analysis');
            return ui.displayAnalysisResults("Nenhuma aba ativa encontrada.", true);
        }
        if (["chrome:", "about:", "edge:"].some(p => tab.url.startsWith(p))) {
            ui.switchTab('analysis');
            return ui.displayAnalysisResults("Não é possível analisar este tipo de página especial.", true);
        }
        currentAnalysisParams = { ...allData, url: tab.url };
        const history = await storage.getHistory();
        const recentEntry = history.find(item => item.url === tab.url && (Date.now() - new Date(item.timestamp).getTime()) < ONE_DAY_IN_MS);
        if (recentEntry) {
            currentCachedData = recentEntry;
            ui.showCachePromptModal(recentEntry);
            return;
        }
        ui.switchTab('analysis');
        try {
            ui.displayAnalysisResults("Extraindo conteúdo da página...", false, true);
            const response = await chrome.tabs.sendMessage(tab.id, { action: "getArticle" });
            if (!response || !response.article) return ui.displayAnalysisResults("Não foi possível extrair o conteúdo.", true);
            currentAnalysisParams.content = response.article;
            performAnalysis(currentAnalysisParams);
        } catch (error) {
            ui.displayAnalysisResults("Falha ao comunicar com a página. Recarregue a extensão e a página.", true);
        }
    };

    const performAnalysis = async (params) => {
        try {
            const updateStatus = (status) => ui.displayAnalysisResults(status, false, true);
            const resultText = await analyzeNews(params, updateStatus);
            ui.displayAnalysisResults(resultText, false, false);
        } catch (error) {
            ui.displayAnalysisResults(`Erro na análise: ${error.message}`, true, false);
        }
    };
    
    const handleSaveSettings = async () => {
        const settings = {
            geminiApiKey: elements.settings.geminiApiKey.value.trim(),
            customSearchApiKey: elements.settings.customSearchApiKey.value.trim(),
            searchEngineId: elements.settings.searchEngineId.value.trim(),
            userName: elements.settings.userName.value.trim(),
            debugMode: elements.settings.debugModeToggle.checked,
        };
        try {
            await storage.saveSettings(settings);
            ui.updateConfigStatus('Configurações salvas com sucesso!', 'success');
        } catch (e) {
            ui.updateConfigStatus(`Erro ao salvar: ${e.message}`, 'error');
        }
    };

    const handleImportHistory = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const history = JSON.parse(e.target.result);
                if (Array.isArray(history) && (history.length === 0 || (history[0].url && history[0].timestamp))) {
                    await storage.importHistory(history);
                    if (document.getElementById('historySection').classList.contains('active')) {
                        const onHistoryClick = (item) => {
                            ui.switchTab('analysis');
                            ui.displayAnalysisResults(item.resultText, false);
                        };
                        ui.renderHistory(history, onHistoryClick);
                    }
                    alert('Histórico importado com sucesso!');
                } else { throw new Error('Formato de arquivo inválido.'); }
            } catch (error) { alert('Erro ao importar histórico: ' + error.message); }
        };
        reader.readAsText(file);
    };

    Object.keys(elements.nav).forEach(key => {
        if (elements.nav[key]) elements.nav[key].addEventListener('click', () => handleNavigation(key));
    });
    elements.buttons.startAnalysisHome.addEventListener('click', handleStartAnalysis);
    elements.buttons.startAnalysisPage.addEventListener('click', handleStartAnalysis);
    elements.home.lastAnalysisCard.addEventListener('click', () => handleNavigation('history'));
    elements.buttons.saveSettings.addEventListener('click', handleSaveSettings);
    elements.buttons.exportHistory.addEventListener('click', () => storage.getHistory().then(ui.exportHistory));
    elements.buttons.importHistory.addEventListener('click', () => elements.settings.importHistoryInput.click());
    elements.settings.importHistoryInput.addEventListener('change', handleImportHistory);

    // Filter button event listeners
    elements.history.filterAll.addEventListener('click', () => {
        currentFilter = 'all';
        ui.renderHistory(currentHistory, onHistoryClick, currentFilter);
        setActiveFilterButton('filterAll');
    });
    elements.history.filterText.addEventListener('click', () => {
        currentFilter = 'text';
        ui.renderHistory(currentHistory, onHistoryClick, currentFilter);
        setActiveFilterButton('filterText');
    });
    elements.history.filterImages.addEventListener('click', () => {
        currentFilter = 'image';
        ui.renderHistory(currentHistory, onHistoryClick, currentFilter);
        setActiveFilterButton('filterImages');
    });

    // Definir botão de filtro ativo inicial
    setActiveFilterButton('filterAll');
    
    elements.buttons.useCachedResult.addEventListener('click', () => {
        if (currentCachedData) {
            ui.switchTab('analysis');
            ui.displayAnalysisResults(currentCachedData.resultText, false);
        }
        ui.hideCachePromptModal();
    });

    elements.buttons.reanalyze.addEventListener('click', async () => {
        ui.hideCachePromptModal();
        ui.switchTab('analysis');
        try {
            ui.displayAnalysisResults("Extraindo conteúdo para reanálise...", false, true);
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: "getArticle" });
            currentAnalysisParams.content = response.article;
            performAnalysis(currentAnalysisParams);
        } catch(e) {
            ui.displayAnalysisResults("Falha ao obter conteúdo para reanálise.", true);
        }
    });

    elements.modals.modalClose.addEventListener('click', closeTutorialModal);
    elements.tutorials.gemini.addEventListener('click', () => openTutorialModal('gemini'));
    elements.tutorials.customSearch.addEventListener('click', () => openTutorialModal('customSearch'));
    elements.tutorials.cxId.addEventListener('click', () => openTutorialModal('cxId'));

    // Handlers para análise de imagem
    elements.imageAnalysis.upload.addEventListener('change', handleImageUpload);
    elements.imageAnalysis.analyzeButton.addEventListener('click', handleImageAnalysis);
     
    const init = async () => {
        const data = await storage.getAllData();

        // Verificar se as chaves de API estão configuradas
        const hasApiKeys = data[STORAGE_KEYS.GEMINI_API_KEY] && data[STORAGE_KEYS.CUSTOM_SEARCH_API_KEY] && data[STORAGE_KEYS.SEARCH_ENGINE_ID];

        // Obter estado salvo da aba
        const savedTabData = await chrome.storage.local.get('lastActiveTab');
        const lastTab = savedTabData.lastActiveTab;

        // Determinar qual aba mostrar
        let targetTab = 'home';
        if (!hasApiKeys) {
            targetTab = 'settings';
            ui.updateConfigStatus('Por favor, configure suas chaves de API para começar.', 'error');
        } else if (lastTab && ['home', 'analysis', 'imageAnalysis', 'history', 'settings'].includes(lastTab)) {
            targetTab = lastTab;
        }

        handleNavigation(targetTab);
        ui.loadSettingsScreenData(data);
    };
    init();
});

async function loadHomepageData() {
    const data = await storage.getAllData();
    const history = data[STORAGE_KEYS.HISTORY] || [];
    const curiosity = typeof curiosities !== 'undefined' ? curiosities[Math.floor(Math.random() * curiosities.length)] : "Carregando dica...";
    const weeklyAnalyses = history.filter(item => new Date(item.timestamp).getTime() >= (Date.now() - 7 * ONE_DAY_IN_MS));

    ui.updateHomepage({
        userName: data[STORAGE_KEYS.USER_NAME],
        weeklyCount: weeklyAnalyses.length,
        fakeNewsCount: history.filter(item => extractPercentage(item.resultText) <= FAKE_NEWS_THRESHOLD).length,
        curiosity: curiosity,
        lastEntry: history.length > 0 ? history[0] : null
    });
}

function handleImageUpload() {
    const file = elements.imageAnalysis.upload.files[0];
    if (file) {
        elements.imageAnalysis.analyzeButton.disabled = false;
    } else {
        elements.imageAnalysis.analyzeButton.disabled = true;
    }
}

async function handleImageAnalysis() {
    const file = elements.imageAnalysis.upload.files[0];
    if (!file) {
        displayImageAnalysisResults("Nenhuma imagem selecionada.", true);
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const base64Data = event.target.result.split(',')[1];
            const imageData = {
                type: file.type,
                data: base64Data
            };
            elements.imageAnalysis.analyzeButton.disabled = true;
            displayImageAnalysisResults("Analisando imagem...", false, true);
            const allData = await storage.getAllData();
            const result = await analyzeImage(imageData, allData, (status) => {
                displayImageAnalysisResults(status, false, true);
            });
            displayImageAnalysisResults(result, false, false);
        } catch (error) {
            displayImageAnalysisResults(`Erro na análise de imagem: ${error.message}`, true, false);
        } finally {
            elements.imageAnalysis.analyzeButton.disabled = false;
        }
    };
    reader.readAsDataURL(file);
}
