# Production QA Plan

## Automated gate

`npm run ci` must pass on every pull request and main-branch commit.

- Strict TypeScript compilation.
- Static checks for all expected Arkadium lifecycle/persistence/ad calls.
- Guards against fullscreen, redirects, clipboard-adjacent unsafe behavior, and dynamic code execution.
- Determinism checks for campaign, daily, and Zen generation.
- Solver verification across 240 generated puzzles.
- AI hint validity across 100 generated puzzles.
- Save-schema sanitization and size checks.
- Scoring behavior checks.
- Build-budget enforcement.

`npm run smoke` additionally boots the production JavaScript in Chromium, enters campaign and daily modes, checks page errors and horizontal overflow, and captures desktop/mobile screenshots.

## Manual gameplay matrix

### Core flow

- New campaign, continue saved campaign, restart, undo, pause, return to menu, next level.
- Complete boards with one, two, and three stars.
- Daily replay and best-score update.
- Zen new-board loop.
- All three free hints; rewarded hint success, cancel, and ad unavailable.
- Interstitial trigger after campaign levels 3, 6, and 9 only.

### Input

- Mouse, touch, trackpad, keyboard-only, and screen-reader-assisted keyboard.
- Rapid repeated tile input, resize during tile animation, rotate view during hint state.
- Browser back/forward and iframe focus changes must not create duplicate moves.

### Display sizes

At minimum: 1920×1080, 1366×768, 1024×768, 844×390, 390×844, 320×640, and embedded 2:1 / 1:2 extremes. Check no clipped dialog, inaccessible toolbar, overlap, blurry canvas, or lost focus.

### SDK Sandbox

- Status indicators for all lifecycle events.
- Anonymous local save and authorized remote save.
- Mock-user toggle during separate fresh Sandbox loads.
- Pause/resume controls while timer and audio are active.
- Interstitial and rewarded ad mock states.
- Leaderboard supported/unsupported states.
- Game display-setting combinations.

### Browser/device matrix

Current Chrome, Edge, Firefox, Safari desktop; current iOS Safari and Android Chrome; at least one lower-memory mobile device. Validate first interaction under five seconds on a normal mobile network and >=30 FPS during dense 8×8 play.

### Reliability and soak

- One-hour continuous play with periodic resize, pause, settings, and mode changes.
- Observe heap, DOM node count, RAF count, and audio nodes for unbounded growth.
- Offline launch after the static assets are cached; SDK unreachable; ad error; persistence exception.
- Corrupt/truncated/oversized save values should restore safe defaults without blocking the game.

## Release exit criteria

No blocker or critical defects, no reproducible crash, no lifecycle validation failure, no data-loss defect, no inaccessible core action, and no supported viewport with clipped gameplay. High-severity defects need producer-approved disposition before submission.
