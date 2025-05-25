import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const hoje    = new Date();
const PORT    = 3000;
const API_KEY = process.env.API_KEY;

const app = express();
app.use(express.json());
app.use(cors());

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const SAVE_DIR = path.join(__dirname, "captured_pages");
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR);

app.post("/scrape", async (req, res) => {
  const { url, content: originalContent } = req.body;
  if (!url || !originalContent)
    return res.status(400).json({ error: "URL ou conteúdo ausente." });

  const analysisPrompt = `
    Você é um especialista em checagem de fatos. Sua função é analisar notícias e determinar a probabilidade de serem falsas.
    Você irá receber o conteúdo absoluto da página, faça uma filtragem para saber qual é o conteúdo real da notícia e não outras notícias paralelas, sempre diga o título da notícia.

    - A data atualizada de hoje é "${hoje}". Guarde a data para si. Não cite a data a menos que seja realmente relevante. Se for uma notícia de uma data antiga, você ainda deve verificar a veracidade.
    - A análise deve ter somente até 240 caracteres.
    - Dê uma porcentagem estimada de chance de ser falso. Se a chance estimada for mais de "95%", arredonde para 100%.
    - Se o texto extraído não for uma notícia, retorne: "Insira uma página válida, por favor."
    - Explique o porquê da notícia ser falsa ou verdadeira.
    - Não utilize caracteres especiais.

    Notícia original:
    "${originalContent.substring(0, 1000)}"

    SEMPRE use a internet para verificar a veracidade com base em fontes confiáveis.
  `;

  const request = {
    contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0 }
  };

  try {
    const result = await model.generateContent(request);
    const responseText = result.response.text(); 
    const fontes = result.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

    // logar fontes no terminal
    fontes.forEach((f, i) => console.log(`Fonte ${i + 1}:`, f.web?.uri || f.url));

    res.json({ response: responseText, sources: fontes });
  } catch (err) {
    console.error("Erro ao gerar resposta:", err);
    res.status(500).json({ error: "Falha no Gemini", details: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`Servidor rodando em http://localhost:${PORT}`)
);
