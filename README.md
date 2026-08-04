# Clockwork Conservatory: Bloom Circuit

**Clockwork Conservatory** is a premium, responsive HTML5 circuit puzzle designed for Arkadium’s adult-casual audience. Rotate brass-and-glass mechanisms, route living aetherlight from the Sunwell, awaken every flower, and seal every powered leak.

![Premium gameplay](artifacts/screenshots/gameplay-level36.png)

## Release candidate 1.1.0

Version 1.1.0 keeps the premium botanical-clockwork presentation while making the game substantially faster, more responsive, more stable, and more alive across phones, tablets, desktop browsers, and embedded game frames.

- adaptive **Auto / High / Balanced** renderer profiles based on memory, CPU, network, pointer type, viewport, DPR, and sustained measured load;
- hard Canvas pixel budgets, capped DPR, bounded effects, and a renderer that fully sleeps on static screens;
- richer glass highlights, living aetherlight travelers, staged power propagation, bloom and leak-seal bursts, impact pulses, plant sway, atmospheric dust, and restoration-driven environmental lighting;
- responsive layouts for 320×568 compact phones, portrait mobile, landscape mobile, tablet, desktop, and narrow Arkadium embeds;
- pointer capture, drag rejection, coalesced hover work, haptics, keyboard navigation, immediate board feedback, and input-safe asynchronous navigation;
- visibility, Page Lifecycle, BFCache, resize, orientation, audio, save-queue, and late-SDK hardening;
- three one-action onboarding levels, deterministic campaign, shared UTC Daily Bloom, and untimed Zen modes;
- restoration map, chamber progression, daily streak, score history, and a five-specimen collection;
- Arkadium SDK lifecycle, storage, ads, analytics, leaderboard, and pause/resume adapter;
- reduced motion, high contrast, six-language UI, live-region announcements, and fail-safe remote integrations;
- deterministic, browser, resize, reduced-motion, interaction-latency, queue-bound, memory-growth, and device-profile release tests.

| Main menu | Restoration map |
|---|---|
| ![Main menu](artifacts/screenshots/menu-desktop.png) | ![Restoration map](artifacts/screenshots/map-desktop.png) |

| Victory | Mobile |
|---|---|
| ![Victory](artifacts/screenshots/victory-desktop.png) | ![Mobile](artifacts/screenshots/gameplay-mobile.png) |

## Run locally

Requirements: Node.js 22+ and a modern browser.

```bash
npm install
npm run dev
```

The preview opens at `http://127.0.0.1:4173`. Add `?standalone=1` to skip the Arkadium SDK connection during local development.

Useful entry points:

```text
?standalone=1&autostart=campaign
?standalone=1&autostart=daily
?standalone=1&autostart=zen
?standalone=1&autostart=map
```

A successful rewarded hint can be simulated only with the explicit local flag:

```text
?standalone=1&debug=1&devReward=1
```

The debug flag also exposes read-only runtime diagnostics through `window.__clockworkDiagnostics()`.

## Quality gates

```bash
npm run check    # strict TypeScript and release-safety checks
npm test         # build plus 828 deterministic gameplay assertions
npm run build    # production output in dist/
npm run smoke    # responsive menu/map/gameplay/victory/accessibility browser matrix
npm run perf     # adaptive quality, canvas, latency, sleep, memory and stress guardrails
npm run release  # complete local release gate
```

The GitHub Actions browser job runs the smoke matrix in Chromium, Firefox, and WebKit and runs the performance suite in Chromium.

Current measured production output:

- initial HTML, CSS, JavaScript, and runtime assets: approximately **605 KiB**;
- complete `dist/`, including source maps and build report: approximately **809 KiB**;
- mobile first-screen runtime resources remain below **300 KiB**;
- production package remains far below Arkadium’s public upload-scale expectations.

Representative local Chromium measurements are recorded in `artifacts/performance-report.json`:

- constrained phone profile: Balanced, DPR 1.5, 740,610 Canvas pixels, about 2.1 ms average draw cost, 37.8 ms input-to-render latency;
- strong phone profile: High, DPR 2, 1,316,640 Canvas pixels, about 1.5 ms average draw cost, 3.7 ms input-to-render latency;
- desktop profile: High, DPR 1, 1,296,000 Canvas pixels, about 1.6 ms average draw cost, 3.9 ms input-to-render latency;
- static mobile menu: zero Canvas frames during the one-second sleep sample;
- 72-cycle low-end mobile stress pass: no DOM growth, negligible measured heap change, no overflow, no browser error, and all renderer queues drained within bounds.

These are automated local guardrails rather than a substitute for Arkadium Sandbox and physical-device QA.

## Controls

- Click or tap a mechanism to rotate it clockwise.
- Arrow keys move selection; `Enter` or `Space` rotates.
- `Z` undo, `H` Garden Hint, `Q`/`E` rotate view, `R` restart, `Esc` pause.

## Architecture

```text
src/
  core/       board analysis, generation, tutorials, scoring, saves, performance profiles
  game/       controller, adaptive premium Canvas renderer, synthesized Web Audio
  platform/   fault-tolerant Arkadium SDK adapter and lifecycle outbox
  ui/         localization with English fallback
public/
  assets/     optimized runtime environmental and specimen art
scripts/      build, checks, deterministic tests, browser matrix, performance guardrails
artifacts/
  concepts/   visual direction references
  screenshots/real browser evidence generated from the implementation
```

The gameplay core has no DOM dependency. Platform APIs are isolated behind `ArkadiumBridge`; a late SDK connection replays mandatory lifecycle events in order. Missing, cancelled, or failed rewarded ads never grant a production reward. The renderer never depends on a remote asset or runtime AI service.

## Publishing path

1. Deploy `dist/` to a stable HTTPS URL or enable the included GitHub Pages workflow.
2. Validate the hosted URL inside the Arkadium Sandbox on desktop, tablet, and physical mobile devices.
3. Ask the assigned producer for the production analytics application ID, final ad cadence, leaderboard configuration, taxonomy, and game slug.
4. Run first-session tests with players who have not seen the game; measure time to first bloom, tutorial completion, level-two start rate, and return intent.
5. Complete physical-device, one-hour soak, throttled-network, and late-SDK testing before live publication.
6. Submit the playable URL through Arkadium’s developer process.

See the [Arkadium checklist](docs/ARKADIUM_CHECKLIST.md), [QA plan](docs/QA_PLAN.md), [performance notes](docs/PERFORMANCE.md), [game design](docs/GAME_DESIGN.md), and [1.1.0 release notes](docs/RELEASE_NOTES_1.1.0.md).
