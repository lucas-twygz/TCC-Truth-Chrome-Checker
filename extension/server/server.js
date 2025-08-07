require('dotenv').config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const googleNewsSearch = require("./googleNewsSearch");
const { URL } = require('url');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));
app.use(cors());

const SAVE_DIR = path.join(__dirname, "captured_pages");
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR);

const SUBFOLDERS = ["initial", "low_truth_chance_investigation", "high_truth_chance_confirmation"];
for (const folder of SUBFOLDERS) {
    const subPath = path.join(SAVE_DIR, folder);
    if (!fs.existsSync(subPath)) fs.mkdirSync(subPath);
}

const ANALYSIS_CACHE_FILE = path.join(__dirname, "analysis_cache.json");
let analysisCache = {};
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

function normalizeUrlForKey(urlString) {
    try {
        const urlObj = new URL(urlString);
        let pathname = urlObj.pathname;
        if (pathname.length > 1 && pathname.endsWith('/')) {
            pathname = pathname.slice(0, -1);
        }
        const hostname = urlObj.hostname.startsWith('www.') ? urlObj.hostname.substring(4) : urlObj.hostname;
        return `${urlObj.protocol}//${hostname}${pathname}`;
    } catch (e) {
        console.warn("Não foi possível normalizar a URL para chave de cache:", urlString, e.message);
        return urlString;
    }
}

function loadCache() {
    try {
        if (fs.existsSync(ANALYSIS_CACHE_FILE)) {
            const data = fs.readFileSync(ANALYSIS_CACHE_FILE, "utf8");
            analysisCache = JSON.parse(data);
            console.log("Cache de análises carregado.");
        } else {
            analysisCache = {};
            console.log("Nenhum arquivo de cache encontrado, iniciando com cache vazio.");
        }
    } catch (error) {
        console.error("Erro ao carregar o cache de análises:", error);
        analysisCache = {};
    }
}

function saveCache() {
    try {
        fs.writeFileSync(ANALYSIS_CACHE_FILE, JSON.stringify(analysisCache, null, 2), "utf8");
        console.log("Cache de análises salvo.");
    } catch (error) {
        console.error("Erro ao salvar o cache de análises:", error);
    }
}

loadCache();

function extractPercentage(responseText) {
    if (!responseText) return null;
    const chanceMatch = responseText.match(/(\d+)\s*%/);
    if (chanceMatch && chanceMatch[1]) {
        return parseInt(chanceMatch[1], 10);
    }
    return null;
}

function getFormattedTimestamp() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year}-${hours}_${minutes}`;
}

app.post("/scrape", async (req, res) => {
    const { url: originalUrl, content: originalContent, force_reanalyze } = req.body;
    // Carregar chaves das variáveis de ambiente
    const apiKeyGemini = process.env.API_KEY_GEMINI;
    const apiKeyCustomSearch = process.env.API_KEY_CUSTOM_SEARCH;
    const searchEngineId = process.env.SEARCH_ENGINE_ID;
    const titleLine = originalContent.split("\n")[0].trim();
    let initialExternalEvidence = [];
    try {
        initialExternalEvidence = await googleNewsSearch.collectExternalEvidence(titleLine, apiKeyCustomSearch, searchEngineId);
    } catch (err) {
        console.error("Erro ao consultar Google CSE (inicial):", err.message);
    }
    let initialEvidenceText;
    if (initialExternalEvidence && initialExternalEvidence.length > 0) {
        initialEvidenceText = initialExternalEvidence.map(e => {
            const confiavelLabel = e.isTrusted ? '[FONTE CONFIAVEL]' : '[OUTRA FONTE]';
            return confiavelLabel + '\nTitulo: ' + e.title + '\nLink: ' + e.link + '\nResumo: ' + e.snippet;
        }).join("\n\n");
    } else {
        initialEvidenceText = "Nenhuma fonte externa inicial foi localizada.";
    }

    // Prompt para análise
    const firstAnalysisPrompt = `Voce e um especialista em checagem de fatos. Sua funcao e analisar noticias e posts de rede social e determinar a probabilidade de serem VERDADEIRAS.
    // Exemplo: Retorno simples para teste
    return res.json({ status: "analyzed", response: initialEvidenceText });
Você irá receber o conteúdo da página.

- A data atual é "${currentDate}". Considere seu conhecimento limitado sobre eventos muito recentes.
- Sua análise deve ter no máximo 240 caracteres.
- Dê uma porcentagem estimada de CHANCE DE SER VERDADEIRO. Se for mais de 95%, arredonde para 100%. (Ex: "Chance de ser verdadeiro: 70%")
- Se o texto extraído claramente não for uma notícia, retorne: "Insira uma página de notícia válida, por favor."
- Explique o porquê da notícia ser considerada predominantemente falsa ou verdadeira.
- Não utilize caracteres especiais não usuais.
- Após a porcentagem, coloque uma quebra de linha antes de iniciar a explicação.

Notícia original (primeiros 1000 caracteres):
"${originalContent.substring(0, 1000)}"

Fontes externas para comparação:
${initialEvidenceText}
    `;

    let finalResponseText;
    let savedFilePath = path.join(SAVE_DIR, "initial", `gemini_payload_initial_${getFormattedTimestamp()}.json`);
    
    fs.writeFileSync(savedFilePath, JSON.stringify({ url: originalUrl, originalContent, initialExternalEvidence, prompt: firstAnalysisPrompt }, null, 2), "utf8");

    try {
        console.log("Realizando primeira análise com Gemini...");
        const firstResult = await modelInstance.generateContent(firstAnalysisPrompt);
        let firstResponseText = firstResult.response.text();
        console.log("RAW Resposta da primeira análise:", JSON.stringify(firstResponseText));

        const chance = extractPercentage(firstResponseText);
        console.log("Chance de ser VERDADEIRO extraída:", chance);

        if (chance !== null && chance <= 40) {
            console.log(`Chance de ser verdadeiro <= 40% (${chance}%). Investigando ponto de suspeita.`);
            const getSuspicionPointPrompt = `
A análise anterior desta notícia indicou uma baixa probabilidade (${chance}%) de ser verdadeira, levantando suspeitas.
Notícia Original:
"${originalContent.substring(0, 1000)}"

Por favor, identifique e retorne APENAS o principal fato, alegação ou termo específico DENTRO DA "Notícia Original" que causa a MAIOR SUSPEITA ou parece ser o ponto mais frágil/questionável da notícia. Este termo deve ser curto (máximo 7 palavras) e pesquisável para verificação.
Se a suspeita for geral ou não houver um termo específico, retorne "N/A".
            `;
            
            const suspicionPromptFilePath = path.join(SAVE_DIR, "low_truth_chance_investigation", `gemini_payload_suspicion_prompt_${getFormattedTimestamp()}.json`);
            fs.writeFileSync(suspicionPromptFilePath, JSON.stringify({ prompt: getSuspicionPointPrompt }, null, 2), "utf8");
            
            console.log("Solicitando termo de suspeita ao Gemini...");
            const suspicionResult = await modelInstance.generateContent(getSuspicionPointPrompt);
            let searchableSuspicion = suspicionResult.response.text().trim();
            searchableSuspicion = searchableSuspicion.replace(/^["']|["']$/g, "");
            console.log("Termo de suspeita recebido:", searchableSuspicion);

            if (searchableSuspicion.toLowerCase() !== "n/a" && searchableSuspicion.length > 0) {
                let suspicionEvidenceResults = [];
                try {
                    console.log(`Buscando evidências sobre o ponto de suspeita: "${searchableSuspicion}"...`);
                    suspicionEvidenceResults = await googleNewsSearch.collectExternalEvidence(searchableSuspicion, apiKeyCustomSearch, searchEngineId);
                } catch (err) {
                    console.error("Erro ao consultar Google CSE (ponto de suspeita):", err.message);
                }

                const suspicionEvidenceText = suspicionEvidenceResults.length
                    ? suspicionEvidenceResults.map(e => {
                        const confiavelLabel = e.isTrusted ? "[FONTE CONFIÁVEL]" : "[OUTRA FONTE]";
                        return `${confiavelLabel}\nTítulo: ${e.title}\nLink: ${e.link}\nResumo: ${e.snippet}`;
                    }).join("\n\n")
                    : "Nenhuma fonte externa adicional foi localizada para o ponto de suspeita investigado.";

                const reAnalysisForLowTruthPrompt = `
REAVALIAÇÃO DE NOTÍCIA (BAIXA CONFIANÇA INICIAL).
Uma análise inicial indicou ${chance}% de chance de ser verdadeira (baixa confiança).
O ponto de maior suspeita identificado foi: "${searchableSuspicion}".
Uma nova busca foi realizada sobre este ponto.

Sua tarefa é REAVALIAR a notícia original considerando TODAS as fontes: as iniciais E as encontradas sobre o ponto "${searchableSuspicion}".

DIRETRIZES PARA SUA ANALISE:
- A data atual é "${currentDate}".
- Máximo 240 caracteres.
- Dê uma NOVA porcentagem estimada de chance de ser VERDADEIRO.
- Explique sua conclusão (falsa ou verdadeira), AGORA considerando TODAS as evidências.
- Foque em como a investigação do ponto "${searchableSuspicion}" afetou sua análise.
- Após a porcentagem, coloque uma quebra de linha antes de iniciar a explicação.

Notícia original:
"${originalContent.substring(0, 1000)}"
Fontes externas INICIAIS:
${initialEvidenceText}
Fontes externas ADICIONAIS (sobre o ponto de suspeita "${searchableSuspicion}"):
${suspicionEvidenceText}
Com base em TUDO isso, sua nova análise concisa e porcentagem:
                `;
                
                savedFilePath = path.join(SAVE_DIR, "low_truth_chance_investigation", `gemini_payload_reanalysis_${getFormattedTimestamp()}.json`);
                fs.writeFileSync(savedFilePath, JSON.stringify({ url: originalUrl, originalContent, initialExternalEvidence, suspicionEvidenceResults, prompt: reAnalysisForLowTruthPrompt }, null, 2), "utf8");

                console.log("Realizando reanálise (baixa confiança inicial) com Gemini...");
                const finalResult = await modelInstance.generateContent(reAnalysisForLowTruthPrompt);
                finalResponseText = finalResult.response.text();
                console.log("RAW Resposta da reanálise (baixa confiança inicial):", JSON.stringify(finalResponseText));
            } else {
                console.log("Nenhum termo de suspeita pesquisável retornado. Usando a primeira análise com ressalva.");
                finalResponseText = `Análise inicial indicou ${chance}% de chance de ser verdadeira, mas não foi possível identificar um ponto específico para investigação adicional. Resposta inicial:\n${firstResponseText}`;
            }
        } 
        else if (chance !== null && chance >= 90) { 
            console.log(`Chance de ser verdadeiro >= 90% (${chance}%). Buscando confirmação adicional do fato central.`);
            const getStrongestFactPrompt = `
A análise anterior desta notícia indicou uma probabilidade muito alta (${chance}%) de ser verdadeira.
Notícia Original:
"${originalContent.substring(0, 1000)}"

Por favor, identifique e retorne APENAS o principal fato ou alegação DENTRO DA "Notícia Original" que você considera o MAIS CENTRAL e representativo da veracidade da notícia. Este termo deve ser curto (máximo 7 palavras) e pesquisável para encontrar fontes de suporte adicionais.
Se não houver um fato específico claramente destacável, retorne "N/A".
Exemplo de retorno para notícia "Prefeito anuncia novo parque": "anúncio novo parque pelo prefeito"
            `;
            
            const strongestFactPromptFilePath = path.join(SAVE_DIR, "high_truth_chance_confirmation", `gemini_payload_strongestfact_prompt_${getFormattedTimestamp()}.json`);
            fs.writeFileSync(strongestFactPromptFilePath, JSON.stringify({ prompt: getStrongestFactPrompt }, null, 2), "utf8");

            console.log("Solicitando termo do fato mais forte ao Gemini...");
            const strongestFactResult = await modelInstance.generateContent(getStrongestFactPrompt);
            let searchableStrongestFact = strongestFactResult.response.text().trim();
            searchableStrongestFact = searchableStrongestFact.replace(/^["']|["']$/g, ""); 
            console.log("Termo do fato mais forte recebido:", searchableStrongestFact);

            if (searchableStrongestFact.toLowerCase() !== "n/a" && searchableStrongestFact.length > 0) {
                let strongestFactEvidenceResults = [];
                try {
                    console.log(`Buscando evidências para o fato mais forte: "${searchableStrongestFact}"...`);
                    strongestFactEvidenceResults = await googleNewsSearch.collectExternalEvidence(searchableStrongestFact, apiKeyCustomSearch, searchEngineId);
                } catch (err) {
                    console.error("Erro ao consultar Google CSE (fato mais forte):", err.message);
                }

                const strongestFactEvidenceText = strongestFactEvidenceResults.length
                    ? strongestFactEvidenceResults.map(e => {
                        const confiavelLabel = e.isTrusted ? "[FONTE CONFIÁVEL]" : "[OUTRA FONTE]";
                        return `${confiavelLabel}\nTítulo: ${e.title}\nLink: ${e.link}\nResumo: ${e.snippet}`;
                    }).join("\n\n")
                    : "Nenhuma fonte externa adicional foi localizada para o fato investigado.";
                
                const reConfirmationPrompt = `
RECONFIRMAÇÃO DE NOTÍCIA (ALTA CONFIANÇA INICIAL).
Uma análise inicial desta notícia indicou ${chance}% de chance de ser verdadeira (alta confiança).
O fato central identificado para busca de mais confirmação foi: "${searchableStrongestFact}".
Uma nova busca foi realizada sobre este ponto.

Sua tarefa é REAVALIAR a notícia original, considerando TODAS as fontes de evidência. O objetivo é solidificar a confiança na veracidade.

DIRETRIZES PARA SUA REAVALIAÇÃO (máximo 240 caracteres):
1. Dê uma NOVA porcentagem estimada de chance de ser VERDADEIRO (deve permanecer alta ou aumentar, idealmente de ${chance}% a 100%, se a confirmação for forte). (Ex: "Nova chance de ser verdadeiro: 98%")
2. Explique brevemente como a evidência adicional sobre "${searchableStrongestFact}" REFORÇA a veracidade da notícia. Se a evidência adicional não for conclusiva mas não contradisser, mantenha a alta confiança.
- Após a porcentagem, coloque uma quebra de linha antes de iniciar a explicação.

Notícia original:
"${originalContent.substring(0, 1000)}"
Fontes externas INICIAIS:
${initialEvidenceText}
Fontes externas ADICIONAIS (sobre o fato central "${searchableStrongestFact}"):
${strongestFactEvidenceText}
Com base em TUDO isso, sua nova análise concisa e porcentagem:
                `;
                
                savedFilePath = path.join(SAVE_DIR, "high_truth_chance_confirmation", `gemini_payload_reconfirmation_${getFormattedTimestamp()}.json`);
                fs.writeFileSync(savedFilePath, JSON.stringify({ url: originalUrl, originalContent, initialExternalEvidence, strongestFactEvidenceResults, prompt: reConfirmationPrompt }, null, 2), "utf8");
                
                console.log("Realizando reanálise de confirmação (alta confiança inicial) com Gemini...");
                const finalConfirmationResult = await modelInstance.generateContent(reConfirmationPrompt);
                finalResponseText = finalConfirmationResult.response.text();
                console.log("RAW Resposta da reanálise de confirmação (alta confiança inicial):", JSON.stringify(finalResponseText));
            } else {
                console.log("Nenhum termo de fato mais forte pesquisável retornado. Usando a primeira análise.");
                finalResponseText = firstResponseText; 
            }
        } 
        else {
            if (chance === null) {
                console.log("Chance de ser verdadeiro não pôde ser extraída. Usando a primeira análise.");
            } else {
                console.log(`Chance de ser verdadeiro intermediária (${chance}%). Usando a primeira análise.`);
            }
            finalResponseText = firstResponseText;
        }
        
        if (finalResponseText) {
            let cleanedText = String(finalResponseText).trim(); 
            const leadingDotPattern = /^\s*\.\s*/; 
            if (leadingDotPattern.test(cleanedText)) {
                cleanedText = cleanedText.replace(leadingDotPattern, "");
            }
            finalResponseText = cleanedText.trim(); 
            console.log("Texto final limpo para resposta JSON:", JSON.stringify(finalResponseText));
        } else {
            finalResponseText = "Erro: Não foi possível obter uma resposta da análise da IA.";
            console.warn("finalResponseText estava indefinido antes de enviar a resposta JSON, usando mensagem de erro padrão.");
        }
        
        if (finalResponseText && !finalResponseText.toLowerCase().includes("erro:") && !finalResponseText.toLowerCase().includes("insira uma página de notícia válida")) {
            analysisCache[cacheKey] = {
                originalUrl: originalUrl,
                timestamp: new Date().toISOString(),
                response: finalResponseText,
            };
            saveCache();
        }
        
        res.json({ status: "analyzed", response: finalResponseText, savedFile: savedFilePath });

    } catch (error) {
        console.error("Erro no fluxo de análise do Gemini:", error.message, error.stack);
        let errorDetails = error.message;
        let statusCode = 500;
        let clientResponseMessage = "Erro durante a análise com o modelo de IA.";

        if (error.message) {
            const lowerErrorMessage = error.message.toLowerCase();
            if (lowerErrorMessage.includes("api key not valid") || 
                lowerErrorMessage.includes("permission_denied") ||
                lowerErrorMessage.includes("authentication failed") ||
                (lowerErrorMessage.includes("resource has been exhausted") && lowerErrorMessage.includes("api key")) ||
                lowerErrorMessage.includes("api_key_invalid")) {
                clientResponseMessage = "A Chave API Gemini parece estar inválida, sem permissões ou atingiu a cota. Por favor, verifique-a.";
                statusCode = 401;
            } else if (error.status === 400 || lowerErrorMessage.includes("invalid")) {
                 clientResponseMessage = "Requisição inválida para a API Gemini. Pode ser um problema com a chave ou o formato do conteúdo enviado.";
                 statusCode = 400;
            }
        }
        
        let errorResponsePayload = { 
            status: "error", 
            error: "Erro ao gerar análise com Gemini.", 
            details: errorDetails, 
            response: clientResponseMessage 
        };

        if (savedFilePath && fs.existsSync(savedFilePath)) {
            errorResponsePayload.savedFileIfError = savedFilePath;
        } else if (savedFilePath) {
            errorResponsePayload.attemptedToSaveTo = savedFilePath;
        }
        res.status(statusCode).json(errorResponsePayload);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});