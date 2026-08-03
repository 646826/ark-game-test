# Arkadium Integration and Technical Checklist

This checklist maps the current implementation to the public Arkadium Game SDK and technical requirements. Final acceptance still requires testing in Arkadium's Sandbox and review by an Arkadium producer.

## SDK and platform integration

| Requirement | Implementation | Status |
|---|---|---|
| Official Game SDK | Dynamically loads SDK v2 from Arkadium CDN; 1.8 s non-blocking fallback; ordered lifecycle outbox replays after late connection | Implemented |
| Ready signal | Calls `lifecycle.onTestReady()` after menu is interactive; queues it if the SDK is still late | Implemented |
| Game start | Calls `onGameStart()` once on first gameplay start per page load | Implemented |
| Score change | Calls `onChangeScore()` on level completion | Implemented |
| Level lifecycle | Calls `onLevelStart()` and `onLevelEnd()` | Implemented |
| Game end | Calls `onGameEnd()` once when the session page is left | Implemented; validate unload behavior in Sandbox |
| Arena pause/resume | Registers `GAME_PAUSE` and `GAME_RESUME`; freezes timer/render/audio | Implemented |
| Persistence | SDK local storage; remote storage for authorized users; local fallback outside Arena | Implemented |
| Ads | Interstitial at a natural break; player-triggered rewarded hint; missing/cancelled/failed rewarded API grants nothing | Implemented |
| Analytics | Standard events/page views/errors; successful round reason is `Completed`; release provider reads `arkadium-app-insights-id` from HTML | Implemented; production app ID required |
| Leaderboard | Daily score posted only when service is supported | Implemented |
| External ecosystem | No redirect, external login, fullscreen, clipboard, or external save service | Pass |

## Technical requirements

| Area | Implementation / evidence | Status |
|---|---|---|
| Standards-based web game | TypeScript/JavaScript, Canvas 2D, Web Audio, DOM, ResizeObserver | Pass |
| Initial package under 15 MB | Build report measures 202.6 KB uncompressed | Pass |
| Total package under 100 MB | Build report measures 377.1 KB including maps/report | Pass |
| Saved game under 500 KB | Typical save under 2 KB; explicit serialized-size tests | Pass |
| Interaction within 5 seconds | No art/network preload; menu renders from local code; SDK is non-blocking | Pass locally; validate hosted URL |
| Smooth gameplay | One Canvas animation loop; DPR capped at 2; no image decoding or runtime allocation spikes | Pass locally; device matrix required |
| Remote dependency failure | SDK timeout and standalone continuation; gameplay/hints need no remote service | Pass |
| AI latency | Local computation plus visible thinking UI; tested on 100 generated levels; player-facing label is Garden Hint | Pass |
| Responsive 2:1 to 1:2 | CSS/canvas resize continuously; automated desktop, portrait, and 2:1 landscape smoke screenshots | Pass locally |
| State preserved on resize | Board model is independent of renderer geometry | Pass |
| Touch and mouse | Pointer events and large controls | Pass |
| Keyboard | Direction selection, rotate, undo, hint, view, sound, restart, pause | Pass |
| Accessibility | Semantic buttons/dialog, focus handling, live region, canvas narration, contrast/motion options | Partial WCAG AA review still required |
| Audio after interaction | AudioContext unlocks only after pointer interaction | Pass |
| Audio hidden/minimized | Visibility pause suspends audio and restores it on resume | Pass |
| English | Complete | Pass |
| FR/IT/DE/ES | Included | Implemented; native-speaker review required |
| E for Everyone | Botanical nonviolent theme and neutral language | Pass by design; producer determines rating |
| No engine logo/fullscreen | No engine splash or fullscreen API | Pass |
| Public version number | `0.2.0` visible on title screen and in build report | Pass |

## Required before submission

- Deploy `dist/` to a stable HTTPS URL.
- Run the public URL through the Arkadium Sandbox and confirm every lifecycle status indicator, including an artificially delayed SDK load.
- Test authorized and anonymous persistence, remote save migration, leaderboard, ad success/cancel/error, and Arena pause/resume.
- Obtain and configure the Arkadium production App Insights app ID; do not use the console provider in release.
- Confirm interstitial cadence, completion analytics taxonomy, and rewarded-ad behavior with the producer.
- Complete browser/device QA, native localization review, accessibility audit, and at least a one-hour soak test.
- Produce store art, gameplay screenshots/video, instructions, privacy disclosure, and submission copy after the producer confirms required dimensions.
