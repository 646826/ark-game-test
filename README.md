# Clockwork Conservatory

**Clockwork Conservatory: Bloom Circuit** is a production-oriented, responsive HTML5 puzzle game designed for the Arkadium audience and Game SDK. Players rotate clockwork irrigation tiles to restore a living glasshouse, bloom every plant, and eliminate every leak.

![Clockwork Conservatory gameplay](artifacts/game-desktop.png)

## Why this concept fits Arkadium

- Calm, polished adult-casual puzzle play with no violence, inappropriate content, or external account flow.
- Sessions work in short breaks but campaign progression, adaptive difficulty, daily puzzles, and leaderboards support retention.
- Deterministic generation produces effectively unlimited content without a content server.
- Clear natural ad breaks exist after completed levels; rewarded ads are used only after the free AI hints are exhausted.
- Canvas 2D keeps the build exceptionally small and fast while still delivering a dimensional, animated presentation.

## Production features

### Gameplay and AI

- Deterministic, solver-verified procedural puzzle generation.
- A local **AI Garden Director** adapts board size, density, fixed tiles, and pre-solved segments from a compact skill profile.
- A local hint engine evaluates legal rotations and network improvement, with a guaranteed solution-correction fallback.
- Campaign, UTC daily challenge, and untimed Zen modes.
- Scoring, three-star grades, adaptive progression, undo, resume, and deterministic replay.
- No runtime generative-AI service, API key, tracking SDK, or backend dependency. Gameplay remains available offline and when remote services fail.

### Arkadium integration

- Arkadium Game SDK v2 loaded from the official CDN with a non-blocking standalone fallback.
- Lifecycle: `onTestReady`, one `onGameStart` / `onGameEnd` per load, level start/end, score updates, pause/resume callbacks.
- SDK persistence: local storage for all players and remote storage for authorized players.
- Interstitial ads only at natural chapter breaks; rewarded ads for optional hints.
- Standard analytics events, page views, custom puzzle dimensions, and error reporting.
- Daily leaderboard posting when the Arena supports it.
- No external login, redirects, clipboard access, fullscreen toggle, or platform navigation.

### Quality and accessibility

- Responsive from 2:1 landscape through 1:2 portrait without reloading or losing state.
- Pointer, touch, and keyboard controls.
- Dynamic canvas accessibility description and live-region announcements.
- High-contrast and reduced-motion options.
- English plus Spanish, French, German, and Italian UI localization.
- Web Audio is synthesized locally, starts only after user interaction, and suspends when the page is hidden.
- Device-pixel-ratio-aware canvas rendering, capped to protect GPU memory.

## Run locally

Requirements: Node.js 22+ and TypeScript 5.8+.

```bash
npm install
npm run dev
```

Open the printed local preview URL. Add `?standalone=1` to skip the SDK connection while developing.

Useful commands:

```bash
npm run check   # TypeScript and Arkadium integration guardrails
npm test        # Build plus deterministic generator/hint/save/scoring tests
npm run build   # Production output in dist/
npm run smoke   # Optional Playwright visual smoke test and screenshots
npm run ci      # Full non-browser CI gate
```

## Controls

- Click or tap a tile to rotate it clockwise.
- Arrow keys move the selected tile; `Enter` or `Space` rotates it.
- `Z` undo, `H` AI hint, `Q` / `E` rotate the view, `R` restart, `M` sound, `Esc` pause.

## Architecture

```text
src/
  core/       deterministic generator, board analysis, AI hinting, skill model, score, save schema
  game/       controller, Canvas 2D renderer, synthesized audio
  platform/   fault-tolerant Arkadium SDK adapter
  ui/         localization
scripts/      dependency-light build, preview, checks, tests, local visual smoke test
```

The gameplay core has no DOM dependencies, so it is deterministic and testable. Platform APIs are isolated behind `ArkadiumBridge`, and every remote capability has a graceful local fallback.

## Build budget

The build script writes `dist/build-report.json` and fails if Arkadium's package budgets are exceeded. Current measured output in this repository:

- Initial HTML/CSS/JavaScript payload: about **169 KB** uncompressed.
- Total production output including source maps/report: about **318 KB**.
- Typical save: less than **2 KB**; remote values are kept below the SDK's 32 KB limit and far below Arkadium's 500 KB game-save maximum.

## Publishing path

1. Enable GitHub Pages using the included workflow or host `dist/` over HTTPS with correct JavaScript MIME types.
2. Test the public playable URL in the Arkadium Sandbox in desktop, mobile, authenticated, unauthenticated, ad, pause/resume, and display-size configurations.
3. Ask the Arkadium liaison for the production App Insights app ID and place it in the `arkadium-app-insights-id` meta tag in `index.html`. The release build configures the provider only when this value is present.
4. Have Arkadium confirm ad cadence, leaderboard configuration, final analytics taxonomy, game slug, localization review, and submission metadata.
5. Submit the playable URL and portfolio details through Arkadium's developer process.

See [docs/ARKADIUM_CHECKLIST.md](docs/ARKADIUM_CHECKLIST.md), [docs/QA_PLAN.md](docs/QA_PLAN.md), and [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

## Original assets and privacy

All visuals are rendered procedurally in code, all sound is synthesized at runtime, and no third-party art, fonts, music, cookies, trackers, or player-facing AI services are included. See [CREDITS.md](CREDITS.md).
