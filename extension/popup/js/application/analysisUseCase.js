import { callGeminiAPI, collectExternalEvidence, describeImageWithGemini } from '../infrastructure/apiService.js';
import { saveToHistory } from '../infrastructure/storageService.js';

export async function analyzeNews(params, updateStatus) {
  console.group("INÍCIO DA ANÁLISE DE FATOS (LÓGICA CORRIGIDA)");

  const { content, url, truthCheckerGeminiApiKey, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId } = params;
  const titleLine = content.split("\n")[0].trim();

  updateStatus("Identificando alegação e data...");
  const extractionPrompt = `Analise a notícia e retorne um ÚNICO objeto JSON com 3 chaves: "entidade" (a pessoa ou organização principal), "alegacao" (a alegação central) e "data" (a data do evento no formato AAAA-MM-DD, estime se não for explícita).\n\nNotícia: "${content.substring(0, 1500)}"`;

  let extractedData;
  let eventDate = null;
  try {
    const rawJson = await callGeminiAPI(extractionPrompt, truthCheckerGeminiApiKey);
    let parsedJson = JSON.parse(rawJson.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsedJson)) parsedJson = parsedJson[0];
    extractedData = parsedJson;
    if (extractedData.data) eventDate = new Date(extractedData.data);
  } catch (e) {
    const claimPrompt = `Extraia a alegação central pesquisável da notícia em 7 palavras:\n\n"${content.substring(0, 1000)}"`;
    extractedData = { entidade: titleLine, alegacao: await callGeminiAPI(claimPrompt, truthCheckerGeminiApiKey) };
  }

  if (!extractedData || !extractedData.entidade || !extractedData.alegacao) {
    return "Erro: Não foi possível identificar a alegação principal da notícia para verificação.";
  }

  const { entidade, alegacao } = extractedData;

  updateStatus(`Buscando fatos sobre: ${entidade}...`);
  let dateRestrictParam = null;
  if (eventDate && !isNaN(eventDate)) {
    const startDate = new Date(eventDate);
    startDate.setDate(startDate.getDate() - 3);
    const endDate = new Date(eventDate);
    endDate.setDate(endDate.getDate() + 3);
    const y1 = startDate.getFullYear(), m1 = String(startDate.getMonth() + 1).padStart(2, '0'), d1 = String(startDate.getDate()).padStart(2, '0');
    const y2 = endDate.getFullYear(), m2 = String(endDate.getMonth() + 1).padStart(2, '0'), d2 = String(endDate.getDate()).padStart(2, '0');
    dateRestrictParam = `${y1}${m1}${d1}..${y2}${m2}${d2}`;
  }

  const { affirmativeResults, skepticalResults } = await collectExternalEvidence(`${entidade} ${alegacao}`, truthCheckerCustomSearchApiKey, truthCheckerSearchEngineId, dateRestrictParam);
  const evidenceString = JSON.stringify({ affirmativeResults, skepticalResults }, null, 2);

  updateStatus("Comparando fatos com IA...");
  const finalAnalysisPrompt = `
    Você é um especialista em checagem de fatos. A data de hoje é ${new Date().toLocaleDateString('pt-BR')}. Sua tarefa é analisar a notícia e as fontes externas fornecidas para gerar um objeto JSON.

    **1. FONTES EXTERNAS PARA SUA ANÁLISE:**
    ${evidenceString}

    **2. NOTÍCIA ORIGINAL:**
    - Título: "${titleLine}"
    - Conteúdo: "${content.substring(0, 2500)}"

    **3. SUA TAREFA - GERAR UM JSON COM AS SEGUINTES REGRAS:**
    A. **Análise de Métricas:** Crie as seções "pontuacaoGeral", "resumoGeral", e "analiseDetalhada" (com "fatos", "titulo", "fontes") conforme sua avaliação. A pontuação geral deve ser a média ponderada (50% fatos, 30% fontes, 20% título). Se for > 95, retorne 100.
    B. **OBRIGATÓRIO - Preenchimento das Fontes:** Você DEVE preencher os arrays "confirmam" e "contestam" dentro de "fontesVerificadas". Use as URLs do objeto JSON fornecido na seção "1. FONTES EXTERNAS". Se um array não tiver fontes, retorne um array vazio [].
        - "confirmam": Deve conter objetos de fontes que SUPORTAM a alegação da notícia.
        - "contestam": Deve conter objetos de fontes que DESMENTEM ou REFUTAM a alegação.
    C. **Validação:** Sua resposta final DEVE ser um objeto JSON perfeitamente válido.

    **Formato de Saída (OBRIGATÓRIO JSON):**
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
    }
    `;

  const finalJsonResponse = await callGeminiAPI(finalAnalysisPrompt, truthCheckerGeminiApiKey);

  await saveToHistory(url, titleLine, finalJsonResponse, 'text');
  console.groupEnd();
  return finalJsonResponse;
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
  try {
    resultData = JSON.parse(resultJsonString);
  } catch (e) {
    console.error("A análise da imagem não retornou um JSON válido:", e);
    return resultJsonString;
  }

  const integrityAnalysisText = "A análise de integridade da imagem (metadados, adulteração) ainda não está implementada.";

  resultData.analiseDetalhada.integridade = {
    score: 50,
    texto: integrityAnalysisText
  };

  const finalResultString = JSON.stringify(resultData);

  await saveToHistory(textAnalysisParams.url, `Análise de Imagem: ${imageDescription.substring(0, 50)}...`, finalResultString, 'image');

  console.groupEnd();
  return finalResultString;
}
