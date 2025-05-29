require("dotenv").config();
const { collectExternalEvidence } = require("./googleNewsSearch");

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 3000;
const GEMINI_API_KEY = process.env.API_KEY;

app.use(express.json());
app.use(cors());

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

const SAVE_DIR = path.join(__dirname, "captured_pages");
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR);

const SUBFOLDERS = ["initial", "low_truth_chance", "high_truth_chance"];
for (const folder of SUBFOLDERS) {
    const subPath = path.join(SAVE_DIR, folder);
    if (!fs.existsSync(subPath)) fs.mkdirSync(subPath);
}

function extractChanceOfFalse(responseText) {
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
    const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() é 0-indexado
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    // para segundos:
    // const seconds = String(now.getSeconds()).padStart(2, '0');
    // return `${day}-${month}-${year}-${hours}_${minutes}_${seconds}`;

    return `${day}-${month}-${year}-${hours}_${minutes}`; // Formato DD-MM-YYYY-HH_MM
}

app.post("/scrape", async (req, res) => {
    const { url, content: originalContent } = req.body;
    const currentDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    if (!url || !originalContent) {
        return res.status(400).json({ error: "URL ou conteúdo ausente." });
    }

    const titleLine = originalContent.split("\n")[0].trim();
    let initialExternalEvidence = [];
    try {
        initialExternalEvidence = await collectExternalEvidence(titleLine);
    } catch (err) {
        console.error("Erro ao consultar Google CSE (inicial):", err.message);
    }

    const initialEvidenceText = initialExternalEvidence.length
        ? initialExternalEvidence.map(e => {
            const confiavelLabel = e.isTrusted ? "[FONTE CONFIÁVEL]" : "[OUTRA FONTE]";
            return `${confiavelLabel}\nTítulo: ${e.title}\nLink: ${e.link}\nResumo: ${e.snippet}`;
        }).join("\n\n")
        : "Nenhuma fonte externa inicial foi localizada.";

    const firstAnalysisPrompt = `
Você é um especialista em checagem de fatos. Sua função é analisar notícias e determinar a probabilidade de serem verdadeiras.
Você irá receber o conteúdo da página.

- A data atual é "${currentDate}". Considere seu conhecimento limitado sobre eventos muito recentes.
- Sua análise deve ter no máximo 240 caracteres.
- Dê uma porcentagem estimada de chance de ser verdadeiro. Se for mais de 95%, arredonde para 100%. (Ex: "Chance de ser verdadeiro: 70%")
- Se o texto extraído claramente não for uma notícia, retorne: "Insira uma página de notícia válida, por favor."
- Explique o porquê da notícia ser considerada falsa ou verdadeira.
- Não utilize caracteres especiais não usuais.

Notícia original (primeiros 1000 caracteres):
"${originalContent.substring(0, 1000)}"

Fontes externas para comparação:
${initialEvidenceText}
    `;

    let finalResponseText;
    let savedFilePath = path.join(SAVE_DIR, "initial", `gemini_payload_initial_${getFormattedTimestamp()}.json`);
    
    fs.writeFileSync(savedFilePath, JSON.stringify({ url, originalContent, initialExternalEvidence, prompt: firstAnalysisPrompt }, null, 2), "utf8");

    try {
        console.log("Realizando primeira análise com Gemini...");
        const firstResult = await model.generateContent(firstAnalysisPrompt);
        let firstResponseText = firstResult.response.text();
        console.log("RAW Resposta da primeira análise:", JSON.stringify(firstResponseText));

        const chance = extractChanceOfFalse(firstResponseText);
        console.log("Chance extraída:", chance);

        if (chance !== null && chance <= 40) {
            console.log(`Chance <= 40 (${chance}%). Iniciando segunda etapa para identificar incongruência.`);
            const getIncongruityPrompt = `
A análise anterior da notícia abaixo indicou uma probabilidade de ${chance}% de ser verdadeira.
Notícia Original:
"${originalContent.substring(0, 1000)}"

Por favor, identifique e retorne APENAS o principal fato, alegação ou termo específico DENTRO DA "Notícia Original" que é o ponto central dessa suspeita e que poderia ser usado como um termo de busca curto (máximo 7 palavras) para verificar sua veracidade ou encontrar mais informações. Retorne APENAS o termo de busca.
Se a suspeita for geral ou não houver um termo específico pesquisável, retorne "N/A".
            `;
            
            const incongruityPromptFilePath = path.join(SAVE_DIR, "low_truth_chance", `gemini_payload_incongruity_prompt_${getFormattedTimestamp()}.json`);
            fs.writeFileSync(incongruityPromptFilePath, JSON.stringify({ prompt: getIncongruityPrompt }, null, 2), "utf8");
            
            console.log("Solicitando termo de incongruência ao Gemini...");
            const incongruityResult = await model.generateContent(getIncongruityPrompt);
            let searchableIncongruity = incongruityResult.response.text().trim();
            searchableIncongruity = searchableIncongruity.replace(/^["']|["']$/g, "");
            console.log("Termo de incongruência recebido:", searchableIncongruity);

            if (searchableIncongruity.toLowerCase() !== "n/a" && searchableIncongruity.length > 0) {
                let incongruityEvidenceResults = [];
                try {
                    console.log(`Buscando evidências para a incongruência: "${searchableIncongruity}"...`);
                    incongruityEvidenceResults = await collectExternalEvidence(searchableIncongruity);
                } catch (err) {
                    console.error("Erro ao consultar Google CSE (incongruência):", err.message);
                }

                const incongruityEvidenceText = incongruityEvidenceResults.length
                    ? incongruityEvidenceResults.map(e => {
                        const confiavelLabel = e.isTrusted ? "[FONTE CONFIÁVEL]" : "[OUTRA FONTE]";
                        return `${confiavelLabel}\nTítulo: ${e.title}\nLink: ${e.link}\nResumo: ${e.snippet}`;
                    }).join("\n\n")
                    : "Nenhuma fonte externa adicional foi localizada para a incongruência investigada.";

                const reAnalysisPrompt = `
REAVALIAÇÃO DE NOTÍCIA.
Uma análise inicial desta notícia indicou ${chance}% de chance de ser verdadeiro.
Foi identificado o seguinte ponto para investigação adicional: "${searchableIncongruity}".
Uma nova busca foi realizada sobre este ponto.

Sua tarefa é REAVALIAR a notícia original considerando TODAS as fontes de evidência: as fontes externas iniciais E as fontes encontradas ao pesquisar o ponto "${searchableIncongruity}".

DIRETRIZES PARA SUA ANALISE:
- A data atual é "${currentDate}". Considere seu conhecimento limitado sobre eventos muito recentes.
- Sua análise deve ter no máximo 240 caracteres.
- Dê uma NOVA porcentagem estimada de chance de ser verdadeiro. Se for mais de 95%, arredonde para 100%. (Ex: "Nova chance de ser verdadeiro: 30%")
- Explique o porquê da notícia ser considerada falsa ou verdadeira, AGORA considerando TODAS as evidências.
- Foque em como a investigação do ponto "${searchableIncongruity}" afetou a análise.

Notícia original:
"${originalContent.substring(0, 1000)}"

Fontes externas INICIAIS (sobre o título da notícia):
${initialEvidenceText}

Fontes externas ADICIONAIS (encontradas sobre o ponto investigado "${searchableIncongruity}"):
${incongruityEvidenceText}

Com base em TUDO isso, sua nova análise concisa e porcentagem:
                `;
                
                // savedFilePath é atualizado AQUI, antes de salvar o payload da reanálise.
                savedFilePath = path.join(SAVE_DIR, "low_truth_chance", `gemini_payload_reanalysis_${getFormattedTimestamp()}.json`);
                fs.writeFileSync(savedFilePath, JSON.stringify({ url, originalContent, initialExternalEvidence, incongruityEvidenceResults, prompt: reAnalysisPrompt }, null, 2), "utf8");

                console.log("Realizando reanálise com Gemini...");
                const finalResult = await model.generateContent(reAnalysisPrompt);
                finalResponseText = finalResult.response.text();
                console.log("RAW Resposta da reanálise:", JSON.stringify(finalResponseText));
            } else { // Este é o else do if (searchableIncongruity.toLowerCase() !== "n/a" ...)
                console.log("Nenhum termo de incongruência pesquisável retornado ou N/A. Usando a primeira análise com ressalva.");
                finalResponseText = `Análise inicial indicou ${chance}% de chance de ser verdadeira, mas não foi possível identificar um ponto específico para nova busca. Resposta inicial: ${firstResponseText}`;
                // savedFilePath permanece o 'initial' já que estamos usando firstResponseText
            }
        } 
        else if (chance !== null && chance <= 90) { 
            console.log(`Chance >= 90 (${chance}%). Iniciando etapa para buscar confirmação do fato mais verdadeiro.`);
            const getTruestFactPrompt = `
A análise anterior da notícia abaixo indicou uma probabilidade muito alta (${chance}%) de ser verdadeira, sugerindo que é provavelmente falso.
Notícia Original:
"${originalContent.substring(0, 1000)}"

Por favor, identifique e retorne APENAS o principal fato, alegação ou termo específico DENTRO DA "Notícia Original" que você considera o MAIS VERDADEIRO e central para a notícia, e que poderia ser usado como um termo de busca curto (máximo 7 palavras) para encontrar mais informações de suporte. Retorne como forma de pergunta o contrário do fato.
Se não houver um fato específico claramente destacável, retorne "N/A".
Exemplo de noticia "O papa está vivo e bem"
Exemplo de retorno "O papa morreu?"
            `;
            
            const truestFactPromptFilePath = path.join(SAVE_DIR, "high_truth_chance", `gemini_payload_truestfact_prompt_${getFormattedTimestamp()}.json`);
            fs.writeFileSync(truestFactPromptFilePath, JSON.stringify({ prompt: getTruestFactPrompt }, null, 2), "utf8");

            console.log("Solicitando termo do fato mais verdadeiro ao Gemini...");
            const truestFactResult = await model.generateContent(getTruestFactPrompt);
            let searchableTruestFact = truestFactResult.response.text().trim();
            searchableTruestFact = searchableTruestFact.replace(/^["']|["']$/g, ""); 
            console.log("Termo do fato mais verdadeiro recebido:", searchableTruestFact);

            if (searchableTruestFact.toLowerCase() !== "n/a" && searchableTruestFact.length > 0) {
                let truestFactEvidenceResults = [];
                try {
                    console.log(`Buscando evidências para o fato mais verdadeiro: "${searchableTruestFact}"...`);
                    truestFactEvidenceResults = await collectExternalEvidence(searchableTruestFact);
                } catch (err) {
                    console.error("Erro ao consultar Google CSE (fato mais verdadeiro):", err.message);
                }

                const truestFactEvidenceText = truestFactEvidenceResults.length
                    ? truestFactEvidenceResults.map(e => {
                        const confiavelLabel = e.isTrusted ? "[FONTE CONFIÁVEL]" : "[OUTRA FONTE]";
                        return `${confiavelLabel}\nTítulo: ${e.title}\nLink: ${e.link}\nResumo: ${e.snippet}`;
                    }).join("\n\n")
                    : "Nenhuma fonte externa adicional foi localizada para o fato investigado.";

                const reConfirmationPrompt = `
RECONFIRMAÇÃO DE NOTÍCIA.
Uma análise inicial desta notícia indicou uma baixa probabilidade (${chance}%) de ser verdadeira, sugerindo ser verdadeira.
Foi identificado o seguinte fato central para busca de mais confirmação: "${searchableTruestFact}".
Uma nova busca foi realizada sobre este ponto.

Sua tarefa é REAVALIAR a notícia original, considerando TODAS as fontes de evidência: as fontes externas iniciais E as fontes encontradas ao pesquisar o fato "${searchableTruestFact}".
O objetivo é confirmar ou refinar a análise inicial.

- Data atual é "${currentDate}"
- Considere seu conhecimento limitado sobre eventos muito recentes.

DIRETRIZES PARA SUA REAVALIAÇÃO (máximo 240 caracteres):
1. Dê uma NOVA porcentagem estimada de chance de ser verdadeiro (deve permanecer baixa, idealmente 0% a ${chance}%, se a confirmação for forte). (Ex: "Nova chance de ser verdadeiro: 5%")
2. Explique brevemente como a evidência adicional sobre "${searchableTruestFact}" suporta ou reforça a veracidade da notícia. Se a evidência adicional não for conclusiva ou não mudar a análise, apenas reitere a confiança.

Notícia original:
"${originalContent.substring(0, 1000)}"

Fontes externas INICIAIS (sobre o título da notícia):
${initialEvidenceText}

Fontes externas ADICIONAIS (encontradas sobre o fato central "${searchableTruestFact}"):
${truestFactEvidenceText}

Com base em TUDO isso, sua nova análise concisa e porcentagem:
                `;
                
                savedFilePath = path.join(SAVE_DIR, "high_truth_chance", `gemini_payload_reconfirmation_${getFormattedTimestamp()}.json`);
                fs.writeFileSync(savedFilePath, JSON.stringify({ url, originalContent, initialExternalEvidence, truestFactEvidenceResults, prompt: reConfirmationPrompt }, null, 2), "utf8");
                
                console.log("Realizando reanálise de confirmação com Gemini...");
                const finalConfirmationResult = await model.generateContent(reConfirmationPrompt);
                finalResponseText = finalConfirmationResult.response.text();
                console.log("RAW Resposta da reanálise de confirmação:", JSON.stringify(finalResponseText));
            } else {
                console.log("Nenhum termo de fato mais verdadeiro pesquisável retornado ou N/A. Usando a primeira análise.");
                finalResponseText = firstResponseText; 
            }
        } 
        else {
            if (chance === null) {
                console.log("Chance não pôde ser extraída. Usando a primeira análise.");
            } else {
                console.log(`Chance entre 10% e 59% (${chance}%). Usando a primeira análise.`);
            }
            finalResponseText = firstResponseText;
        }
        
        // Limpeza do finalResponseText para remover ponto inicial ou espaços extras
        if (finalResponseText) {
            let cleanedText = String(finalResponseText).trim(); 
            const leadingDotPattern = /^\s*\.\s*/; 
            if (leadingDotPattern.test(cleanedText)) {
                cleanedText = cleanedText.replace(leadingDotPattern, "");
            }
            finalResponseText = cleanedText.trim(); 
            console.log("Texto final limpo para resposta JSON:", JSON.stringify(finalResponseText));
        } else {
            finalResponseText = "Erro: Não foi possível obter uma resposta da análise.";
            console.warn("finalResponseText estava indefinido antes de enviar a resposta JSON.");
        }
        
        res.json({ response: finalResponseText, savedFile: savedFilePath });

    } catch (error) {
        console.error("Erro no fluxo de análise do Gemini:", error.message, error.stack);
        let errorResponse = { error: "Erro ao gerar análise com Gemini.", details: error.message };
        if (savedFilePath && fs.existsSync(savedFilePath)) {
            errorResponse.savedFileIfError = savedFilePath;
        } else if (savedFilePath) {
            errorResponse.attemptedToSaveTo = savedFilePath;
        }
        res.status(500).json(errorResponse);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
