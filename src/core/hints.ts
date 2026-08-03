import { analyzeBoard, createTileMap, rotationPeriod, rotationsToTarget, tileKey } from './board.js';
import { solutionDistanceMap } from './generator.js';
import { DIRECTIONS, type HintSuggestion, type PuzzleDefinition, type TileState } from './types.js';

function analysisScore(puzzle: PuzzleDefinition): number {
  const analysis = analyzeBoard(puzzle);
  return analysis.poweredPlants * 1200 + analysis.powered.size * 22 - analysis.leaks.length * 11;
}

export function suggestHint(puzzle: PuzzleDefinition): HintSuggestion | null {
  const baselineAnalysis = analyzeBoard(puzzle);
  if (baselineAnalysis.solved) {
    return null;
  }

  const baselineScore = analysisScore(puzzle);
  let best: HintSuggestion | null = null;

  for (const tile of puzzle.tiles) {
    const period = rotationPeriod(tile.baseMask);
    if (tile.fixed || period === 1) {
      continue;
    }
    const original = tile.rotation;
    for (let rotations = 1; rotations < period; rotations += 1) {
      tile.rotation = (original + rotations) % period;
      const projectedScore = analysisScore(puzzle) - rotations * 3;
      if (projectedScore > baselineScore && (!best || projectedScore > best.projectedScore)) {
        best = {
          tileId: tile.id,
          rotations,
          projectedScore,
          reason: 'immediate-improvement',
        };
      }
    }
    tile.rotation = original;
  }

  if (best) {
    return best;
  }

  const map = createTileMap(puzzle.tiles);
  const distances = solutionDistanceMap(puzzle);
  const candidates = puzzle.tiles
    .filter((tile) => !tile.fixed && rotationsToTarget(tile) > 0)
    .map((tile) => ({
      tile,
      rotations: rotationsToTarget(tile),
      frontier: frontierWeight(tile, map, baselineAnalysis.powered),
      distance: distances.get(tile.id) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => b.frontier - a.frontier || a.distance - b.distance || a.rotations - b.rotations);

  const candidate = candidates[0];
  if (!candidate) {
    return null;
  }
  return {
    tileId: candidate.tile.id,
    rotations: candidate.rotations,
    projectedScore: baselineScore,
    reason: candidate.frontier > 0 ? 'frontier-correction' : 'solution-correction',
  };
}

function frontierWeight(tile: TileState, map: ReadonlyMap<string, TileState>, powered: ReadonlySet<string>): number {
  let weight = powered.has(tile.id) ? 5 : 0;
  for (const direction of DIRECTIONS) {
    const neighbor = map.get(tileKey(tile.x + direction.dx, tile.y + direction.dy));
    if (neighbor && powered.has(neighbor.id)) {
      weight += 3;
    }
  }
  return weight;
}
