import type { DifficultyConfig, GameMode } from './types.js';

export function difficultyFor(level: number, mode: GameMode): DifficultyConfig {
  if (mode === 'zen') {
    const size = Math.min(6, 4 + Math.floor((level - 1) / 8));
    return { width: size, height: size, holes: Math.max(0, size - 4), fixedRatio: 0, tier: 'Gardener' };
  }
  if (level <= 3) return { width: 3, height: 3, holes: 0, fixedRatio: 0, tier: 'Seedling' };
  if (level <= 8) return { width: 4, height: 4, holes: 1, fixedRatio: 0.03, tier: 'Gardener' };
  if (level <= 18) return { width: 5, height: 5, holes: 2, fixedRatio: 0.08, tier: 'Botanist' };
  const size = level >= 34 ? 7 : 6;
  return { width: size, height: size, holes: Math.min(6, 2 + Math.floor(level / 12)), fixedRatio: 0.12, tier: 'Conservator' };
}
