# Arkadium Submission Copy

## Game name

**Clockwork Conservatory: Bloom Circuit**

## Genre

Puzzle / Logic / Connection

## Platform

Browser — responsive HTML5 for desktop, tablet, and mobile.

## Short description

Restore a forgotten clockwork greenhouse by rotating brass-and-glass mechanisms, routing luminous energy to every flower, and sealing every leak. Clockwork Conservatory combines easy-to-learn connection puzzles with premium botanical presentation, short satisfying sessions, Daily Bloom challenges, a restoration journey, collectible specimens, and accessible play for adult casual audiences.

## Why it fits Arkadium

- The rule is understandable in one sentence and the first level resolves in one guided action.
- Calm, nonviolent, grown-up visual direction with no account wall or external navigation.
- Short sessions support casual visits; Campaign, collection, Daily Bloom, streak, and scores support return play.
- Responsive on mouse, touch, and keyboard with reduced-motion, high-contrast, and localization support.
- Natural monetization breaks occur after completed level groups; rewarded ads are optional and player initiated.
- Compact standards-based build with deterministic content and no gameplay backend dependency.

## Core features

- Three authored onboarding levels and effectively unlimited verified procedural puzzles.
- Campaign, UTC Daily Bloom, and Zen modes.
- Stars, scores, progress map, active-run resume, five specimens, and daily streak.
- Garden Hint, undo, restart, view rotation, synthesized audio, and cinematic victory.
- Premium Canvas 2D renderer with art-directed packaged scenes and scalable quality profiles.

## Monetization plan

- Interstitial video only at natural chapter breaks after every third campaign completion, subject to producer tuning.
- Rewarded video for an optional additional Garden Hint after three free hints.
- No forced ad during an active puzzle and no reward on failed/cancelled ad completion.
- Architecture can support Arkadium-approved static placements outside the gameplay canvas if required by the host shell.

## Technical specification

- TypeScript / HTML5 / Canvas 2D / Web Audio.
- Arkadium Game SDK v2 integration for lifecycle, pause/resume, persistence, analytics, ads, and leaderboard.
- Responsive from wide landscape to tall portrait; state survives resize.
- Packaged output below one megabyte in the current release candidate, with automated size enforcement.
- No runtime AI service, API key, game server, third-party tracker, or remote art dependency.

## Current status

A complete playable release candidate is available. Remaining launch work is host-specific Arkadium Sandbox validation, production analytics/leaderboard identifiers, ad-cadence approval, native-language review, final real-device QA, and any producer-requested content tuning.

## Suggested form text

**Playable link:** `https://646826.github.io/ark-game-test/`

**Short description:**

> A premium botanical connection puzzle for adult casual players. Rotate clockwork mechanisms to route aetherlight from the Sunwell, bloom every plant, and eliminate every leak. Includes guided onboarding, Campaign, Daily Bloom, Zen, restoration progress, specimen collection, responsive touch/mouse/keyboard controls, and Arkadium SDK integration.

## Publishing-fund note

The playable vertical slice is already implemented. A requested development budget should be supplied by the project owner only if submitting through Arkadium’s Publishing Fund; it would depend on the agreed scope for authored chambers, seasonal content, additional art/audio, localization review, and live-operations support. The existing game can also be submitted through the licensing path without inventing a funding request.
