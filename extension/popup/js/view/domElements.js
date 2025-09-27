export const elements = {
    // Navegação
    nav: {
        home: document.getElementById('navHome'),
        analysis: document.getElementById('navAnalysis'),
        imageAnalysis: document.getElementById('navImageAnalysis'),
        history: document.getElementById('navHistory'),
        settings: document.getElementById('navSettings'),
    },
    // Seções (Abas)
    sections: {
        home: document.getElementById('homeSection'),
        analysis: document.getElementById('analysisSection'),
        imageAnalysis: document.getElementById('imageAnalysisSection'),
        history: document.getElementById('historySection'),
        settings: document.getElementById('settingsSection'),
    },
    // Homepage
    home: {
        greetingText: document.getElementById('greetingText'),
        weeklyCount: document.getElementById('weeklyCount'),
        lastAnalysisCard: document.getElementById('lastAnalysisCard'),
        gaugeFill: document.getElementById('gaugeFill'),
        gaugePercent: document.getElementById('gaugePercent'),
        lastAnalysisUrl: document.getElementById('lastAnalysisUrl'),
        fakeNewsCount: document.getElementById('fakeNewsCount'),
        curiosityText: document.getElementById('curiosityText'),
    },
    // Análise da Página
    analysis: {
        gaugeBar: document.getElementById('gaugeBar'),
        percentageText: document.getElementById('percentageText'),
        analysisResultText: document.getElementById('analysisResultText'),
    },
   // Análise por Imagem
    imageAnalysis: {
        uploadArea: document.getElementById('uploadArea'),
        selectFileButton: document.getElementById('selectFileButton'),
        upload: document.getElementById('imageUpload'),
        previewContainer: document.getElementById('imagePreviewContainer'),
        preview: document.getElementById('imagePreview'),
        removeImageButton: document.getElementById('removeImageButton'),
        analyzeButton: document.getElementById('analyzeImageButton'),
        result: document.getElementById('imageAnalysisResult'),
    },
    // Botões de Ação
    buttons: {
        startAnalysisHome: document.getElementById('startAnalysisButtonHome'),
        startAnalysisPage: document.getElementById('startAnalysisButtonPage'),
        saveSettings: document.getElementById('saveApiKeysButton'),
        useCachedResult: document.getElementById('useCachedResultButton'),
        reanalyze: document.getElementById('reanalyzeButton'),
        exportHistory: document.getElementById('exportHistoryButton'),
        importHistory: document.getElementById('importHistoryButton'),
    },
    // Configurações
    settings: {
        userName: document.getElementById('userName'),
        geminiApiKey: document.getElementById('geminiApiKey'),
        customSearchApiKey: document.getElementById('customSearchApiKey'),
        searchEngineId: document.getElementById('programmableSearchEngineId'),
        debugModeToggle: document.getElementById('debugModeToggle'),
        importHistoryInput: document.getElementById('importHistoryInput'),
        configStatus: document.getElementById('configStatus'),
    },
    // Histórico
    history: {
        searchInput: document.getElementById('historySearchInput'),
        listContainer: document.getElementById('historyListContainer'),
        filterAll: document.getElementById('filterAll'),
        filterText: document.getElementById('filterText'),
        filterImages: document.getElementById('filterImages'),
    },
    // Modais
    modals: {
        cachePrompt: document.getElementById('cachePromptModal'),
        cachePromptDetails: document.getElementById('cachePromptDetails'),
        tutorial: document.getElementById('tutorialModal'),
        tutorialTitle: document.getElementById('tutorialTitle'),
        tutorialBody: document.getElementById('tutorialBody'),
        modalClose: document.getElementById('modalCloseButton'),
    },
    // Ícones de Tutorial
    tutorials: {
        gemini: document.getElementById('geminiTutorialIcon'),
        customSearch: document.getElementById('customSearchTutorialIcon'),
        cxId: document.getElementById('cxIdTutorialIcon'),
    }
};
