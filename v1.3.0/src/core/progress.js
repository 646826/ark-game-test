export const SAVE_KEY = 'clockwork-conservatory-progress-v3';
const PLANTS = ['lumen-orchid', 'moonbell', 'sun-dahlia', 'mist-lily', 'ember-bloom'];
export function createDefaultProgress(language = 'en') {
    return {
        schema: 4,
        campaignLevel: 1,
        totalScore: 0,
        totalStars: 0,
        bestScore: 0,
        streak: 0,
        dailyBest: {},
        specimens: ['lumen-orchid'],
        settings: {
            language,
            sound: true,
            music: true,
            haptics: true,
            reducedMotion: prefersReducedMotion(),
            highContrast: false,
            quality: 'auto',
        },
    };
}
export function sanitizeProgress(value, fallbackLanguage = 'en') {
    const fallback = createDefaultProgress(fallbackLanguage);
    if (!isRecord(value))
        return fallback;
    const settings = isRecord(value.settings) ? value.settings : {};
    const specimens = Array.isArray(value.specimens) ? value.specimens.filter(isPlantKind) : fallback.specimens;
    const progress = {
        schema: 4,
        campaignLevel: positiveInteger(value.campaignLevel, 1),
        totalScore: nonNegativeNumber(value.totalScore, 0),
        totalStars: nonNegativeNumber(value.totalStars, 0),
        bestScore: nonNegativeNumber(value.bestScore, 0),
        streak: nonNegativeNumber(value.streak ?? value.dailyStreak, 0),
        dailyBest: sanitizeNumberRecord(value.dailyBest ?? value.bestDaily),
        specimens: specimens.length > 0 ? [...new Set(specimens)] : ['lumen-orchid'],
        settings: {
            language: isLanguage(settings.language) ? settings.language : fallbackLanguage,
            sound: typeof settings.sound === 'boolean' ? settings.sound : true,
            music: typeof settings.music === 'boolean' ? settings.music : true,
            haptics: typeof settings.haptics === 'boolean' ? settings.haptics : true,
            reducedMotion: typeof settings.reducedMotion === 'boolean' ? settings.reducedMotion : prefersReducedMotion(),
            highContrast: typeof settings.highContrast === 'boolean' ? settings.highContrast : false,
            quality: isQuality(settings.quality) ? settings.quality : normalizeLegacyQuality(settings.quality),
        },
        ...(typeof value.lastDailyDate === 'string' ? { lastDailyDate: value.lastDailyDate.slice(0, 10) } : {}),
    };
    if (isRecord(value.activeRun) && Array.isArray(value.activeRun.rotations)) {
        const mode = value.activeRun.mode;
        if (mode === 'campaign' || mode === 'daily' || mode === 'zen') {
            progress.activeRun = {
                seed: typeof value.activeRun.seed === 'string' ? value.activeRun.seed.slice(0, 160) : '',
                mode,
                level: positiveInteger(value.activeRun.level, 1),
                rotations: value.activeRun.rotations.slice(0, 100).map((item) => Math.max(0, Math.min(3, Math.round(nonNegativeNumber(item, 0))))),
                moves: nonNegativeNumber(value.activeRun.moves, 0),
                hintsUsed: nonNegativeNumber(value.activeRun.hintsUsed, 0),
                elapsedMs: nonNegativeNumber(value.activeRun.elapsedMs, 0),
            };
        }
    }
    return progress;
}
export function specimenForLevel(level) {
    const unlocks = ['moonbell', 'sun-dahlia', 'mist-lily', 'ember-bloom'];
    if (level > 0 && level % 4 === 0)
        return unlocks[Math.min(unlocks.length - 1, Math.floor(level / 4) - 1)] ?? null;
    return null;
}
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function positiveInteger(value, fallback) { return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback; }
function nonNegativeNumber(value, fallback) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback; }
function sanitizeNumberRecord(value) {
    if (!isRecord(value))
        return {};
    const result = {};
    for (const [key, item] of Object.entries(value).slice(0, 1_000)) {
        if (typeof item === 'number' && Number.isFinite(item) && item >= 0)
            result[key.slice(0, 80)] = Math.round(item);
    }
    return result;
}
function isPlantKind(value) { return typeof value === 'string' && PLANTS.includes(value); }
function isLanguage(value) { return value === 'en' || value === 'es' || value === 'fr' || value === 'de' || value === 'it' || value === 'ru'; }
function isQuality(value) { return value === 'auto' || value === 'high' || value === 'balanced'; }
function normalizeLegacyQuality(value) { return value === 'medium' || value === 'low' ? 'balanced' : 'auto'; }
function prefersReducedMotion() { return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
//# sourceMappingURL=progress.js.map