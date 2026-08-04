# Quality-assurance plan

## Automated release gate

Run before every release:

```bash
npm run ci
npm run smoke
```

The current deterministic test suite covers:

- all three authored tutorials start unsolved and solve in exactly one guided action;
- campaign, daily, and Zen generation across levels 4–70;
- deterministic replay from identical seeds;
- valid solved states and available hints;
- board-size bounds;
- save-schema migration and sanitization;
- score and star bounds;
- strict TypeScript and release-safety checks;
- real Chromium rendering of menu, map, gameplay, victory, and portrait layouts.

## Manual functional matrix

Test each mode on desktop and mobile:

1. first launch, loading, menu, help, and settings;
2. tutorial target enforcement, pointer rotation, keyboard selection, undo, restart;
3. active leak and powered path feedback;
4. all three tutorials and transition to generated level four;
5. save, reload, resize, background/foreground, pause/resume;
6. free hints, rewarded-unavailable path, rewarded-success Sandbox path;
7. victory sequence, score, stars, specimen unlock, next/replay/menu;
8. Daily Bloom replay, best score, streak, and leaderboard state;
9. campaign interstitial at the approved natural break;
10. all supported languages, reduced motion, high contrast, sound, and music.

## Device matrix

Minimum release devices:

- iPhone Safari: current and one older supported iOS;
- Android Chrome: mid-range and low-memory device;
- iPad Safari in portrait and landscape;
- Windows Chrome and Edge at 1366×768 and 1920×1080;
- macOS Safari and Chrome;
- 2:1 landscape embed and 1:2 portrait embed.

## Performance targets

- first interactive screen under five seconds on a throttled connection;
- stable 30 FPS minimum, 60 FPS target on common devices;
- no unbounded array, timer, audio-node, or lifecycle growth;
- no visible resolution loss at device-pixel-ratio 1–2;
- no layout overlap at 280×320 minimum emergency viewport;
- no reproducible exception or lost save during a one-hour session.

## First-session usability study

Use at least 10 players who have not seen the game. Record:

- time to identify the Sunwell;
- time to first successful bloom;
- tutorial completion rate;
- whether players understand red leak markers without verbal explanation;
- level-two and level-four start rate;
- desire to continue restoring the next chamber;
- accidental taps and unreadable labels by device.
