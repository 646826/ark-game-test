import type { CompletionStats, DifficultyConfig, SkillProfile } from './types.js';

export function createDefaultSkillProfile(): SkillProfile {
  return {
    rating: 0.28,
    emaEfficiency: 0.65,
    emaSecondsPerTile: 3.8,
    hintRate: 0,
    streak: 0,
    completed: 0,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function difficultyFor(level: number, rating: number, mode: 'campaign' | 'daily' | 'zen'): DifficultyConfig {
  if (mode === 'daily') {
    return {
      tier: 7,
      cols: 7,
      rows: 7,
      activeCells: 34,
      minPlants: 7,
      maxPlants: 10,
      preSolvedChance: 0.18,
      fixedChance: 0.08,
    };
  }

  if (mode === 'zen') {
    return {
      tier: 3,
      cols: 6,
      rows: 6,
      activeCells: 24,
      minPlants: 5,
      maxPlants: 8,
      preSolvedChance: 0.3,
      fixedChance: 0.16,
    };
  }

  const progression = Math.floor((Math.max(1, level) - 1) / 3);
  const adaptive = Math.round(clamp(rating, 0, 1) * 3);
  const tier = clamp(progression + adaptive, 0, 10);
  const size = tier < 2 ? 5 : tier < 6 ? 6 : tier < 9 ? 7 : 8;
  const area = size * size;
  const fill = 0.58 + Math.min(tier, 8) * 0.025;

  return {
    tier,
    cols: size,
    rows: size,
    activeCells: Math.min(area - 2, Math.round(area * fill)),
    minPlants: Math.min(3 + Math.floor(tier / 2), 9),
    maxPlants: Math.min(5 + Math.floor(tier / 2), 11),
    preSolvedChance: clamp(0.35 - tier * 0.022, 0.12, 0.35),
    fixedChance: clamp(0.2 - tier * 0.014, 0.04, 0.2),
  };
}

export function updateSkillProfile(profile: SkillProfile, stats: CompletionStats, activeTiles: number): SkillProfile {
  const efficiency = clamp(stats.optimalMoves / Math.max(stats.moves, stats.optimalMoves), 0, 1);
  const secondsPerTile = stats.elapsedMs / 1000 / Math.max(1, activeTiles);
  const speedScore = clamp(1 - (secondsPerTile - 1.2) / 6, 0, 1);
  const hintPenalty = clamp(stats.hintsUsed / Math.max(1, activeTiles / 8), 0, 1);
  const performance = clamp(efficiency * 0.68 + speedScore * 0.32 - hintPenalty * 0.18, 0, 1);
  const alpha = profile.completed < 4 ? 0.34 : 0.18;

  return {
    rating: clamp(profile.rating * (1 - alpha) + performance * alpha, 0.05, 0.98),
    emaEfficiency: profile.emaEfficiency * 0.78 + efficiency * 0.22,
    emaSecondsPerTile: profile.emaSecondsPerTile * 0.78 + secondsPerTile * 0.22,
    hintRate: profile.hintRate * 0.8 + (stats.hintsUsed > 0 ? 1 : 0) * 0.2,
    streak: stats.stars >= 2 ? profile.streak + 1 : 0,
    completed: profile.completed + 1,
  };
}
