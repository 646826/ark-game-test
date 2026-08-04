# Premium Arkadium redesign — approved design

## Goal

Turn the existing Clockwork Conservatory prototype into a visually distinctive, production-minded HTML5 puzzle suitable for a playable Arkadium review link, while preserving the deterministic circuit mechanic and keeping the package exceptionally light.

## Approved direction

The approved option permits original generated concept art and optimized runtime assets. The product uses a premium botanical-clockwork world: deep teal glass, warm brass, greenhouse architecture, luminous aqua energy, atmospheric depth, and elegant adult-casual UI.

## Scope

- replace the presentation layer without adding a gameplay backend;
- preserve deterministic generation, analysis, hints, scoring, and saves;
- add authored onboarding, restoration map, collection, streak, and daily mode surfaces;
- support desktop, tablet, portrait mobile, pointer, touch, keyboard, reduced motion, and high contrast;
- isolate Arkadium integration behind a fault-tolerant adapter;
- keep ads at natural breaks and fail rewarded rewards closed;
- add automated release and browser gates.

## Architecture

- `core`: pure deterministic game state and calculations;
- `game`: stateful controller, Canvas renderer, and Web Audio;
- `platform`: SDK lifecycle, storage, ads, analytics, leaderboard;
- `ui`: localization;
- optimized environmental art is decorative and cannot affect game logic or hit testing.

## Success criteria

- a new player can complete the first level without external explanation;
- active flow, sleeping flowers, leaks, fixed pieces, and selected pieces are readable at mobile width;
- menu, map, gameplay, and victory appear as one coherent commercial product;
- no host/API failure prevents core play;
- strict build, deterministic tests, visual smoke tests, and package budgets pass.
