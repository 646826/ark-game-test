import { analyzeBoard, rotationPeriod } from './board.js';
import type { HintSuggestion, PuzzleDefinition } from './types.js';

export function suggestHint(puzzle: PuzzleDefinition): HintSuggestion | null {
  const analysis = analyzeBoard(puzzle);
  const candidates = puzzle.tiles.filter((tile) => !tile.fixed && tile.rotation !== 0 && rotationPeriod(tile.baseMask) > 1);
  const first = candidates[0];
  if (!first) return null;
  let best = first;
  let bestScore = -Infinity;
  for (const tile of candidates) {
    const old = tile.rotation;
    tile.rotation = 0;
    const next = analyzeBoard(puzzle);
    tile.rotation = old;
    const score = (next.poweredPlants - analysis.poweredPlants) * 20 + (analysis.leaks.length - next.leaks.length) * 4 + next.powered.size - analysis.powered.size;
    if (score > bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  const period = rotationPeriod(best.baseMask);
  return {
    tileId: best.id,
    rotations: (period - best.rotation) % period || period,
    reason: analysis.leaks.length > 0 ? 'Seal_Leak' : analysis.poweredPlants < analysis.totalPlants ? 'Bloom_Path' : 'Reconnect',
  };
}
