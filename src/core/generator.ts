import { clockwiseDistanceToSolved, rotationPeriod } from './board.js';
import { Random } from './random.js';
import {
  DIRECTIONS,
  type DirectionBit,
  type GameMode,
  type PlantKind,
  type PuzzleDefinition,
  type TileState,
} from './types.js';

const PLANTS: readonly PlantKind[] = ['lumen-orchid', 'moonbell', 'sun-dahlia', 'mist-lily', 'ember-bloom'];

export function dailySeed(date = new Date()): string {
  return `daily:${date.toISOString().slice(0, 10)}`;
}

export function generatePuzzle(options: { seed: string; mode: GameMode; level: number }): PuzzleDefinition {
  const { seed, mode, level } = options;
  const random = new Random(seed);
  const width = Math.min(6, 4 + Math.floor(Math.max(0, level - 4) / 18));
  const height = Math.min(5, 3 + Math.floor(Math.max(0, level - 7) / 14));
  const masks = new Map<string, number>();
  const visited = new Set<string>();
  const start = { x: random.integer(0, width - 1), y: random.integer(0, height - 1) };
  const stack = [start];
  visited.add(key(start.x, start.y));

  while (stack.length > 0) {
    const current = stack[stack.length - 1] as { x: number; y: number };
    const candidates = random.shuffle(
      DIRECTIONS.filter((direction) => {
        const x = current.x + direction.dx;
        const y = current.y + direction.dy;
        return x >= 0 && x < width && y >= 0 && y < height && !visited.has(key(x, y));
      }).map((direction) => ({ ...direction })),
    );
    const direction = candidates[0];
    if (!direction) {
      stack.pop();
      continue;
    }
    const nx = current.x + direction.dx;
    const ny = current.y + direction.dy;
    masks.set(key(current.x, current.y), (masks.get(key(current.x, current.y)) ?? 0) | direction.bit);
    masks.set(key(nx, ny), (masks.get(key(nx, ny)) ?? 0) | direction.opposite);
    visited.add(key(nx, ny));
    stack.push({ x: nx, y: ny });
  }

  // A few carefully bounded loops make later boards feel less tree-like while preserving a unique solved orientation.
  const loopAttempts = Math.min(3, Math.floor(level / 14));
  for (let index = 0; index < loopAttempts; index += 1) {
    const x = random.integer(0, width - 1);
    const y = random.integer(0, height - 1);
    const direction = random.pick(DIRECTIONS);
    const nx = x + direction.dx;
    const ny = y + direction.dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const a = key(x, y);
    const b = key(nx, ny);
    if (((masks.get(a) ?? 0) & direction.bit) !== 0) continue;
    masks.set(a, (masks.get(a) ?? 0) | direction.bit);
    masks.set(b, (masks.get(b) ?? 0) | direction.opposite);
  }

  const positions = [...masks.keys()].map((value) => {
    const [x, y] = value.split(',').map(Number);
    return { x: x ?? 0, y: y ?? 0, mask: masks.get(value) ?? 0 };
  });
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const sourcePosition = [...positions]
    .sort((left, right) => {
      const leftDegree = bitCount(left.mask);
      const rightDegree = bitCount(right.mask);
      const leftScore = Math.abs(left.x - centerX) + Math.abs(left.y - centerY) - Math.min(2, leftDegree) * 0.7;
      const rightScore = Math.abs(right.x - centerX) + Math.abs(right.y - centerY) - Math.min(2, rightDegree) * 0.7;
      return leftScore - rightScore;
    })[0] as { x: number; y: number; mask: number };

  const leaves = positions
    .filter((position) => bitCount(position.mask) === 1 && !(position.x === sourcePosition.x && position.y === sourcePosition.y))
    .sort((left, right) => distance(right, sourcePosition) - distance(left, sourcePosition));
  const plantCount = Math.min(leaves.length, Math.max(2, Math.min(6, 2 + Math.floor(level / 10))));
  const plantPool = leaves.slice(0, Math.max(plantCount, Math.ceil(leaves.length * 0.75)));
  const plantKeys = new Set(random.shuffle(plantPool).slice(0, plantCount).map((position) => key(position.x, position.y)));
  const sourceId = tileId(sourcePosition.x, sourcePosition.y);
  const fixedRate = Math.min(0.18, Math.max(0, level - 8) * 0.0045);

  const tiles: TileState[] = positions.map((position, index) => {
    const id = tileId(position.x, position.y);
    const isSource = id === sourceId;
    const isPlant = plantKeys.has(key(position.x, position.y));
    const period = rotationPeriod(position.mask);
    const fixed = isSource || isPlant || period === 1 || (!isSource && !isPlant && random.next() < fixedRate);
    const solutionRotation = 0;
    let rotation = fixed ? 0 : random.integer(0, period - 1);
    if (!fixed && period > 1 && random.next() < 0.74 && rotation === 0) rotation = random.integer(1, period - 1);
    return {
      id,
      x: position.x,
      y: position.y,
      baseMask: position.mask,
      kind: isSource ? 'source' : isPlant ? 'plant' : 'pipe',
      fixed,
      ...(isPlant ? { plantKind: PLANTS[(level + index) % PLANTS.length] as PlantKind } : {}),
      solutionRotation,
      rotation,
      visualTurns: rotation,
    };
  });

  if (tiles.every((tile) => tile.fixed || tile.rotation === tile.solutionRotation)) {
    const rotatable = tiles.find((tile) => !tile.fixed && rotationPeriod(tile.baseMask) > 1);
    if (rotatable) {
      rotatable.rotation = 1;
      rotatable.visualTurns = 1;
    }
  }

  const idealMoves = Math.max(1, tiles.reduce((sum, tile) => sum + clockwiseDistanceToSolved(tile), 0));
  return {
    seed,
    mode,
    level,
    width,
    height,
    sourceId,
    tiles,
    idealMoves,
    theme: Math.floor((Math.max(1, level) - 1) / 5) % 4,
  };
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function tileId(x: number, y: number): string {
  return `tile-${x}-${y}`;
}

function bitCount(value: number): number {
  let count = 0;
  let current = value & 15;
  while (current > 0) {
    count += current & 1;
    current >>= 1;
  }
  return count;
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}
