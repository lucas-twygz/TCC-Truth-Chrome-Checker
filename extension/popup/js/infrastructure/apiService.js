const TRUSTED_SOURCES = [
    "bbc.com", "nytimes.com", "theguardian.com", "reuters.com",
    "apnews.com", "cnn.com", "estadao.com.br", "g1.globo.com",
    "globo.com", "oglobo.globo.com", "folha.uol.com.br",
    "uol.com.br", "terra.com.br", "r7.com", "correiobraziliense.com.br",
    "veja.abril.com.br", "band.uol.com.br", "cnnbrasil.com.br",
    "agencialupa.com", "aosfatos.org", "boatos.org", "e-farsas.com",
    "projetocomprova.com.br", "drauziovarella.uol.com.br"
];

async function performSearch(query, apiKey, cseId, dateRestrict) {
    let endpoint = `https://customsearch.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&num=5&q=${encodeURIComponent(query)}`;

    // ALTERAÇÃO CRÍTICA: Apenas ordena por data se houver uma restrição explícita.
    // Caso contrário, a API usará o padrão de RELEVÂNCIA.
    if (dateRestrict) {
        endpoint += `&sort=date:r:${dateRestrict.replace(/\[|\]/g, '')}`;
    }
    // O bloco 'else' que forçava a ordenação por data foi removido.

    const response = await fetch(endpoint);
    if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Erro na API de Pesquisa Google (${response.status}). Detalhes: ${errorDetails}`);
    }
    const data = await response.json();

    return (data.items || []).map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        isTrusted: TRUSTED_SOURCES.some(source => new URL(item.link).hostname.includes(source))
    }));
}

export async function collectExternalEvidence(query, apiKey, cseId, dateRestrict = null) {
    const affirmativeQuery = query;
    const skepticalQuery = `${query} é falso? farsa fraude checagem`;

    const [affirmativeResults, skepticalResults] = await Promise.all([
        performSearch(affirmativeQuery, apiKey, cseId, dateRestrict),
        // A busca cética nunca usa restrição de data para encontrar a checagem mais relevante.
        performSearch(skepticalQuery, apiKey, cseId, null)
    ]);

    return { affirmativeResults, skepticalResults };
}

export async function callGeminiAPI(prompt, apiKey) {
    // Mantido o modelo 'flash' para análises de texto por ser mais rápido.
    const model = 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData?.error?.message || "Erro desconhecido na API Gemini.";
        throw new Error(`Erro na API Gemini (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error("Resposta da API Gemini em formato inesperado.");
    }
    return data.candidates[0].content.parts[0].text;
}

export async function describeImageWithGemini(imageData, apiKey) {
    // Usando o modelo 'pro-vision' que é especialista em imagens.
    const model = 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    // Instrução aprimorada para retornar um JSON com descrição E texto
                    { text: "Analise esta imagem e retorne um objeto JSON com duas chaves: 'visualDescription' (descreva detalhadamente os elementos visuais da imagem em português) e 'textOnImage' (transcreva literalmente qualquer texto visível na imagem em português, se houver). Se não houver texto, retorne uma string vazia para 'textOnImage'." },
                    {
                        inline_data: {
                            mime_type: imageData.type,
                            data: imageData.data
                        }
                    }
                ]
            }],
            // Adicionado para garantir que a resposta seja JSON
            generationConfig: {
                responseMimeType: "application/json",
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData?.error?.message || "Erro desconhecido na API Gemini Vision.";
        throw new Error(`Erro na API Gemini Vision (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error("Resposta da API Gemini Vision em formato inesperado.");
    }
    // Retorna o JSON como uma string para ser processado depois
    return data.candidates[0].content.parts[0].text;
}
