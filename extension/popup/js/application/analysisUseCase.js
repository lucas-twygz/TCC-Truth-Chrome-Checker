// analysisUseCase.js
import { callGeminiAPI, collectExternalEvidence, describeImageWithGemini } from '../infrastructure/apiService.js';
import { saveToHistory } from '../infrastructure/storageService.js';
import { FAKE_NEWS_THRESHOLD } from '../config.js';

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
function endsWithDomain(host, domain) {
  if (!host || !domain) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

const LOW_TRUST_DOMAINS = [
  'tiktok.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com',
  'youtube.com', 'medium.com', 'reddit.com', 'quora.com', 'telegram.me', 't.me',
  'threads.net', 'bsky.app', 'gettr.com', 'truthsocial.com', 'kwai.com',
  'blogspot.com', 'wordpress.com', 'wikipedia.org'
];

const PRIORITY_SITES = [
  'g1.globo.com', 'oglobo.globo.com', 'folha.uol.com.br', 'estadao.com.br',
  'uol.com.br', 'cnnbrasil.com.br', 'aosfatos.org', 'lupa.uol.com.br',
  'projetocomprova.com.br', 'e-farsas.com', 'boatos.org', 'bbc.com',
  'reuters.com', 'apnews.com', 'variety.com', 'hollywoodreporter.com', 'deadline.com'
];

const PRIMARY_SITES = [
  'reuters.com', 'apnews.com', 'afp.com', 'efe.com', 'agenciabrasil.ebc.com.br',
  'bbc.com', 'nytimes.com', 'theguardian.com', 'wsj.com', 'aljazeera.com',
  'politifact.com', 'snopes.com', 'factcheck.org', 'whitehouse.gov', 'state.gov',
  'gov.uk', 'europa.eu', 'planalto.gov.br', 'camara.leg.br', 'senado.leg.br', 'stf.jus.br'
];

const ACADEMIC_SITES = [
  'ox.ac.uk', 'nature.com', 'science.org', 'sciencemag.org', 'cell.com', 'pnas.org',
  'nejm.org', 'thelancet.com', 'bmj.com', 'jamanetwork.com', 'springer.com', 'tandfonline.com',
  'sciencedirect.com', 'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'doi.org', 'who.int', 'cdc.gov', 'butantan.gov.br'
];

function isLowTrust(url) {
  const h = hostFromUrl(url);
  return LOW_TRUST_DOMAINS.some(d => endsWithDomain(h, d));
}
function isAcademic(url) {
  const h = hostFromUrl(url);
  return ACADEMIC_SITES.some(d => endsWithDomain(h, d));
}

function clip(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/\s+/g, ' ').trim();
}

function toNum(x) {
  if (typeof x === 'number') return x;
  if (typeof x === 'string') {
    const m = x.match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }
  return NaN;
}

// Heurística de risco APENAS para alegações médico-científicas
function computeClaimRisk(text) {
  const t = (text || '').toLowerCase();
  // Refinado para ser mais específico
  const healthTerms = /(sa[úu]de|m[eé]dic|cl[ií]nic|doen[çc]a|terap|ensaio|randomizad|cognitiv|densidade\s+[óo]ssea|estresse\s+oxidativo|colesterol|press[aã]o\s+(?:arterial|sangu[ií]nea)|vitamin|horm|imun|c[aâ]ncer)/i;
  const scienceCtx = /(estudo cient[íi]fico|pesquisa da universidade|artigo cient[íi]fico|revis[aã]o por pares|peer[- ]review|preprint)/i;
  const productDrug = /(coca[- ]?cola|refrigerante|suplemento alimentar|rem[eé]dio|medicamento|droga farmac[êe]utica)/i;
  const hype = /(milagre|cura definitiva|100% eficaz|comprovado cientificamente|garantido|revolucion[áa]rio|novo paradigma)/i;

  const isMedClaim = (healthTerms.test(t) && scienceCtx.test(t)) || productDrug.test(t);

  if (!isMedClaim) return 0;

  let risk = 0.6;
  if (hype.test(t)) risk += 0.2;
  return Math.min(1, risk);
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

// Lógica de recalibração CORRIGIDA E OTIMIZADA
function recalibrateScore(finalJsonStr, affirmativeResults, skepticalResults, originalText) {
  let obj;
  try { obj = JSON.parse(finalJsonStr.replace(/```json|```/g, '').trim()); }
  catch { return finalJsonStr; }

  let f = toNum(obj?.analiseDetalhada?.fatos?.score);
  let t = toNum(obj?.analiseDetalhada?.titulo?.score);
  let s = toNum(obj?.analiseDetalhada?.fontes?.score);

  if (!Number.isFinite(f)) f = 50;
  if (!Number.isFinite(t)) t = 70;
  if (!Number.isFinite(s)) s = 60;

  // A pontuação base é sempre a média ponderada da análise da IA
  let finalScore = 0.5 * f + 0.3 * s + 0.2 * t;

  const affTotal = affirmativeResults.length;
  const skeTotal = skepticalResults.length;
  const affTrusted = affirmativeResults.filter(r => r.isTrusted).length;
  const skeTrusted = skepticalResults.filter(r => r.isTrusted).length;
  const affAcademic = affirmativeResults.filter(r => isAcademic(r.link)).length;

  const risk = computeClaimRisk(originalText);
  const peerNoReview = /(n[ãa]o\s+(?:foi|est[áa]|tenha\s+sido)\s+revisad[oa]\s+por\s+pares|sem\s+revis[ãa]o\s+por\s+pares|not\s+peer[- ]reviewed|unreviewed\s+preprint)/iu.test(originalText);

  // Aplica penalidades e bônus sobre a pontuação base
  if (affTrusted >= 3) {
    finalScore = Math.max(finalScore, 90); // Bônus por alta confirmação
  } else if (affTrusted >= 2) {
    finalScore = Math.max(finalScore, 85);
  }

  // Penalização por fontes céticas confiáveis
  finalScore -= Math.min(20, skeTrusted * 10);

  // Caps de segurança para cenários específicos
  if (risk > 0) { // Aplica caps apenas se for uma alegação de risco
    if (peerNoReview) finalScore = Math.min(finalScore, 30);
    if (affAcademic === 0) finalScore = Math.min(finalScore, 35);
  }
  if (affTotal === 0 && skeTotal === 0) {
    finalScore = Math.min(finalScore, 25); // Cap se nenhuma fonte foi encontrada
  }

  // Garante que o score final esteja entre 0 e 100
  finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

  // Atualiza APENAS a pontuação geral, preservando a análise detalhada da IA
  obj.pontuacaoGeral = finalScore;

  return JSON.stringify(obj);
}


export async function analyzeNews(params, updateStatus) {
  // ... (o restante do seu código analyzeNews permanece exatamente o mesmo)
  console.group("INÍCIO DA ANÁLISE DE FATOS (LÓGICA CLIENT-SIDE INVESTIGATIVA)");
  const { content, url, truthCheckerGeminiApiKey, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId } = params;
  const titleLine = content.split("\n")[0].trim();

  updateStatus("Identificando alegação e data...");
  const extractionPrompt = `Analise a notícia e retorne um ÚNICO objeto JSON com 3 chaves: "entidade" (pessoa/organização central), "alegacao" (alegação principal, curta e pesquisável) e "data" (AAAA-MM-DD, estime se não for explícita). Texto: "${content.substring(0, 1500)}"`;

  let extractedData;
  let eventDate = null;
  try {
    const rawJson = await callGeminiAPI(extractionPrompt, truthCheckerGeminiApiKey);
    let parsedJson = JSON.parse(rawJson.replace(/```json|```/g, '').trim());
    extractedData = Array.isArray(parsedJson) ? parsedJson[0] : parsedJson;
    if (extractedData.data) eventDate = new Date(extractedData.data);
  } catch {
    const entPrompt = `Qual é a pessoa ou organização central? 1 a 3 palavras. Texto: "${content.substring(0, 1000)}"`;
    const claimPrompt = `Extraia a alegação central pesquisável em até 7 palavras: "${content.substring(0, 1000)}"`;
    const entidade = (await callGeminiAPI(entPrompt, truthCheckerGeminiApiKey)).trim();
    const alegacao = (await callGeminiAPI(claimPrompt, truthCheckerGeminiApiKey)).trim();
    extractedData = { entidade: entidade || titleLine, alegacao };
  }

  if (!extractedData || !extractedData.entidade || !extractedData.alegacao) {
    throw new Error("Não foi possível identificar a alegação principal da notícia para verificação.");
  }
  const { entidade, alegacao } = extractedData;

  updateStatus(`Buscando fatos sobre: ${entidade}...`);
  let dateRestrictParam = null;
  if (eventDate && !isNaN(eventDate)) {
    const startDate = new Date(eventDate); startDate.setDate(startDate.getDate() - 14);
    const endDate = new Date(eventDate); endDate.setDate(endDate.getDate() + 14);
    const y1 = startDate.getFullYear(), m1 = String(startDate.getMonth() + 1).padStart(2, '0'), d1 = String(startDate.getDate()).padStart(2, '0');
    const y2 = endDate.getFullYear(), m2 = String(endDate.getMonth() + 1).padStart(2, '0'), d2 = String(endDate.getDate()).padStart(2, '0');
    dateRestrictParam = `${y1}${m1}${d1}..${y2}${m2}${d2}`;
  }

  let { affirmativeResults, skepticalResults } =
    await collectExternalEvidence(`${entidade} ${alegacao}`, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, dateRestrictParam);

  affirmativeResults = dedupeByLink(affirmativeResults);
  skepticalResults = dedupeByLink(skepticalResults);

  const totalInitial = affirmativeResults.length + skepticalResults.length;
  const trustedAff = affirmativeResults.filter(r => r.isTrusted).length;
  const trustedSke = skepticalResults.filter(r => r.isTrusted).length;

  if (totalInitial < 3 || (trustedAff + trustedSke) === 0) {
    const variants = [
      `"${alegacao}"`,
      `${entidade}`,
      `${entidade} "${alegacao}"`
    ];
    for (const v of variants) {
      const res = await collectExternalEvidence(v, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, null);
      affirmativeResults = dedupeByLink(affirmativeResults.concat(res.affirmativeResults || []));
      skepticalResults = dedupeByLink(skepticalResults.concat(res.skepticalResults || []));
    }
    for (const site of PRIORITY_SITES) {
      const q1 = `"${alegacao}" site:${site}`;
      const q2 = `${entidade} site:${site}`;
      const res1 = await collectExternalEvidence(q1, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, null);
      const res2 = await collectExternalEvidence(q2, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, null);
      affirmativeResults = dedupeByLink(affirmativeResults.concat(res1.affirmativeResults || [], res2.affirmativeResults || []));
      skepticalResults = dedupeByLink(skepticalResults.concat(res1.skepticalResults || [], res2.skepticalResults || []));
    }
  }

  const haveTrustedAff = affirmativeResults.some(r => r.isTrusted);
  if (haveTrustedAff) affirmativeResults = affirmativeResults.filter(r => r.isTrusted || !isLowTrust(r.link));
  const haveTrustedSke = skepticalResults.some(r => r.isTrusted);
  if (haveTrustedSke) skepticalResults = skepticalResults.filter(r => r.isTrusted || !isLowTrust(r.link));

  const initialEvidenceString = JSON.stringify({ affirmativeResults, skepticalResults }, null, 2);

  updateStatus("Comparando fatos com IA...");
  const formatInstruction = `
    {
      "pontuacaoGeral": <número>,
      "resumoGeral": "<texto>",
      "analiseDetalhada": {
        "fatos": { "score": <número>, "texto": "<texto>" },
        "titulo": { "score": <número>, "texto": "<texto>" },
        "fontes": { "score": <número>, "texto": "<texto>" }
      },
      "fontesVerificadas": {
        "confirmam": [ { "url": "<url real da fonte que confirma>", "tipo": "Notícia" } ],
        "contestam": []
      }
    }`;

  const styleConstraints = `
    - Seja amigável e direto.
    - "resumoGeral": até 3 frases curtas (<= 320 caracteres). Priorize o que está confirmado; incertezas em 1 oração curta.
    - Em "analiseDetalhada.*.texto", use até 3 bullets curtos (máx. 18 palavras).
    - Não fale de fontes no texto; só em "fontesVerificadas".
    - Trate ausência de detalhes nos snippets como "não verificado nos trechos coletados".
    - Para alegações médicas/científicas sem fonte primária (universidade/revista com revisão por pares/órgão de saúde), defina "fatos.score" ≤ 30.
    - Se o próprio texto indicar ausência de revisão por pares, defina "fatos.score" ≤ 30.
    - Avalie "fatos.score" pela alegação central; detalhes secundários podem reduzir no máximo 10 pontos.
    `;

  const preliminaryAnalysisPrompt = `
    Você é especialista em checagem. Hoje é ${new Date().toLocaleDateString('pt-BR')}.
    Considere que as "fontes externas" são títulos e trechos (snippets), não artigos completos.
    ${styleConstraints}

    FONTES:
    ${initialEvidenceString}

    NOTÍCIA:
    - Título: "${titleLine}"
    - Conteúdo: "${content.substring(0, 2500)}"

    REGRAS:
    A) "pontuacaoGeral" é média ponderada (50% fatos, 30% fontes, 20% título). Se >95, retorne 100.
    B) Preencha "fontesVerificadas.confirmam" e ".contestam" SOMENTE com URLs fornecidas em FONTES.
    C) Responda com JSON válido no formato:
    ${formatInstruction}
    `;

  let finalJsonResponse = await callGeminiAPI(preliminaryAnalysisPrompt, truthCheckerGeminiApiKey);
  const preliminaryScore = getScoreFromResponse(finalJsonResponse);

  const totalNow = affirmativeResults.length + skepticalResults.length;
  const trustedAffNow = affirmativeResults.filter(r => r.isTrusted).length;
  const trustedSkeNow = skepticalResults.filter(r => r.isTrusted).length;
  const lowCoverage = totalNow < 3 || (trustedAffNow + trustedSkeNow) === 0;
  const highConflict = trustedSkeNow > trustedAffNow && trustedSkeNow >= 2;

  if ((preliminaryScore !== null && preliminaryScore <= FAKE_NEWS_THRESHOLD) || lowCoverage || highConflict) {
    updateStatus("Baixa confiança/cobertura. Investigando ponto crítico...");
    const suspicionPrompt = `Retorne apenas o principal termo factual mais duvidoso da notícia (máx. 7 palavras), pesquisável.`;
    const suspicionTerm = (await callGeminiAPI(suspicionPrompt, truthCheckerGeminiApiKey)).trim().replace(/["']/g, "");

    if (suspicionTerm && !suspicionTerm.toLowerCase().includes('n/a')) {
      const { affirmativeResults: aff2 = [], skepticalResults: ske2 = [] } =
        await collectExternalEvidence(suspicionTerm, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, null);

      affirmativeResults = dedupeByLink(affirmativeResults.concat(aff2));
      skepticalResults = dedupeByLink(skepticalResults.concat(ske2));

      if (affirmativeResults.some(r => r.isTrusted)) {
        affirmativeResults = affirmativeResults.filter(r => r.isTrusted || !isLowTrust(r.link));
      }
      if (skepticalResults.some(r => r.isTrusted)) {
        skepticalResults = skepticalResults.filter(r => r.isTrusted || !isLowTrust(r.link));
      }

      const additionalEvidenceString = JSON.stringify({ affirmativeResults, skepticalResults }, null, 2);

      const reAnalysisPrompt = `
        REAVALIAÇÃO (ponto investigado: "${suspicionTerm}"):
        ${styleConstraints}
        As fontes seguem sendo snippets; trate ausências como "não verificado nos trechos coletados".

        FONTES ATUALIZADAS:
        ${additionalEvidenceString}

        NOTÍCIA:
        - Título: "${titleLine}"
        - Conteúdo: "${content.substring(0, 2000)}"

        Gere o JSON final seguindo:
        ${formatInstruction}
        `;
      updateStatus("Reavaliando com novas informações...");
      finalJsonResponse = await callGeminiAPI(reAnalysisPrompt, truthCheckerGeminiApiKey);
    }
  }

  let finalObj;
  try {
    finalObj = JSON.parse(finalJsonResponse.replace(/```json|```/g, '').trim());
  } catch {
    finalObj = {
      pontuacaoGeral: 70,
      resumoGeral: "Resumo indisponível.",
      analiseDetalhada: {
        fatos: { score: 70, texto: "" },
        titulo: { score: 80, texto: "" },
        fontes: { score: 70, texto: "" }
      },
      fontesVerificadas: { confirmam: [], contestam: [] }
    };
  }

  finalObj.resumoGeral = clip(finalObj.resumoGeral);
  if (!finalObj.analiseDetalhada) finalObj.analiseDetalhada = {};
  if (!finalObj.analiseDetalhada.fatos) finalObj.analiseDetalhada.fatos = { score: finalObj.pontuacaoGeral || 70, texto: "" };
  if (!finalObj.analiseDetalhada.titulo) finalObj.analiseDetalhada.titulo = { score: 80, texto: "" };
  if (!finalObj.analiseDetalhada.fontes) finalObj.analiseDetalhada.fontes = { score: 80, texto: "" };
  finalObj.analiseDetalhada.fatos.texto = clip(finalObj.analiseDetalhada.fatos.texto);
  finalObj.analiseDetalhada.titulo.texto = clip(finalObj.analiseDetalhada.titulo.texto);
  finalObj.analiseDetalhada.fontes.texto = clip(finalObj.analiseDetalhada.fontes.texto);

  let adjusted = JSON.stringify(finalObj);
  adjusted = recalibrateScore(
    adjusted,
    affirmativeResults,
    skepticalResults,
    (typeof extractedData?.alegacao === 'string' && extractedData.alegacao.trim())
      ? extractedData.alegacao
      : `${titleLine} ${content}`
  );

  const allowedLinks = dedupeByLink(affirmativeResults.concat(skepticalResults)).map(x => x.link);
  const sanitized = sanitizeSources(adjusted, allowedLinks);

  await saveToHistory(url, titleLine, sanitized, 'text');
  console.groupEnd();
  return sanitized;
}

export async function analyzeImage(imageData, params, updateStatus) {
  // ... (a função analyzeImage permanece a mesma)
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
  catch (e) { console.error("A análise da imagem não retornou um JSON válido:", e); console.groupEnd(); return resultJsonString; }

  const integrityAnalysisText = "A análise de integridade da imagem (metadados, adulteração) ainda não está implementada.";
  resultData.analiseDetalhada = resultData.analiseDetalhada || {};
  resultData.analiseDetalhada.integridade = { score: 50, texto: integrityAnalysisText };

  const finalResultString = JSON.stringify(resultData);
  await saveToHistory(textAnalysisParams.url, `Análise de Imagem: ${imageDescription.substring(0, 50)}...`, finalResultString, 'image');
  console.groupEnd();
  return finalResultString;
}
