import { elements } from './domElements.js';
import { FAKE_NEWS_THRESHOLD } from '../config.js';
import { extractPercentage } from '../utils/textUtils.js';

export function switchTab(tabName) {
    for (const section of Object.values(elements.sections)) {
        if(section) section.classList.remove('active');
    }
    for (const navButton of Object.values(elements.nav)) {
        if(navButton) navButton.classList.remove('active');
    }
    if (elements.sections[tabName]) {
        elements.sections[tabName].classList.add('active');
    }
    if (elements.nav[tabName]) {
        elements.nav[tabName].classList.add('active');
    }
}

export function loadSettingsScreenData(data) {
    elements.settings.geminiApiKey.value = data.truthCheckerGeminiApiKey || '';
    elements.settings.customSearchApiKey.value = data.truthCheckerCustomSearchApiKey || '';
    elements.settings.searchEngineId.value = data.truthCheckerSearchEngineId || '';
    elements.settings.userName.value = data.truthCheckerUserName || '';
    elements.settings.debugModeToggle.checked = !!data.truthCheckerDebugModeEnabled;
}

export function updateConfigStatus(message, type) {
    if (elements.settings.configStatus) {
        elements.settings.configStatus.textContent = message;
        elements.settings.configStatus.className = `status-message ${type}`;
    }
}

export function updateHomepage(data) {
    const { userName, weeklyCount, fakeNewsCount, curiosity, lastEntry } = data;
    
    const hour = new Date().getHours();
    let greeting = (hour < 12) ? 'Bom dia,' : (hour < 18) ? 'Boa tarde,' : 'Boa noite,';
    elements.home.greetingText.textContent = userName ? `${greeting} ${userName}.` : greeting.replace(',', '!');

    elements.home.weeklyCount.textContent = weeklyCount;
    elements.home.fakeNewsCount.textContent = fakeNewsCount;
    elements.home.curiosityText.textContent = curiosity;

    updateLastAnalysisCard(lastEntry);
}

function updateLastAnalysisCard(lastEntry) {
    const { gaugeFill, gaugePercent, lastAnalysisUrl } = elements.home;
    
    if (!lastEntry) {
        gaugePercent.textContent = '--%';
        lastAnalysisUrl.textContent = 'Nenhuma análise recente.';
        gaugeFill.style.transform = 'rotate(0deg)';
        gaugeFill.style.backgroundColor = '#ecf0f1';
        return;
    }

    const percentage = extractPercentage(lastEntry.resultText);
    if (percentage !== null) {
        gaugePercent.textContent = `${percentage}%`;
        const degrees = (percentage / 100) * 180;
        gaugeFill.style.transform = `rotate(${degrees}deg)`;
        
        if (percentage <= FAKE_NEWS_THRESHOLD) gaugeFill.style.backgroundColor = 'var(--red-light)';
        else if (percentage < 75) gaugeFill.style.backgroundColor = 'var(--yellow-light)';
        else gaugeFill.style.backgroundColor = 'var(--green-light)';
    } else {
        gaugePercent.textContent = 'N/A';
        gaugeFill.style.transform = 'rotate(0deg)';
        gaugeFill.style.backgroundColor = '#ecf0f1';
    }
    try {
        lastAnalysisUrl.textContent = new URL(lastEntry.url).hostname.replace('www.', '');
    } catch {
        lastAnalysisUrl.textContent = lastEntry.url;
    }
}

export function displayAnalysisResults(responseText, isError = false, inProgress = false) {
    const { gaugeBar, percentageText, analysisResultText } = elements.analysis;
    
    percentageText.classList.remove('hidden');
    analysisResultText.textContent = '';

    if (isError) {
        gaugeBar.style.width = '0%';
        percentageText.textContent = 'Erro na Análise';
        analysisResultText.textContent = responseText;
        return;
    }
    
    if (inProgress) {
        gaugeBar.style.width = '100%';
        gaugeBar.style.backgroundColor = '#7f8c8d';
        percentageText.textContent = responseText;
        analysisResultText.textContent = "Por favor, aguarde...";
        return;
    }

    const percentage = extractPercentage(responseText);
    if (percentage !== null) {
        gaugeBar.style.width = percentage + '%';
        gaugeBar.style.backgroundColor = `hsl(${(percentage/100)*120}, 70%, 50%)`;
        percentageText.textContent = `Probabilidade de ser verdadeiro: ${percentage}%`;
    } else {
        gaugeBar.style.width = '0%';
        percentageText.textContent = 'Análise Concluída';
    }
    
    analysisResultText.textContent = String(responseText).split('\n').slice(1).join('\n').trim() || responseText;
}

export function renderHistory(history, onHistoryItemClick, filter = 'all') {
    const container = elements.history.listContainer;
    container.innerHTML = '';

    const filteredHistory = history.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'text') return item.type === 'text';
        if (filter === 'image') return item.type === 'image';
        return true;
    });

    if (filteredHistory.length === 0) {
        container.textContent = 'Nenhum registro encontrado.';
        return;
    }

    filteredHistory.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.addEventListener('click', () => onHistoryItemClick(item));
        if (item.type === 'image') {
            div.innerHTML = `
                <h3 class="history-item-title">${item.title || "Título indisponível"}</h3>
                <div class="history-item-url">${item.url}</div>
                <div class="history-item-date">${new Date(item.timestamp).toLocaleString('pt-BR')}</div>
                <img src="${item.url}" alt="${item.title || 'Imagem do histórico'}" class="history-item-image" />
                <p class="history-item-result">${item.resultText}</p>
            `;
        } else {
            div.innerHTML = `
                <h3 class="history-item-title">${item.title || "Título indisponível"}</h3>
                <div class="history-item-url">${item.url}</div>
                <div class="history-item-date">${new Date(item.timestamp).toLocaleString('pt-BR')}</div>
                <p class="history-item-result">${item.resultText}</p>
            `;
        }
        container.appendChild(div);
    });
}

export function showCachePromptModal(cachedEntry) {
    const { cachePrompt, cachePromptDetails } = elements.modals;
    const date = new Date(cachedEntry.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    let preview = cachedEntry.resultText || "Resultado anterior indisponível.";
    if (preview.length > 100) preview = preview.substring(0, 100) + "...";
    cachePromptDetails.textContent = `Analisado em ${date}. Resultado: "${preview}". Deseja usar este resultado ou analisar novamente?`;
    cachePrompt.classList.remove('hidden');
}

export function hideCachePromptModal() {
    elements.modals.cachePrompt.classList.add('hidden');
}

export function displayImageAnalysisResults(responseText, isError = false, inProgress = false) {
    const resultElement = elements.imageAnalysis.result;

    if (isError) {
        resultElement.innerHTML = `<div style="color: #e74c3c; font-weight: bold;">Erro: ${responseText}</div>`;
        return;
    }

    if (inProgress) {
        resultElement.innerHTML = `<div style="color: #7f8c8d;">${responseText}</div>`;
        return;
    }

    // Para resultados bem-sucedidos, formatar como na análise de texto
    const percentage = extractPercentage(responseText);
    let formattedResult = responseText;

    if (percentage !== null) {
        const color = percentage <= FAKE_NEWS_THRESHOLD ? '#e74c3c' :
                     percentage < 75 ? '#f39c12' : '#27ae60';
        formattedResult = `<div style="margin-bottom: 10px; font-weight: bold; color: ${color};">
            Probabilidade de ser verdadeiro: ${percentage}%
        </div>${responseText}`;
    }

    resultElement.innerHTML = formattedResult;
}
