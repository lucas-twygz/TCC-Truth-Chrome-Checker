require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.API_KEY;
console.log("API_KEY carregada:", API_KEY);

(async () => {
  const genAI = new GoogleGenerativeAI(API_KEY);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Conexão realizada com sucesso!");
  } catch (error) {
    console.error("Erro ao conectar com o modelo:", error.message);
  }
})();
