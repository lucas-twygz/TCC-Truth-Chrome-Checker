// cgaves usadas para o chrome.storage.local
export const STORAGE_KEYS = {
    GEMINI_API_KEY: 'truthCheckerGeminiApiKey',
    CUSTOM_SEARCH_API_KEY: 'truthCheckerCustomSearchApiKey',
    SEARCH_ENGINE_ID: 'truthCheckerSearchEngineId',
    USER_NAME: 'truthCheckerUserName',
    HISTORY: 'analysisHistory',
    DEBUG_MODE: 'debugModeEnabled'
};
export const FAKE_NEWS_THRESHOLD = 40 // abaixo deste valor, a notícia é considerada de baixa veracidade
export const HIGH_SCORE_THRESHOLD = 75 // acima deste valor, a trava de segurança para alegações extraordinárias é ativada
export const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000