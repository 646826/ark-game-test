# Premium Conservatory Redesign — Validated Design

## Goal

Turn the original functional Clockwork Conservatory prototype into a publication-oriented Arkadium candidate with a clear adult-casual identity, strong first-session comprehension, a memorable completion payoff, and reliable desktop/mobile operation.

## Chosen approach

Use a hybrid premium 2.5D pipeline:

- optimized packaged greenhouse backdrops for atmosphere;
- procedural foreground mechanisms, pipes, plants, state indicators, particles, and lighting;
- semantic DOM UI over a deterministic Canvas puzzle renderer;
- no runtime AI, 3D engine, remote font, or gameplay backend.

This approach preserves a very small initial payload, makes every gameplay state readable and animatable, avoids sprite explosion, and retains graceful fallback when optional art or Arkadium services fail.

## Visual system

- Deep teal greenhouse environments with warm brass trim and cyan aetherlight.
- Layered platform top, bevel, sidewall, rivet, pipe, gear, source, plant, leak, selection, hint, fixed, and victory states.
- Isometric desktop/small-board composition; dense portrait boards switch to a larger top-down 2.5D projection.
- Menu, HUD, toolbar, settings, tutorial, pause, and completion use live accessible text rather than baked image text.
- Scene art is lazy except the title backdrop.

## Product system

- Three authored onboarding boards.
- Campaign chamber progression, specimens, stars, cumulative score.
- Date-stable Daily Bloom with streak/best/leaderboard.
- Zen mode, resume, undo, local hints, restart, view rotation.
- Three free hints, then optional fail-closed rewarded hints.
- Interstitials only after completed campaign groups.

## Platform architecture

- Puzzle model, generator, analysis, hints, scoring, and save sanitation are independent of rendering.
- Canvas renderer has one bounded animation loop and adaptive DPR/quality tiers.
- Arkadium SDK adapter owns lifecycle, persistence, analytics, ads, leaderboard, and host pause/resume.
- Mandatory lifecycle events use a bounded ordered outbox for late SDK connection.
- Core gameplay stays available in standalone mode.

## Acceptance criteria

- Strict TypeScript passes.
- Hundreds of deterministic generated boards solve in the canonical orientation.
- Desktop and mobile menu/game/victory smoke tests pass.
- Dense portrait board remains readable and tappable.
- Mocked SDK emits ready/start/level/score events in order and registers pause/resume.
- Initial and total output remain below Arkadium recommendations.
- Save remains below remote and aggregate platform limits.
- Release docs clearly distinguish local evidence from Sandbox/manual work.
