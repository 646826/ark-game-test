import {
  DIRECTIONS,
  Direction,
  type BoardAnalysis,
  type DirectionBit,
  type Leak,
  type PuzzleDefinition,
  type TileState,
} from './types.js';

export function tileKey(x: number, y: number): string {
  return `${x}:${y}`;
}

export function rotateMask(mask: number, quarterTurns: number): number {
  const turns = ((quarterTurns % 4) + 4) % 4;
  let result = mask & 0b1111;
  for (let index = 0; index < turns; index += 1) {
    result = ((result << 1) & 0b1111) | ((result & Direction.West) >>> 3);
  }
  return result;
}

export function popCount(mask: number): number {
  let value = mask & 0b1111;
  let count = 0;
  while (value !== 0) {
    count += value & 1;
    value >>>= 1;
  }
  return count;
}

export function rotationPeriod(baseMask: number): 1 | 2 | 4 {
  if ((baseMask & 0b1111) === 0b1111) {
    return 1;
  }
  if (rotateMask(baseMask, 2) === (baseMask & 0b1111)) {
    return 2;
  }
  return 4;
}

export function normalizedRotation(tile: Pick<TileState, 'rotation' | 'baseMask'>): number {
  const period = rotationPeriod(tile.baseMask);
  return ((tile.rotation % period) + period) % period;
}

export function rotationsToTarget(tile: Pick<TileState, 'rotation' | 'targetRotation' | 'baseMask'>): number {
  const period = rotationPeriod(tile.baseMask);
  const current = ((tile.rotation % period) + period) % period;
  const target = ((tile.targetRotation % period) + period) % period;
  return (target - current + period) % period;
}

export function currentMask(tile: Pick<TileState, 'baseMask' | 'rotation'>): number {
  return rotateMask(tile.baseMask, tile.rotation);
}

export function canonicalizeMask(solutionMask: number): { baseMask: number; targetRotation: number } {
  let bestMask = Number.POSITIVE_INFINITY;
  let bestRotation = 0;
  for (let candidateRotation = 0; candidateRotation < 4; candidateRotation += 1) {
    const candidateBase = rotateMask(solutionMask, -candidateRotation);
    if (candidateBase < bestMask) {
      bestMask = candidateBase;
      bestRotation = candidateRotation;
    }
  }
  return { baseMask: bestMask, targetRotation: bestRotation };
}

export function createTileMap(tiles: readonly TileState[]): Map<string, TileState> {
  return new Map(tiles.map((tile) => [tileKey(tile.x, tile.y), tile]));
}

export function analyzeBoard(puzzle: Pick<PuzzleDefinition, 'tiles' | 'sourceId'>): BoardAnalysis {
  const byCoordinate = createTileMap(puzzle.tiles);
  const byId = new Map(puzzle.tiles.map((tile) => [tile.id, tile]));
  const powered = new Set<string>();
  const leaks: Leak[] = [];
  const queue: TileState[] = [];
  const source = byId.get(puzzle.sourceId);

  if (!source) {
    return { powered, poweredPlants: 0, totalPlants: 0, leaks, solved: false };
  }

  powered.add(source.id);
  queue.push(source);

  while (queue.length > 0) {
    const tile = queue.shift() as TileState;
    const mask = currentMask(tile);

    for (const direction of DIRECTIONS) {
      if ((mask & direction.bit) === 0) {
        continue;
      }
      const neighbor = byCoordinate.get(tileKey(tile.x + direction.dx, tile.y + direction.dy));
      if (!neighbor || (currentMask(neighbor) & direction.opposite) === 0) {
        continue;
      }
      if (!powered.has(neighbor.id)) {
        powered.add(neighbor.id);
        queue.push(neighbor);
      }
    }
  }

  for (const tile of puzzle.tiles) {
    const mask = currentMask(tile);
    for (const direction of DIRECTIONS) {
      if ((mask & direction.bit) === 0) {
        continue;
      }
      const neighbor = byCoordinate.get(tileKey(tile.x + direction.dx, tile.y + direction.dy));
      if (!neighbor || (currentMask(neighbor) & direction.opposite) === 0) {
        leaks.push({ tileId: tile.id, direction: direction.bit });
      }
    }
  }

  const totalPlants = puzzle.tiles.filter((tile) => tile.kind === 'plant').length;
  const poweredPlants = puzzle.tiles.filter((tile) => tile.kind === 'plant' && powered.has(tile.id)).length;
  const solved = totalPlants > 0 && poweredPlants === totalPlants && powered.size === puzzle.tiles.length && leaks.length === 0;

  return { powered, poweredPlants, totalPlants, leaks, solved };
}

export function directionFromDelta(dx: number, dy: number): DirectionBit {
  const direction = DIRECTIONS.find((candidate) => candidate.dx === dx && candidate.dy === dy);
  if (!direction) {
    throw new Error(`Invalid direction delta: ${dx}, ${dy}`);
  }
  return direction.bit;
}

export function oppositeDirection(direction: DirectionBit): DirectionBit {
  const definition = DIRECTIONS.find((candidate) => candidate.bit === direction);
  if (!definition) {
    throw new Error(`Unknown direction bit: ${direction}`);
  }
  return definition.opposite;
}
