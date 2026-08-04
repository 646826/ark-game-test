export function calculateCompletion(puzzle, moves, hintsUsed, elapsedMs) {
    const ideal = Math.max(1, puzzle.idealMoves);
    const efficiency = Math.min(1, ideal / Math.max(ideal, moves));
    const parMs = Math.max(24_000, puzzle.tiles.length * 4_200);
    const timeFactor = Math.max(0.45, Math.min(1, parMs / Math.max(parMs, elapsedMs)));
    const stars = hintsUsed === 0 && efficiency >= 0.8 && timeFactor >= 0.72 ? 3 : efficiency >= 0.55 ? 2 : 1;
    const base = 1_000 + puzzle.level * 140 + puzzle.tiles.length * 125;
    const score = Math.max(250, Math.round(base * (0.68 + efficiency * 0.72 + timeFactor * 0.35) - hintsUsed * 220));
    return { score, stars, moves, elapsedMs, efficiency };
}
//# sourceMappingURL=scoring.js.map