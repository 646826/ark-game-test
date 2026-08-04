# Arkadium Integration Checklist — 0.3.0

Status meanings:

- **Pass locally** — implementation plus automated/local evidence exists.
- **Needs Sandbox** — requires the Arkadium-hosted Sandbox or producer configuration.
- **Needs manual QA** — cannot be completed credibly by automation alone.

## SDK and integration

| Requirement | Implementation and evidence | Status |
|---|---|---|
| Official Game SDK v2 | Loads the documented CDN SDK and uses `ArkadiumGameSDK.getInstance()` | Pass locally; Needs Sandbox |
| `onTestReady` | Sent after title art, save, settings, and menu are interactive; queued if connection is late | Pass locally; mocked smoke |
| One game start per load | Bridge de-duplicates `onGameStart`; sent when the first mode starts | Pass locally; mocked smoke |
| Score updates | `onChangeScore` sent with completion score before the session concludes | Pass locally; mocked smoke |
| Level lifecycle | `onLevelStart(level)` and `onLevelEnd(level)` preserve order through a bounded outbox | Pass locally; mocked smoke |
| One game end per load | De-duplicated `onGameEnd` on `pagehide` | Pass locally; Needs Sandbox unload check |
| Host pause/resume | Registers `GAME_PAUSE` and `GAME_RESUME`, freezes timer/renderer/audio | Pass locally; mocked callback check; Needs Sandbox |
| Persistence | SDK local storage; authenticated remote storage; local fallback outside Arena | Pass locally; Needs authenticated Sandbox |
| No outside ecosystem | No redirect, external login, clipboard, fullscreen, or external save system | Pass locally |
| Ads | Natural interstitial groups; optional player-triggered rewarded hints; fail-closed rewards | Pass locally; Needs Sandbox |
| Analytics | Standard page/game/round events, custom puzzle dimensions, errors, optional App Insights ID | Implemented; production ID required |
| Leaderboard | Daily score posts only when the service reports support | Implemented; configuration required |

## Technical requirements

| Area | Current evidence | Status |
|---|---|---|
| Standards-compliant web APIs | TypeScript/JavaScript, Canvas 2D, Web Audio, DOM, ResizeObserver | Pass locally |
| Save below 500 KB | Automated assertion; typical value is far below 32 KB | Pass locally |
| Initial below 15 MB | Build report currently about 0.30 MB | Pass locally |
| Total below 100 MB | Build report currently about 0.63 MB including maps and optional art | Pass locally |
| Interaction within 5 seconds | Only title art blocks the ready state; all other scene art is lazy | Pass locally; hosted cold-load measurement needed |
| Smooth gameplay | DPR cap, adaptive profiles, bounded particles, single animation loop | Pass locally; real-device FPS needed |
| One-hour stability | No unbounded gameplay queues; particles and lifecycle outbox bounded | Needs manual one-hour soak |
| Remote failure | Core game, generation, hints, saves fallback, and renderer work without remote services | Pass locally |
| Responsive 2:1 through 1:2 | Automated 1440×900 and 390×844 plus continuous resize architecture | Pass locally; complete matrix required |
| State survives resize | Geometry is renderer-only; puzzle state is independent | Pass locally |
| Clear density-aware visuals | DPR-aware canvas; isometric and dense-portrait compositions | Pass locally |
| Touch, mouse, keyboard | Pointer hit testing, DOM buttons, arrows/Enter and shortcuts | Pass locally; real touch device needed |
| Audio gating and focus | No audio before gesture; suspend on hidden/blur/host pause | Pass locally; mobile browser check needed |
| English | Complete | Pass locally |
| FR/IT/DE/ES | UI tables included | Needs native-speaker review |
| E-for-Everyone content | Nonviolent botanical theme and neutral copy | Pass by design; producer confirms |
| Visible version | Menu footer and build report show 0.3.0 | Pass locally |

## Before submission

- Deploy the exact `dist/` artifact to stable HTTPS.
- Run all Sandbox status indicators and event logs from a refreshed Sandbox page.
- Test anonymous and authenticated persistence, including login transitions.
- Test subscriber/ad-free behavior, interstitial success/failure, rewarded success/failure/cancel.
- Confirm App Insights ID, analytics taxonomy, leaderboard ID, slug, and ad cadence.
- Complete the device/browser/aspect matrix and one-hour soak in `QA_PLAN.md`.
- Obtain native review of non-English strings.
- Review generated-asset provenance and commercial terms with the producer.
