// apiService.js
const TRUSTED_SOURCES = [
  "bbc.com","nytimes.com","theguardian.com","reuters.com",
  "apnews.com","cnn.com","estadao.com.br","g1.globo.com",
  "globo.com","oglobo.globo.com","folha.uol.com.br",
  "uol.com.br","terra.com.br","r7.com","correiobraziliense.com.br",
  "veja.abril.com.br","band.uol.com.br","cnnbrasil.com.br",
  "agencialupa.com","aosfatos.org","boatos.org","e-farsas.com",
  "projetocomprova.com.br","drauziovarella.uol.com.br",
  "variety.com","hollywoodreporter.com","deadline.com",
  "washingtonpost.com","time.com","hbo.com","wbd.com","press.wbd.com","warnerbros.com"
];

function safeHost(href) {
  try { return new URL(href).hostname.replace(/^www\./,''); } catch { return ""; }
}
function isHostTrusted(host) {
  if (!host) return false;
  return TRUSTED_SOURCES.some(domain => host === domain || host.endsWith(`.${domain}`));
}

async function performSearch(query, apiKey, cseId, dateRestrict) {
  let endpoint = `https://customsearch.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&num=10&q=${encodeURIComponent(query)}`;
  if (dateRestrict) endpoint += `&sort=date:r:${dateRestrict.replace(/\[|\]/g, '')}`;
  else endpoint += `&sort=date`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`Erro na API de Pesquisa Google (${response.status}). Detalhes: ${errorDetails}`);
  }
  const data = await response.json();

  return (data.items || []).map(item => {
    const host = safeHost(item.link);
    return {
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      isTrusted: isHostTrusted(host)
    };
  });
}

export async function collectExternalEvidence(query, apiKey, cseId, dateRestrict = null) {
  const affirmativeQuery = query;
  const skepticalQuery = `${query} é falso? farsa fraude checagem OR "${query}" fake hoax debunk`;
  const [affirmativeResults, skepticalResults] = await Promise.all([
    performSearch(affirmativeQuery, apiKey, cseId, dateRestrict),
    performSearch(skepticalQuery, apiKey, cseId, null)
  ]);
  return { affirmativeResults, skepticalResults };
}

export async function callGeminiAPI(prompt, apiKey) {
  const model = 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
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
  const model = 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Descreva detalhadamente o que você vê nesta imagem. Foque em elementos visuais, pessoas, objetos, texto presente, contexto e qualquer informação relevante que possa ajudar a verificar a veracidade desta imagem como se fosse uma notícia." },
          { inline_data: { mime_type: imageData.type, data: imageData.data } }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.error?.message || "Erro desconhecido na API Gemini Vision.";
    throw new Error(`Erro na API Gemini Vision (${response.status}): ${errorMessage}`);
  }

  const data = await response.json();
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Resposta da API Gemini Vision em formato inesperado.");
  }
  return data.candidates[0].content.parts[0].text;
}
