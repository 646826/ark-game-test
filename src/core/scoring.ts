import { clamp } from './difficulty.js';
import type { CompletionStats, PuzzleDefinition } from './types.js';

export function calculateCompletion(
  puzzle: PuzzleDefinition,
  moves: number,
  hintsUsed: number,
  elapsedMs: number,
): CompletionStats {
  const efficiency = clamp(puzzle.optimalMoves / Math.max(moves, puzzle.optimalMoves), 0, 1);
  const targetMs = Math.max(35_000, puzzle.tiles.length * (2_600 + puzzle.config.tier * 90));
  const speed = clamp(1 - Math.max(0, elapsedMs - targetMs * 0.45) / (targetMs * 1.6), 0, 1);
  const hintMultiplier = Math.pow(0.9, hintsUsed);
  const modeMultiplier = puzzle.mode === 'daily' ? 1.35 : puzzle.mode === 'zen' ? 0.85 : 1;
  const base = 750 + puzzle.tiles.length * 34 + puzzle.config.tier * 125;
  const score = Math.max(
    100,
    Math.round((base + base * efficiency * 0.72 + base * speed * 0.38) * hintMultiplier * modeMultiplier),
  );

  let stars: 1 | 2 | 3 = 1;
  if (efficiency >= 0.72 && hintsUsed <= 2) {
    stars = 2;
  }
  if (efficiency >= 0.9 && hintsUsed === 0 && speed >= 0.45) {
    stars = 3;
  }

  return { moves, optimalMoves: puzzle.optimalMoves, hintsUsed, elapsedMs, score, stars };
}
