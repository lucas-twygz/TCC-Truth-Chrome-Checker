const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

const TRUSTED_SOURCES = [
    "bbc.com", "nytimes.com", "theguardian.com", "reuters.com",
    "apnews.com", "cnn.com", "estadao.com.br", "g1.globo.com",
    "globo.com", "oglobo.globo.com", "folha.uol.com.br",
    "uol.com.br", "terra.com.br", "r7.com",
    "veja.abril.com.br", "band.uol.com.br", "cnnbrasil.com.br"
];

function bigrams(str) {
    const s = str.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).join(" ");
    const bg = new Set();
    for (let i = 0; i < s.length - 1; i++) {
        bg.add(s.slice(i, i + 2));
    }
    return bg;
}

function similarity(a, b) {
    const A = bigrams(a);
    const B = bigrams(b);
    const intersection = [...A].filter(x => B.has(x)).length;
    return (2 * intersection) / (A.size + B.size);
}

async function searchNews(title, num = 10) {
    // 🔧 Removido uso de aspas para flexibilizar a busca
    const query = encodeURIComponent(title);
    const endpoint = `https://customsearch.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&num=${num}&q=${query}`;

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Search API error ${res.status}`);
    const data = await res.json();

    return (data.items || []).map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
    }));
}

export async function collectExternalEvidence(originalTitle) {
    const results = await searchNews(originalTitle);

    // 🎯 Filtro por fontes confiáveis e similaridade
    const trusted = results.filter(r => {
        const domain = new URL(r.link).hostname.replace(/^www\./, "");
        const isTrusted = TRUSTED_SOURCES.some(source => domain.includes(source));
        const isSimilar = similarity(r.title, originalTitle) >= 0.2; // Mais permissivo
        return isTrusted && isSimilar;
    });

    // ✅ Se achou fontes confiáveis, retorna apenas elas
    if (trusted.length > 0) {
        return trusted;
    }

    // 🔁 Se não achou confiáveis, retorna os 2 primeiros mais relevantes (com aviso, se quiser)
    return results.slice(0, 2);
}
