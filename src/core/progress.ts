import { createDefaultSkillProfile } from './difficulty.js';
import type { PersistedProgress, SupportedLanguage } from './types.js';

export const SAVE_KEY = 'clockwork-conservatory-progress-v1';

export function createDefaultProgress(language: SupportedLanguage): PersistedProgress {
  return {
    schemaVersion: 1,
    campaignLevel: 1,
    totalScore: 0,
    bestDaily: {},
    skill: createDefaultSkillProfile(),
    settings: {
      sound: true,
      reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      highContrast: globalThis.matchMedia?.('(prefers-contrast: more)').matches ?? false,
      language,
    },
  };
}

export function sanitizeProgress(value: unknown, fallbackLanguage: SupportedLanguage): PersistedProgress {
  const fallback = createDefaultProgress(fallbackLanguage);
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return fallback;
  }

  const settings = isRecord(value.settings) ? value.settings : {};
  const skill = isRecord(value.skill) ? value.skill : {};
  const language = isSupportedLanguage(settings.language) ? settings.language : fallbackLanguage;
  const result: PersistedProgress = {
    schemaVersion: 1,
    campaignLevel: safeInteger(value.campaignLevel, 1, 1, 10_000),
    totalScore: safeInteger(value.totalScore, 0, 0, Number.MAX_SAFE_INTEGER),
    bestDaily: sanitizeDailyScores(value.bestDaily),
    skill: {
      rating: safeNumber(skill.rating, fallback.skill.rating, 0.05, 0.98),
      emaEfficiency: safeNumber(skill.emaEfficiency, fallback.skill.emaEfficiency, 0, 1),
      emaSecondsPerTile: safeNumber(skill.emaSecondsPerTile, fallback.skill.emaSecondsPerTile, 0.1, 120),
      hintRate: safeNumber(skill.hintRate, fallback.skill.hintRate, 0, 1),
      streak: safeInteger(skill.streak, 0, 0, 100_000),
      completed: safeInteger(skill.completed, 0, 0, 100_000),
    },
    settings: {
      sound: typeof settings.sound === 'boolean' ? settings.sound : fallback.settings.sound,
      reducedMotion:
        typeof settings.reducedMotion === 'boolean' ? settings.reducedMotion : fallback.settings.reducedMotion,
      highContrast: typeof settings.highContrast === 'boolean' ? settings.highContrast : fallback.settings.highContrast,
      language,
    },
  };

  const activeCandidate = value.activeRun;
  if (isRecord(activeCandidate)) {
    const configCandidate = activeCandidate.config;
    const rotationsCandidate = activeCandidate.rotations;
    if (isRecord(configCandidate) && Array.isArray(rotationsCandidate)) {
      const mode =
        activeCandidate.mode === 'daily' || activeCandidate.mode === 'zen' || activeCandidate.mode === 'campaign'
          ? activeCandidate.mode
          : null;
      if (mode && typeof activeCandidate.seed === 'string') {
        result.activeRun = {
          mode,
          level: safeInteger(activeCandidate.level, 1, 1, 10_000),
          seed: activeCandidate.seed.slice(0, 120),
          config: {
            tier: safeInteger(configCandidate.tier, 0, 0, 20),
            cols: safeInteger(configCandidate.cols, 5, 3, 12),
            rows: safeInteger(configCandidate.rows, 5, 3, 12),
            activeCells: safeInteger(configCandidate.activeCells, 18, 4, 144),
            minPlants: safeInteger(configCandidate.minPlants, 3, 1, 30),
            maxPlants: safeInteger(configCandidate.maxPlants, 8, 1, 30),
            preSolvedChance: safeNumber(configCandidate.preSolvedChance, 0.25, 0, 1),
            fixedChance: safeNumber(configCandidate.fixedChance, 0.1, 0, 1),
          },
          rotations: rotationsCandidate.slice(0, 144).map((rotation: unknown) => safeInteger(rotation, 0, 0, 3)),
          moves: safeInteger(activeCandidate.moves, 0, 0, 1_000_000),
          hintsUsed: safeInteger(activeCandidate.hintsUsed, 0, 0, 1_000_000),
          elapsedMs: safeInteger(activeCandidate.elapsedMs, 0, 0, 604_800_000),
          score: safeInteger(activeCandidate.score, 0, 0, Number.MAX_SAFE_INTEGER),
        };
      }
    }
  }

  return result;
}

export function serializedSize(progress: PersistedProgress): number {
  return new TextEncoder().encode(JSON.stringify(progress)).byteLength;
}

function sanitizeDailyScores(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }
  const entries = Object.entries(value)
    .filter(([key, score]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && typeof score === 'number' && Number.isFinite(score))
    .slice(-90)
    .map(([key, score]) => [key, Math.max(0, Math.round(score as number))] as const);
  return Object.fromEntries(entries);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function safeInteger(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(safeNumber(value, fallback, min, max));
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === 'en' || value === 'es' || value === 'fr' || value === 'de' || value === 'it';
}
