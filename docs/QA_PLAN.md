# Quality-assurance plan

## Automated release gate

Run before every release:

```bash
npm run release
```

The release command executes strict source checks, 828 deterministic assertions, the production build, the browser smoke matrix, and performance/stability guardrails.

The automated coverage includes:

- all three authored tutorials start unsolved and solve in exactly one guided action;
- campaign, Daily Bloom, and Zen generation across levels 4–70;
- deterministic replay from identical seeds;
- valid solved states and available hints;
- board-size bounds;
- save-schema migration, sanitization, and haptics/quality defaults;
- score and star bounds;
- Auto/High/Balanced profile selection, DPR fitting, and sustained-load downgrade logic;
- real browser rendering of menu, settings, map, tutorial, gameplay, victory, portrait, compact phone, landscape, high contrast, reduced motion, and advanced boards;
- active-run preservation through viewport/orientation changes;
- static-menu and Reduced Motion renderer sleep;
- Canvas pixel budgets, draw cost, input-to-render latency, horizontal overflow, DOM growth, measured heap growth, and renderer queue bounds;
- repeated input, undo, view movement, pause/resume, and orientation changes in a 72-cycle low-end stress scenario.

The CI workflow runs the smoke matrix in Chromium, Firefox, and WebKit. Local release evidence depends on the browser engines installed in the development environment.

## Manual functional matrix

Test each mode on desktop and mobile:

1. first launch, loading, menu, help, settings, and Auto/High/Balanced switching;
2. tutorial target enforcement, pointer rotation, drag rejection, keyboard selection, undo, restart;
3. staged energy propagation, active leak, bloom, seal, and powered-path feedback;
4. all three tutorials and transition to generated level four;
5. save, reload, resize, orientation, background/foreground, freeze/resume, BFCache, pause/resume;
6. free hints, rewarded-unavailable path, rewarded-success Sandbox path;
7. victory sequence, score count-up, stars, specimen unlock, next/replay/menu;
8. Daily Bloom replay, best score, streak, and leaderboard state;
9. campaign interstitial at the approved natural break;
10. all supported languages, Reduced Motion, High Contrast, sound, music, and haptics;
11. Data Saver / slow-network Auto quality and sustained-load downgrade behaviour;
12. rapid repeated taps, multitouch cancellation, interrupted navigation, and slow host responses.

## Device matrix

Minimum release devices:

- iPhone Safari: current and one older supported iOS;
- Android Chrome: strong, mid-range, and low-memory device;
- iPad Safari in portrait and landscape;
- Windows Chrome and Edge at 1366×768 and 1920×1080;
- macOS Safari and Chrome;
- 2:1 landscape embed and 1:2 portrait embed;
- emergency 280×320 and compact 320×568 layouts.

## Performance targets

- first interactive screen under five seconds on the agreed throttled connection;
- stable 30 FPS minimum during interaction on supported constrained devices, 60 FPS target on common capable devices;
- input-to-visible-response below 100 ms on common devices and below 200 ms on the supported low-end floor;
- no Canvas allocation above the active profile budget;
- static menu/map and Reduced Motion scenes stop recurring Canvas work;
- no unbounded particle, burst, transition, impact, timer, audio-node, DOM, save, or lifecycle growth;
- no visible resolution loss beyond the deliberate Balanced DPR cap;
- no layout overlap or horizontal overflow at supported embed sizes;
- no reproducible exception, lost save, or stale async transition during a one-hour session;
- acceptable battery and thermal behaviour during a 20-minute mobile session.

## First-session usability study

Use at least 10 players who have not seen the game. Record:

- time to identify the Sunwell;
- time to first successful bloom;
- tutorial completion rate;
- whether players understand red leak markers without verbal explanation;
- level-two and level-four start rate;
- desire to continue restoring the next chamber;
- accidental taps and unreadable labels by device;
- perceived responsiveness and whether visual effects clarify or distract from the puzzle.
