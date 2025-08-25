const TRUSTED_SOURCES = [
    "bbc.com", "nytimes.com", "theguardian.com", "reuters.com",
    "apnews.com", "cnn.com", "estadao.com.br", "g1.globo.com",
    "globo.com", "oglobo.globo.com", "folha.uol.com.br",
    "uol.com.br", "terra.com.br", "r7.com",
    "veja.abril.com.br", "band.uol.com.br", "cnnbrasil.com.br"
];

function bigrams(str) {
    if (!str) return new Set();
    const s = str.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).join(" ");
    const bg = new Set();
    for (let i = 0; i < s.length - 1; i++) {
        bg.add(s.slice(i, i + 2));
    }
    return bg;
}

function similarity(a, b) {
    if (!a || !b) return 0;
    const A = bigrams(a);
    const B = bigrams(b);
    if (A.size + B.size === 0) return 0;
    const intersection = [...A].filter(x => B.has(x)).length;
    return (2 * intersection) / (A.size + B.size);
}

async function searchNews(title, apiKey, cseId, num = 10) {
    if (!apiKey || !cseId) {
        throw new Error("Chave da API Google (apiKey) ou ID do Mecanismo de Busca (cseId) não fornecidos para searchNews.");
    }
    const query = encodeURIComponent(title);
    const endpoint = `https://customsearch.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&num=${num}&q=${query}&sort=date`;

    const res = await fetch(endpoint);
    if (!res.ok) {
        let errorBodyText = "Não foi possível obter detalhes do erro da API.";
        try {
            errorBodyText = await res.text();
        } catch (e) { }
        throw new Error(`Erro na API de Pesquisa Google (${res.status}): ${res.statusText}. Detalhes: ${errorBodyText}`);
    }
    const data = await res.json();

    return (data.items || []).map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
    }));
}

async function collectExternalEvidence(originalTitle, apiKeyCustomSearch, searchEngineId) {
    const rawResults = await searchNews(originalTitle, apiKeyCustomSearch, searchEngineId);

    const resultsWithTrustFlag = rawResults.map(r => {
        let isTrustedSource = false;
        try {
            const domain = new URL(r.link).hostname.replace(/^www\./, "");
            isTrustedSource = TRUSTED_SOURCES.some(source => domain.includes(source));
        } catch (e) {
            console.warn("URL inválida em collectExternalEvidence:", r.link, e.message);
        }
        return { ...r, isTrusted: isTrustedSource };
    });

    const trustedAndSimilar = resultsWithTrustFlag.filter(r => {
        const isSimilar = similarity(r.title, originalTitle) >= 0.2;
        return r.isTrusted && isSimilar;
    });

    if (trustedAndSimilar.length > 0) {
        return trustedAndSimilar;
    }
    return resultsWithTrustFlag.slice(0, 2);
}

async function callGeminiAPI(prompt, apiKey) {
    const model = 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData?.error?.message || "Erro desconhecido na API Gemini.";
        throw new Error(`Erro na API Gemini (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        throw new Error("Resposta da API Gemini em formato inesperado.");
    }
    return data.candidates[0].content.parts[0].text;
}