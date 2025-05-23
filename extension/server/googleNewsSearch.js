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
    if (!str) return new Set(); // Adicionado para segurança
    const s = str.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).join(" ");
    const bg = new Set();
    for (let i = 0; i < s.length - 1; i++) {
        bg.add(s.slice(i, i + 2));
    }
    return bg;
}

function similarity(a, b) {
    if (!a || !b) return 0; // Adicionado para segurança
    const A = bigrams(a);
    const B = bigrams(b);
    if (A.size + B.size === 0) return 0; // Evita divisão por zero
    const intersection = [...A].filter(x => B.has(x)).length;
    return (2 * intersection) / (A.size + B.size);
}

async function searchNews(title, num = 10) {
    const query = encodeURIComponent(title);
    // Adicionado &sort=date para priorizar resultados recentes, conforme discutido anteriormente.
    // Se não quiser, pode remover o &sort=date.
    const endpoint = `https://customsearch.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&num=${num}&q=${query}&sort=date`;

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Search API error ${res.status}`);
    const data = await res.json();

    return (data.items || []).map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
    }));
}

async function collectExternalEvidence(originalTitle) {
    const rawResults = await searchNews(originalTitle);

    // Processa os resultados para adicionar a flag isTrusted
    const resultsWithTrustFlag = rawResults.map(r => {
        let isTrustedSource = false;
        try {
            const domain = new URL(r.link).hostname.replace(/^www\./, "");
            isTrustedSource = TRUSTED_SOURCES.some(source => domain.includes(source));
        } catch (e) {
            console.warn("URL inválida em collectExternalEvidence:", r.link, e.message);
            // ignora URLs malformadas, isTrustedSource permanece false
        }
        return { ...r, isTrusted: isTrustedSource }; // Adiciona a flag isTrusted
    });

    const trustedAndSimilar = resultsWithTrustFlag.filter(r => {
        const isSimilar = similarity(r.title, originalTitle) >= 0.2;
        // r.isTrusted já indica se o domínio é confiável
        return r.isTrusted && isSimilar;
    });

    if (trustedAndSimilar.length > 0) {
        return trustedAndSimilar; // Estes itens terão .isTrusted = true
    }

    // Fallback: retorna os 2 primeiros resultados gerais.
    // A flag .isTrusted deles refletirá o status do seu domínio (pode ser true ou false).
    return resultsWithTrustFlag.slice(0, 2);
}

module.exports = {
    collectExternalEvidence
};