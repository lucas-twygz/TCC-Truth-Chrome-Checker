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
if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR);
}

// Função auxiliar para extrair a porcentagem da resposta do Gemini
function extractChanceOfFalse(responseText) {
    if (!responseText) return null;
    const chanceMatch = responseText.match(/(\d+)\s*%/);
    if (chanceMatch && chanceMatch[1]) {
        return parseInt(chanceMatch[1], 10);
    }
    return null;
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

    const firstAnalysisPrompt =
        `
Você é um especialista em checagem de fatos. Sua função é analisar notícias e determinar a probabilidade de serem falsas.
Você irá receber o conteúdo da página. Identifique o título da notícia ao iniciar sua análise.

- A data atual é "${currentDate}". Considere seu conhecimento limitado sobre eventos muito recentes.
- Sua análise deve ter no máximo 240 caracteres.
- Dê uma porcentagem estimada de chance de ser falso. Se for mais de 95%, arredonde para 100%.
- Se o texto extraído claramente não for uma notícia, retorne: "Insira uma página de notícia válida, por favor."
- Explique o porquê da notícia ser considerada falsa ou verdadeira.
- Não utilize caracteres especiais não usuais.

Notícia original (primeiros 1000 caracteres):
"${originalContent.substring(0, 1000)}"

Fontes externas para comparação:
${initialEvidenceText}
        `;

    let finalResponseText;
    let savedFilePath = path.join(SAVE_DIR, `gemini_payload_initial_${Date.now()}.json`);
    fs.writeFileSync(savedFilePath, JSON.stringify({ url, originalContent, initialExternalEvidence, prompt: firstAnalysisPrompt }, null, 2), "utf8");

    try {
        console.log("Realizando primeira análise com Gemini...");
        const firstResult = await model.generateContent(firstAnalysisPrompt);
        let firstResponseText = firstResult.response.text();
        console.log("Resposta da primeira análise:", firstResponseText);

        const chance = extractChanceOfFalse(firstResponseText);
        console.log("Chance extraída:", chance);

        if (chance !== null && chance >= 60) {
            console.log(`Chance >= 60 (${chance}%). Iniciando segunda etapa para identificar incongruência.`);

            const getIncongruityPrompt =
                `
A análise anterior da notícia abaixo indicou uma probabilidade de ${chance}% de ser falsa.
Notícia Original:
"${originalContent.substring(0, 1000)}"

Por favor, identifique e retorne APENAS o principal fato, alegação ou termo específico DENTRO DA "Notícia Original" que é o ponto central dessa suspeita e que poderia ser usado como um termo de busca curto (máximo 7 palavras) para verificar sua veracidade ou encontrar mais informações. Retorne APENAS o termo de busca.
Se a suspeita for geral ou não houver um termo específico pesquisável, retorne "N/A".
                `;

            fs.writeFileSync(path.join(SAVE_DIR, `gemini_payload_incongruity_prompt_${Date.now()}.json`), JSON.stringify({ prompt: getIncongruityPrompt }, null, 2), "utf8");
            console.log("Solicitando termo de incongruência ao Gemini...");
            const incongruityResult = await model.generateContent(getIncongruityPrompt);
            let searchableIncongruity = incongruityResult.response.text().trim();
            searchableIncongruity = searchableIncongruity.replace(/^\["']|["']$/g, "");
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

                const reAnalysisPrompt =
                    `
REAVALIAÇÃO DE NOTÍCIA.
Uma análise inicial desta notícia indicou ${chance}% de chance de ser falsa.
Foi identificado o seguinte ponto para investigação adicional: "${searchableIncongruity}".
Uma nova busca foi realizada sobre este ponto.

Sua tarefa é REAVALIAR a notícia original considerando TODAS as fontes de evidência: as fontes externas iniciais E as fontes encontradas ao pesquisar o ponto "${searchableIncongruity}".

DIRETRIZES PARA SUA ANALISE:
- A data atual é "${currentDate}". Considere seu conhecimento limitado sobre eventos muito recentes.
- Sua análise deve ter no máximo 240 caracteres.
- Dê uma porcentagem estimada de chance de ser falso. Se for mais de 95%, arredonde para 100%.
- Explique o porquê da notícia ser considerada falsa ou verdadeira.
- Não utilize caracteres especiais não usuais.

Notícia original:
"${originalContent.substring(0, 1000)}"

Fontes externas INICIAIS (sobre o título da notícia):
${initialEvidenceText}

Fontes externas ADICIONAIS (encontradas sobre o ponto investigado "${searchableIncongruity}"):
${incongruityEvidenceText}

Com base em TUDO isso, sua nova análise concisa e porcentagem:
                    `;

                savedFilePath = path.join(SAVE_DIR, `gemini_payload_reanalysis_${Date.now()}.json`);
                fs.writeFileSync(savedFilePath, JSON.stringify({ url, originalContent, initialExternalEvidence, incongruityEvidenceResults, prompt: reAnalysisPrompt }, null, 2), "utf8");

                console.log("Realizando reanálise com Gemini...");
                const finalResult = await model.generateContent(reAnalysisPrompt);
                finalResponseText = finalResult.response.text();
                console.log("Resposta da reanálise:", finalResponseText);

            } else {
                console.log("Nenhum termo de incongruência pesquisável retornado ou N/A. Usando a primeira análise.");
                finalResponseText = `Análise inicial indicou ${chance}% de chance de ser falsa, mas não foi possível identificar um ponto específico para nova busca. Resposta inicial: ${firstResponseText}`;
            }
        } else {
            console.log(`Chance < 60 (${chance === null ? 'não encontrada' : chance + '%' }). Usando a primeira análise.`);
            finalResponseText = firstResponseText;
        }

        res.json({ response: finalResponseText, savedFile: savedFilePath });

    } catch (error) {
        console.error("Erro no fluxo de análise do Gemini:", error);
        res.status(500).json({ error: "Erro ao gerar análise com Gemini.", details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
