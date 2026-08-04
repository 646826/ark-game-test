# Arkadium publishing checklist

This document maps release candidate 1.3.0 to public Arkadium expectations and the integration work that must be finalized with an assigned producer.

## Public fit

| Area | Current implementation | Status |
|---|---|---|
| Browser-first game | Standards-based HTML5/TypeScript/Canvas 2D | Pass |
| Desktop, tablet, mobile | Compact phone, portrait, landscape, tablet, desktop, and narrow-embed layouts | Pass locally; physical-device matrix required |
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
| Host/page pause | Host events, visibility, focus, freeze/resume, pagehide/pageshow and BFCache handling | Implemented |
| Save data | Serialized local/remote writes with immutable payload snapshots | Implemented |
| Interstitial ads | Natural campaign break after every third completed level | Implemented; cadence requires producer approval |
| Rewarded ads | Optional hint after three free hints; failure grants nothing | Implemented |
| Analytics | App/menu/level/first-move/win/hint dimensions and error reporting | Implemented; production taxonomy/app ID required |
| Daily leaderboard | Posts only when host capability is available | Implemented; board configuration required |

## Package and performance

| Check | Evidence | Status |
|---|---|---|
| Initial package budget | 2,223,497 bytes (about 2.12 MiB); exact report in `dist/build-report.json` | Pass |
| Complete package budget | 2,494,312 bytes (about 2.38 MiB) including source maps/report | Pass |
| Fast interaction | Local assets, non-blocking SDK, deferred hidden-screen art, menu payload ~738 KiB encoded, no gameplay backend | Pass locally |
| Adaptive rendering | Auto/High/Balanced, capped DPR and pixels, event-driven active/ambient/idle/sleep states | Pass locally |
| Constrained-phone guardrail | Balanced, DPR 1.5, 740,610 pixels, ~5.0 ms average draw cost, 14.2 ms input-to-render under 2× CPU throttle in the latest run | Pass locally |
| Strong-phone guardrail | High, DPR 2, 1,316,640 pixels, ~2.2 ms average draw cost, 4.5 ms input-to-render | Pass locally |
| Static screen efficiency | Mobile menu rendered zero Canvas frames during one-second sleep sample | Pass locally |
| Resize without state loss | Automated portrait/desktop resize preserves active puzzle and moves | Pass locally |
| Queue/resource bounds | 72-cycle stress test drains particles, bursts, transitions, and impacts; no DOM growth | Pass locally |
| Remote service failure | Core gameplay remains available; monetized rewards fail closed | Pass |
| Long-session stability | Bounded queues/timers plus automated stress pass | One-hour physical soak still required |

## Accessibility and localization

| Check | Status |
|---|---|
| Pointer, touch, keyboard | Implemented |
| Visible logical selection | Implemented on the board |
| Reduced motion | Event-driven static rendering with animation queues disabled | Implemented and automated |
| High contrast | Implemented |
| Live region and dynamic announcements | Implemented |
| English, Spanish, French, German, Italian, Russian | Implemented with English fallback; native review required |

## Required before live release

- Validate inside Arkadium Sandbox while authenticated and unauthenticated.
- Replace or confirm the SDK endpoint and analytics application ID supplied by Arkadium.
- Confirm exact analytics taxonomy, score semantics, ad cadence, rewarded messaging, and daily leaderboard.
- Run iPhone Safari, Android Chrome, iPad, low-end Windows laptop, and macOS browser tests.
- Let the published CI workflow complete its Chromium, Firefox, and WebKit browser matrix.
- Complete a one-hour soak, 20-minute mobile thermal/battery session, throttled-network test, and late-SDK test.
- Run native-language review and first-session usability tests.
- Prepare store thumbnail, five screenshots, short description, long description, and rating metadata.
