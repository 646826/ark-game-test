import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });

const { analyzeBoard, currentMask, rotationPeriod } = await import('../dist/src/core/board.js');
const { generatePuzzle, tutorialPuzzle, dailySeed } = await import('../dist/src/core/generator.js');
const { suggestHint } = await import('../dist/src/core/hints.js');
const { createDefaultProgress, sanitizeProgress } = await import('../dist/src/core/progress.js');
const { calculateCompletion } = await import('../dist/src/core/scoring.js');

let generated = 0;
for (const mode of ['campaign', 'daily', 'zen']) {
  for (let level = 4; level <= 80; level += 2) {
    for (let variant = 0; variant < 2; variant += 1) {
      const seed = `${mode}:qa:${level}:${variant}`;
      const puzzle = generatePuzzle({ seed, mode, level });
      const duplicate = generatePuzzle({ seed, mode, level });
      generated += 1;

      assert.equal(puzzle.seed, seed);
      assert.equal(puzzle.tiles.length, new Set(puzzle.tiles.map((tile) => tile.id)).size, 'tile ids must be unique');
      assert.equal(puzzle.tiles.filter((tile) => tile.kind === 'source').length, 1, 'exactly one source is required');
      assert.ok(puzzle.tiles.filter((tile) => tile.kind === 'plant').length >= 2, 'generated boards need at least two plants');
      assert.ok(puzzle.parMoves > 0, 'generated boards must start with work to do');
      assert.deepEqual(
        duplicate.tiles.map((tile) => [tile.x, tile.y, tile.baseMask, tile.rotation, tile.kind, tile.fixed, tile.plantKind]),
        puzzle.tiles.map((tile) => [tile.x, tile.y, tile.baseMask, tile.rotation, tile.kind, tile.fixed, tile.plantKind]),
        'generation must be deterministic for a seed',
      );
      for (const tile of puzzle.tiles) {
        assert.ok(tile.baseMask >= 1 && tile.baseMask <= 15, `invalid mask ${tile.baseMask}`);
        assert.ok(tile.rotation >= 0 && tile.rotation < rotationPeriod(tile.baseMask));
        assert.ok(currentMask(tile) >= 1 && currentMask(tile) <= 15);
      }

      const initial = analyzeBoard(puzzle);
      assert.equal(initial.solved, false, `generated puzzle ${seed} should not start solved`);
      const hint = suggestHint(puzzle);
      assert.ok(hint, `generated puzzle ${seed} should provide a hint`);
      assert.ok(puzzle.tiles.some((tile) => tile.id === hint.tileId));
      assert.ok(hint.rotations >= 1 && hint.rotations <= 3);

      const solved = structuredClone(puzzle);
      for (const tile of solved.tiles) {
        tile.rotation = 0;
        tile.visualTurns = 0;
      }
      const solvedAnalysis = analyzeBoard(solved);
      assert.equal(solvedAnalysis.solved, true, `solution orientation failed for ${seed}`);
      assert.equal(solvedAnalysis.leaks.length, 0, `solution leaks for ${seed}`);
      assert.equal(solvedAnalysis.poweredPlants, solvedAnalysis.totalPlants);
    }
  }
}

for (const level of [1, 2, 3]) {
  const puzzle = tutorialPuzzle(level);
  assert.equal(analyzeBoard(puzzle).solved, false);
  let safety = 0;
  while (!analyzeBoard(puzzle).solved && safety < 8) {
    const hint = suggestHint(puzzle);
    assert.ok(hint, `tutorial ${level} should have a hint`);
    const tile = puzzle.tiles.find((candidate) => candidate.id === hint.tileId);
    assert.ok(tile);
    tile.rotation = (tile.rotation + hint.rotations) % rotationPeriod(tile.baseMask);
    tile.visualTurns += hint.rotations;
    safety += 1;
  }
  assert.equal(analyzeBoard(puzzle).solved, true, `tutorial ${level} must solve through hints`);
}

const today = new Date('2026-08-04T23:59:59Z');
assert.equal(dailySeed(today), 'daily:2026-08-04');

const clean = createDefaultProgress('fr');
assert.equal(clean.settings.language, 'fr');
assert.ok(JSON.stringify(clean).length < 32_000, 'remote save must fit the Arkadium per-value limit');
assert.ok(JSON.stringify(clean).length < 500_000, 'save must fit the Arkadium game-save limit');

const hostile = sanitizeProgress({
  campaignLevel: Infinity,
  totalScore: -999,
  unlockedSpecimens: ['lumen', 'lumen', 'invalid'],
  bestDaily: { '2026-08-04': 123, '__proto__': 99, bad: Infinity },
  settings: { language: 'xx', quality: 'ultra', sound: 'yes' },
  activeRun: { seed: 'x', mode: 'invalid', level: -1, rotations: [99] },
}, 'de');
assert.equal(hostile.campaignLevel, 1);
assert.equal(hostile.totalScore, 0);
assert.deepEqual(hostile.unlockedSpecimens, ['lumen']);
assert.equal(hostile.settings.language, 'de');
assert.equal(hostile.settings.quality, 'auto');
assert.equal(hostile.activeRun, undefined);
assert.deepEqual(hostile.bestDaily, { '2026-08-04': 123 });

const restored = sanitizeProgress({
  ...clean,
  activeRun: { seed: 'campaign:8', mode: 'campaign', level: 8, rotations: [0, 1, 2, 3], moves: 12, elapsedMs: 4500 },
});
assert.equal(restored.activeRun?.mode, 'campaign');
assert.deepEqual(restored.activeRun?.rotations, [0, 1, 2, 3]);

const scoringPuzzle = generatePuzzle({ seed: 'score-test', mode: 'campaign', level: 12 });
const excellent = calculateCompletion(scoringPuzzle, scoringPuzzle.parMoves, 0, 20_000);
const assisted = calculateCompletion(scoringPuzzle, scoringPuzzle.parMoves + 15, 3, 300_000);
assert.ok(excellent.score > assisted.score);
assert.ok(excellent.stars >= assisted.stars);
assert.ok(excellent.score >= 0 && assisted.score >= 0);

const report = JSON.parse(readFileSync('dist/build-report.json', 'utf8'));
assert.ok(report.initialBytes < 15 * 1024 * 1024);
assert.ok(report.totalBytes < 100 * 1024 * 1024);
assert.ok(report.files.some((file) => file.path === 'assets/atrium-desktop.webp'));
assert.ok(report.files.some((file) => file.path === 'assets/garden-portrait.webp'));

console.log(`Core tests passed: ${generated} generated puzzles, 3 tutorials, persistence hardening, scoring, and bundle budgets.`);
