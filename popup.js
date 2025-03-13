document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("sendButton").addEventListener("click", sendPrompt);
});

async function sendPrompt() {
    const prompt = document.getElementById("promptInput").value;
    const responseElement = document.getElementById("result");

    if (!prompt) {
        responseElement.textContent = "Por favor, insira uma notícia.";
        return;
    }

    responseElement.textContent = "Carregando...";

    try {
        const res = await fetch("http://localhost:3000/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        const data = await res.json();
        responseElement.textContent = data.response || "Erro ao obter resposta.";
    } catch (error) {
        console.error("Erro:", error);
        responseElement.textContent = "Erro ao conectar com o servidor.";
    }
}
