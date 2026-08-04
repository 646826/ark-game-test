export function calculateCompletion(puzzle, moves, hintsUsed, elapsedMs) {
    const par = Math.max(1, puzzle.parMoves);
    const efficiency = Math.max(0, 1 - Math.max(0, moves - par) / Math.max(4, par * 1.8));
    const timeTarget = Math.max(20000, puzzle.tiles.length * 4500);
    const timeFactor = Math.max(0.25, Math.min(1, timeTarget / Math.max(timeTarget, elapsedMs)));
    const base = 800 + puzzle.level * 90 + puzzle.tiles.length * 70;
    const score = Math.max(100, Math.round((base * (0.65 + efficiency * 0.75) * (0.75 + timeFactor * 0.25) - hintsUsed * 120) / 10) * 10);
    const stars = moves <= par + 1 && hintsUsed === 0 ? 3 : moves <= Math.ceil(par * 1.7) && hintsUsed <= 1 ? 2 : 1;
    return { score, stars, moves, elapsedMs, parMoves: par };
}
//# sourceMappingURL=scoring.js.map