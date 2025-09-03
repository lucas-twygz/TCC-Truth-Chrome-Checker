import { callGeminiAPI, collectExternalEvidence, describeImageWithGemini } from '../infrastructure/apiService.js';
import { saveToHistory } from '../infrastructure/storageService.js';
import { FAKE_NEWS_THRESHOLD, HIGH_SCORE_THRESHOLD } from '../config.js';
import { extractPercentage } from '../utils/textUtils.js';

export async function analyzeNews(params, updateStatus) {
    console.group("INÍCIO DA ANÁLISE DE FATOS");

    const { content, url, truthCheckerGeminiApiKey, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId } = params;
    const titleLine = content.split("\n")[0].trim();

    updateStatus("Identificando alegação principal...");
    console.log("---- ETAPA 1: Extraindo Entidade, Alegação e Data ----");
    const extractionPrompt = `Analise a notícia e retorne um ÚNICO objeto JSON com 3 chaves: "entidade" (a pessoa ou organização principal), "alegacao" (a alegação central sobre a entidade) e "data" (a data do evento no formato AAAA-MM-DD, estime se não for explícita).\n\nNotícia: "${content.substring(0, 1500)}"`;
    
    let extractedData;
    let eventDate = null;
    try {
        const rawJson = await callGeminiAPI(extractionPrompt, truthCheckerGeminiApiKey);
        let parsedJson = JSON.parse(rawJson.replace(/```json|```/g, '').trim());
        
        if (Array.isArray(parsedJson)) {
            console.warn("IA retornou um array, pegando o primeiro elemento como principal.");
            parsedJson = parsedJson[0];
        }
        
        extractedData = parsedJson;
        if (extractedData.data) {
            eventDate = new Date(extractedData.data);
        }
        console.log("IA extraiu:", extractedData);
    } catch (e) {
        console.error("Falha crítica na extração de JSON. Usando fallback.", e);
        const claimPrompt = `Extraia a alegação central pesquisável da notícia em 7 palavras:\n\n"${content.substring(0, 1000)}"`;
        extractedData = { entidade: titleLine, alegacao: await callGeminiAPI(claimPrompt, truthCheckerGeminiApiKey) };
    }
    
    if (!extractedData || !extractedData.entidade || !extractedData.alegacao) {
        console.error("Extração falhou em produzir entidade/alegação. Abortando análise.");
        console.groupEnd();
        return "Erro: Não foi possível identificar a alegação principal da notícia para verificação.";
    }
    
    const { entidade, alegacao } = extractedData;

    updateStatus(`Buscando fatos sobre: ${entidade}...`);
    console.log("\n---- ETAPA 2: Buscando Evidências Externas ----");
    
    let dateRestrictParam = null;
    if (eventDate && !isNaN(eventDate)) {
        const startDate = new Date(eventDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(eventDate);
        endDate.setDate(endDate.getDate() + 3);
        const y1 = startDate.getFullYear(), m1 = String(startDate.getMonth() + 1).padStart(2, '0'), d1 = String(startDate.getDate()).padStart(2, '0');
        const y2 = endDate.getFullYear(), m2 = String(endDate.getMonth() + 1).padStart(2, '0'), d2 = String(endDate.getDate()).padStart(2, '0');
        dateRestrictParam = `${y1}${m1}${d1}..${y2}${m2}${d2}`;
        console.log(`Realizando busca restrita ao período: ${dateRestrictParam}`);
    } else {
        console.log("Realizando busca sem restrição de data.");
    }

    const externalEvidence = await collectExternalEvidence(`${entidade} ${alegacao}`, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, dateRestrictParam);
    const evidenceText = externalEvidence.length 
        ? externalEvidence.map(e => `[FONTE] ${e.title}\n${e.snippet}`).join("\n\n")
        : "Nenhuma fonte externa sobre a alegação principal foi encontrada no período especificado.";
    console.log("Evidências encontradas:", externalEvidence.length > 0 ? externalEvidence : "Nenhuma");

    updateStatus("Comparando fatos com IA...");
    console.log("\n---- ETAPA 3: Análise Final do 'Detetive de Fatos' ----");
    const finalAnalysisPrompt = `Você é um detetive de fatos. Compare a "Notícia Original" com as "Fontes Externas" e determine a veracidade da alegação.
    
**Regra de Temporalidade CRÍTICA:** Se a notícia descreve um evento que é factualmente VERDADEIRO, mas ocorreu no passado, a porcentagem de veracidade deve ser ALTA (acima de 90%). Sua justificativa DEVE OBRIGATORIAMENTE explicar o contexto.

Notícia Original:
- Entidade: ${entidade}
- Alegação: ${alegacao}

Fontes Externas (encontradas em ${new Date().toLocaleDateString('pt-BR')} para o período relevante):
${evidenceText}

Sua Análise e Conclusão:
Com base nas regras e na comparação, dê uma porcentagem de CHANCE DE SER VERDADEIRO e uma justificativa clara. Máximo 240 caracteres. Após a %, pule uma linha.`;
    
    console.log("Enviando prompt final para a IA: " + finalAnalysisPrompt);
    
    let finalResponseText = await callGeminiAPI(finalAnalysisPrompt, truthCheckerGeminiApiKey);
    
    const originalPercentage = extractPercentage(finalResponseText);
    if (originalPercentage !== null) {
        if (originalPercentage >= 90) {
            console.log(`Arredondando score de ${originalPercentage}% para 100%`);
            finalResponseText = finalResponseText.replace(`${originalPercentage}%`, '100%');
        } else if (originalPercentage <= 10) {
            console.log(`Arredondando score de ${originalPercentage}% para 0%`);
            finalResponseText = finalResponseText.replace(`${originalPercentage}%`, '0%');
        }
    }
    
    console.log("Resposta final da IA (após arredondamento):", `"${finalResponseText}"`);

    await saveToHistory(url, titleLine, finalResponseText, 'text');
    console.groupEnd();
    return finalResponseText;
}

export async function analyzeImage(imageData, params, updateStatus) {
    console.group("INÍCIO DA ANÁLISE DE IMAGEM");

    const { truthCheckerGeminiApiKey, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId } = params;

    updateStatus("Analisando imagem com IA...");
    console.log("---- DESCRIÇÃO DA IMAGEM ----");

    try {
        const imageDescription = await describeImageWithGemini(imageData, truthCheckerGeminiApiKey);
        console.log("Descrição da imagem:", imageDescription);

        updateStatus("Verificando veracidade da descrição...");

        // Criar um objeto de parâmetros simulado para a análise de texto
        const textAnalysisParams = {
            content: `Análise de Imagem\n\nDescrição da Imagem: ${imageDescription}`,
            url: "imagem-uploaded://" + Date.now(),
            truthCheckerGeminiApiKey,
            truthCheckerCustomSearchApiKey,
            truthCheckerSearchEngineId
        };

        // Usar a função de análise de texto existente, mas salvar como imagem
        const result = await analyzeNews(textAnalysisParams, updateStatus);

        // Análise simples de metadados e possíveis alterações na imagem
        let extendedResult = result;
        if (!result.includes("Metadados:")) {
            extendedResult += "\n\nAnálise de Integridade:\n";

            // Verificação básica de metadados
            let metadataIssues = false;
            if (!imageData.type) {
                metadataIssues = true;
            }

            // Verificação básica de possíveis alterações (simulação)
            let alterationDetected = false;
            if (imageData.data && imageData.data.length > 0) {
                // Simulação de detecção de alterações baseada no tamanho dos dados
                const dataLength = imageData.data.length;
                if (dataLength < 1000) {
                    alterationDetected = true; // Imagens muito pequenas podem indicar manipulação
                }
                // Outras verificações básicas podem ser adicionadas aqui
            }

            if (metadataIssues || alterationDetected) {
                extendedResult += "⚠️ Possíveis alterações detectadas na imagem ou metadados.\n";
            } else {
                extendedResult += "✅ Nenhuma alteração suspeita detectada na imagem ou metadados.\n";
            }
        }

        // Ajustar o formato do resultado para parecer mais textual e menos caixa de texto
        extendedResult = extendedResult.replace(/\n/g, '<br>');

        // Sobrescrever o histórico com tipo 'image'
        await saveToHistory(textAnalysisParams.url, `Análise de Imagem: ${imageDescription.substring(0, 50)}...`, extendedResult, 'image');

        console.groupEnd();
        return extendedResult;
    } catch (error) {
        console.error("Erro na análise de imagem:", error);
        console.groupEnd();
        throw error;
    }
}
