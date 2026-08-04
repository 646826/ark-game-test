import { DIRECTIONS, EAST, NORTH, SOUTH, WEST, type BoardAnalysis, type DirectionBit, type PuzzleDefinition, type TileState } from './types.js';

export const OPPOSITE: Record<DirectionBit, DirectionBit> = {
  [NORTH]: SOUTH,
  [EAST]: WEST,
  [SOUTH]: NORTH,
  [WEST]: EAST,
};

export const DELTA: Record<DirectionBit, readonly [number, number]> = {
  [NORTH]: [0, -1],
  [EAST]: [1, 0],
  [SOUTH]: [0, 1],
  [WEST]: [-1, 0],
};

export function rotateMask(mask: number, turns: number): number {
  let normalized = ((turns % 4) + 4) % 4;
  let result = mask & 15;
  while (normalized > 0) {
    result = ((result << 1) & 15) | ((result & WEST) ? NORTH : 0);
    normalized -= 1;
  }
  return result;
}

export function currentMask(tile: TileState): number {
  return rotateMask(tile.baseMask, tile.rotation);
}

export function rotationPeriod(mask: number): number {
  if (rotateMask(mask, 1) === mask) return 1;
  if (rotateMask(mask, 2) === mask) return 2;
  return 4;
}

export function analyzeBoard(puzzle: PuzzleDefinition): BoardAnalysis {
  const byPosition = new Map<string, TileState>();
  const byId = new Map<string, TileState>();
  for (const tile of puzzle.tiles) {
    byPosition.set(`${tile.x},${tile.y}`, tile);
    byId.set(tile.id, tile);
  }

  const powered = new Set<string>();
  const queue = [puzzle.sourceId];
  powered.add(puzzle.sourceId);

  while (queue.length > 0) {
    const id = queue.shift() as string;
    const tile = byId.get(id);
    if (!tile) continue;
    const mask = currentMask(tile);
    for (const direction of DIRECTIONS) {
      if ((mask & direction) === 0) continue;
      const [dx, dy] = DELTA[direction];
      const neighbor = byPosition.get(`${tile.x + dx},${tile.y + dy}`);
      if (!neighbor || (currentMask(neighbor) & OPPOSITE[direction]) === 0) continue;
      if (!powered.has(neighbor.id)) {
        powered.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }
  }

  const leaks: { tileId: string; direction: DirectionBit }[] = [];
  for (const id of powered) {
    const tile = byId.get(id);
    if (!tile) continue;
    const mask = currentMask(tile);
    for (const direction of DIRECTIONS) {
      if ((mask & direction) === 0) continue;
      const [dx, dy] = DELTA[direction];
      const neighbor = byPosition.get(`${tile.x + dx},${tile.y + dy}`);
      if (!neighbor || (currentMask(neighbor) & OPPOSITE[direction]) === 0) {
        leaks.push({ tileId: tile.id, direction });
      }
    }
  }

  const plants = puzzle.tiles.filter((tile) => tile.kind === 'plant');
  const poweredPlants = plants.filter((tile) => powered.has(tile.id)).length;
  return {
    powered,
    poweredPlants,
    totalPlants: plants.length,
    leaks,
    solved: plants.length > 0 && poweredPlants === plants.length && leaks.length === 0,
  };
}
