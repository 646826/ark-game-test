import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeBoard, currentMask, rotateMask, rotationsToTarget } from '../dist/src/core/board.js';
import { difficultyFor } from '../dist/src/core/difficulty.js';
import { dailySeed, generatePuzzle } from '../dist/src/core/generator.js';
import { suggestHint } from '../dist/src/core/hints.js';
import { createDefaultProgress, sanitizeProgress, serializedSize } from '../dist/src/core/progress.js';
import { calculateCompletion } from '../dist/src/core/scoring.js';
import { tutorialForLevel } from '../dist/src/core/tutorial.js';
import { Direction } from '../dist/src/core/types.js';

test('direction masks rotate clockwise and preserve four-bit topology', () => {
  assert.equal(rotateMask(Direction.North, 1), Direction.East);
  assert.equal(rotateMask(Direction.North, 2), Direction.South);
  assert.equal(rotateMask(Direction.West, 1), Direction.North);
  assert.equal(rotateMask(Direction.North | Direction.South, 1), Direction.East | Direction.West);
  assert.equal(rotateMask(0b1111, 13), 0b1111);
});

test('generator is deterministic, unsolved at start, and solution-verified across modes', () => {
  const samples = [];
  for (const mode of ['campaign', 'daily', 'zen']) {
    for (let level = 1; level <= 80; level += 1) {
      const config = difficultyFor(level, (level % 11) / 10, mode);
      const seed = `verification:${mode}:${level}`;
      const first = generatePuzzle({ seed, mode, level, config });
      const second = generatePuzzle({ seed, mode, level, config });
      assert.deepEqual(
        first.tiles.map((tile) => [tile.id, tile.baseMask, tile.rotation, tile.targetRotation, tile.fixed]),
        second.tiles.map((tile) => [tile.id, tile.baseMask, tile.rotation, tile.targetRotation, tile.fixed]),
      );
      assert.equal(analyzeBoard(first).solved, false, `${mode} level ${level} must start unsolved`);
      assert.ok(first.optimalMoves > 0);
      assert.ok(first.tiles.length <= config.cols * config.rows);
      for (const tile of first.tiles) {
        tile.rotation = tile.targetRotation;
        tile.visualTurns = tile.targetRotation;
        assert.equal(currentMask(tile), tile.solutionMask);
      }
      const solved = analyzeBoard(first);
      assert.equal(solved.solved, true, `${mode} level ${level} has a verified solution`);
      assert.equal(solved.leaks.length, 0);
      samples.push(first.tiles.length);
    }
  }
  assert.ok(Math.min(...samples) >= 10);
});

test('three authored onboarding puzzles each teach one action and remain solution-verified', () => {
  for (const level of [1, 2, 3]) {
    const tutorial = tutorialForLevel(level);
    assert.ok(tutorial, `missing tutorial level ${level}`);
    const { puzzle, targetTileId } = tutorial;
    const target = puzzle.tiles.find((tile) => tile.id === targetTileId);
    assert.ok(target, `missing target tile for tutorial ${level}`);
    assert.equal(target.fixed, false);
    assert.equal(puzzle.optimalMoves, 1);
    assert.equal(analyzeBoard(puzzle).solved, false);

    target.rotation = (target.rotation + 1) % 4;
    target.visualTurns += 1;
    const solved = analyzeBoard(puzzle);
    assert.equal(solved.solved, true, `tutorial ${level} must solve after one clockwise turn`);
    assert.equal(solved.poweredPlants, solved.totalPlants);
    assert.equal(solved.leaks.length, 0);
  }
  assert.equal(tutorialForLevel(4), null);
});

test('local AI hint always points to a legal, useful correction', () => {
  for (let level = 1; level <= 100; level += 1) {
    const config = difficultyFor(level, 0.55, 'campaign');
    const puzzle = generatePuzzle({ seed: `hint:${level}`, mode: 'campaign', level, config });
    const hint = suggestHint(puzzle);
    assert.ok(hint, `missing hint for level ${level}`);
    const tile = puzzle.tiles.find((candidate) => candidate.id === hint.tileId);
    assert.ok(tile);
    assert.equal(tile.fixed, false);
    assert.ok(hint.rotations >= 1 && hint.rotations <= 3);
    assert.ok(rotationsToTarget(tile) > 0 || hint.reason === 'immediate-improvement');
  }
});

test('daily seed uses UTC and is stable for the whole calendar day', () => {
  assert.equal(dailySeed(new Date('2026-08-03T00:01:00Z')), 'daily:2026-08-03');
  assert.equal(dailySeed(new Date('2026-08-03T23:59:59Z')), 'daily:2026-08-03');
});

test('progress sanitization is defensive and remains far below the save budget', () => {
  const fallback = createDefaultProgress('en');
  const progress = sanitizeProgress(
    {
      schemaVersion: 1,
      campaignLevel: 42.7,
      totalScore: -100,
      settings: { sound: false, reducedMotion: true, highContrast: true, language: 'es' },
      skill: { rating: 10, emaEfficiency: -2, emaSecondsPerTile: 4, hintRate: 0.2, streak: 4, completed: 8 },
      bestDaily: { '2026-08-03': 1234, nope: 999 },
    },
    'en',
  );
  assert.equal(progress.campaignLevel, 43);
  assert.equal(progress.totalScore, 0);
  assert.equal(progress.settings.language, 'es');
  assert.equal(progress.skill.rating, 0.98);
  assert.deepEqual(progress.bestDaily, { '2026-08-03': 1234 });
  assert.ok(serializedSize(progress) < 32 * 1024);
  assert.ok(serializedSize(fallback) < 2 * 1024);
  assert.deepEqual(sanitizeProgress({ schemaVersion: 999, campaignLevel: 900 }, 'en'), fallback);
});

test('scoring rewards efficient play and applies hint/mode modifiers', () => {
  const config = difficultyFor(4, 0.4, 'campaign');
  const puzzle = generatePuzzle({ seed: 'score', mode: 'campaign', level: 4, config });
  const perfect = calculateCompletion(puzzle, puzzle.optimalMoves, 0, 40_000);
  const assisted = calculateCompletion(puzzle, puzzle.optimalMoves * 2, 4, 180_000);
  assert.ok(perfect.score > assisted.score);
  assert.ok(perfect.stars >= assisted.stars);
  assert.equal(perfect.moves, puzzle.optimalMoves);
});
