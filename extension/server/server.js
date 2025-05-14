require("dotenv").config();
const { collectExternalEvidence } = require("./googleNewsSearch");

const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const hoje = new Date();
console.log(hoje);

const app = express();
const PORT = 3000;
const API_KEY = process.env.API_KEY;

app.use(express.json());
app.use(cors());

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

const SAVE_DIR = path.join(__dirname, "captured_pages");
if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR);
}

app.post("/scrape", async (req, res) => {
    const { url, content: originalContent } = req.body;

    if (!url || !originalContent) {
        return res.status(400).json({ error: "URL ou conteúdo ausente." });
    }

    const titleLine = originalContent.split("\n")[0].trim();
    let externalEvidence = [];
    try {
        externalEvidence = await collectExternalEvidence(titleLine);
    } catch (err) {
        console.error("Erro ao consultar Google CSE:", err.message);
    }

    const evidenceText = externalEvidence.length
        ? externalEvidence.map(e => {
            const confiavel = e.isTrusted ? "[FONTE CONFIÁVEL]" : "[OUTRA FONTE]";
            return `${confiavel}\nTítulo: ${e.title}\nLink: ${e.link}\nResumo: ${e.snippet}`;
        }).join("\n\n")
        : "Nenhuma fonte foi localizada.";


    const analysisPrompt = `
        Você é um especialista em checagem de fatos. Sua função é analisar notícias e determinar a probabilidade de serem falsas.
        voce irá receber o conteudo absoluto da página, faça uma filtragem para saber qual é o conteudo real da noticia e não outras noticias paralelas, sempre diga o titulo da noticia.

        - A data atualizada de hoje é "${hoje}" guarde a data para si. Não cite a data a menos que seja realmente relevante. Se for uma noticia de uma data antiga voce ainda deve verificar a veracidade.
        - Analise ser somente até 240 caracteres
        - Dê uma porcentagem estimada de chance de ser falso. Se a chance estimada for mais de "95%" arredonde para 100%.
        - Se o texto extraído não for uma notícia retorne: "Insira uma página válida, por favor."
        - Explique o porquê da notícia ser falsa ou verdadeira.
        - não utilize caracteres especiais

        Notícia original:
        "${originalContent.substring(0, 1000)}"

        Fontes externas para comparação:
        ${evidenceText}
    `;

    const payloadParaGemini = {
        url,
        originalContent,
        externalEvidence,
        prompt: analysisPrompt
    };

    const SAVE_DIR = path.join(__dirname, "captured_pages");
    const jsonPath = path.join(SAVE_DIR, `gemini_payload_${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(payloadParaGemini, null, 2), "utf8");

    try {
        const result = await model.generateContent(analysisPrompt);
        const responseText = result.response.text();
        res.json({ response: responseText, savedFile: jsonPath });
    } catch (error) {
        console.error("Erro ao gerar resposta do Gemini:", error);
        res.status(500).json({ error: "Erro ao gerar análise com Gemini." });
    }
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
