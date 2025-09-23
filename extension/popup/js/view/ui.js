import { elements } from './domElements.js';
import { FAKE_NEWS_THRESHOLD } from '../config.js';
import { extractPercentage } from '../utils/textUtils.js';

export function switchTab(tabName) {
    for (const section of Object.values(elements.sections)) {
        if (section) section.classList.remove('active');
    }
    for (const navButton of Object.values(elements.nav)) {
        if (navButton) navButton.classList.remove('active');
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

    let percentage = null;
    try {
        const resultData = JSON.parse(lastEntry.resultText);
        percentage = resultData.pontuacaoGeral;
    } catch (e) {
        percentage = extractPercentage(lastEntry.resultText);
    }

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

export function showImagePreview(file) {
    document.body.classList.remove('compact');
    const reader = new FileReader();
    reader.onload = (e) => {
        elements.imageAnalysis.preview.src = e.target.result;
    };
    reader.readAsDataURL(file);
    elements.imageAnalysis.uploadArea.style.display = 'none';
    elements.imageAnalysis.previewContainer.classList.remove('hidden');
}

export function hideImagePreview() {
    document.body.classList.add('compact');
    elements.imageAnalysis.uploadArea.style.display = 'block';
    elements.imageAnalysis.previewContainer.classList.add('hidden');
    elements.imageAnalysis.preview.src = '#';
    elements.imageAnalysis.result.innerHTML = '';
}


function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function createMetricCard(metricName, score, text) {
    const sanitizedName = metricName.replace(/\s+/g, '-');
    return `
        <div class="metric-card">
            <h4>${metricName}</h4>
            <div class="metric-bar-container">
                <div class="metric-bar-track">
                    <div class="metric-bar-fill" data-metric="${sanitizedName}"></div>
                </div>
                <span class="metric-percentage">${score}%</span>
            </div>
            <p>${text}</p>
        </div>
    `;
}

export function displayAnalysisResults(responseText, isError = false, inProgress = false) {
    document.body.classList.remove('compact');
    const resultContainer = document.getElementById('analysisResultContainer');
    const placeholder = document.getElementById('analysisPlaceholder');
    const { gaugeBar, percentageText } = elements.analysis;
    const geralSummary = document.getElementById('geralSummary');
    const detailedAnalysis = document.getElementById('detailedAnalysis');
    const sources = document.getElementById('sources');
    const sourcesTitle = document.getElementById('sourcesTitle');

    placeholder.classList.add('hidden');
    resultContainer.classList.remove('hidden');

    if (isError) {
        resultContainer.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.textContent = responseText;
        return;
    }

    if (inProgress) {
        percentageText.textContent = responseText;
        geralSummary.textContent = "Aguarde, processando...";
        gaugeBar.style.setProperty('--bar-width', '100%');
        gaugeBar.style.setProperty('--bar-color', '#7f8c8d');
        detailedAnalysis.innerHTML = '';
        sources.innerHTML = '';
        sourcesTitle.classList.add('hidden');
        return;
    }

    if (!responseText.trim().startsWith('{')) {
        resultContainer.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.textContent = `A API retornou uma resposta inesperada (não-JSON):\n\n"${responseText}"`;
        console.warn("A resposta não era JSON, exibindo como texto puro:", responseText);
        return;
    }

    try {
        const data = JSON.parse(responseText);

        const percentage = data.pontuacaoGeral;
        const mainBarColor = percentage > 0 ? `hsl(${(percentage / 100) * 120}, 70%, 50%)` : '#d3d3d3';
        gaugeBar.style.setProperty('--bar-width', `${percentage}%`);
        gaugeBar.style.setProperty('--bar-color', mainBarColor);
        percentageText.innerHTML = `Pontuação Geral de Confiabilidade: <span class="metric-percentage">${percentage}%</span>`;

        geralSummary.textContent = data.resumoGeral;

        const metricMap = {
            'Veracidade-dos-Fatos': 'fatos',
            'Título-e-Sensacionalismo': 'titulo',
            'Qualidade-das-Fontes': 'fontes'
        };

        detailedAnalysis.innerHTML =
            createMetricCard('Veracidade dos Fatos', data.analiseDetalhada.fatos.score, data.analiseDetalhada.fatos.texto) +
            createMetricCard('Título e Sensacionalismo', data.analiseDetalhada.titulo.score, data.analiseDetalhada.titulo.texto) +
            createMetricCard('Qualidade das Fontes', data.analiseDetalhada.fontes.score, data.analiseDetalhada.fontes.texto);

        Object.keys(metricMap).forEach(metricName => {
            const dataKey = metricMap[metricName];
            const score = data.analiseDetalhada[dataKey].score;
            const element = detailedAnalysis.querySelector(`[data-metric="${metricName.replace(/\s+/g, '-')}"]`);
            if (element) {
                const color = score > 0 ? `hsl(${(score / 100) * 120}, 70%, 50%)` : '#d3d3d3';
                element.style.setProperty('--bar-width', `${score}%`);
                element.style.setProperty('--bar-color', color);
            }
        });

        let sourcesHTML = '';
        const { confirmam, contestam } = data.fontesVerificadas;
        if (confirmam && confirmam.length > 0) {
            sourcesHTML += '<h5>Fontes que Confirmam:</h5>';
            confirmam.forEach(fonte => {
                if (fonte && fonte.url && isValidURL(fonte.url)) {
                    sourcesHTML += `<div class="source-item">✅ <a href="${fonte.url}" target="_blank">${new URL(fonte.url).hostname.replace('www.','')}</a></div>`;
                }
            });
        }
        if (contestam && contestam.length > 0) {
            sourcesHTML += '<h5>Fontes que Contestam:</h5>';
            contestam.forEach(fonte => {
                if (fonte && fonte.url && isValidURL(fonte.url)) {
                    sourcesHTML += `<div class="source-item">❌ <a href="${fonte.url}" target="_blank">${new URL(fonte.url).hostname.replace('www.','')}</a></div>`;
                }
            });
        }

        if (sourcesHTML === '') {
            sourcesTitle.classList.add('hidden');
            sources.innerHTML = '<p style="text-align: center;">Nenhuma fonte externa foi encontrada para verificação.</p>';
        } else {
            sourcesTitle.classList.remove('hidden');
            sources.innerHTML = `<div class="sources-card"><div class="sources-list-container">${sourcesHTML}</div></div>`;
        }

    } catch (e) {
        resultContainer.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.textContent = "Erro ao processar a resposta da análise. Tente novamente.";
        console.error("JSON Parsing Error:", e, "Raw Text:", responseText);
    }
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

        let resultTextPreview = '';
        try {
            const resultData = JSON.parse(item.resultText);
            resultTextPreview = `<b>${resultData.pontuacaoGeral}%</b> - ${resultData.resumoGeral}`;
        } catch (e) {
            resultTextPreview = item.resultText.substring(0, 150) + '...';
        }

        div.innerHTML = `
            <h3 class="history-item-title">${item.title || "Título indisponível"}</h3>
            <div class="history-item-url">${item.url}</div>
            <div class="history-item-date">${new Date(item.timestamp).toLocaleString('pt-BR')}</div>
            <p class="history-item-result">${resultTextPreview}</p>
        `;
        container.appendChild(div);
    });
}

export function showCachePromptModal(cachedEntry) {
    document.body.classList.remove('compact');
    const { cachePrompt, cachePromptDetails } = elements.modals;
    const date = new Date(cachedEntry.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    let preview = "Resultado anterior indisponível.";
    try {
        const data = JSON.parse(cachedEntry.resultText);
        preview = `${data.pontuacaoGeral}% - ${data.resumoGeral}`;
    } catch (e) {
        preview = cachedEntry.resultText.substring(0, 100) + "...";
    }

    cachePromptDetails.textContent = `Analisado em ${date}. Resultado: "${preview}". Deseja usar este resultado ou analisar novamente?`;
    cachePrompt.classList.remove('hidden');
}

export function hideCachePromptModal() {
    elements.modals.cachePrompt.classList.add('hidden');
}

export function displayImageAnalysisResults(responseText, isError = false, inProgress = false) {
    document.body.classList.remove('compact');
    const resultElement = elements.imageAnalysis.result;

    if (isError) {
        resultElement.innerHTML = `<p class="analysis-placeholder" style="color: #e74c3c;">${responseText}</p>`;
        resultElement.dataset.hasContent = 'true';
        return;
    }

    if (inProgress) {
        resultElement.innerHTML = `<p class="analysis-placeholder">${responseText}</p>`;
        return;
    }

    if (!responseText.trim().startsWith('{')) {
        resultElement.innerHTML = `<p class="analysis-placeholder" style="color: #e74c3c;">A API retornou uma resposta inesperada (não-JSON).</p>`;
        resultElement.dataset.hasContent = 'true';
        console.warn("A resposta não era JSON:", responseText);
        return;
    }

    try {
        const data = JSON.parse(responseText);
        resultElement.dataset.hasContent = 'true';

        // Cria a mesma estrutura do painel de análise de texto
        let sourcesHTML = '';
        const { confirmam, contestam } = data.fontesVerificadas;
        if (confirmam && confirmam.length > 0) {
            sourcesHTML += '<h5>Fontes que Confirmam:</h5>';
            confirmam.forEach(fonte => {
                if (fonte && fonte.url && isValidURL(fonte.url)) {
                    sourcesHTML += `<div class="source-item">✅ <a href="${fonte.url}" target="_blank">${new URL(fonte.url).hostname.replace('www.','')}</a></div>`;
                }
            });
        }
        if (contestam && contestam.length > 0) {
            sourcesHTML += '<h5>Fontes que Contestam:</h5>';
            contestam.forEach(fonte => {
                if (fonte && fonte.url && isValidURL(fonte.url)) {
                    sourcesHTML += `<div class="source-item">❌ <a href="${fonte.url}" target="_blank">${new URL(fonte.url).hostname.replace('www.','')}</a></div>`;
                }
            });
        }

        const sourcesBlock = (sourcesHTML !== '')
            ? `<div class="sources-container">
                 <h3 id="sourcesTitle">Fontes Utilizadas</h3>
                 <div class="sources-card"><div class="sources-list-container">${sourcesHTML}</div></div>
               </div>`
            : '';

        resultElement.innerHTML = `
            <p class="percentage-text">Pontuação Geral de Confiabilidade: <span class="metric-percentage">${data.pontuacaoGeral}%</span></p>
            <div class="gauge-container">
                <div class="gauge-bar-track">
                    <div class="gauge-bar-fill" id="imageAnalysisGaugeBar"></div>
                </div>
            </div>
            <p class="geral-summary">${data.resumoGeral}</p>
            <hr class="divider">
            <h3>Análise Detalhada</h3>
            <div class="detailed-analysis-container">
                ${createMetricCard('Veracidade dos Fatos', data.analiseDetalhada.fatos.score, data.analiseDetalhada.fatos.texto)}
                ${createMetricCard('Análise do Contexto', data.analiseDetalhada.titulo.score, data.analiseDetalhada.titulo.texto)}
                ${createMetricCard('Qualidade das Fontes', data.analiseDetalhada.fontes.score, data.analiseDetalhada.fontes.texto)}
            </div>
            ${sourcesBlock}
        `;

        // Pinta a barra principal
        const gaugeBar = document.getElementById('imageAnalysisGaugeBar');
        const percentage = data.pontuacaoGeral;
        const mainBarColor = percentage > 0 ? `hsl(${(percentage / 100) * 120}, 70%, 50%)` : '#d3d3d3';
        gaugeBar.style.setProperty('--bar-width', `${percentage}%`);
        gaugeBar.style.setProperty('--bar-color', mainBarColor);

        // Pinta as barras detalhadas
        const metricMap = { 'Veracidade-dos-Fatos': 'fatos', 'Análise-do-Contexto': 'titulo', 'Qualidade-das-Fontes': 'fontes' };
        Object.keys(metricMap).forEach(metricName => {
            const dataKey = metricMap[metricName];
            const score = data.analiseDetalhada[dataKey].score;
            const element = resultElement.querySelector(`[data-metric="${metricName}"]`);
            if (element) {
                const color = score > 0 ? `hsl(${(score / 100) * 120}, 70%, 50%)` : '#d3d3d3';
                element.style.setProperty('--bar-width', `${score}%`);
                element.style.setProperty('--bar-color', color);
            }
        });

    } catch (e) {
        resultElement.innerHTML = `<div style="color: #e74c3c; font-weight: bold;">Erro ao processar o resultado da análise da imagem.</div>`;
        console.error("Erro ao exibir resultado da imagem:", e);
    }
}
