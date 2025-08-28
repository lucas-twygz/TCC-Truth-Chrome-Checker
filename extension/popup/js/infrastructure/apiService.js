const TRUSTED_SOURCES = [
    "bbc.com", "nytimes.com", "theguardian.com", "reuters.com",
    "apnews.com", "cnn.com", "estadao.com.br", "g1.globo.com",
    "globo.com", "oglobo.globo.com", "folha.uol.com.br",
    "uol.com.br", "terra.com.br", "r7.com", "correiobraziliense.com.br",
    "veja.abril.com.br", "band.uol.com.br", "cnnbrasil.com.br"
];

export async function callGeminiAPI(prompt, apiKey) {
    const model = 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData?.error?.message || "Erro desconhecido na API Gemini.";
        throw new Error(`Erro na API Gemini (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        if (data.candidates?.[0]?.content?.parts?.[0]) {
             return "";
        }
        throw new Error("Resposta da API Gemini em formato inesperado.");
    }
    return data.candidates[0].content.parts[0].text;
}

export async function collectExternalEvidence(query, apiKey, cseId, dateRestrict = null) {
    let endpoint = `https://customsearch.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&num=5&q=${encodeURIComponent(query)}`;
    
    if (dateRestrict) {
        endpoint += `&sort=date:r:${dateRestrict.replace(/\[|\]/g, '')}`;
    } else {
        endpoint += `&sort=date`;
    }

    const response = await fetch(endpoint);
    if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Erro na API de Pesquisa Google (${response.status}). Detalhes: ${errorDetails}`);
    }
    const data = await response.json();

    const rawResults = (data.items || []).map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
    }));
    
    return rawResults.map(r => {
        let isTrusted = false;
        try {
            const domain = new URL(r.link).hostname.replace(/^www\./, "");
            isTrusted = TRUSTED_SOURCES.some(source => domain.includes(source));
        } catch (e) {
            console.warn("URL inválida no resultado da busca:", r.link);
        }
        return { ...r, isTrusted };
    });
}