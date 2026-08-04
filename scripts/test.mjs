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
const performance = await import(new URL('../dist/src/core/performance.js', import.meta.url));

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
assert(sanitized.schema === 4, 'save schema is upgraded');
assert(sanitized.settings.language === 'ru', 'supported language is preserved');
assert(sanitized.settings.quality === 'balanced', 'legacy quality is normalized');
assert(sanitized.settings.haptics === true, 'legacy saves enable touch feedback by default');

const desktopSignals = {
  width: 1440, height: 900, devicePixelRatio: 1, deviceMemory: 8, hardwareConcurrency: 8,
  saveData: false, effectiveType: '4g', coarsePointer: false,
};
const lowMobileSignals = {
  width: 390, height: 844, devicePixelRatio: 3, deviceMemory: 4, hardwareConcurrency: 4,
  saveData: false, effectiveType: '4g', coarsePointer: true,
};
const strongMobileSignals = {
  width: 390, height: 844, devicePixelRatio: 2, deviceMemory: 8, hardwareConcurrency: 8,
  saveData: false, effectiveType: '4g', coarsePointer: true,
};
assert(performance.resolveAutoQuality(desktopSignals) === 'high', 'desktop auto quality resolves to high');
assert(performance.resolveAutoQuality(lowMobileSignals) === 'balanced', 'constrained mobile resolves to balanced');
assert(performance.resolveAutoQuality(strongMobileSignals) === 'high', 'strong mobile retains high quality');
const balancedProfile = performance.resolveRenderProfile('balanced', lowMobileSignals);
const fittedDpr = performance.fitDevicePixelRatio(390, 844, 3, balancedProfile);
assert(fittedDpr <= 1.5, 'balanced DPR respects the profile cap');
assert(Math.round(390 * fittedDpr) * Math.round(844 * fittedDpr) <= balancedProfile.maxCanvasPixels + 2_000, 'balanced canvas respects the pixel budget');
assert(performance.shouldAutoDowngrade(Array.from({ length: 72 }, (_, index) => index % 3 === 0 ? 18 : 11)), 'sustained expensive frames trigger adaptive downgrade');
assert(!performance.shouldAutoDowngrade(Array.from({ length: 72 }, () => 4)), 'smooth frames do not trigger adaptive downgrade');

const score = scoring.calculateCompletion(generator.generatePuzzle({ seed: 'score', mode: 'campaign', level: 9 }), 12, 0, 40_000);
assert(score.score > 0 && score.stars >= 1 && score.stars <= 3, 'scoring returns a valid result');

console.log(`Passed ${assertions} deterministic gameplay assertions.`);
