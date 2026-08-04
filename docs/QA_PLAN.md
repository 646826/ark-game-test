# QA Plan — Clockwork Conservatory 0.3.0

## Automated release gate

Run from a clean checkout:

```bash
npm install
npm run ci
npm run smoke
```

Expected evidence:

- strict TypeScript and safety checks pass;
- 234 generated puzzle cases and all tutorials pass;
- corrupted saves are sanitized;
- build budgets pass;
- desktop/mobile menu, tutorial gameplay, victory, and dense Daily layout screenshots are created;
- mocked `onTestReady`, game start, level start/end, score change, and pause/resume registration pass.

## Functional matrix

- Campaign levels 1–3: guided target, wrong-target rejection, keyboard target, solve, stars, next.
- Generated campaign: rotate, powered flow, plants, leaks, fixed tile rejection, undo, restart, resume.
- Daily: deterministic date seed, replay, best score, streak, leaderboard supported/unsupported.
- Zen: fresh seed, completion, replay, return to menu.
- Hint: three free hints; rewarded success, fail, cancel, missing API, interrupted ad.
- Progress: specimen unlocks at configured levels; score/stars/chamber progress; map locked/current/complete states.
- No-content boundary: verify behavior before shipping a finite authored campaign cap.

## Persistence matrix

- Standalone local first run, reload, corruption recovery, storage quota failure.
- Arena anonymous local storage.
- Arena authenticated remote storage.
- Login transition after local progress exists.
- Slow SDK connection while the player starts a game.
- Page hidden or closed during play and during the victory flourish.
- Confirm serialized value remains below 32 KB and aggregate game save below 500 KB.

## Display matrix

Test without reloading while a level, tutorial, hint, victory, pause, and modal are active.

| Class | Examples |
|---|---|
| Wide landscape | 1920×960, 1440×720, 1024×512 |
| Standard landscape | 1440×900, 1280×800, 1024×768 |
| Square | 900×900, 600×600 |
| Portrait | 430×932, 390×844, 375×812 |
| Extreme portrait | 512×1024, 360×720 |
| Density | DPR 1, 1.25, 1.5, 2, 3 with renderer cap |

Check clipping, readability, 44-pixel-equivalent targets where practical, board hit testing, projection switch, safe areas, state preservation, and animation destinations.

## Browser and device matrix

- Current Chrome and Edge on Windows.
- Current Chrome and Safari on macOS.
- Current Safari on iPhone and iPad.
- Current Chrome on representative low-, mid-, and high-tier Android devices.
- Firefox desktop where supported by the distribution target.
- Mouse, trackpad, touch, coarse pointer, and keyboard-only paths.

## Performance and endurance

- Cold and warm load over realistic broadband and throttled mobile profiles.
- Time to `onTestReady` and first input.
- FPS during large boards, repeated rotations, leak effects, and victory.
- Quality auto/high/balanced/low behavior.
- Memory at 1 minute, 15 minutes, and 60 minutes.
- Fifty sequential level transitions without reload.
- Background/foreground cycles, minimized mobile browser, screen lock, and host pause.
- No accumulating particles, timers, listeners, audio nodes, or lifecycle messages.

## Accessibility and comfort

- Full menu/settings/help/game/completion path by keyboard.
- Visible focus and meaningful button labels.
- Canvas accessible label and live status announcements.
- High contrast without relying only on hue.
- Reduced motion removes camera interpolation, ambient drift, and particle celebration.
- Browser zoom and OS text scaling.
- Screen-reader spot checks in menu, tutorial, controls, settings, pause, and completion.
- No essential instructions embedded only in the background art.

## Content and release

- English editorial pass and native ES/FR/DE/IT review.
- No offensive, trademark-confusing, or external-navigation copy.
- Confirm asset provenance and retention of generation records.
- HTTPS, MIME types, cache headers, source-map policy, rollback, and version display.
- Fresh Arkadium Sandbox page for each candidate URL.
