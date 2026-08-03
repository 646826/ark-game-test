# Production QA Plan

## Automated gate

`npm run ci` must pass on every pull request and main-branch commit.

- Strict TypeScript compilation.
- Static checks for expected Arkadium lifecycle, persistence, and ad calls.
- Release guards against fullscreen, redirects, dynamic code execution, the obsolete solved-round reason, and permissive rewarded fallback.
- Determinism and solver verification across 240 generated campaign, Daily, and Zen puzzles.
- Verification that all three authored onboarding boards start unsolved, target an adjustable mechanism, require one clockwise move, power every plant, and finish with zero leaks.
- Garden Hint validity across 100 generated puzzles.
- Save-schema sanitization and size checks.
- Scoring behavior checks.
- Build-budget enforcement.

`npm run smoke` boots the production JavaScript in Chromium and now covers:

- menu, guided desktop, guided portrait mobile, dense portrait Daily, and 2:1 landscape layouts;
- page errors, canvas presence, and horizontal overflow;
- a real one-click tutorial completion;
- the in-board victory sequence and result card;
- first specimen unlock feedback and clean removal of the completed active-run save;
- late Arkadium SDK availability after standalone timeout, asserting replay order `onTestReady → onGameStart → onLevelStart`.

## Manual gameplay matrix

### First-session onboarding

- Fresh profile receives authored levels 1, 2, and 3 in order.
- Each level can be understood and solved without opening Help.
- Wrong pointer and keyboard selections do not consume a move and return focus to the glowing target.
- Level 1 has no leak/anchor visual noise; level 2 introduces the active leak marker; level 3 introduces anchored pieces.
- First successful bloom should occur within 15–25 seconds for a new test player.
- Closing the page after the solved state is saved but before the result card must resume directly into completion, not an already-solved interactive board.

### Core flow

- New campaign, continue saved campaign, restart, undo, pause, return to menu, and next level.
- Complete boards with one, two, and three stars.
- Restoration counter, five-level chamber bar, specimen locked/unlocked labels, and milestone message.
- Daily replay and best-score update.
- Zen new-board loop.
- All three free Garden Hints; rewarded success, cancel, SDK error, API unavailable, and explicit local debug simulation.
- Interstitial trigger after campaign levels 3, 6, and 9 only.

### Input

- Mouse, touch, trackpad, keyboard-only, and screen-reader-assisted keyboard.
- Rapid repeated tile input, resize during rotation/victory animation, and rotate view during hint state.
- Browser back/forward and iframe focus changes must not create duplicate moves.

### Display sizes

At minimum: 1920×1080, 1366×768, 1024×768, 844×390, 390×844, 320×640, and embedded 2:1 / 1:2 extremes. Check coach card, HUD, board, toolbar, completion card, dialogs, readable text, and non-blurry canvas. Dense active-leak markers must remain informative rather than dominate the board.

### SDK Sandbox

- Status indicators for every mandatory lifecycle event.
- Repeat lifecycle validation with artificial SDK delay longer than 1.8 seconds.
- Anonymous local save and authorized remote save.
- Mock-user toggle during separate fresh Sandbox loads.
- Pause/resume controls while timer, renderer, victory sequence, and audio are active.
- Interstitial and rewarded ad success/cancel/error/unavailable states; no reward on failure.
- Leaderboard supported/unsupported states.
- Game display-setting combinations.
- Confirm completion analytics taxonomy and App Insights dimensions with the assigned producer.

### Browser/device matrix

Current Chrome, Edge, Firefox, and Safari desktop; current iOS Safari and Android Chrome; at least one lower-memory mobile device. Validate first interaction under five seconds on a normal mobile network and at least 30 FPS during dense 8×8 play and the victory sequence.

### Reliability and soak

- One-hour continuous play with periodic resize, pause, settings, mode changes, ads, and menu transitions.
- Observe heap, DOM node count, RAF count, event listener count, and audio nodes for unbounded growth.
- Offline launch after static assets are cached; SDK unreachable; delayed SDK; ad error; persistence exception.
- Corrupt, truncated, and oversized save values restore safe defaults without blocking play.

### Playtest metrics

Run at least 10–20 first-time sessions and capture:

- time to first correct rotation and first bloom;
- percentage completing all three guided lessons;
- percentage starting procedural level 4;
- wrong-tile attempts per tutorial level;
- Help opens before first completion;
- second-level and next-day return intent;
- qualitative understanding of Sunwell, active leak, anchored tile, and win condition.

## Release exit criteria

No blocker or critical defects, no reproducible crash, no lifecycle validation failure, no rewarded grant on failure, no data-loss defect, no inaccessible core action, and no supported viewport with clipped gameplay. High-severity defects require producer-approved disposition before submission.
