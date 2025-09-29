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

    const onHistoryClick = async (item) => {
        // Pega as configurações mais recentes para passar para a UI
        const allData = await storage.getAllData();
        if (item.type === 'image') {
            ui.switchTab('imageAnalysis');
            ui.displayImageAnalysisResults(item.resultText, false, false, allData);
        } else {
            ui.switchTab('analysis');
            ui.displayAnalysisResults(item.resultText, false, false, allData);
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
                ui.renderHistory(currentHistory, onHistoryClick, currentFilter);
            });
        }
    };

    const handleStartAnalysis = async () => {
        const allData = await storage.getAllData();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            ui.switchTab('analysis');
            return ui.displayAnalysisResults("Nenhuma aba ativa encontrada.", true, false, allData);
        }

        const protectedUrls = ["chrome:", "about:", "edge:", "https://chrome.google.com/"];
        if (protectedUrls.some(p => tab.url.startsWith(p)) || tab.url.endsWith(".pdf")) {
            ui.switchTab('analysis');
            return ui.displayAnalysisResults("Não é possível analisar este tipo de página especial (ex: loja de extensões, PDFs, páginas do navegador).", true, false, allData);
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
            ui.displayAnalysisResults("Extraindo conteúdo da página...", false, true, allData);

            const response = await chrome.tabs.sendMessage(tab.id, { action: "getArticle" });

            if (!response || !response.article) {
                return ui.displayAnalysisResults("Não foi possível extrair o conteúdo desta página. Tente em uma notícia com mais texto.", true, false, allData);
            }

            currentAnalysisParams.content = response.article;
            performAnalysis(currentAnalysisParams);

        } catch (error) {
            console.error("Falha na comunicação com o content script:", error);
            ui.displayAnalysisResults("Falha ao comunicar com a página. Por favor, recarregue a extensão e a página e tente novamente.", true, false, allData);
        }
    };

    const performAnalysis = async (params) => {
        try {
            const allData = await storage.getAllData();
            const updateStatus = (status) => ui.displayAnalysisResults(status, false, true, allData);
            const resultText = await analyzeNews(params, updateStatus);
            ui.displayAnalysisResults(resultText, false, false, allData);
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
            expandDetails: elements.settings.expandDetailsToggle.checked
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
    elements.buttons.exportHistory.addEventListener('click', () => storage.getHistory().then(storage.exportHistory));
    elements.buttons.importHistory.addEventListener('click', () => elements.settings.importHistoryInput.click());
    elements.settings.importHistoryInput.addEventListener('change', handleImportHistory);

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

    setActiveFilterButton('filterAll');

    elements.buttons.useCachedResult.addEventListener('click', async () => {
        if (currentCachedData) {
            const allData = await storage.getAllData();
            ui.switchTab('analysis');
            ui.displayAnalysisResults(currentCachedData.resultText, false, false, allData);
        }
        ui.hideCachePromptModal();
    });

    elements.buttons.reanalyze.addEventListener('click', async () => {
        ui.hideCachePromptModal();
        ui.switchTab('analysis');
        try {
            const allData = await storage.getAllData();
            ui.displayAnalysisResults("Extraindo conteúdo para reanálise...", false, true, allData);
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

        const allData = await storage.getAllData();
        ui.displayImageAnalysisResults("Analisando imagem...", false, true, allData);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const base64Data = event.target.result.split(',')[1];
                const imageData = { type: imageFile.type, data: base64Data };
                const result = await analyzeImage(imageData, allData, (status) => {
                    ui.displayImageAnalysisResults(status, false, true, allData);
                });
                ui.displayImageAnalysisResults(result, false, false, allData);
            } catch (error) {
                ui.displayImageAnalysisResults(`Erro na análise: ${error.message}`, true, false, allData);
            }
        };
        reader.readAsDataURL(imageFile);
    });

    const setupCollapsibleBehavior = () => {
        elements.analysis.collapsibleHeader.addEventListener('click', () => {
            elements.analysis.detailedContent.classList.toggle('collapsed');
            elements.analysis.collapsibleHeader.querySelector('.arrow-icon').classList.toggle('collapsed');
        });

        elements.imageAnalysis.result.addEventListener('click', (event) => {
            const header = event.target.closest('.collapsible-header');
            if (header) {
                const content = header.nextElementSibling;
                if (content && content.classList.contains('collapsible-content')) {
                    content.classList.toggle('collapsed');
                    header.querySelector('.arrow-icon').classList.toggle('collapsed');
                }
            }
        });
    };
    setupCollapsibleBehavior();

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
