# Arkadium publishing checklist

This document maps the current release candidate to public Arkadium expectations and the integration work that must be finalized with an assigned producer.

## Public fit

| Area | Current implementation | Status |
|---|---|---|
| Browser-first game | Standards-based HTML5/TypeScript/Canvas 2D | Pass |
| Desktop, tablet, mobile | Fluid 2:1 landscape through 1:2 portrait layouts | Pass locally; real-device matrix required |
| Adult-casual fit | Calm nonviolent puzzle, short sessions, readable rules, premium visual tone | Pass by design |
| Easy first session | Three authored, one-action onboarding levels | Pass locally; external playtest required |
| Return motivation | Campaign restoration, chamber map, collection, streak, daily seed, scores | Implemented |
| Playable submission link | GitHub Pages workflow included | Deploy and validate |

## SDK and host integration

| Requirement | Implementation | Status |
|---|---|---|
| Official SDK bootstrap | Non-blocking v2 CDN loader with standalone fallback | Implemented; confirm final URL with producer |
| Ready signal | Queued `onTestReady` after interactive menu | Implemented |
| Game lifecycle | Single game start/end plus level start/end and score changes | Implemented |
| Late SDK connection | Bounded ordered lifecycle outbox | Implemented |
| Host pause/resume | Host events plus visibility and focus handling | Implemented |
| Save data | Local storage plus supported remote SDK storage | Implemented |
| Interstitial ads | Natural campaign break after every third completed level | Implemented; cadence requires producer approval |
| Rewarded ads | Optional hint after three free hints; failure grants nothing | Implemented |
| Analytics | App/menu/level/first-move/win/hint dimensions and error reporting | Implemented; production taxonomy/app ID required |
| Daily leaderboard | Posts only when host capability is available | Implemented; board configuration required |

## Package and performance

| Check | Evidence | Status |
|---|---|---|
| Initial package budget | Approximately 542 KiB; exact report in `dist/build-report.json` | Pass |
| Complete package budget | Approximately 689 KiB including source maps/report | Pass |
| Fast interaction | No runtime art downloads beyond the local package; SDK is non-blocking | Pass locally |
| Smooth rendering | One Canvas loop, capped DPR, balanced quality mode, bounded particles | Pass locally; device profiling required |
| Resize without state loss | Board model is renderer-independent | Pass |
| Remote service failure | Core gameplay remains available; monetized rewards fail closed | Pass |
| Long session stability | Deterministic bounded board size and bounded lifecycle/particle queues | Automated logic pass; one-hour soak required |

## Accessibility and localization

| Check | Status |
|---|---|
| Pointer, touch, keyboard | Implemented |
| Visible logical selection | Implemented on the board |
| Reduced motion | Implemented |
| High contrast | Implemented |
| Live region and dynamic announcements | Implemented |
| English, Spanish, French, German, Italian, Russian | Implemented with English fallback; native review required |

## Required before live release

- Validate inside Arkadium Sandbox while authenticated and unauthenticated.
- Replace/confirm SDK endpoint and analytics application ID supplied by Arkadium.
- Confirm exact analytics taxonomy, score semantics, ad cadence, rewarded messaging, and daily leaderboard.
- Run iPhone Safari, Android Chrome, iPad, low-end Windows laptop, and macOS browser tests.
- Complete a one-hour soak test and throttled-network/late-SDK test.
- Run native-language review and first-session usability tests.
- Prepare store thumbnail, five screenshots, short description, long description, and rating metadata.
