import {
  DIRECTIONS,
  type BoardAnalysis,
  type DirectionBit,
  type HintSuggestion,
  type PuzzleDefinition,
  type TileState,
} from './types.js';

export function rotateMask(mask: number, turns: number): number {
  let result = mask & 15;
  const normalized = ((Math.round(turns) % 4) + 4) % 4;
  for (let index = 0; index < normalized; index += 1) {
    result = ((result << 1) & 15) | ((result >> 3) & 1);
  }
  return result;
}

export function currentMask(tile: TileState): number {
  return rotateMask(tile.baseMask, tile.rotation);
}

export function rotationPeriod(mask: number): 1 | 2 | 4 {
  if (rotateMask(mask, 1) === mask) return 1;
  if (rotateMask(mask, 2) === mask) return 2;
  return 4;
}

export function clockwiseDistanceToSolved(tile: TileState): 0 | 1 | 2 | 3 {
  const period = rotationPeriod(tile.baseMask);
  const distance = ((tile.solutionRotation - tile.rotation) % period + period) % period;
  return Math.min(3, distance) as 0 | 1 | 2 | 3;
}

export function analyzeBoard(puzzle: PuzzleDefinition): BoardAnalysis {
  const byPosition = new Map<string, TileState>();
  const byId = new Map<string, TileState>();
  for (const tile of puzzle.tiles) {
    byPosition.set(`${tile.x},${tile.y}`, tile);
    byId.set(tile.id, tile);
  }

  const powered = new Set<string>();
  const queue: string[] = [puzzle.sourceId];
  powered.add(puzzle.sourceId);

  while (queue.length > 0) {
    const id = queue.shift();
    const tile = id ? byId.get(id) : undefined;
    if (!tile) continue;
    const mask = currentMask(tile);
    for (const direction of DIRECTIONS) {
      if ((mask & direction.bit) === 0) continue;
      const neighbor = byPosition.get(`${tile.x + direction.dx},${tile.y + direction.dy}`);
      if (!neighbor || (currentMask(neighbor) & direction.opposite) === 0 || powered.has(neighbor.id)) continue;
      powered.add(neighbor.id);
      queue.push(neighbor.id);
    }
  }

  const leaks: { tileId: string; direction: DirectionBit; powered: boolean }[] = [];
  for (const tile of puzzle.tiles) {
    if (!powered.has(tile.id)) continue;
    const mask = currentMask(tile);
    for (const direction of DIRECTIONS) {
      if ((mask & direction.bit) === 0) continue;
      const neighbor = byPosition.get(`${tile.x + direction.dx},${tile.y + direction.dy}`);
      if (!neighbor || (currentMask(neighbor) & direction.opposite) === 0) {
        leaks.push({ tileId: tile.id, direction: direction.bit, powered: true });
      }
    }
  }

  const plants = puzzle.tiles.filter((tile) => tile.kind === 'plant');
  const poweredPlants = plants.filter((tile) => powered.has(tile.id)).length;
  const totalPlants = plants.length;
  const solved = totalPlants > 0 && poweredPlants === totalPlants && leaks.length === 0;
  const plantProgress = totalPlants === 0 ? 0 : poweredPlants / totalPlants;
  const leakPenalty = Math.min(0.45, leaks.length * 0.035);
  return {
    powered,
    leaks,
    poweredPlants,
    totalPlants,
    solved,
    progress: Math.max(0, Math.min(1, plantProgress - leakPenalty)),
  };
}

export function suggestHint(puzzle: PuzzleDefinition): HintSuggestion | null {
  const baseline = analyzeBoard(puzzle);
  let best: { tile: TileState; rotations: 1 | 2 | 3; score: number } | null = null;

  for (const tile of puzzle.tiles) {
    if (tile.fixed) continue;
    const period = rotationPeriod(tile.baseMask);
    if (period === 1) continue;
    const original = tile.rotation;
    for (let rotations = 1; rotations < period; rotations += 1) {
      tile.rotation = (original + rotations) % period;
      const analysis = analyzeBoard(puzzle);
      const score =
        (analysis.solved ? 10_000 : 0) +
        analysis.poweredPlants * 120 -
        analysis.leaks.length * 9 +
        analysis.progress * 100 -
        rotations * 0.2;
      if (!best || score > best.score) {
        best = { tile, rotations: rotations as 1 | 2 | 3, score };
      }
    }
    tile.rotation = original;
  }

  if (best && best.score > baseline.poweredPlants * 120 - baseline.leaks.length * 9 + baseline.progress * 100) {
    return { tileId: best.tile.id, rotations: best.rotations };
  }

  const fallback = puzzle.tiles
    .filter((tile) => !tile.fixed && clockwiseDistanceToSolved(tile) > 0)
    .sort((left, right) => clockwiseDistanceToSolved(left) - clockwiseDistanceToSolved(right))[0];
  if (!fallback) return null;
  return { tileId: fallback.id, rotations: clockwiseDistanceToSolved(fallback) as 1 | 2 | 3 };
}

export function clonePuzzle(puzzle: PuzzleDefinition): PuzzleDefinition {
  return {
    ...puzzle,
    tiles: puzzle.tiles.map((tile) => ({ ...tile })),
    ...(puzzle.tutorial ? { tutorial: { ...puzzle.tutorial } } : {}),
  };
}

export function solvedClone(puzzle: PuzzleDefinition): PuzzleDefinition {
  const clone = clonePuzzle(puzzle);
  for (const tile of clone.tiles) {
    tile.rotation = tile.solutionRotation;
    tile.visualTurns = tile.solutionRotation;
  }
  return clone;
}
