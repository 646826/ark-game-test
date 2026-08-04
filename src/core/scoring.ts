import type { CompletionStats, PuzzleDefinition } from './types.js';

export function calculateCompletion(puzzle: PuzzleDefinition, moves: number, hintsUsed: number, elapsedMs: number): CompletionStats {
  const par = Math.max(1, puzzle.parMoves);
  const efficiency = Math.max(0, 1 - Math.max(0, moves - par) / Math.max(4, par * 1.8));
  const timeTarget = Math.max(20_000, puzzle.tiles.length * 4_500);
  const timeFactor = Math.max(0.25, Math.min(1, timeTarget / Math.max(timeTarget, elapsedMs)));
  const base = 800 + puzzle.level * 90 + puzzle.tiles.length * 70;
  const score = Math.max(100, Math.round((base * (0.65 + efficiency * 0.75) * (0.75 + timeFactor * 0.25) - hintsUsed * 120) / 10) * 10);
  const stars: 1 | 2 | 3 = moves <= par + 1 && hintsUsed === 0 ? 3 : moves <= Math.ceil(par * 1.7) && hintsUsed <= 1 ? 2 : 1;
  return { score, stars, moves, elapsedMs, parMoves: par };
}
