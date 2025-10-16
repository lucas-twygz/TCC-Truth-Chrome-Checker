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
let imageFile = null;

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
            if (elements.history[id]) {
                if (id === activeId) {
                    elements.history[id].classList.add('active');
                } else {
                    elements.history[id].classList.remove('active');
                }
            }
        });
    };

    // NOVA FUNÇÃO para aplicar filtros de tipo E de busca
    const applyHistoryFilters = () => {
        const searchTerm = elements.history.searchInput.value.toLowerCase();

        const filtered = currentHistory.filter(item => {
            // 1. Filtro por tipo (Todas, Textuais, Imagens)
            const typeMatch = (currentFilter === 'all') || (item.type === currentFilter);
            if (!typeMatch) return false;

            // 2. Filtro por termo de busca (se houver)
            if (searchTerm) {
                const titleMatch = item.title?.toLowerCase().includes(searchTerm);
                const urlMatch = item.url?.toLowerCase().includes(searchTerm);
                const resultMatch = item.resultText?.toLowerCase().includes(searchTerm);
                return titleMatch || urlMatch || resultMatch;
            }

            return true; // Se não houver termo de busca, passa
        });

        ui.renderHistory(filtered, onHistoryClick);
    };


    const handleNavigation = (tabName) => {
        ui.switchTab(tabName);
        chrome.storage.local.set({ lastActiveTab: tabName });

        let applyCompact = false;
        if (tabName === 'analysis' && document.getElementById('analysisResultContainer').classList.contains('hidden')) {
            applyCompact = true;
        }
        if (tabName === 'imageAnalysis') {
            const previewContainer = document.getElementById('imagePreviewContainer');
            const resultContainer = document.getElementById('imageAnalysisResult');
            if (previewContainer.classList.contains('hidden') && !resultContainer.dataset.hasContent) {
                applyCompact = true;
            }
        }

        if (applyCompact) {
            document.body.classList.add('compact');
        } else {
            document.body.classList.remove('compact');
        }

        if (tabName === 'home') loadHomepageData();
        if (tabName === 'history') {
            storage.getHistory().then(history => {
                currentHistory = history;
                applyHistoryFilters(); // Usa a nova função para renderizar
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
        document.body.classList.add('compact');
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
            if (error.message.includes('API key not valid')) {
                ui.updateConfigStatus('Chave de API inválida. Verifique suas configurações.', 'error');
                ui.displayAnalysisResults('Falha na análise devido a uma chave de API inválida. Por favor, acesse a aba de Configurações para corrigi-la.', true, false);
            } else if (error.message.includes('QUOTA_EXCEEDED')) {
                // Nova condição para o erro de cota
                ui.displayAnalysisResults('O limite diário de análises foi atingido. Por favor, tente novamente amanhã.', true, false);
            } else {
                ui.displayAnalysisResults(`Erro na análise: ${error.message}`, true, false);
            }
        }
    };

    const handleAutoSaveSettings = async () => {
        const settings = {
            geminiApiKey: elements.settings.geminiApiKey.value.trim(),
            customSearchApiKey: elements.settings.customSearchApiKey.value.trim(),
            searchEngineId: elements.settings.searchEngineId.value.trim(),
            userName: elements.settings.userName.value.trim(),
        };
        try {
            await storage.saveSettings(settings);
        } catch (e) {
            console.error('Erro ao auto-salvar configurações:', e.message);
        }
    };

    const handleSaveSettings = async () => {
        try {
            await handleAutoSaveSettings();
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
                    currentHistory = history; // Atualiza a variável local
                    if (document.getElementById('historySection').classList.contains('active')) {
                        applyHistoryFilters(); // Re-renderiza a lista
                    }
                    // SUBSTITUIÇÃO DO ALERT
                    ui.updateConfigStatus('Histórico importado com sucesso!', 'success');
                } else { throw new Error('Formato de arquivo inválido.'); }
            } catch (error) {
                // SUBSTITUIÇÃO DO ALERT DE ERRO
                ui.updateConfigStatus(`Erro ao importar: ${error.message}`, 'error');
            }
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

    elements.settings.geminiApiKey.addEventListener('change', handleAutoSaveSettings);
    elements.settings.customSearchApiKey.addEventListener('change', handleAutoSaveSettings);
    elements.settings.searchEngineId.addEventListener('change', handleAutoSaveSettings);
    elements.settings.userName.addEventListener('change', handleAutoSaveSettings);

    elements.history.filterAll.addEventListener('click', () => {
        currentFilter = 'all';
        applyHistoryFilters();
        setActiveFilterButton('filterAll');
    });
    elements.history.filterText.addEventListener('click', () => {
        currentFilter = 'text';
        applyHistoryFilters();
        setActiveFilterButton('filterText');
    });
    elements.history.filterImages.addEventListener('click', () => {
        currentFilter = 'image';
        applyHistoryFilters();
        setActiveFilterButton('filterImages');
    });

    // ADICIONADO: Event listener para o campo de busca
    elements.history.searchInput.addEventListener('input', applyHistoryFilters);

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
        document.body.classList.add('compact');
        ui.switchTab('analysis');
        try {
            ui.displayAnalysisResults("Extraindo conteúdo para reanálise...", false, true);
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: "getArticle" });
            currentAnalysisParams.content = response.article;
            performAnalysis(currentAnalysisParams);
        } catch (e) {
            ui.displayAnalysisResults("Falha ao obter conteúdo para reanálise.", true);
        }
    });

    elements.modals.modalClose.addEventListener('click', closeTutorialModal);
    elements.tutorials.gemini.addEventListener('click', () => openTutorialModal('gemini'));
    elements.tutorials.customSearch.addEventListener('click', () => openTutorialModal('customSearch'));
    elements.tutorials.cxId.addEventListener('click', () => openTutorialModal('cxId'));

    const processImageFile = (file) => {
        if (file && file.type.startsWith('image/')) {
            imageFile = file;
            ui.showImagePreview(file);
            elements.imageAnalysis.analyzeButton.disabled = false;
        }
    };

    elements.imageAnalysis.selectFileButton.addEventListener('click', (event) => {
        event.stopPropagation();
        elements.imageAnalysis.upload.click();
    });

    elements.imageAnalysis.upload.addEventListener('change', (event) => {
        processImageFile(event.target.files[0]);
    });

    elements.imageAnalysis.uploadArea.addEventListener('click', () => {
        elements.imageAnalysis.upload.click();
    });

    elements.imageAnalysis.uploadArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    });

    elements.imageAnalysis.uploadArea.addEventListener('dragleave', (event) => {
        event.currentTarget.classList.remove('drag-over');
    });

    elements.imageAnalysis.uploadArea.addEventListener('drop', (event) => {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        processImageFile(event.dataTransfer.files[0]);
    });

    document.addEventListener('paste', (event) => {
        if (elements.sections.imageAnalysis.classList.contains('active')) {
            const items = (event.clipboardData || event.originalEvent.clipboardData).items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    processImageFile(file);
                    break;
                }
            }
        }
    });

    elements.imageAnalysis.removeImageButton.addEventListener('click', () => {
        ui.hideImagePreview();
        imageFile = null;
        elements.imageAnalysis.upload.value = '';
        elements.imageAnalysis.analyzeButton.disabled = true;
    });

    elements.imageAnalysis.analyzeButton.addEventListener('click', async () => {
        if (!imageFile) return;

        ui.displayImageAnalysisResults("Analisando imagem...", false, true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const base64Data = event.target.result.split(',')[1];
                const imageData = { type: imageFile.type, data: base64Data };
                const allData = await storage.getAllData();
                const result = await analyzeImage(imageData, allData, (status) => {
                    ui.displayImageAnalysisResults(status, false, true);
                });
                ui.displayImageAnalysisResults(result, false, false);
            } catch (error) {
                if (error.message.includes('API key not valid')) {
                    ui.updateConfigStatus('Chave de API inválida. Verifique suas configurações.', 'error');
                    ui.displayImageAnalysisResults(
                        'Falha na análise devido a uma chave de API inválida. Por favor, acesse a aba de Configurações para corrigi-la.',
                        true,
                        false
                    );
                } else {
                    ui.displayImageAnalysisResults(`Erro na análise: ${error.message}`, true, false);
                }
            }
        };
        reader.readAsDataURL(imageFile);
    });

    const init = async () => {
        const data = await storage.getAllData();
        const hasApiKeys = data[STORAGE_KEYS.GEMINI_API_KEY] && data[STORAGE_KEYS.CUSTOM_SEARCH_API_KEY] && data[STORAGE_KEYS.SEARCH_ENGINE_ID];
        const savedTabData = await chrome.storage.local.get('lastActiveTab');
        const lastTab = savedTabData.lastActiveTab;

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
        fakeNewsCount: history.filter(item => {
            try {
                const res = JSON.parse(item.resultText);
                return res.pontuacaoGeral <= FAKE_NEWS_THRESHOLD;
            } catch {
                return extractPercentage(item.resultText) <= FAKE_NEWS_THRESHOLD;
            }
        }).length,
        curiosity: curiosity,
        lastEntry: history.length > 0 ? history[0] : null
    });
}
