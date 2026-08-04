import { canonicalizeMask, rotateMask, rotationsToTarget } from './board.js';
import { Direction } from './types.js';
const TUTORIAL_GENERATOR_VERSION = 100;
export function tutorialForLevel(level) {
    if (level === 1) {
        return createTutorial(1, config(3, 3, 3, 1), [
            tile(0, 1, 'source', Direction.East, Direction.East, true),
            tile(1, 1, 'path', Direction.East | Direction.West, Direction.North | Direction.South, false),
            tile(2, 1, 'plant', Direction.West, Direction.West, true, 'aster'),
        ], idFor(0, 1), idFor(1, 1));
    }
    if (level === 2) {
        return createTutorial(2, config(3, 3, 3, 1), [
            tile(0, 2, 'source', Direction.East, Direction.East, true),
            tile(1, 2, 'path', Direction.West | Direction.North, Direction.South | Direction.West, false),
            tile(1, 1, 'plant', Direction.South, Direction.South, true, 'fern'),
        ], idFor(0, 2), idFor(1, 2));
    }
    if (level === 3) {
        return createTutorial(3, config(4, 3, 5, 2), [
            tile(0, 1, 'source', Direction.East, Direction.East, true),
            tile(1, 1, 'path', Direction.West | Direction.North | Direction.East, Direction.North | Direction.South | Direction.West, false),
            tile(1, 0, 'plant', Direction.South, Direction.South, true, 'orchid'),
            tile(2, 1, 'path', Direction.East | Direction.West, Direction.East | Direction.West, true),
            tile(3, 1, 'plant', Direction.West, Direction.West, true, 'lotus'),
        ], idFor(0, 1), idFor(1, 1));
    }
    return null;
}
export function isTutorialSeed(seed) {
    return /^tutorial:[1-3]:clockwork-v2$/.test(seed);
}
function createTutorial(step, difficulty, tiles, sourceId, targetTileId) {
    const puzzle = {
        seed: `tutorial:${step}:clockwork-v2`,
        mode: 'campaign',
        level: step,
        config: difficulty,
        tiles,
        sourceId,
        optimalMoves: tiles.reduce((sum, candidate) => sum + rotationsToTarget(candidate), 0),
        generatedAtVersion: TUTORIAL_GENERATOR_VERSION,
    };
    return { puzzle, step, targetTileId };
}
function config(cols, rows, activeCells, plants) {
    return {
        tier: 0,
        cols,
        rows,
        activeCells,
        minPlants: plants,
        maxPlants: plants,
        preSolvedChance: 0,
        fixedChance: 0,
    };
}
function tile(x, y, kind, solutionMask, startingMask, fixed, plantKind) {
    const { baseMask, targetRotation } = canonicalizeMask(solutionMask);
    const rotation = rotationForMask(baseMask, startingMask);
    const common = {
        id: idFor(x, y),
        x,
        y,
        kind,
        baseMask,
        solutionMask,
        targetRotation,
        fixed,
        rotation,
        visualTurns: rotation,
    };
    return plantKind ? { ...common, kind: 'plant', plantKind } : common;
}
function rotationForMask(baseMask, desiredMask) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
        if (rotateMask(baseMask, rotation) === desiredMask) {
            return rotation;
        }
    }
    throw new Error(`Tutorial mask ${desiredMask} is not a rotation of ${baseMask}.`);
}
function idFor(x, y) {
    return `tile-${x}-${y}`;
}
//# sourceMappingURL=tutorial.js.map