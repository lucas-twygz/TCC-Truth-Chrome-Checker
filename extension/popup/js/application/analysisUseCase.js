// analysisUseCase.js
import { callGeminiAPI, collectExternalEvidence, describeImageWithGemini } from '../infrastructure/apiService.js';
import { saveToHistory } from '../infrastructure/storageService.js';
import { FAKE_NEWS_THRESHOLD } from '../config.js';

// Domínios de baixa confiança (mantidos da sua versão)
const LOW_TRUST_DOMAINS = [
  'tiktok.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com',
  'youtube.com', 'medium.com', 'reddit.com', 'quora.com', 'telegram.me', 't.me',
  'threads.net', 'bsky.app', 'gettr.com', 'truthsocial.com', 'kwai.com',
  'blogspot.com', 'wordpress.com', 'wikipedia.org'
];

// Sites prioritários (mantidos da sua versão)
const PRIORITY_SITES = [
  'g1.globo.com', 'oglobo.globo.com', 'folha.uol.com.br', 'estadao.com.br',
  'uol.com.br', 'cnnbrasil.com.br', 'aosfatos.org', 'lupa.uol.com.br',
  'projetocomprova.com.br', 'e-farsas.com', 'boatos.org', 'bbc.com',
  'reuters.com', 'apnews.com'
];

function getScoreFromResponse(jsonResponse) {
  try {
    const data = JSON.parse(jsonResponse);
    if (data && typeof data.pontuacaoGeral === 'number') return data.pontuacaoGeral;
  } catch (e) { console.error("Erro ao extrair pontuação do JSON:", e); }
  return null;
}

function dedupeByLink(arr) {
  const seen = new Set();
  return (arr || []).filter(it => {
    const key = it?.link;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hostFromUrl(href) {
  try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function isLowTrust(url) {
    const h = hostFromUrl(url);
    return LOW_TRUST_DOMAINS.some(d => h === d || h.endsWith(`.${d}`));
}

function clip(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/\s+/g, ' ').trim();
}

function sanitizeSources(finalJsonStr, allowedLinks) {
  const allow = new Set(allowedLinks);
  try {
    const data = JSON.parse(finalJsonStr.replace(/```json|```/g, '').trim());
    if (!data.fontesVerificadas) data.fontesVerificadas = { confirmam: [], contestam: [] };
    ['confirmam', 'contestam'].forEach(k => {
      if (!Array.isArray(data.fontesVerificadas[k])) data.fontesVerificadas[k] = [];
      data.fontesVerificadas[k] = data.fontesVerificadas[k].filter(x => x && allow.has(x.url));
    });
    return JSON.stringify(data);
  } catch { return finalJsonStr; }
}

function recalibrateScore(finalJsonStr, affirmativeResults, skepticalResults) {
    let obj;
    try {
        obj = JSON.parse(finalJsonStr.replace(/```json|```/g, '').trim());
    } catch {
        return finalJsonStr;
    }

    let finalScore = obj.pontuacaoGeral || 50;

    const affTrusted = affirmativeResults.filter(r => r.isTrusted).length;
    const skeTrusted = skepticalResults.filter(r => r.isTrusted).length;

    if (affTrusted >= 3) {
        finalScore = Math.max(finalScore, 90);
    } else if (affTrusted >= 2) {
        finalScore = Math.max(finalScore, 85);
    }

    if (skeTrusted >= 2) {
        finalScore = Math.min(finalScore, 30);
    } else if (skeTrusted > 0) {
        finalScore -= 15;
    }

    if (affirmativeResults.length === 0 && skepticalResults.length === 0) {
        finalScore = Math.min(finalScore, 25);
    }

    finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));
    obj.pontuacaoGeral = finalScore;

    return JSON.stringify(obj);
}


export async function analyzeNews(params, updateStatus) {
  console.group("INÍCIO DA ANÁLISE DE FATOS");
  const { content, url, truthCheckerGeminiApiKey, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId } = params;
  const titleLine = content.split("\n")[0].trim();

  updateStatus("Identificando alegação principal...");
  const extractionPrompt = `Analise a notícia e retorne um objeto JSON com "entidade" (pessoa/organização central) e "alegacao" (alegação principal, curta e pesquisável). Texto: "${content.substring(0, 1500)}"`;

  let extractedData;
  try {
    const rawJson = await callGeminiAPI(extractionPrompt, truthCheckerGeminiApiKey);
    let parsedJson = JSON.parse(rawJson.replace(/```json|```/g, '').trim());
    extractedData = Array.isArray(parsedJson) ? parsedJson[0] : parsedJson;
  } catch (error) {
     console.error("Falha na extração inicial, usando fallback:", error);
     const entPrompt = `Qual é a pessoa ou organização central? 1 a 3 palavras. Texto: "${content.substring(0, 1000)}"`;
     const claimPrompt = `Extraia a alegação central pesquisável em até 7 palavras: "${content.substring(0, 1000)}"`;
     const entidade = (await callGeminiAPI(entPrompt, truthCheckerGeminiApiKey)).trim();
     const alegacao = (await callGeminiAPI(claimPrompt, truthCheckerGeminiApiKey)).trim();
     extractedData = { entidade: entidade || titleLine, alegacao };
  }

  if (!extractedData || !extractedData.entidade || !extractedData.alegacao) {
    throw new Error("Não foi possível identificar a alegação principal da notícia.");
  }
  const { entidade, alegacao } = extractedData;

  updateStatus(`Buscando fatos sobre: ${alegacao}...`);
  let { affirmativeResults, skepticalResults } = await collectExternalEvidence(`${entidade} ${alegacao}`, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId);

  affirmativeResults = dedupeByLink(affirmativeResults);
  skepticalResults = dedupeByLink(skepticalResults);

  const totalInitial = affirmativeResults.length + skepticalResults.length;
  const trustedSources = affirmativeResults.filter(r => r.isTrusted).length + skepticalResults.filter(r => r.isTrusted).length;

  if (totalInitial < 4 || trustedSources < 2) {
      updateStatus("Cobertura inicial baixa. Expandindo busca...");
      const prioritySitesQueryPart = PRIORITY_SITES.slice(0, 4)
          .map(site => `site:${site}`)
          .join(" OR ");
      const expandedQuery = `"${alegacao}" (${prioritySitesQueryPart})`;
      const res = await collectExternalEvidence(expandedQuery, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, null);
      affirmativeResults = dedupeByLink(affirmativeResults.concat(res.affirmativeResults || []));
      skepticalResults = dedupeByLink(skepticalResults.concat(res.skepticalResults || []));
  }

  if (affirmativeResults.some(r => r.isTrusted)) {
    affirmativeResults = affirmativeResults.filter(r => r.isTrusted || !isLowTrust(r.link));
  }
  if (skepticalResults.some(r => r.isTrusted)) {
    skepticalResults = skepticalResults.filter(r => r.isTrusted || !isLowTrust(r.link));
  }

  const evidenceString = JSON.stringify({ affirmativeResults, skepticalResults }, null, 2);

  updateStatus("Analisando com IA...");
  const formatInstruction = `{
      "pontuacaoGeral": <número de 0 a 100>,
      "resumoGeral": "<resumo conciso da análise>",
      "analiseDetalhada": {
        "fatos": { "score": <número>, "texto": "<análise dos fatos>" },
        "titulo": { "score": <número>, "texto": "<análise do título>" },
        "fontes": { "score": <número>, "texto": "<análise das fontes>" }
      },
      "fontesVerificadas": {
        "confirmam": [ { "url": "<url>" } ],
        "contestam": [ { "url": "<url>" } ]
      }
    }`;

  const criticalRule = `- **Regra CRÍTICA para Fontes:** A pontuação de "fontes" NÃO é sobre a qualidade do domínio, mas se o CONTEÚDO da fonte (ver o snippet) APOIA a alegação da notícia. Se os snippets das fontes CONTRADIZEM a notícia (ex: dizem que OUTRA PESSOA ganhou o prêmio), a pontuação de "fontes" e "fatos" deve ser extremamente baixa (abaixo de 20). Fontes que contradizem devem ir para a lista "contestam".`;

  const preliminaryAnalysisPrompt = `
    Você é um especialista em checagem de fatos. Analise a notícia com base nas fontes externas.
    - Calcule a "pontuacaoGeral" com base na veracidade (60%), qualidade das fontes (30%) e sensacionalismo do título (10%).
    ${criticalRule}

    FONTES EXTERNAS:
    ${evidenceString}

    NOTÍCIA:
    - Título: "${titleLine}"
    - Conteúdo: "${content.substring(0, 2000)}"

    REGRAS: Responda APENAS com um objeto JSON válido no seguinte formato:
    ${formatInstruction}
    `;

  let finalJsonResponse = await callGeminiAPI(preliminaryAnalysisPrompt, truthCheckerGeminiApiKey);
  const preliminaryScore = getScoreFromResponse(finalJsonResponse);

  if (preliminaryScore !== null && preliminaryScore <= FAKE_NEWS_THRESHOLD) {
    updateStatus("Baixa confiança. Investigando ponto crítico...");
    const suspicionPrompt = `Qual o principal termo factual duvidoso na notícia (máx. 7 palavras)?`;
    const suspicionTerm = (await callGeminiAPI(suspicionPrompt, truthCheckerGeminiApiKey)).trim().replace(/["']/g, "");

    if (suspicionTerm && !suspicionTerm.toLowerCase().includes('n/a')) {
      const { affirmativeResults: aff2 = [], skepticalResults: ske2 = [] } = await collectExternalEvidence(suspicionTerm, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, null);

      const finalAffirmative = dedupeByLink(affirmativeResults.concat(aff2));
      const finalSkeptical = dedupeByLink(skepticalResults.concat(ske2));
      const additionalEvidenceString = JSON.stringify({ affirmativeResults: finalAffirmative, skepticalResults: finalSkeptical }, null, 2);

      const reAnalysisPrompt = `
        REAVALIAÇÃO (ponto investigado: "${suspicionTerm}"):
        Com base nas novas fontes, refine a análise.
        ${criticalRule}

        FONTES ATUALIZADAS:
        ${additionalEvidenceString}

        NOTÍCIA ORIGINAL:
        - Título: "${titleLine}"
        - Conteúdo: "${content.substring(0, 2000)}"

        Gere o JSON final no mesmo formato:
        ${formatInstruction}
        `;
      updateStatus("Reavaliando com novas informações...");
      finalJsonResponse = await callGeminiAPI(reAnalysisPrompt, truthCheckerGeminiApiKey);
    }
  }

  let finalObj;
  try {
      finalObj = JSON.parse(finalJsonResponse.replace(/```json|```/g, '').trim());
  } catch (e) {
      console.error("Erro final de parsing JSON", e);
      throw new Error("A resposta da IA não estava em um formato JSON válido.");
  }

  finalObj.resumoGeral = clip(finalObj.resumoGeral);
  let adjusted = JSON.stringify(finalObj);
  adjusted = recalibrateScore(adjusted, affirmativeResults, skepticalResults);
  const allowedLinks = dedupeByLink(affirmativeResults.concat(skepticalResults)).map(x => x.link);
  const sanitized = sanitizeSources(adjusted, allowedLinks);

  await saveToHistory(url, titleLine, sanitized, 'text');
  console.groupEnd();
  return sanitized;
}


export async function analyzeImage(imageData, params, updateStatus) {
  console.group("INÍCIO DA ANÁLISE DE IMAGEM");
  const { truthCheckerGeminiApiKey, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId } = params;

  updateStatus("Analisando imagem com IA...");
  const imageDescription = await describeImageWithGemini(imageData, truthCheckerGeminiApiKey);

  updateStatus("Verificando veracidade da descrição...");
  const textAnalysisParams = {
    content: `Análise de Imagem\n\nDescrição da Imagem: ${imageDescription}`,
    url: "imagem-upload://" + Date.now(),
    truthCheckerGeminiApiKey,
    truthCheckerCustomSearchApiKey,
    truthCheckerSearchEngineId
  };

  const resultJsonString = await analyzeNews(textAnalysisParams, updateStatus);

  let resultData;
  try { resultData = JSON.parse(resultJsonString); }
  catch (e) {
    console.error("A análise da imagem não retornou um JSON válido:", e);
    console.groupEnd();
    return resultJsonString;
  }

  const integrityAnalysisText = "A análise de integridade da imagem (metadados, adulteração) ainda não está implementada.";
  resultData.analiseDetalhada = resultData.analiseDetalhada || {};
  resultData.analiseDetalhada.integridade = { score: 50, texto: integrityAnalysisText };

  const finalResultString = JSON.stringify(resultData);
  await saveToHistory(textAnalysisParams.url, `Análise de Imagem: ${imageDescription.substring(0, 50)}...`, finalResultString, 'image');
  console.groupEnd();
  return finalResultString;
}
