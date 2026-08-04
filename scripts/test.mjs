import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';

const root = new URL('..', import.meta.url).pathname;
const build = spawnSync(process.execPath, [join(root, 'scripts', 'build.mjs')], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const board = await import(new URL('../dist/src/core/board.js', import.meta.url));
const generator = await import(new URL('../dist/src/core/generator.js', import.meta.url));
const tutorial = await import(new URL('../dist/src/core/tutorial.js', import.meta.url));
const progress = await import(new URL('../dist/src/core/progress.js', import.meta.url));
const scoring = await import(new URL('../dist/src/core/scoring.js', import.meta.url));

let assertions = 0;
const assert = (condition, message) => { assertions += 1; if (!condition) throw new Error(message); };

for (let level = 1; level <= 3; level += 1) {
  const puzzle = tutorial.tutorialForLevel(level);
  assert(puzzle, `tutorial ${level} exists`);
  const start = board.analyzeBoard(puzzle);
  assert(!start.solved, `tutorial ${level} starts unsolved`);
  const target = puzzle.tiles.find((tile) => tile.id === puzzle.tutorial.targetId);
  assert(target && !target.fixed, `tutorial ${level} target is rotatable`);
  target.rotation = (target.rotation + 1) % board.rotationPeriod(target.baseMask);
  assert(board.analyzeBoard(puzzle).solved, `tutorial ${level} solves in one action`);
}

for (const mode of ['campaign', 'daily', 'zen']) {
  for (let level = 4; level <= 70; level += 1) {
    const seed = `${mode}:test:${level}`;
    const first = generator.generatePuzzle({ seed, mode, level });
    const second = generator.generatePuzzle({ seed, mode, level });
    assert(JSON.stringify(first) === JSON.stringify(second), `${mode} ${level} is deterministic`);
    assert(first.tiles.length <= 30, `${mode} ${level} stays within board budget`);
    const solved = board.solvedClone(first);
    assert(board.analyzeBoard(solved).solved, `${mode} ${level} has a valid solved state`);
    assert(board.suggestHint(first) !== null, `${mode} ${level} exposes a usable hint`);
  }
}

const sanitized = progress.sanitizeProgress({ campaignLevel: 9, totalScore: 100, settings: { language: 'ru', quality: 'low' }, specimens: ['lumen-orchid', 'bad'] }, 'en');
assert(sanitized.schema === 3, 'save schema is upgraded');
assert(sanitized.settings.language === 'ru', 'supported language is preserved');
assert(sanitized.settings.quality === 'balanced', 'legacy quality is normalized');
const score = scoring.calculateCompletion(generator.generatePuzzle({ seed: 'score', mode: 'campaign', level: 9 }), 12, 0, 40_000);
assert(score.score > 0 && score.stars >= 1 && score.stars <= 3, 'scoring returns a valid result');

console.log(`Passed ${assertions} deterministic gameplay assertions.`);
