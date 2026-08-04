import type { ActiveRunSnapshot, GameMode, PersistedProgress, PlantKind, SupportedLanguage } from './types.js';

export const SAVE_KEY = 'clockwork-conservatory-v3';
const ALL_PLANTS: PlantKind[] = ['lumen', 'orchid', 'starbell', 'ember', 'moonfern'];
const LANGUAGES: SupportedLanguage[] = ['en', 'es', 'fr', 'de', 'it'];
const MODES: GameMode[] = ['campaign', 'daily', 'zen'];

export function createDefaultProgress(language: SupportedLanguage = 'en'): PersistedProgress {
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

export function sanitizeProgress(value: unknown, fallbackLanguage: SupportedLanguage = 'en'): PersistedProgress {
  const fallback = createDefaultProgress(fallbackLanguage);
  if (!isRecord(value)) return fallback;
  const input = value as Partial<PersistedProgress>;
  const unlocked = Array.isArray(input.unlockedSpecimens)
    ? input.unlockedSpecimens.filter((item): item is PlantKind => ALL_PLANTS.includes(item as PlantKind))
    : fallback.unlockedSpecimens;
  const lastDailyDate = typeof input.lastDailyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.lastDailyDate)
    ? input.lastDailyDate
    : undefined;
  const activeRun = sanitizeActiveRun(input.activeRun);
  const language = LANGUAGES.includes(input.settings?.language as SupportedLanguage)
    ? input.settings?.language as SupportedLanguage
    : fallbackLanguage;
  const bestDaily: Record<string, number> = {};
  if (isRecord(input.bestDaily)) {
    for (const [date, score] of Object.entries(input.bestDaily)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && typeof score === 'number' && Number.isFinite(score)) {
        bestDaily[date] = finiteInt(score, 0, 1_000_000_000, 0);
      }
    }
  }
  return {
    version: 3,
    campaignLevel: finiteInt(input.campaignLevel, 1, 999, 1),
    totalScore: finiteInt(input.totalScore, 0, 1_000_000_000, 0),
    totalStars: finiteInt(input.totalStars, 0, 100_000, 0),
    completedLevels: finiteInt(input.completedLevels, 0, 100_000, 0),
    streak: finiteInt(input.streak, 0, 10_000, 0),
    ...(lastDailyDate ? { lastDailyDate } : {}),
    bestDaily,
    unlockedSpecimens: unlocked.length > 0 ? [...new Set(unlocked)] : ['lumen'],
    settings: {
      language,
      sound: input.settings?.sound !== false,
      reducedMotion: input.settings?.reducedMotion === true,
      highContrast: input.settings?.highContrast === true,
      quality: ['auto', 'high', 'balanced', 'low'].includes(input.settings?.quality ?? '') ? input.settings!.quality : 'auto',
      tutorialHints: input.settings?.tutorialHints !== false,
    },
    ...(activeRun ? { activeRun } : {}),
  };
}

export function specimenForLevel(level: number): PlantKind | null {
  const unlockAt: Record<number, PlantKind> = { 3: 'orchid', 7: 'starbell', 12: 'ember', 20: 'moonfern' };
  return unlockAt[level] ?? null;
}

function sanitizeActiveRun(value: unknown): ActiveRunSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.seed !== 'string' || value.seed.length === 0 || value.seed.length > 240) return undefined;
  if (typeof value.mode !== 'string' || !MODES.includes(value.mode as GameMode)) return undefined;
  if (!Array.isArray(value.rotations) || value.rotations.length === 0 || value.rotations.length > 64) return undefined;
  const rotations = value.rotations.map((rotation) => finiteInt(rotation, 0, 3, 0));
  return {
    seed: value.seed,
    mode: value.mode as GameMode,
    level: finiteInt(value.level, 1, 999, 1),
    rotations,
    moves: finiteInt(value.moves, 0, 1_000_000, 0),
    elapsedMs: finiteInt(value.elapsedMs, 0, 7 * 24 * 60 * 60 * 1000, 0),
  };
}

function finiteInt(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
