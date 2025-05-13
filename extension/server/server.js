require("dotenv").config();

const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

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
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: "Nenhuma URL foi fornecida." });
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const pageContent = await page.evaluate(() => document.body.innerText);
        await browser.close();

        const filePath = path.join(SAVE_DIR, `pagina_capturada_${Date.now()}.txt`);
        fs.writeFileSync(filePath, pageContent, "utf8");

        const analysisPrompt = `
        Você é um especialista em checagem de fatos. Sua função é analisar notícias e determinar a probabilidade de serem falsas.
        voce irá receber o conteudo absoluto da página, faça uma filtragem para saber qual é o conteudo real da noticia e não outras noticias paralelas, sempre diga o titulo da noticia.

        - analise ser somente ser 240 caracteres
        - não utilize caracteres especiais
        - Dê uma porcentagem estimada de chance de ser falso.

        - Leia atentamente o seguinte texto extraído da página:
        "${pageContent.substring(0, 1000)}"
        `;

        const result = await model.generateContent(analysisPrompt);
        const responseText = result.response.text();
        res.json({ response: responseText, savedFile: filePath });
    } catch (error) {
        console.error("Erro ao processar scraping:", error);
        res.status(500).json({ error: "Erro ao capturar conteúdo da página." });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
