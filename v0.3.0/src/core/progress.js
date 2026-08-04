export const SAVE_KEY = 'clockwork-conservatory-v3';
const ALL_PLANTS = ['lumen', 'orchid', 'starbell', 'ember', 'moonfern'];
const LANGUAGES = ['en', 'es', 'fr', 'de', 'it'];
const MODES = ['campaign', 'daily', 'zen'];
export function createDefaultProgress(language = 'en') {
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    return {
        version: 3,
        campaignLevel: 1,
        totalScore: 0,
        totalStars: 0,
        completedLevels: 0,
        streak: 0,
        bestDaily: {},
        unlockedSpecimens: ['lumen'],
        settings: { language, sound: true, reducedMotion, highContrast: false, quality: 'auto', tutorialHints: true },
    };
}
export function sanitizeProgress(value, fallbackLanguage = 'en') {
    const fallback = createDefaultProgress(fallbackLanguage);
    if (!isRecord(value))
        return fallback;
    const input = value;
    const unlocked = Array.isArray(input.unlockedSpecimens)
        ? input.unlockedSpecimens.filter((item) => ALL_PLANTS.includes(item))
        : fallback.unlockedSpecimens;
    const lastDailyDate = typeof input.lastDailyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.lastDailyDate)
        ? input.lastDailyDate
        : undefined;
    const activeRun = sanitizeActiveRun(input.activeRun);
    const language = LANGUAGES.includes(input.settings?.language)
        ? input.settings?.language
        : fallbackLanguage;
    const bestDaily = {};
    if (isRecord(input.bestDaily)) {
        for (const [date, score] of Object.entries(input.bestDaily)) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(date) && typeof score === 'number' && Number.isFinite(score)) {
                bestDaily[date] = finiteInt(score, 0, 1000000000, 0);
            }
        }
    }
    return {
        version: 3,
        campaignLevel: finiteInt(input.campaignLevel, 1, 999, 1),
        totalScore: finiteInt(input.totalScore, 0, 1000000000, 0),
        totalStars: finiteInt(input.totalStars, 0, 100000, 0),
        completedLevels: finiteInt(input.completedLevels, 0, 100000, 0),
        streak: finiteInt(input.streak, 0, 10000, 0),
        ...(lastDailyDate ? { lastDailyDate } : {}),
        bestDaily,
        unlockedSpecimens: unlocked.length > 0 ? [...new Set(unlocked)] : ['lumen'],
        settings: {
            language,
            sound: input.settings?.sound !== false,
            reducedMotion: input.settings?.reducedMotion === true,
            highContrast: input.settings?.highContrast === true,
            quality: ['auto', 'high', 'balanced', 'low'].includes(input.settings?.quality ?? '') ? input.settings.quality : 'auto',
            tutorialHints: input.settings?.tutorialHints !== false,
        },
        ...(activeRun ? { activeRun } : {}),
    };
}
export function specimenForLevel(level) {
    const unlockAt = { 3: 'orchid', 7: 'starbell', 12: 'ember', 20: 'moonfern' };
    return unlockAt[level] ?? null;
}
function sanitizeActiveRun(value) {
    if (!isRecord(value))
        return undefined;
    if (typeof value.seed !== 'string' || value.seed.length === 0 || value.seed.length > 240)
        return undefined;
    if (typeof value.mode !== 'string' || !MODES.includes(value.mode))
        return undefined;
    if (!Array.isArray(value.rotations) || value.rotations.length === 0 || value.rotations.length > 64)
        return undefined;
    const rotations = value.rotations.map((rotation) => finiteInt(rotation, 0, 3, 0));
    return {
        seed: value.seed,
        mode: value.mode,
        level: finiteInt(value.level, 1, 999, 1),
        rotations,
        moves: finiteInt(value.moves, 0, 1000000, 0),
        elapsedMs: finiteInt(value.elapsedMs, 0, 7 * 24 * 60 * 60 * 1000, 0),
    };
}
function finiteInt(value, min, max, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
//# sourceMappingURL=progress.js.map