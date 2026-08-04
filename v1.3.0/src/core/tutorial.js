import { EAST, NORTH, SOUTH, WEST } from './types.js';
export function tutorialForLevel(level) {
    if (level === 1) {
        return puzzle(1, 3, 1, [
            tile(0, 0, EAST, 'source', true, 0),
            tile(1, 0, EAST | WEST, 'pipe', false, 1),
            tile(2, 0, WEST, 'plant', true, 0, 'lumen-orchid'),
        ], {
            title: 'Guide the bloom current',
            body: 'Rotate the highlighted mechanism to carry aetherlight to the sleeping flower.',
            targetId: 'tile-1-0',
            step: 1,
        });
    }
    if (level === 2) {
        return puzzle(2, 2, 2, [
            tile(0, 0, EAST, 'source', true, 0),
            tile(1, 0, WEST | SOUTH, 'pipe', false, 3),
            tile(1, 1, NORTH, 'plant', true, 0, 'moonbell'),
        ], {
            title: 'Turn the corner',
            body: 'Align the curved channel. Every open powered port becomes a visible leak.',
            targetId: 'tile-1-0',
            step: 2,
        });
    }
    if (level === 3) {
        return puzzle(3, 3, 2, [
            tile(0, 1, EAST, 'source', true, 0),
            tile(1, 1, WEST | NORTH | EAST, 'pipe', false, 3),
            tile(1, 0, SOUTH, 'plant', true, 0, 'mist-lily'),
            tile(2, 1, WEST, 'plant', true, 0, 'sun-dahlia'),
        ], {
            title: 'Awaken every bloom',
            body: 'Rotate the branch once so the current reaches both flowers without escaping.',
            targetId: 'tile-1-1',
            step: 3,
        });
    }
    return null;
}
function tile(x, y, baseMask, kind, fixed, rotation, plantKind) {
    return {
        id: `tile-${x}-${y}`,
        x,
        y,
        baseMask,
        kind,
        fixed,
        ...(plantKind ? { plantKind } : {}),
        solutionRotation: 0,
        rotation,
        visualTurns: rotation,
    };
}
function puzzle(level, width, height, tiles, tutorial) {
    return {
        seed: `tutorial:${level}`,
        mode: 'campaign',
        level,
        width,
        height,
        sourceId: tiles.find((item) => item.kind === 'source')?.id ?? tiles[0]?.id ?? '',
        tiles,
        idealMoves: 1,
        theme: 0,
        tutorial,
    };
}
//# sourceMappingURL=tutorial.js.map