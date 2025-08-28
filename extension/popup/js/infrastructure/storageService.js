import { STORAGE_KEYS } from '../config.js';

export async function saveSettings(settings) {
    const dataToSave = {
        [STORAGE_KEYS.GEMINI_API_KEY]: settings.geminiApiKey,
        [STORAGE_KEYS.CUSTOM_SEARCH_API_KEY]: settings.customSearchApiKey,
        [STORAGE_KEYS.SEARCH_ENGINE_ID]: settings.searchEngineId,
        [STORAGE_KEYS.USER_NAME]: settings.userName,
        [STORAGE_KEYS.DEBUG_MODE]: settings.debugMode,
    };
    return chrome.storage.local.set(dataToSave);
}

export async function getAllData() {
    const keys = Object.values(STORAGE_KEYS);
    return chrome.storage.local.get(keys);
}

export async function getHistory() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    return data[STORAGE_KEYS.HISTORY] || [];
}

export async function saveToHistory(url, title, resultText) {
    const history = await getHistory();
    const newEntry = { url, title, resultText, timestamp: new Date().toISOString() };
    const updatedHistory = [newEntry, ...history.filter(item => item.url !== url).slice(0, 99)];
    return chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updatedHistory });
}

export async function importHistory(newHistory) {
    return chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: newHistory });
}