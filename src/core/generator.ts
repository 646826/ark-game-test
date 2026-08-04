import { DELTA, OPPOSITE, rotationPeriod } from './board.js';
import { difficultyFor } from './difficulty.js';
import { Random } from './random.js';
import { DIRECTIONS, EAST, NORTH, SOUTH, WEST, type DirectionBit, type GameMode, type PlantKind, type PuzzleDefinition, type TileState } from './types.js';

const PLANTS: readonly PlantKind[] = ['lumen', 'orchid', 'starbell', 'ember', 'moonfern'];

interface Cell { x: number; y: number; }

export function dailySeed(date = new Date()): string {
  return `daily:${date.toISOString().slice(0, 10)}`;
}

export function generatePuzzle(options: { seed: string; mode: GameMode; level: number }): PuzzleDefinition {
  if (options.mode === 'campaign' && options.level <= 3) return tutorialPuzzle(options.level as 1 | 2 | 3);
  const config = difficultyFor(options.level, options.mode);
  const rng = new Random(options.seed);
  const all: Cell[] = [];
  for (let y = 0; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) all.push({ x, y });
  }

  const active = new Map(all.map((cell) => [`${cell.x},${cell.y}`, cell]));
  // Remove only cells whose deletion keeps the remaining grid connected.
  for (const candidate of rng.shuffle([...all])) {
    if (active.size <= Math.max(8, config.width * config.height - config.holes)) break;
    if (candidate.x === Math.floor(config.width / 2) && candidate.y === 0) continue;
    active.delete(`${candidate.x},${candidate.y}`);
    if (!isConnected(active)) active.set(`${candidate.x},${candidate.y}`, candidate);
  }

  const cells = [...active.values()];
  const source = cells.reduce((best, cell) => {
    const score = Math.abs(cell.x - (config.width - 1) / 2) + cell.y * 0.35;
    const bestScore = Math.abs(best.x - (config.width - 1) / 2) + best.y * 0.35;
    return score < bestScore ? cell : best;
  }, cells[0] as Cell);

  const treeEdges = randomizedTree(active, source, rng);
  const masks = new Map<string, number>(cells.map((cell) => [`${cell.x},${cell.y}`, 0]));
  for (const [a, b, direction] of treeEdges) {
    masks.set(key(a), (masks.get(key(a)) ?? 0) | direction);
    masks.set(key(b), (masks.get(key(b)) ?? 0) | OPPOSITE[direction]);
  }

  let leaves = cells.filter((cell) => bitCount(masks.get(key(cell)) ?? 0) === 1 && key(cell) !== key(source));
  if (leaves.length < 2) leaves = cells.filter((cell) => key(cell) !== key(source)).slice(-2);
  const desiredPlants = Math.min(leaves.length, Math.max(2, Math.round(Math.sqrt(cells.length))));
  const selectedPlants = new Set(rng.shuffle([...leaves]).slice(0, desiredPlants).map(key));

  const tiles: TileState[] = cells.map((cell, index) => {
    const baseMask = masks.get(key(cell)) ?? 0;
    const sourceCell = key(cell) === key(source);
    const plant = selectedPlants.has(key(cell));
    const period = rotationPeriod(baseMask);
    const fixed = sourceCell || (!plant && rng.next() < config.fixedRatio);
    let rotation = fixed || period === 1 ? 0 : rng.int(0, period - 1);
    if (!fixed && rotation === 0 && rng.next() < 0.72) rotation = 1 % period;
    return {
      id: `tile-${index}-${cell.x}-${cell.y}`,
      x: cell.x,
      y: cell.y,
      baseMask,
      kind: sourceCell ? 'source' : plant ? 'plant' : 'gear',
      plantKind: plant ? PLANTS[(index + options.level) % PLANTS.length] : undefined,
      fixed,
      rotation,
      visualTurns: rotation,
    };
  });

  const parMoves = tiles.reduce((sum, tile) => {
    const period = rotationPeriod(tile.baseMask);
    return sum + (tile.fixed ? 0 : (period - tile.rotation) % period);
  }, 0);

  // Guarantee that the starting board is not already solved.
  if (parMoves === 0) {
    const candidate = tiles.find((tile) => !tile.fixed && rotationPeriod(tile.baseMask) > 1);
    if (candidate) {
      candidate.rotation = 1;
      candidate.visualTurns = 1;
    }
  }

  return {
    seed: options.seed,
    mode: options.mode,
    level: options.level,
    width: config.width,
    height: config.height,
    tiles,
    sourceId: tiles.find((tile) => tile.kind === 'source')?.id ?? tiles[0]?.id ?? '',
    config,
    parMoves: Math.max(1, tiles.reduce((sum, tile) => {
      const period = rotationPeriod(tile.baseMask);
      return sum + (tile.fixed ? 0 : (period - tile.rotation) % period);
    }, 0)),
  };
}

function randomizedTree(active: Map<string, Cell>, start: Cell, rng: Random): Array<[Cell, Cell, DirectionBit]> {
  const visited = new Set<string>([key(start)]);
  const edges: Array<[Cell, Cell, DirectionBit]> = [];
  const frontier: Array<[Cell, Cell, DirectionBit]> = neighbors(start, active).map(([cell, direction]) => [start, cell, direction]);
  while (frontier.length > 0) {
    const index = rng.int(0, frontier.length - 1);
    const [from, to, direction] = frontier.splice(index, 1)[0] as [Cell, Cell, DirectionBit];
    if (visited.has(key(to))) continue;
    visited.add(key(to));
    edges.push([from, to, direction]);
    for (const [next, nextDirection] of neighbors(to, active)) {
      if (!visited.has(key(next))) frontier.push([to, next, nextDirection]);
    }
  }
  return edges;
}

function neighbors(cell: Cell, active: Map<string, Cell>): Array<[Cell, DirectionBit]> {
  const result: Array<[Cell, DirectionBit]> = [];
  for (const direction of DIRECTIONS) {
    const [dx, dy] = DELTA[direction];
    const neighbor = active.get(`${cell.x + dx},${cell.y + dy}`);
    if (neighbor) result.push([neighbor, direction]);
  }
  return result;
}

function isConnected(active: Map<string, Cell>): boolean {
  const first = active.values().next().value as Cell | undefined;
  if (!first) return false;
  const seen = new Set<string>([key(first)]);
  const queue = [first];
  while (queue.length > 0) {
    const current = queue.shift() as Cell;
    for (const [neighbor] of neighbors(current, active)) {
      if (!seen.has(key(neighbor))) {
        seen.add(key(neighbor));
        queue.push(neighbor);
      }
    }
  }
  return seen.size === active.size;
}

function key(cell: Cell): string { return `${cell.x},${cell.y}`; }
function bitCount(mask: number): number { let value = mask; let count = 0; while (value) { count += value & 1; value >>>= 1; } return count; }

export function tutorialPuzzle(level: 1 | 2 | 3): PuzzleDefinition {
  const config = difficultyFor(level, 'campaign');
  const definitions: Record<1 | 2 | 3, Array<{ x: number; y: number; mask: number; kind: 'source' | 'gear' | 'plant'; rotation?: number; fixed?: boolean; plant?: PlantKind }>> = {
    1: [
      { x: 0, y: 1, mask: EAST, kind: 'source', fixed: true },
      { x: 1, y: 1, mask: EAST | WEST, kind: 'gear', rotation: 1 },
      { x: 2, y: 1, mask: WEST, kind: 'plant', fixed: true, plant: 'lumen' },
    ],
    2: [
      { x: 1, y: 0, mask: SOUTH, kind: 'source', fixed: true },
      { x: 1, y: 1, mask: NORTH | EAST | WEST, kind: 'gear', rotation: 3 },
      { x: 0, y: 1, mask: EAST, kind: 'plant', fixed: true, plant: 'orchid' },
      { x: 2, y: 1, mask: WEST, kind: 'plant', fixed: true, plant: 'starbell' },
    ],
    3: [
      { x: 0, y: 0, mask: EAST, kind: 'source', fixed: true },
      { x: 1, y: 0, mask: EAST | WEST, kind: 'gear', fixed: true },
      { x: 2, y: 0, mask: SOUTH | WEST, kind: 'gear', rotation: 1 },
      { x: 2, y: 1, mask: NORTH | SOUTH, kind: 'gear' },
      { x: 2, y: 2, mask: NORTH | WEST, kind: 'gear' },
      { x: 1, y: 2, mask: EAST | WEST, kind: 'gear' },
      { x: 0, y: 2, mask: EAST, kind: 'plant', fixed: true, plant: 'moonfern' },
    ],
  };
  const tiles = definitions[level].map((entry, index): TileState => ({
    id: `tutorial-${level}-${index}`,
    x: entry.x,
    y: entry.y,
    baseMask: entry.mask,
    kind: entry.kind,
    plantKind: entry.plant,
    fixed: entry.fixed ?? entry.kind !== 'gear',
    rotation: entry.rotation ?? 0,
    visualTurns: entry.rotation ?? 0,
  }));
  return {
    seed: `tutorial:${level}`,
    mode: 'campaign',
    level,
    width: 3,
    height: 3,
    tiles,
    sourceId: tiles.find((tile) => tile.kind === 'source')?.id ?? tiles[0]?.id ?? '',
    config,
    parMoves: level === 1 || level === 2 ? 1 : 3,
    tutorial: level,
  };
}
