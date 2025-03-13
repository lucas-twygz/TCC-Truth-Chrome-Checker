require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 3000;
const API_KEY = process.env.API_KEY;

app.use(express.json());
app.use(cors());

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post("/generate", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Nenhuma notícia foi fornecida." });
    }

    const analysisPrompt = `
    Você é um especialista em checagem de fatos. Sua função é analisar notícias e determinar a probabilidade de serem falsas.
    
    Instruções:
    - analise ser somente ser 200 caracteres
    - não utilize caracteres especiais
    - Leia a notícia atentamente.
    - Pesquise mentalmente por inconsistências e padrões de fake news.
    - Dê uma porcentagem estimada de chance da notícia ser falsa.
    - Justifique brevemente sua resposta.

    NOTÍCIA A SER ANALISADA:
    "${prompt}"

    Responda apenas com a análise e a porcentagem estimada de falsidade.
    `;

    try {
        const result = await model.generateContent(analysisPrompt);
        const responseText = result.response.text();
        
        res.json({ response: responseText });
    } catch (error) {
        console.error("Erro ao gerar resposta:", error);
        res.status(500).json({ error: "Erro ao processar a análise." });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});