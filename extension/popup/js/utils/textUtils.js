export function extractPercentage(responseText) {
    if (!responseText) return null;
    const chanceMatch = responseText.match(/(\d+)\s*%/);
    return chanceMatch ? parseInt(chanceMatch[1], 10) : null;
}